/**
 * ProductService - Concrete implementation extending BaseService
 * Provides business logic with automatic retry, circuit breaker, and monitoring
 */

import { BaseService } from '@/lib/base/base-service'
import { ProductRepository, type Product, type CreateProductInput, type UpdateProductInput } from '@/lib/repositories/product.repository'
import { z } from 'zod'

// Validation schemas
const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  base_price: z.number().min(0).default(0),
  cost: z.number().min(0).default(0),
  weight: z.number().min(0).optional(),
  dimensions: z.record(z.any()).optional(),
  image_url: z.string().url().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.any()).optional()
})

const updateProductSchema = createProductSchema.partial()

export class ProductService extends BaseService {
  constructor(private repository: ProductRepository) {
    super({
      serviceName: 'ProductService',
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerEnabled: true,
      timeoutMs: 30000
    })
  }

  /**
   * Create a new product with validation
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    return this.execute(async () => {
      // Validate input
      const validated = this.validateInput<CreateProductInput>(input)
      
      // Check for duplicate SKU
      const existing = await this.repository.findBySku(validated.sku)
      if (existing) {
        throw new Error(`Product with SKU ${validated.sku} already exists`)
      }
      
      // Create product
      const product = await this.repository.create(validated)
      
      this.log('info', 'Product created', { productId: product.id, sku: product.sku })
      
      return product
    })
  }

  /**
   * Update a product
   */
  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    return this.execute(async () => {
      // Check if product exists first
      const existing = await this.repository.findById(id)
      if (!existing) {
        throw new Error(`Product ${id} not found`)
      }
      
      // Validate input
      const validated = this.validateInput<UpdateProductInput>(input)
      
      // If SKU is being changed, check for duplicates
      if (validated.sku && validated.sku !== existing.sku) {
        const duplicate = await this.repository.findBySku(validated.sku)
        if (duplicate) {
          throw new Error(`Product with SKU ${validated.sku} already exists`)
        }
      }
      
      // Update product
      const product = await this.repository.update(id, validated)
      
      this.log('info', 'Product updated', { productId: product.id })
      
      return product
    })
  }

  /**
   * Get a product by ID
   */
  async getProduct(id: string): Promise<Product | null> {
    return this.execute(async () => {
      return await this.repository.findById(id)
    })
  }

  /**
   * Get all products with optional filters
   */
  async getAllProducts(filters?: Partial<Product>): Promise<Product[]> {
    return this.execute(async () => {
      return await this.repository.findAll(filters)
    })
  }

  /**
   * Search products by name or SKU
   */
  async searchProducts(searchTerm: string, limit?: number): Promise<Product[]> {
    return this.execute(async () => {
      return await this.repository.search(searchTerm, limit)
    })
  }

  /**
   * Delete a product (soft delete)
   */
  async deleteProduct(id: string): Promise<void> {
    return this.execute(async () => {
      // Check if product exists
      const existing = await this.repository.findById(id)
      if (!existing) {
        throw new Error(`Product ${id} not found`)
      }

      await this.repository.delete(id)
      
      this.log('info', 'Product deleted', { productId: id })
    })
  }

  /**
   * Sync products from external system
   */
  async syncProducts(externalProducts: any[]): Promise<{
    created: number
    updated: number
    errors: Array<{ sku: string; error: string }>
  }> {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ sku: string; error: string }>
    }

    // Process in batches with parallel execution
    await this.batchExecute(
      externalProducts,
      async (batch) => {
        const operations = batch.map(async (externalProduct) => {
          try {
            const productData = this.transformExternalProduct(externalProduct)
            
            // Check if product exists
            const existing = await this.repository.findBySku(productData.sku)
            
            if (existing) {
              await this.repository.update(existing.id, productData)
              results.updated++
            } else {
              await this.repository.create(productData)
              results.created++
            }
          } catch (error) {
            results.errors.push({
              sku: externalProduct.sku || 'unknown',
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        })
        
        await Promise.all(operations)
        return []
      },
      50 // Process 50 products at a time
    )

    this.log('info', 'Product sync completed', results)
    
    return results
  }

  /**
   * Get products requiring inventory update
   */
  async getProductsForInventoryCheck(): Promise<Product[]> {
    return this.execute(async () => {
      // Get all active products
      const products = await this.repository.findAll({ active: true })
      
      // Filter products that haven't been checked in 24 hours
      const cutoff = new Date()
      cutoff.setHours(cutoff.getHours() - 24)
      
      return products.filter(product => {
        const lastChecked = (product.metadata as any)?.last_inventory_check as string
        if (!lastChecked) return true
        return new Date(lastChecked) < cutoff
      })
    })
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold = 10): Promise<Array<Product & { current_inventory: number }>> {
    return this.execute(async () => {
      return await this.repository.findLowStock(threshold)
    })
  }

  /**
   * Bulk update products
   */
  async bulkUpdateProducts(updates: Array<{ id: string } & UpdateProductInput>): Promise<Product[]> {
    return this.execute(async () => {
      // Validate all updates first
      const validatedUpdates = updates.map(({ id, ...data }) => ({
        id,
        ...this.validateInput<UpdateProductInput>(data)
      }))

      return await this.repository.bulkUpdate(validatedUpdates)
    })
  }

  /**
   * Validate input data
   */
  protected validateInput<T>(data: unknown): T {
    // Check if we're in an update context by checking if this is a partial object
    const keys = Object.keys(data as object)
    const hasAllRequiredFields = keys.includes('sku') && keys.includes('name')
    
    if (hasAllRequiredFields) {
      // Create operation - require all fields
      return createProductSchema.parse(data) as T
    } else {
      // Update operation - allow partial
      return updateProductSchema.parse(data) as T
    }
  }

  /**
   * Transform external product data to our format
   */
  private transformExternalProduct(external: any): CreateProductInput {
    return {
      name: external.name || external.title,
      sku: external.sku || external.variant_sku,
      description: external.description || external.body_html,
      active: external.status === 'active',
      base_price: external.price ? parseFloat(external.price) : 0,
      cost: external.cost ? parseFloat(external.cost) : 0,
      weight: external.weight ? parseFloat(external.weight) : undefined,
      metadata: {
        external_id: external.id,
        external_source: external.source || 'unknown',
        last_synced: new Date().toISOString()
      }
    }
  }

  /**
   * Health check
   */
  protected async runHealthCheck(): Promise<boolean> {
    try {
      // Try to count products
      const count = await this.repository.count()
      return count >= 0
    } catch {
      return false
    }
  }
}

/**
 * Factory function to create a product service
 */
export async function createProductService(): Promise<ProductService> {
  const { createProductRepository } = await import('@/lib/repositories/product.repository')
  const repository = await createProductRepository()
  return new ProductService(repository)
}