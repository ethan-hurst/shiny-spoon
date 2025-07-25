'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { warehouseSchema } from '@/lib/validations/warehouse'

/**
 * Authenticates the current user and retrieves their organization ID and user ID.
 *
 * @returns An object containing the Supabase client, the user's organization ID, and user ID.
 * @throws If the user is not authenticated or their profile is not found.
 */
async function getAuthenticatedOrgId() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get user's organization - Using explicit query building to bypass strict typing
  const result = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (result.error || !result.data) throw new Error('User profile not found')

  return {
    supabase,
    organizationId: (result.data as any).organization_id as string,
    userId: user.id,
  }
}

// Helper function to safely parse JSON
function safeJsonParse(jsonString: string, fieldName: string) {
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    throw new Error(`Invalid ${fieldName} format`)
  }
}

export async function createWarehouse(formData: FormData) {
  const { supabase, organizationId } = await getAuthenticatedOrgId()

  // Parse and validate with error handling
  let addressData, contactsData
  try {
    addressData = safeJsonParse(formData.get('address') as string, 'address')
    contactsData = safeJsonParse(formData.get('contacts') as string, 'contacts')
  } catch (error) {
    return { error: (error as Error).message }
  }

  const parsed = warehouseSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
    address: addressData,
    contacts: contactsData,
    is_default: formData.get('is_default') === 'true',
    active: formData.get('active') !== 'false',
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Check code uniqueness
  const existingResult = await supabase
    .from('warehouses')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('code', parsed.data.code)
    .limit(1)

  if (existingResult.data && existingResult.data.length > 0) {
    return { error: 'Warehouse code already exists' }
  }

  // If setting as default, unset current default first
  if (parsed.data.is_default) {
    await supabase
      .from('warehouses')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true)
  }

  // Insert warehouse
  const insertResult = await supabase
    .from('warehouses')
    .insert({
      organization_id: organizationId,
      name: parsed.data.name,
      code: parsed.data.code,
      address: parsed.data.address,
      contact: parsed.data.contacts,
      is_default: parsed.data.is_default,
      active: parsed.data.active,
    })
    .select()
    .single()

  if (insertResult.error) {
    return { error: insertResult.error.message }
  }

  revalidatePath('/dashboard/warehouses')
  redirect('/dashboard/warehouses')
}

export async function updateWarehouse(id: string, formData: FormData) {
  const { supabase, organizationId } = await getAuthenticatedOrgId()

  // Check warehouse ownership
  const warehouseResult = await supabase
    .from('warehouses')
    .select('organization_id, is_default')
    .eq('id', id)
    .single()

  if (warehouseResult.error || !warehouseResult.data) {
    throw new Error('Warehouse not found')
  }

  const warehouse = warehouseResult.data as {
    organization_id: string
    is_default: boolean
  }

  if (warehouse.organization_id !== organizationId) {
    throw new Error('Warehouse not found')
  }

  // Parse and validate with error handling
  let addressData, contactsData
  try {
    addressData = safeJsonParse(formData.get('address') as string, 'address')
    contactsData = safeJsonParse(formData.get('contacts') as string, 'contacts')
  } catch (error) {
    return { error: (error as Error).message }
  }

  // Parse and validate (exclude code since it can't be changed)
  const parsed = warehouseSchema.omit({ code: true }).safeParse({
    name: formData.get('name'),
    address: addressData,
    contacts: contactsData,
    is_default: formData.get('is_default') === 'true',
    active: formData.get('active') !== 'false',
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Prevent deactivating default warehouse
  if (warehouse.is_default && !parsed.data.active) {
    return { error: 'Cannot deactivate the default warehouse' }
  }

  // If setting as default, unset current default first
  if (parsed.data.is_default && !warehouse.is_default) {
    await supabase
      .from('warehouses')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true)
  }

  // Update warehouse
  const updateResult = await supabase
    .from('warehouses')
    .update({
      name: parsed.data.name,
      address: parsed.data.address,
      contact: parsed.data.contacts,
      is_default: parsed.data.is_default,
      active: parsed.data.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateResult.error) {
    return { error: updateResult.error.message }
  }

  revalidatePath('/dashboard/warehouses')
  redirect('/dashboard/warehouses')
}

export async function deleteWarehouse(id: string) {
  const { supabase, organizationId } = await getAuthenticatedOrgId()

  // Check warehouse ownership and status
  const warehouseResult = await supabase
    .from('warehouses')
    .select('organization_id, is_default')
    .eq('id', id)
    .single()

  if (warehouseResult.error || !warehouseResult.data) {
    return { error: 'Warehouse not found' }
  }

  const warehouse = warehouseResult.data as {
    organization_id: string
    is_default: boolean
  }

  if (warehouse.organization_id !== organizationId) {
    return { error: 'Warehouse not found' }
  }

  if (warehouse.is_default) {
    return { error: 'Cannot delete the default warehouse' }
  }

  // Check for inventory
  const inventoryResult = await supabase
    .from('inventory')
    .select('id')
    .eq('warehouse_id', id)
    .limit(1)

  if (inventoryResult.data && inventoryResult.data.length > 0) {
    return { error: 'Cannot delete warehouse with inventory' }
  }

  // Soft delete
  const deleteResult = await supabase
    .from('warehouses')
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (deleteResult.error) {
    return { error: deleteResult.error.message }
  }

  revalidatePath('/dashboard/warehouses')
  return { success: true }
}

export async function setDefaultWarehouse(id: string) {
  const { supabase, organizationId } = await getAuthenticatedOrgId()

  // Check warehouse is active and belongs to org
  const warehouseResult = await supabase
    .from('warehouses')
    .select('active, organization_id')
    .eq('id', id)
    .single()

  if (warehouseResult.error || !warehouseResult.data) {
    return { error: 'Warehouse not found' }
  }

  const warehouse = warehouseResult.data as {
    active: boolean
    organization_id: string
  }

  if (warehouse.organization_id !== organizationId) {
    return { error: 'Warehouse not found' }
  }

  if (!warehouse.active) {
    return { error: 'Cannot set inactive warehouse as default' }
  }

  // Unset current default first
  await supabase
    .from('warehouses')
    .update({ is_default: false })
    .eq('organization_id', organizationId)
    .eq('is_default', true)

  // Set new default
  const updateResult = await supabase
    .from('warehouses')
    .update({ is_default: true })
    .eq('id', id)

  if (updateResult.error) {
    return { error: updateResult.error.message }
  }

  revalidatePath('/dashboard/warehouses')
  return { success: true }
}

export async function toggleWarehouseStatus(id: string) {
  const { supabase, organizationId } = await getAuthenticatedOrgId()

  // Check warehouse
  const warehouseResult = await supabase
    .from('warehouses')
    .select('active, is_default, organization_id')
    .eq('id', id)
    .single()

  if (warehouseResult.error || !warehouseResult.data) {
    return { error: 'Warehouse not found' }
  }

  const warehouse = warehouseResult.data as {
    active: boolean
    is_default: boolean
    organization_id: string
  }

  if (warehouse.organization_id !== organizationId) {
    return { error: 'Warehouse not found' }
  }

  // Prevent deactivating default warehouse
  if (warehouse.is_default && warehouse.active) {
    return { error: 'Cannot deactivate the default warehouse' }
  }

  // Toggle status
  const toggleResult = await supabase
    .from('warehouses')
    .update({
      active: !warehouse.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (toggleResult.error) {
    return { error: toggleResult.error.message }
  }

  revalidatePath('/dashboard/warehouses')
  return { success: true }
}

// Typed warehouse actions that accept objects instead of FormData
export async function createWarehouseTyped(data: {
  name: string
  code: string
  address: any
  contacts: any[]
  is_default: boolean
  active: boolean
}) {
  const { supabase, organizationId } = await getAuthenticatedOrgId()

  const parsed = warehouseSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Check code uniqueness
  const existingResult = await supabase
    .from('warehouses')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('code', parsed.data.code)
    .limit(1)

  if (existingResult.data && existingResult.data.length > 0) {
    return { error: 'Warehouse code already exists' }
  }

  // If setting as default, unset current default first
  if (parsed.data.is_default) {
    await supabase
      .from('warehouses')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true)
  }

  // Insert warehouse
  const insertResult = await supabase
    .from('warehouses')
    .insert({
      organization_id: organizationId,
      name: parsed.data.name,
      code: parsed.data.code,
      address: parsed.data.address,
      contact: parsed.data.contacts,
      is_default: parsed.data.is_default,
      active: parsed.data.active,
    })
    .select()
    .single()

  if (insertResult.error) {
    return { error: insertResult.error.message }
  }

  revalidatePath('/dashboard/warehouses')
  redirect('/dashboard/warehouses')
}

export async function updateWarehouseTyped(
  id: string,
  data: {
    name: string
    address: any
    contacts: any[]
    is_default: boolean
    active: boolean
  }
) {
  const { supabase, organizationId } = await getAuthenticatedOrgId()

  // Check warehouse ownership
  const warehouseResult = await supabase
    .from('warehouses')
    .select('organization_id, is_default')
    .eq('id', id)
    .single()

  if (warehouseResult.error || !warehouseResult.data) {
    throw new Error('Warehouse not found')
  }

  const warehouse = warehouseResult.data as {
    organization_id: string
    is_default: boolean
  }

  if (warehouse.organization_id !== organizationId) {
    throw new Error('Warehouse not found')
  }

  // Parse and validate (exclude code since it can't be changed)
  const parsed = warehouseSchema.omit({ code: true }).safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Prevent deactivating default warehouse
  if (warehouse.is_default && !parsed.data.active) {
    return { error: 'Cannot deactivate the default warehouse' }
  }

  // If setting as default, unset current default first
  if (parsed.data.is_default && !warehouse.is_default) {
    await supabase
      .from('warehouses')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true)
  }

  // Update warehouse
  const updateResult = await supabase
    .from('warehouses')
    .update({
      name: parsed.data.name,
      address: parsed.data.address,
      contact: parsed.data.contacts,
      is_default: parsed.data.is_default,
      active: parsed.data.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateResult.error) {
    return { error: updateResult.error.message }
  }

  revalidatePath('/dashboard/warehouses')
  redirect('/dashboard/warehouses')
}
