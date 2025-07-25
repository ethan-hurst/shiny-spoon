'use server'

import { revalidatePath } from 'next/cache'
import { format } from 'date-fns'
import { parse } from 'papaparse'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  adjustmentSchema,
  bulkUpdateSchema,
  type InventoryExportRow,
} from '@/types/inventory.types'

export async function adjustInventory(formData: FormData) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Organization not found' }
  }

  // Validate input
  const validationResult = adjustmentSchema.safeParse({
    inventory_id: formData.get('inventory_id'),
    new_quantity: parseInt(formData.get('new_quantity') as string),
    reason: formData.get('reason'),
    notes: formData.get('notes') || null,
  })

  if (!validationResult.success) {
    return { error: validationResult.error.flatten() }
  }

  const { inventory_id, new_quantity, reason, notes } = validationResult.data

  // Use admin client for transaction
  const adminSupabase = supabaseAdmin

  try {
    // Start transaction by getting current inventory
    const { data: inventory, error: fetchError } = await adminSupabase
      .from('inventory')
      .select('*, product:products(*)')
      .eq('id', inventory_id)
      .eq('organization_id', profile.organization_id)
      .single()

    if (fetchError || !inventory) {
      return { error: 'Inventory item not found' }
    }

    const currentQuantity = inventory.quantity || 0
    const adjustment = new_quantity - currentQuantity

    // Update inventory quantity
    const { error: updateError } = await adminSupabase
      .from('inventory')
      .update({
        quantity: new_quantity,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', inventory_id)
      .eq('organization_id', profile.organization_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return { error: 'Failed to update inventory' }
    }

    // Log adjustment
    const { error: logError } = await adminSupabase
      .from('inventory_adjustments')
      .insert({
        inventory_id,
        organization_id: profile.organization_id,
        previous_quantity: currentQuantity,
        new_quantity,
        adjustment,
        reason,
        notes: notes || null,
        created_by: user.id,
      })

    if (logError) {
      console.error('Log error:', logError)
      // Try to rollback
      await adminSupabase
        .from('inventory')
        .update({
          quantity: currentQuantity,
          updated_at: inventory.updated_at,
        })
        .eq('id', inventory_id)

      return { error: 'Failed to log adjustment' }
    }

    revalidatePath('/inventory')
    revalidatePath(`/inventory/${inventory_id}/history`)

    return { success: true }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function bulkUpdateInventory(csvData: string) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', successCount: 0, errorCount: 0 }
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Organization not found', successCount: 0, errorCount: 0 }
  }

  // Parse CSV
  const parseResult = parse(csvData, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) =>
      header.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseResult.errors.length > 0) {
    return {
      error: `CSV parsing error: ${parseResult.errors[0]?.message || 'Unknown error'}`,
      successCount: 0,
      errorCount: parseResult.errors.length,
    }
  }

  // Transform and validate data
  const updates = parseResult.data.map((row: any) => ({
    sku: row.sku || row.product_sku,
    warehouse_code: row.warehouse_code || row.warehouse,
    quantity: parseInt(row.quantity) || 0,
    reason: row.reason || 'cycle_count',
  }))

  const validationResult = bulkUpdateSchema.safeParse({ updates })

  if (!validationResult.success) {
    return {
      error: 'Validation failed: ' + (validationResult.error.errors[0]?.message || 'Unknown error'),
      successCount: 0,
      errorCount: updates.length,
    }
  }

  const adminSupabase = supabaseAdmin
  let successCount = 0
  let errorCount = 0
  const errors: string[] = []

  // First, batch fetch all inventory items to avoid N+1 queries
  const skus = validationResult.data.updates.map((u) => u.sku)
  const warehouseCodes = validationResult.data.updates.map(
    (u) => u.warehouse_code
  )

  const { data: inventoryItems, error: fetchError } = await adminSupabase
    .from('inventory')
    .select(
      `
      *,
      product:products!inner(sku),
      warehouse:warehouses!inner(code)
    `
    )
    .eq('organization_id', profile.organization_id)
    .in('product.sku', skus)
    .in('warehouse.code', warehouseCodes)

  if (fetchError) {
    return {
      error: `Failed to fetch inventory items: ${fetchError.message}`,
      successCount: 0,
      errorCount: validationResult.data.updates.length,
    }
  }

  // Create a map for quick lookup
  const inventoryMap = new Map()
  inventoryItems?.forEach((item: any) => {
    const key = `${item.product.sku}-${item.warehouse.code}`
    inventoryMap.set(key, item)
  })

  // Prepare batch updates
  const batchUpdates: any[] = []
  const batchAdjustments: any[] = []

  // Process each update
  for (const update of validationResult.data.updates) {
    try {
      const key = `${update.sku}-${update.warehouse_code}`
      const inventory = inventoryMap.get(key)

      if (!inventory) {
        errors.push(
          `SKU ${update.sku} not found in warehouse ${update.warehouse_code}`
        )
        errorCount++
        continue
      }

      const currentQuantity = inventory.quantity || 0
      const adjustment = update.quantity - currentQuantity

      // Prepare update for batch processing
      batchUpdates.push({
        id: inventory.id,
        quantity: update.quantity,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })

      // Prepare adjustment log for batch processing
      batchAdjustments.push({
        inventory_id: inventory.id,
        organization_id: profile.organization_id,
        previous_quantity: currentQuantity,
        new_quantity: update.quantity,
        adjustment,
        reason: update.reason as any,
        notes: 'Bulk update via CSV',
        created_by: user.id,
      })

      successCount++
    } catch (error) {
      errors.push(`Error processing ${update.sku}: ${error}`)
      errorCount++
    }
  }

  // Execute batch updates using Supabase upsert for better performance
  if (batchUpdates.length > 0) {
    const { error: updateError } = await adminSupabase
      .from('inventory')
      .upsert(batchUpdates, { onConflict: 'id' })

    if (updateError) {
      return {
        error: `Batch update failed: ${updateError.message}`,
        successCount: 0,
        errorCount: batchUpdates.length,
      }
    }

    // Batch insert adjustment logs
    const { error: adjustmentError } = await adminSupabase
      .from('inventory_adjustments')
      .insert(batchAdjustments)

    if (adjustmentError) {
      console.error('Failed to log adjustments:', adjustmentError)
      // Continue anyway as the inventory was updated successfully
    }
  }

  revalidatePath('/inventory')

  return {
    success: true,
    successCount,
    errorCount,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit error messages
  }
}

export async function exportInventory(filters?: {
  warehouse_id?: string
  search?: string
  low_stock_only?: boolean
}) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Organization not found' }
  }

  // Build query
  let query = supabase
    .from('inventory')
    .select(
      `
      *,
      product:products!inner(*),
      warehouse:warehouses!inner(*)
    `
    )
    .eq('organization_id', profile.organization_id)

  // Apply filters
  if (filters?.warehouse_id) {
    query = query.eq('warehouse_id', filters.warehouse_id)
  }

  if (filters?.search) {
    query = query.or(
      `product.name.ilike.%${filters.search}%,product.sku.ilike.%${filters.search}%`
    )
  }

  const { data: inventory, error } = await query

  if (error) {
    return { error: 'Failed to fetch inventory data' }
  }

  // Filter for low stock if needed
  let filteredInventory = inventory || []
  if (filters?.low_stock_only) {
    filteredInventory = filteredInventory.filter((item: any) => {
      const available = (item.quantity || 0) - (item.reserved_quantity || 0)
      return available <= (item.reorder_point || 0)
    })
  }

  // Transform to export format
  const exportData: InventoryExportRow[] = filteredInventory.map((item: any) => ({
    sku: item.product.sku,
    product_name: item.product.name,
    warehouse: item.warehouse.name,
    quantity: item.quantity || 0,
    reserved_quantity: item.reserved_quantity || 0,
    available_quantity: (item.quantity || 0) - (item.reserved_quantity || 0),
    reorder_point: item.reorder_point || 0,
    reorder_quantity: item.reorder_quantity || 0,
    last_updated: format(new Date(item.updated_at), 'yyyy-MM-dd HH:mm:ss'),
  }))

  // Convert to CSV
  const headers = [
    'SKU',
    'Product Name',
    'Warehouse',
    'Quantity',
    'Reserved',
    'Available',
    'Reorder Point',
    'Reorder Quantity',
    'Last Updated',
  ]

  const csvRows = [
    headers.join(','),
    ...exportData.map((row) =>
      [
        `"${row.sku}"`,
        `"${row.product_name}"`,
        `"${row.warehouse}"`,
        row.quantity,
        row.reserved_quantity,
        row.available_quantity,
        row.reorder_point,
        row.reorder_quantity,
        `"${row.last_updated}"`,
      ].join(',')
    ),
  ]

  const csv = csvRows.join('\n')
  const filename = `inventory_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`

  return {
    success: true,
    csv,
    filename,
    rowCount: exportData.length,
  }
}
