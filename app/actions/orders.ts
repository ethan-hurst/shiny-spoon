'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { AuditLogger } from '@/lib/audit/audit-logger'
import { z } from 'zod'
import type { 
  CreateOrderInput, 
  UpdateOrderInput, 
  OrderStatus,
  Order,
  OrderItem
} from '@/types/order.types'

// Validation schemas
const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
})

const createOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive().optional(),
  warehouse_id: z.string().uuid().optional(),
})

const createOrderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  items: z.array(createOrderItemSchema).min(1),
  billing_address: addressSchema.optional(),
  shipping_address: addressSchema.optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

const updateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  notes: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  actual_delivery_date: z.string().optional(),
  billing_address: addressSchema.optional(),
  shipping_address: addressSchema.optional(),
})

/**
 * Generates a unique order number for the organization
 */
async function generateOrderNumber(organizationId: string, supabase: any): Promise<string> {
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('order_number')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const today = new Date()
  const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  
  if (!lastOrder || !lastOrder.order_number.startsWith(datePrefix)) {
    return `${datePrefix}-0001`
  }

  const lastNumber = parseInt(lastOrder.order_number.split('-')[1])
  return `${datePrefix}-${String(lastNumber + 1).padStart(4, '0')}`
}

/**
 * Creates a new order with items
 */
export async function createOrder(input: CreateOrderInput) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  // Validate input
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  try {
    // Begin transaction-like operation
    // First, fetch product details and calculate totals
    const productIds = parsed.data.items.map(item => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, name, description, base_price')
      .in('id', productIds)
      .eq('organization_id', profile.organization_id)

    if (productsError || !products) {
      return { error: 'Failed to fetch product details' }
    }

    // Create a map for quick product lookup
    const productMap = new Map(products.map(p => [p.id, p]))

    // Calculate order totals
    let subtotal = 0
    const orderItems = parsed.data.items.map(item => {
      const product = productMap.get(item.product_id)
      if (!product) {
        throw new Error(`Product ${item.product_id} not found`)
      }

      const unitPrice = item.unit_price || product.base_price
      const totalPrice = unitPrice * item.quantity

      subtotal += totalPrice

      return {
        product_id: item.product_id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        warehouse_id: item.warehouse_id,
        discount_amount: 0,
        tax_amount: 0,
        shipped_quantity: 0,
        metadata: {},
      }
    })

    // Calculate tax (simplified - 10% for now)
    const taxAmount = subtotal * 0.1
    const totalAmount = subtotal + taxAmount

    // Generate order number
    const orderNumber = await generateOrderNumber(profile.organization_id, supabase)

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        organization_id: profile.organization_id,
        order_number: orderNumber,
        customer_id: parsed.data.customer_id,
        status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        shipping_amount: 0,
        discount_amount: 0,
        total_amount: totalAmount,
        billing_address: parsed.data.billing_address,
        shipping_address: parsed.data.shipping_address || parsed.data.billing_address,
        notes: parsed.data.notes,
        metadata: parsed.data.metadata || {},
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (orderError || !order) {
      return { error: orderError?.message || 'Failed to create order' }
    }

    // Create order items
    const itemsToInsert = orderItems.map(item => ({
      ...item,
      order_id: order.id,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback by deleting the order (cascade will delete items)
      await supabase.from('orders').delete().eq('id', order.id)
      return { error: itemsError.message }
    }

    // Update inventory (reserve quantities)
    for (const item of orderItems) {
      if (item.warehouse_id) {
        const { error: inventoryError } = await supabase
          .rpc('update_inventory_reserved', {
            p_product_id: item.product_id,
            p_warehouse_id: item.warehouse_id,
            p_quantity: item.quantity,
            p_operation: 'reserve',
          })

        if (inventoryError) {
          console.error('Failed to update inventory:', inventoryError)
        }
      }
    }

    // Log order creation
    try {
      const auditLogger = new AuditLogger(supabase)
      await auditLogger.log({
        action: 'create',
        entity_type: 'order',
        entity_id: order.id,
        changes: {
          order_number: orderNumber,
          item_count: orderItems.length,
          total_amount: totalAmount,
        },
        metadata: {
          source: 'dashboard',
          customer_id: parsed.data.customer_id,
        },
      })
    } catch (auditError) {
      console.error('Failed to log order creation:', auditError)
    }

    revalidatePath('/dashboard/orders')
    if (parsed.data.customer_id) {
      revalidatePath(`/dashboard/customers/${parsed.data.customer_id}`)
    }

    return { success: true, data: order }
  } catch (error) {
    console.error('Order creation error:', error)
    return { error: error instanceof Error ? error.message : 'Failed to create order' }
  }
}

/**
 * Updates an existing order
 */
export async function updateOrder(orderId: string, input: UpdateOrderInput) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  // Validate input
  const parsed = updateOrderSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Get existing order
  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (fetchError || !existingOrder) {
    return { error: 'Order not found' }
  }

  // Build update object
  const updates: any = {
    ...parsed.data,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  // Update order
  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  // Handle inventory updates based on status changes
  if (parsed.data.status && parsed.data.status !== existingOrder.status) {
    if (parsed.data.status === 'cancelled' && existingOrder.status !== 'cancelled') {
      // Release reserved inventory
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, warehouse_id, quantity')
        .eq('order_id', orderId)

      if (items) {
        for (const item of items) {
          if (item.warehouse_id) {
            await supabase.rpc('update_inventory_reserved', {
              p_product_id: item.product_id,
              p_warehouse_id: item.warehouse_id,
              p_quantity: -item.quantity,
              p_operation: 'release',
            })
          }
        }
      }
    } else if (parsed.data.status === 'shipped' && existingOrder.status !== 'shipped') {
      // Convert reserved to shipped
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, warehouse_id, quantity')
        .eq('order_id', orderId)

      if (items) {
        for (const item of items) {
          if (item.warehouse_id) {
            await supabase.rpc('ship_inventory', {
              p_product_id: item.product_id,
              p_warehouse_id: item.warehouse_id,
              p_quantity: item.quantity,
            })
          }
        }
      }
    }
  }

  // Log order update
  try {
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logUpdate('order', orderId, existingOrder, updatedOrder, {
      source: 'dashboard',
      status_changed: parsed.data.status !== existingOrder.status,
    })
  } catch (auditError) {
    console.error('Failed to log order update:', auditError)
  }

  revalidatePath('/dashboard/orders')
  revalidatePath(`/dashboard/orders/${orderId}`)
  if (existingOrder.customer_id) {
    revalidatePath(`/dashboard/customers/${existingOrder.customer_id}`)
  }

  return { success: true, data: updatedOrder }
}

/**
 * Cancels an order
 */
export async function cancelOrder(orderId: string, reason?: string) {
  return updateOrder(orderId, { 
    status: 'cancelled',
    notes: reason ? `Cancellation reason: ${reason}` : undefined
  })
}

/**
 * Gets order details with items
 */
export async function getOrderDetails(orderId: string) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get order with items and customer info
  const { data: order, error } = await supabase
    .from('order_summary')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { success: true, data: order }
}

/**
 * Lists orders with filters
 */
export async function listOrders(filters?: {
  status?: OrderStatus
  customer_id?: string
  from_date?: string
  to_date?: string
  search?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  // Build query
  let query = supabase
    .from('order_summary')
    .select('*', { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('order_date', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.customer_id) {
    query = query.eq('customer_id', filters.customer_id)
  }

  if (filters?.from_date) {
    query = query.gte('order_date', filters.from_date)
  }

  if (filters?.to_date) {
    query = query.lte('order_date', filters.to_date)
  }

  if (filters?.search) {
    query = query.or(
      `order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%`
    )
  }

  // Apply pagination
  const limit = filters?.limit || 20
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return { error: error.message }
  }

  return { 
    success: true, 
    data: {
      orders: data || [],
      total: count || 0,
      limit,
      offset,
    }
  }
}

/**
 * Exports orders to CSV
 */
export async function exportOrders(filters?: {
  status?: OrderStatus
  customer_id?: string
  from_date?: string
  to_date?: string
}) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get orders without pagination
  const result = await listOrders({ ...filters, limit: 10000, offset: 0 })
  
  if (!result.success || !result.data) {
    return { error: result.error || 'Failed to fetch orders' }
  }

  // Dynamic import papaparse
  const Papa = await import('papaparse').then((mod) => mod.default)

  // Flatten data for CSV
  const csvData = result.data.orders.map((order: any) => ({
    'Order Number': order.order_number,
    'Date': new Date(order.order_date).toLocaleDateString(),
    'Customer': order.customer_name || 'Guest',
    'Email': order.customer_email || '',
    'Status': order.status.charAt(0).toUpperCase() + order.status.slice(1),
    'Items': order.item_count,
    'Subtotal': order.subtotal,
    'Tax': order.tax_amount,
    'Shipping': order.shipping_amount,
    'Discount': order.discount_amount,
    'Total': order.total_amount,
    'Notes': order.notes || '',
  }))

  // Generate CSV
  const csv = Papa.unparse(csvData, {
    header: true,
    delimiter: ',',
  })

  // Log export
  try {
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.log({
      action: 'export',
      entity_type: 'orders',
      entity_id: null,
      changes: {
        count: result.data.orders.length,
        filters: filters || {},
      },
      metadata: {
        source: 'dashboard',
        format: 'csv',
      },
    })
  } catch (auditError) {
    console.error('Failed to log export:', auditError)
  }

  return {
    success: true,
    data: {
      csv,
      filename: `orders_export_${new Date().toISOString().split('T')[0]}.csv`,
      count: result.data.orders.length,
    },
  }
}