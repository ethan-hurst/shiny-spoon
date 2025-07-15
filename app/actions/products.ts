'use server'

import { createClient } from '@/lib/supabase/server'
import { productSchema } from '@/lib/validations/product'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export async function createProduct(formData: FormData) {
  const supabase = createClient()
  
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

  // Parse and validate
  const parsed = productSchema.safeParse({
    sku: formData.get('sku'),
    name: formData.get('name'),
    description: formData.get('description'),
    category: formData.get('category'),
    base_price: formData.get('base_price'),
    cost: formData.get('cost'),
    weight: formData.get('weight'),
    image: formData.get('image'),
  })
  
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  
  // Handle image upload if present
  let imageUrl = null
  if (parsed.data.image instanceof File) {
    const fileExt = parsed.data.image.name.split('.').pop()
    const fileName = `${profile.organization_id}/${crypto.randomUUID()}.${fileExt}`
    
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('products')
      .upload(fileName, parsed.data.image)
    
    if (uploadError) {
      return { error: 'Failed to upload image' }
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(fileName)
    
    imageUrl = publicUrl
  }
  
  // Check SKU uniqueness
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('sku', parsed.data.sku)
    .limit(1)
  
  if (existing && existing.length > 0) {
    return { error: 'SKU already exists' }
  }
  
  // Insert product
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      organization_id: profile.organization_id,
      sku: parsed.data.sku,
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      base_price: parsed.data.base_price,
      cost: parsed.data.cost || 0,
      weight: parsed.data.weight || null,
      image_url: imageUrl,
      active: true,
      dimensions: {},
      metadata: {}
    })
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/products')
  return { success: true, data: product }
}

export async function updateProduct(formData: FormData) {
  const supabase = createClient()
  
  const id = formData.get('id') as string
  if (!id) {
    return { error: 'Product ID is required' }
  }

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

  // Check product exists and belongs to org
  const { data: existingProduct } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!existingProduct) {
    return { error: 'Product not found' }
  }

  // Parse and validate (excluding SKU for updates)
  const updateSchema = productSchema.omit({ sku: true })
  const parsed = updateSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    category: formData.get('category'),
    base_price: formData.get('base_price'),
    cost: formData.get('cost'),
    weight: formData.get('weight'),
    image: formData.get('image'),
  })
  
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  
  // Handle image upload if present
  let imageUrl = existingProduct.image_url
  if (parsed.data.image instanceof File) {
    // Delete old image if exists
    if (existingProduct.image_url) {
      const oldPath = existingProduct.image_url.split('/').slice(-2).join('/')
      await supabase.storage.from('products').remove([oldPath])
    }

    const fileExt = parsed.data.image.name.split('.').pop()
    const fileName = `${profile.organization_id}/${crypto.randomUUID()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, parsed.data.image)
    
    if (uploadError) {
      return { error: 'Failed to upload image' }
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(fileName)
    
    imageUrl = publicUrl
  }
  
  // Update product
  const { data: product, error } = await supabase
    .from('products')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      base_price: parsed.data.base_price,
      cost: parsed.data.cost || 0,
      weight: parsed.data.weight || null,
      image_url: imageUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select()
    .single()
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/products')
  revalidatePath(`/dashboard/products/${id}/edit`)
  return { success: true, data: product }
}

export async function deleteProduct(id: string) {
  const supabase = createClient()
  
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

  // Soft delete by setting active to false
  const { error } = await supabase
    .from('products')
    .update({ 
      active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/dashboard/products')
  return { success: true }
}

export async function bulkImportProducts(csvData: string) {
  // TODO: Implement CSV parsing and bulk import
  const supabase = createClient()
  
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

  // Parse CSV and validate all rows
  // Insert all valid rows in a transaction
  
  return { error: 'Bulk import not yet implemented' }
}

export async function exportProducts(filters?: any) {
  // TODO: Implement export with filters
  const supabase = createClient()
  
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

  // Fetch products with filters
  // Convert to CSV format
  // Return CSV data
  
  return { error: 'Export not yet implemented' }
}