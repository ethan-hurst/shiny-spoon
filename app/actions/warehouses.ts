'use server'

import { createClient } from '@/lib/supabase/server'
import { warehouseSchema } from '@/lib/validations/warehouse'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createWarehouse(formData: FormData) {
  const supabase = createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
  
  if (!profile) throw new Error('User profile not found')

  // Parse and validate
  const parsed = warehouseSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
    address: JSON.parse(formData.get('address') as string),
    contacts: JSON.parse(formData.get('contacts') as string),
    is_default: formData.get('is_default') === 'true',
    active: formData.get('active') !== 'false',
  })
  
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  
  // Check code uniqueness
  const { data: existing } = await supabase
    .from('warehouses')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('code', parsed.data.code)
    .limit(1)
  
  if (existing && existing.length > 0) {
    return { error: 'Warehouse code already exists' }
  }
  
  // If setting as default, unset current default
  if (parsed.data.is_default) {
    await supabase
      .from('warehouses')
      .update({ is_default: false })
      .eq('organization_id', profile.organization_id)
      .eq('is_default', true)
  }
  
  // Insert warehouse
  const { data: warehouse, error } = await supabase
    .from('warehouses')
    .insert({
      organization_id: profile.organization_id,
      name: parsed.data.name,
      code: parsed.data.code,
      address: parsed.data.address,
      contact: parsed.data.contacts,
      is_default: parsed.data.is_default,
      active: parsed.data.active,
    })
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/warehouses')
  redirect('/warehouses')
}

export async function updateWarehouse(id: string, formData: FormData) {
  const supabase = createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
  
  if (!profile) throw new Error('User profile not found')

  // Check warehouse ownership
  const { data: existingWarehouse } = await supabase
    .from('warehouses')
    .select('organization_id, is_default')
    .eq('id', id)
    .single()
    
  if (!existingWarehouse || existingWarehouse.organization_id !== profile.organization_id) {
    throw new Error('Warehouse not found')
  }

  // Parse and validate (exclude code since it can't be changed)
  const parsed = warehouseSchema.omit({ code: true }).safeParse({
    name: formData.get('name'),
    address: JSON.parse(formData.get('address') as string),
    contacts: JSON.parse(formData.get('contacts') as string),
    is_default: formData.get('is_default') === 'true',
    active: formData.get('active') !== 'false',
  })
  
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  
  // Prevent deactivating default warehouse
  if (existingWarehouse.is_default && !parsed.data.active) {
    return { error: 'Cannot deactivate the default warehouse' }
  }
  
  // If setting as default, unset current default
  if (parsed.data.is_default && !existingWarehouse.is_default) {
    await supabase
      .from('warehouses')
      .update({ is_default: false })
      .eq('organization_id', profile.organization_id)
      .eq('is_default', true)
  }
  
  // Update warehouse
  const { error } = await supabase
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
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/warehouses')
  redirect('/warehouses')
}

export async function deleteWarehouse(id: string) {
  const supabase = createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
  
  if (!profile) throw new Error('User profile not found')

  // Check warehouse ownership and status
  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('organization_id, is_default')
    .eq('id', id)
    .single()
    
  if (!warehouse || warehouse.organization_id !== profile.organization_id) {
    return { error: 'Warehouse not found' }
  }
  
  if (warehouse.is_default) {
    return { error: 'Cannot delete the default warehouse' }
  }
  
  // Check for inventory
  const { data: inventory } = await supabase
    .from('inventory')
    .select('id')
    .eq('warehouse_id', id)
    .limit(1)
  
  if (inventory && inventory.length > 0) {
    return { error: 'Cannot delete warehouse with inventory' }
  }
  
  // Soft delete
  const { error } = await supabase
    .from('warehouses')
    .update({ 
      active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/warehouses')
  return { success: true }
}

export async function setDefaultWarehouse(id: string) {
  const supabase = createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
  
  if (!profile) throw new Error('User profile not found')
  
  // Check warehouse is active and belongs to org
  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('active, organization_id')
    .eq('id', id)
    .single()
    
  if (!warehouse || warehouse.organization_id !== profile.organization_id) {
    return { error: 'Warehouse not found' }
  }
  
  if (!warehouse.active) {
    return { error: 'Cannot set inactive warehouse as default' }
  }
  
  // Unset current default
  await supabase
    .from('warehouses')
    .update({ is_default: false })
    .eq('organization_id', profile.organization_id)
    .eq('is_default', true)
  
  // Set new default
  const { error } = await supabase
    .from('warehouses')
    .update({ is_default: true })
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/warehouses')
  return { success: true }
}

export async function toggleWarehouseStatus(id: string) {
  const supabase = createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
  
  if (!profile) throw new Error('User profile not found')
  
  // Check warehouse
  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('active, is_default, organization_id')
    .eq('id', id)
    .single()
    
  if (!warehouse || warehouse.organization_id !== profile.organization_id) {
    return { error: 'Warehouse not found' }
  }
  
  // Prevent deactivating default warehouse
  if (warehouse.is_default && warehouse.active) {
    return { error: 'Cannot deactivate the default warehouse' }
  }
  
  // Toggle status
  const { error } = await supabase
    .from('warehouses')
    .update({ 
      active: !warehouse.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/warehouses')
  return { success: true }
}