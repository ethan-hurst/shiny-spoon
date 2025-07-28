/**
 * ProductRepository - Concrete implementation extending BaseRepository
 * Provides organization-isolated, audited product data access
 */

import { BaseRepository } from '@/lib/base/base-repository'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export type Product = Database['public']['Tables']['products']['Row']
export type CreateProductInput = Omit<
  Database['public']['Tables']['products']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'organization_id'
>
export type UpdateProductInput = Partial<CreateProductInput>

export class ProductRepository extends BaseRepository<Product> {
  private userId: string | null = null
  private organizationId: string | null = null

  constructor(supabase: SupabaseClient<Database>, context?: { userId?: string; organizationId?: string }) {
    super(supabase, { tableName: 'products' })
    this.userId = context?.userId || null
    this.organizationId = context?.organizationId || null
  }

  /**
   * Set context for the repository
   */
  setContext(userId: string, organizationId: string): void {
    this.userId = userId
    this.organizationId = organizationId
  }

  protected getOrganizationId(): string | null {
    return this.organizationId
  }

  protected getCurrentUserId(): string | null {
    return this.userId
  }

  /**
   * Find products by SKU (exact match)
   */
  async findBySku(sku: string): Promise<Product | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('sku', sku)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw this.handleError(error)
    }

    return data as Product
  }

  /**
   * Search products by name or SKU
   */
  async search(searchTerm: string, limit = 10): Promise<Product[]> {
    const { data, error } = await this.query()
      .select('*')
      .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
      .limit(limit)
      .order('name')

    if (error) throw this.handleError(error)
    return (data || []) as Product[]
  }

  /**
   * Find products with low inventory
   */
  async findLowStock(threshold = 10): Promise<Array<Product & { current_inventory: number }>> {
    const { data, error } = await this.query()
      .select(`
        *,
        inventory!inner (
          quantity
        )
      `)
      .lt('inventory.quantity', threshold)
      .order('inventory.quantity')

    if (error) throw this.handleError(error)
    
    return (data || []).map(item => ({
      ...item,
      current_inventory: (item.inventory as any)?.[0]?.quantity || 0
    })) as Array<Product & { current_inventory: number }>
  }

  /**
   * Bulk update products
   */
  async bulkUpdate(updates: Array<{ id: string } & UpdateProductInput>): Promise<Product[]> {
    const results: Product[] = []
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 100
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      
      // Use Promise.all for parallel updates within batch
      const batchResults = await Promise.all(
        batch.map(({ id, ...data }) => this.update(id, data))
      )
      
      results.push(...batchResults)
    }
    
    return results
  }

  /**
   * Get products with pricing information
   */
  async getWithPricing(productIds?: string[]): Promise<Array<Product & { base_price?: number }>> {
    let query = this.query().select(`
      *,
      product_pricing (
        price,
        currency,
        effective_date
      )
    `)

    if (productIds && productIds.length > 0) {
      query = query.in('id', productIds)
    }

    const { data, error } = await query.order('name')

    if (error) throw this.handleError(error)

    return (data || []).map(product => ({
      ...product,
      base_price: (product as any).product_pricing?.[0]?.price
    })) as Array<Product & { base_price?: number }>
  }
}

/**
 * Factory function to create a product repository with server context
 */
export async function createProductRepository(): Promise<ProductRepository> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Authentication required')
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
    
  if (!profile?.organization_id) throw new Error('User must belong to an organization')
  
  const repository = new ProductRepository(supabase, {
    userId: user.id,
    organizationId: profile.organization_id
  })
  
  return repository
}