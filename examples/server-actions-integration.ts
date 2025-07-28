/**
 * Example server actions refactored to use ProductService
 * This demonstrates the integration pattern for existing code
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createProductService } from '@/lib/services/product.service'
import type { CreateProductInput, UpdateProductInput } from '@/lib/repositories/product.repository'

/**
 * Create a new product
 * BEFORE: Direct Supabase calls with manual validation
 * AFTER: Service handles validation, retry, monitoring, organization isolation
 */
export async function createProductAction(formData: FormData) {
  try {
    const productService = await createProductService()
    
    const input: CreateProductInput = {
      sku: formData.get('sku') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      category: formData.get('category') as string || undefined,
      base_price: parseFloat(formData.get('base_price') as string) || 0,
      cost: parseFloat(formData.get('cost') as string) || 0,
      weight: formData.get('weight') ? parseFloat(formData.get('weight') as string) : undefined,
      active: formData.get('active') === 'true'
    }
    
    // Service handles:
    // - Input validation with Zod schemas
    // - Duplicate SKU checking
    // - Organization isolation
    // - Retry logic for transient failures
    // - Circuit breaker protection
    // - Audit trail creation
    // - Logging and metrics
    const product = await productService.createProduct(input)
    
    revalidatePath('/products')
    redirect(`/products/${product.id}`)
  } catch (error) {
    // Error is already enriched with service context
    console.error('Product creation failed:', error)
    throw error
  }
}

/**
 * Update an existing product
 */
export async function updateProductAction(id: string, formData: FormData) {
  try {
    const productService = await createProductService()
    
    const input: UpdateProductInput = {
      name: formData.get('name') as string || undefined,
      description: formData.get('description') as string || undefined,
      category: formData.get('category') as string || undefined,
      base_price: formData.get('base_price') ? parseFloat(formData.get('base_price') as string) : undefined,
      cost: formData.get('cost') ? parseFloat(formData.get('cost') as string) : undefined,
      weight: formData.get('weight') ? parseFloat(formData.get('weight') as string) : undefined,
      active: formData.get('active') ? formData.get('active') === 'true' : undefined
    }
    
    // Remove undefined values
    const cleanInput = Object.fromEntries(
      Object.entries(input).filter(([_, value]) => value !== undefined)
    ) as UpdateProductInput
    
    // Service handles validation, existence check, duplicate SKU check
    const product = await productService.updateProduct(id, cleanInput)
    
    revalidatePath('/products')
    revalidatePath(`/products/${id}`)
    
    return product
  } catch (error) {
    console.error('Product update failed:', error)
    throw error
  }
}

/**
 * Delete a product (soft delete)
 */
export async function deleteProductAction(id: string) {
  try {
    const productService = await createProductService()
    
    // Service handles existence check and soft delete
    await productService.deleteProduct(id)
    
    revalidatePath('/products')
    redirect('/products')
  } catch (error) {
    console.error('Product deletion failed:', error)
    throw error
  }
}

/**
 * Search products
 */
export async function searchProductsAction(searchTerm: string) {
  try {
    const productService = await createProductService()
    
    // Service handles organization isolation and search logic
    const products = await productService.searchProducts(searchTerm, 50)
    
    return products
  } catch (error) {
    console.error('Product search failed:', error)
    throw error
  }
}

/**
 * Bulk update products from CSV import
 */
export async function bulkUpdateProductsAction(updates: Array<{ id: string } & UpdateProductInput>) {
  try {
    const productService = await createProductService()
    
    // Service handles:
    // - Batch processing with size limits
    // - Validation of all inputs
    // - Parallel execution within batches
    // - Error collection and reporting
    const results = await productService.bulkUpdateProducts(updates)
    
    revalidatePath('/products')
    
    return {
      success: true,
      updated: results.length,
      products: results
    }
  } catch (error) {
    console.error('Bulk product update failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Sync products from external system (e.g., Shopify)
 */
export async function syncProductsFromExternalAction(externalProducts: any[]) {
  try {
    const productService = await createProductService()
    
    // Service handles:
    // - Data transformation from external format
    // - Batch processing with concurrency control
    // - Create vs update logic based on SKU
    // - Error collection for failed items
    // - Progress tracking and metrics
    const results = await productService.syncProducts(externalProducts)
    
    revalidatePath('/products')
    
    return {
      success: true,
      created: results.created,
      updated: results.updated,
      errors: results.errors
    }
  } catch (error) {
    console.error('Product sync failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get low stock products for dashboard
 */
export async function getLowStockProductsAction(threshold = 10) {
  try {
    const productService = await createProductService()
    
    // Service handles inventory joins and threshold filtering
    const products = await productService.getLowStockProducts(threshold)
    
    return products
  } catch (error) {
    console.error('Low stock check failed:', error)
    throw error
  }
}