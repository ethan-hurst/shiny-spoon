'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { productSchema } from '@/lib/validations/product'

// Image upload configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

// Types for product operations
interface ProductFilters {
  category?: string
  active?: boolean
  search?: string
  minPrice?: number
  maxPrice?: number
  warehouse?: string
  lowStock?: boolean
}

// Helper function to validate and upload image
async function validateAndUploadImage(
  file: File,
  organizationId: string,
  supabase: any
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'Image file size must be less than 5MB' }
  }

  // Validate MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      success: false,
      error: 'Only JPEG, PNG, and WebP image formats are allowed',
    }
  }

  // Safely extract file extension
  const nameParts = file.name.split('.')
  let fileExt = 'jpg' // default extension

  if (nameParts.length > 1) {
    const ext = nameParts.pop()?.toLowerCase()
    if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
      fileExt = ext
    }
  }

  // Generate safe UUID (fallback for environments without crypto.randomUUID)
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }
    )
  }

  const fileName = `${organizationId}/${generateUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('products')
    .upload(fileName, file)

  if (uploadError) {
    console.error('Image upload error:', uploadError)
    return {
      success: false,
      error: 'Failed to upload image. Please try again.',
    }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('products').getPublicUrl(fileName)

  return { success: true, imageUrl: publicUrl }
}

// Helper function to safely delete image
async function deleteImage(imageUrl: string, supabase: any): Promise<void> {
  try {
    // More robust URL parsing to extract storage path
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split('/')

    // Extract the storage path (typically the last two parts: orgId/fileName)
    const storagePathIndex = pathParts.findIndex((part) => part === 'products')
    if (storagePathIndex !== -1 && storagePathIndex < pathParts.length - 1) {
      const storagePath = pathParts.slice(storagePathIndex + 1).join('/')
      const { error } = await supabase.storage
        .from('products')
        .remove([storagePath])

      if (error) {
        console.error('Error deleting image:', error)
      }
    }
  } catch (error) {
    console.error('Error parsing image URL for deletion:', error)
  }
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    const uploadResult = await validateAndUploadImage(
      parsed.data.image,
      profile.organization_id,
      supabase
    )

    if (!uploadResult.success) {
      return { error: uploadResult.error }
    }

    imageUrl = uploadResult.imageUrl
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
      metadata: {},
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
  const supabase = await createClient()

  const id = formData.get('id') as string
  if (!id) {
    return { error: 'Product ID is required' }
  }

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
      await deleteImage(existingProduct.image_url, supabase)
    }

    const uploadResult = await validateAndUploadImage(
      parsed.data.image,
      profile.organization_id,
      supabase
    )

    if (!uploadResult.success) {
      return { error: uploadResult.error }
    }

    imageUrl = uploadResult.imageUrl
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
      updated_at: new Date().toISOString(),
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
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/products')
  return { success: true }
}

export async function bulkImportProducts(_csvData: string) {
  // TODO: Implement CSV parsing and bulk import
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

export async function exportProducts(_filters?: ProductFilters) {
  // TODO: Implement export with filters
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
