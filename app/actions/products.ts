'use server'

import { revalidatePath } from 'next/cache'
import { AuditLogger } from '@/lib/audit/audit-logger'
import { createClient } from '@/lib/supabase/server'
import { isFile } from '@/lib/utils/file'
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

/**
 * Creates a new product for the authenticated user's organization, including optional image upload and SKU uniqueness validation.
 *
 * Parses and validates product data from the provided form, uploads an image if present, ensures the SKU is unique within the organization, and inserts the new product into the database. Returns the created product data on success or an error message on failure.
 *
 * @param formData - The form data containing product details and an optional image file
 * @returns An object with either `{ success: true, data: product }` on success or `{ error: message }` on failure
 */
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
  if (isFile(parsed.data.image)) {
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

  // Log product creation
  try {
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logCreate('product', product, {
      source: 'dashboard',
      has_image: !!imageUrl,
    })
  } catch (auditError) {
    // Log audit error but don't fail the operation
    console.error('Failed to log product creation:', auditError)
  }

  revalidatePath('/dashboard/products')
  return { success: true, data: product }
}

/**
 * Updates an existing product's details and image for the authenticated user's organization.
 *
 * Validates input data, ensures the product exists and belongs to the user's organization, and handles optional image replacement. If a new image is provided, the previous image is deleted before uploading the new one. Returns the updated product data on success or an error message on failure.
 */
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
  if (isFile(parsed.data.image)) {
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

  // Log product update
  try {
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logUpdate('product', id, existingProduct, product, {
      source: 'dashboard',
      image_changed: existingProduct.image_url !== imageUrl,
    })
  } catch (auditError) {
    // Log audit error but don't fail the operation
    console.error('Failed to log product update:', auditError)
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

export async function bulkImportProducts(csvData: string) {
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

  // Dynamic import papaparse for server-side CSV parsing
  const Papa = await import('papaparse').then((mod) => mod.default)

  // Parse CSV
  const parseResult = Papa.parse<{
    sku: string
    name: string
    description?: string
    category?: string
    base_price: string
    cost?: string
    weight?: string
  }>(csvData, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) =>
      header.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseResult.errors.length > 0) {
    const errorMessages = parseResult.errors
      .map((err) => `Row ${err.row}: ${err.message}`)
      .join(', ')
    return { error: `CSV parsing errors: ${errorMessages}` }
  }

  const products = parseResult.data
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as { row: number; error: string }[],
    skuDuplicates: [] as string[],
  }

  // Get existing SKUs to check for duplicates
  const skus = products.map((p) => p.sku).filter(Boolean)
  const { data: existingProducts } = await supabase
    .from('products')
    .select('sku')
    .eq('organization_id', profile.organization_id)
    .in('sku', skus)

  const existingSkus = new Set(existingProducts?.map((p) => p.sku) || [])

  // Validate and prepare products for insertion
  const validProducts = []
  for (let i = 0; i < products.length; i++) {
    const row = products[i]
    const rowNumber = i + 2 // Account for header row

    // Skip empty rows
    if (!row.sku || !row.name) {
      results.errors.push({
        row: rowNumber,
        error: 'SKU and name are required',
      })
      results.failed++
      continue
    }

    // Check for duplicate SKUs
    if (existingSkus.has(row.sku)) {
      results.skuDuplicates.push(row.sku)
      results.errors.push({
        row: rowNumber,
        error: `SKU "${row.sku}" already exists`,
      })
      results.failed++
      continue
    }

    // Validate and parse numeric fields
    const basePrice = parseFloat(row.base_price)
    if (isNaN(basePrice) || basePrice < 0) {
      results.errors.push({
        row: rowNumber,
        error: 'Invalid base price',
      })
      results.failed++
      continue
    }

    const cost = row.cost ? parseFloat(row.cost) : 0
    if (isNaN(cost) || cost < 0) {
      results.errors.push({
        row: rowNumber,
        error: 'Invalid cost',
      })
      results.failed++
      continue
    }

    const weight = row.weight ? parseFloat(row.weight) : null
    if (row.weight && (isNaN(weight!) || weight! < 0)) {
      results.errors.push({
        row: rowNumber,
        error: 'Invalid weight',
      })
      results.failed++
      continue
    }

    validProducts.push({
      organization_id: profile.organization_id,
      sku: row.sku.trim(),
      name: row.name.trim(),
      description: row.description?.trim() || null,
      category: row.category?.trim() || null,
      base_price: basePrice,
      cost: cost,
      weight: weight,
      active: true,
      dimensions: {},
      metadata: {},
    })

    // Add to existing SKUs to prevent duplicates within the same import
    existingSkus.add(row.sku)
  }

  // Insert valid products in batches
  if (validProducts.length > 0) {
    const batchSize = 100
    for (let i = 0; i < validProducts.length; i += batchSize) {
      const batch = validProducts.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('products')
        .insert(batch)

      if (insertError) {
        // If batch fails, try inserting one by one to identify specific failures
        for (const product of batch) {
          const { error: singleError } = await supabase
            .from('products')
            .insert(product)

          if (singleError) {
            results.errors.push({
              row: products.findIndex((p) => p.sku === product.sku) + 2,
              error: singleError.message,
            })
            results.failed++
          } else {
            results.successful++
          }
        }
      } else {
        results.successful += batch.length
      }
    }
  }

  // Log bulk import
  try {
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.log({
      action: 'bulk_import',
      entity_type: 'products',
      entity_id: null,
      changes: {
        total_rows: products.length,
        successful: results.successful,
        failed: results.failed,
      },
      metadata: {
        source: 'csv_import',
        errors_sample: results.errors.slice(0, 5),
      },
    })
  } catch (auditError) {
    console.error('Failed to log bulk import:', auditError)
  }

  revalidatePath('/dashboard/products')

  return {
    success: true,
    data: results,
  }
}

export async function duplicateProduct(productId: string, newSku?: string) {
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

  // Get the product to duplicate
  const { data: originalProduct, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (fetchError || !originalProduct) {
    return { error: 'Product not found' }
  }

  // Generate new SKU if not provided
  const duplicateSku = newSku || `${originalProduct.sku}-COPY-${Date.now()}`

  // Check SKU uniqueness
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('sku', duplicateSku)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'SKU already exists. Please provide a unique SKU.' }
  }

  // Create duplicate product
  const { data: newProduct, error: insertError } = await supabase
    .from('products')
    .insert({
      organization_id: profile.organization_id,
      sku: duplicateSku,
      name: `${originalProduct.name} (Copy)`,
      description: originalProduct.description,
      category: originalProduct.category,
      base_price: originalProduct.base_price,
      cost: originalProduct.cost,
      weight: originalProduct.weight,
      image_url: originalProduct.image_url, // Note: This shares the same image
      active: originalProduct.active,
      dimensions: originalProduct.dimensions || {},
      metadata: {
        ...originalProduct.metadata,
        duplicated_from: productId,
        duplicated_at: new Date().toISOString(),
      },
    })
    .select()
    .single()

  if (insertError) {
    return { error: insertError.message }
  }

  // Log product duplication
  try {
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.log({
      action: 'duplicate',
      entity_type: 'product',
      entity_id: newProduct.id,
      changes: {
        duplicated_from: productId,
        original_sku: originalProduct.sku,
        new_sku: duplicateSku,
      },
      metadata: {
        source: 'dashboard',
      },
    })
  } catch (auditError) {
    console.error('Failed to log product duplication:', auditError)
  }

  revalidatePath('/dashboard/products')
  return { success: true, data: newProduct }
}

export async function exportProducts(filters?: ProductFilters) {
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

  // Build query with filters
  let query = supabase
    .from('products')
    .select(
      `
      *,
      inventory!inner(
        quantity,
        reserved_quantity,
        warehouse_id,
        warehouses!inner(name)
      )
    `
    )
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active)
  }

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    )
  }

  if (filters?.minPrice !== undefined) {
    query = query.gte('base_price', filters.minPrice)
  }

  if (filters?.maxPrice !== undefined) {
    query = query.lte('base_price', filters.maxPrice)
  }

  if (filters?.warehouse) {
    query = query.eq('inventory.warehouse_id', filters.warehouse)
  }

  // Execute query
  const { data: products, error } = await query

  if (error) {
    return { error: error.message }
  }

  if (!products || products.length === 0) {
    return { error: 'No products found to export' }
  }

  // Dynamic import papaparse for CSV generation
  const Papa = await import('papaparse').then((mod) => mod.default)

  // Flatten data for CSV export
  const csvData = products.map((product) => {
    // Aggregate inventory data
    const totalQuantity =
      product.inventory?.reduce(
        (sum: number, inv: any) => sum + (inv.quantity || 0),
        0
      ) || 0

    const totalReserved =
      product.inventory?.reduce(
        (sum: number, inv: any) => sum + (inv.reserved_quantity || 0),
        0
      ) || 0

    const warehouses =
      product.inventory
        ?.map((inv: any) => inv.warehouses?.name)
        .filter(Boolean)
        .join(', ') || ''

    return {
      SKU: product.sku,
      Name: product.name,
      Description: product.description || '',
      Category: product.category || '',
      'Base Price': product.base_price,
      Cost: product.cost || 0,
      Weight: product.weight || '',
      'Total Quantity': totalQuantity,
      'Reserved Quantity': totalReserved,
      'Available Quantity': totalQuantity - totalReserved,
      Warehouses: warehouses,
      Status: product.active ? 'Active' : 'Inactive',
      'Created Date': new Date(product.created_at).toLocaleDateString(),
      'Last Updated': new Date(product.updated_at).toLocaleDateString(),
    }
  })

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
      entity_type: 'products',
      entity_id: null,
      changes: {
        count: products.length,
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

  // Return CSV data with appropriate headers
  return {
    success: true,
    data: {
      csv,
      filename: `products_export_${new Date().toISOString().split('T')[0]}.csv`,
      count: products.length,
    },
  }
}
