/**
 * InventoryRepository - Concrete implementation extending BaseRepository
 * Provides organization-isolated, audited inventory data access
 */

import { BaseRepository } from '@/lib/base/base-repository'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export type Inventory = Database['public']['Tables']['inventory']['Row']
export type CreateInventoryInput = Omit<
  Database['public']['Tables']['inventory']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'organization_id'
>
export type UpdateInventoryInput = Partial<CreateInventoryInput>

export class InventoryRepository extends BaseRepository<Inventory> {
  private userId: string | null = null
  private organizationId: string | null = null

  constructor(supabase: SupabaseClient<Database>, context?: { userId?: string; organizationId?: string }) {
    super(supabase, { tableName: 'inventory' })
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
   * Get inventory for a specific product across all warehouses
   */
  async getByProductId(productId: string): Promise<Inventory[]> {
    const { data, error } = await this.query()
      .select(`
        *,
        warehouses (
          id,
          name,
          code
        )
      `)
      .eq('product_id', productId)
      .order('quantity', { ascending: false })

    if (error) throw this.handleError(error)
    return (data || []) as Inventory[]
  }

  /**
   * Get inventory for a specific warehouse
   */
  async getByWarehouseId(warehouseId: string): Promise<Inventory[]> {
    const { data, error } = await this.query()
      .select(`
        *,
        products (
          id,
          name,
          sku
        )
      `)
      .eq('warehouse_id', warehouseId)
      .order('quantity', { ascending: false })

    if (error) throw this.handleError(error)
    return (data || []) as Inventory[]
  }

  /**
   * Get specific inventory record
   */
  async getByProductAndWarehouse(productId: string, warehouseId: string): Promise<Inventory | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('product_id', productId)
      .eq('warehouse_id', warehouseId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw this.handleError(error)
    }

    return data as Inventory
  }

  /**
   * Get total available quantity for a product
   */
  async getTotalQuantity(productId: string): Promise<number> {
    const { data, error } = await this.query()
      .select('quantity')
      .eq('product_id', productId)

    if (error) throw this.handleError(error)
    
    return (data || []).reduce((total, inv) => total + (inv.quantity || 0), 0)
  }

  /**
   * Get total reserved quantity for a product
   */
  async getTotalReservedQuantity(productId: string): Promise<number> {
    const { data, error } = await this.query()
      .select('reserved_quantity')
      .eq('product_id', productId)

    if (error) throw this.handleError(error)
    
    return (data || []).reduce((total, inv) => total + (inv.reserved_quantity || 0), 0)
  }

  /**
   * Update inventory quantity with audit trail
   */
  async adjustQuantity(
    productId: string,
    warehouseId: string,
    adjustment: number,
    reason: string
  ): Promise<Inventory> {
    // Get current inventory
    const current = await this.getByProductAndWarehouse(productId, warehouseId)

    const newQuantity = (current?.quantity || 0) + adjustment

    if (newQuantity < 0) {
      throw new Error(`Insufficient inventory. Available: ${current?.quantity || 0}, Requested: ${Math.abs(adjustment)}`)
    }

    // Update or create inventory record
    if (current) {
      return await this.update(current.id, {
        quantity: newQuantity,
        last_counted_at: new Date().toISOString(),
        last_counted_by: this.getCurrentUserId()
      })
    } else {
      return await this.create({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: newQuantity,
        reserved_quantity: 0,
        last_counted_at: new Date().toISOString(),
        last_counted_by: this.getCurrentUserId()
      })
    }
  }

  /**
   * Reserve inventory for orders
   */
  async reserveQuantity(
    productId: string,
    warehouseId: string,
    quantity: number
  ): Promise<Inventory> {
    const current = await this.getByProductAndWarehouse(productId, warehouseId)

    if (!current) {
      throw new Error(`No inventory record found for product ${productId} in warehouse ${warehouseId}`)
    }

    const availableQuantity = current.quantity - current.reserved_quantity
    if (availableQuantity < quantity) {
      throw new Error(`Insufficient available inventory. Available: ${availableQuantity}, Requested: ${quantity}`)
    }

    return await this.update(current.id, {
      reserved_quantity: current.reserved_quantity + quantity
    })
  }

  /**
   * Release reserved inventory
   */
  async releaseReservedQuantity(
    productId: string,
    warehouseId: string,
    quantity: number
  ): Promise<Inventory> {
    const current = await this.getByProductAndWarehouse(productId, warehouseId)

    if (!current) {
      throw new Error(`No inventory record found for product ${productId} in warehouse ${warehouseId}`)
    }

    const newReservedQuantity = Math.max(0, current.reserved_quantity - quantity)

    return await this.update(current.id, {
      reserved_quantity: newReservedQuantity
    })
  }

  /**
   * Transfer inventory between warehouses
   */
  async transfer(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number
  ): Promise<{ from: Inventory; to: Inventory }> {
    // Decrease from source warehouse
    const from = await this.adjustQuantity(
      productId,
      fromWarehouseId,
      -quantity,
      `Transfer to warehouse ${toWarehouseId}`
    )

    // Increase in destination warehouse
    const to = await this.adjustQuantity(
      productId,
      toWarehouseId,
      quantity,
      `Transfer from warehouse ${fromWarehouseId}`
    )

    return { from, to }
  }

  /**
   * Find inventory items below reorder point
   */
  async findBelowReorderPoint(): Promise<Inventory[]> {
    const { data, error } = await this.query()
      .select(`
        *,
        products (
          id,
          name,
          sku
        ),
        warehouses (
          id,
          name,
          code
        )
      `)
      .not('reorder_point', 'is', null)
      .filter('quantity', 'lt', 'reorder_point')
      .order('quantity')

    if (error) throw this.handleError(error)
    return (data || []) as Inventory[]
  }

  /**
   * Get inventory summary by warehouse
   */
  async getWarehouseSummary(): Promise<Array<{
    warehouse_id: string
    warehouse_name: string
    total_products: number
    total_quantity: number
    total_reserved: number
    low_stock_items: number
  }>> {
    const { data, error } = await this.query()
      .select(`
        warehouse_id,
        warehouses!inner (
          name
        ),
        quantity,
        reserved_quantity,
        reorder_point
      `)

    if (error) throw this.handleError(error)

    // Group and aggregate by warehouse
    const warehouseMap = new Map()
    
    for (const item of data || []) {
      const warehouseId = item.warehouse_id
      const warehouseName = (item.warehouses as any)?.name || 'Unknown'
      
      if (!warehouseMap.has(warehouseId)) {
        warehouseMap.set(warehouseId, {
          warehouse_id: warehouseId,
          warehouse_name: warehouseName,
          total_products: 0,
          total_quantity: 0,
          total_reserved: 0,
          low_stock_items: 0
        })
      }
      
      const summary = warehouseMap.get(warehouseId)
      summary.total_products += 1
      summary.total_quantity += item.quantity
      summary.total_reserved += item.reserved_quantity
      
      // Check if below reorder point
      if (item.reorder_point && item.quantity < item.reorder_point) {
        summary.low_stock_items += 1
      }
    }
    
    return Array.from(warehouseMap.values())
  }
}

/**
 * Factory function to create an inventory repository with server context
 */
export async function createInventoryRepository(): Promise<InventoryRepository> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Authentication required')
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
    
  if (!profile?.organization_id) throw new Error('User must belong to an organization')
  
  const repository = new InventoryRepository(supabase, {
    userId: user.id,
    organizationId: profile.organization_id
  })
  
  return repository
}