/**
 * InventoryService - Concrete implementation extending BaseService
 * Provides inventory business logic with automatic retry, circuit breaker, and monitoring
 */

import { BaseService } from '@/lib/base/base-service'
import { InventoryRepository, type Inventory, type CreateInventoryInput, type UpdateInventoryInput } from '@/lib/repositories/inventory.repository'
import { z } from 'zod'

// Validation schemas
const createInventorySchema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.number().min(0).default(0),
  reserved_quantity: z.number().min(0).default(0),
  reorder_point: z.number().min(0).optional(),
  reorder_quantity: z.number().min(0).optional(),
  last_counted_at: z.string().optional(),
  last_counted_by: z.string().uuid().optional()
})

const updateInventorySchema = createInventorySchema.partial()

export interface InventoryAdjustment {
  productId: string
  warehouseId: string
  adjustment: number
  reason: string
  reference?: string
}

export interface InventoryReservation {
  productId: string
  warehouseId: string
  quantity: number
  orderId?: string
  customerId?: string
}

export interface InventoryTransfer {
  productId: string
  fromWarehouseId: string
  toWarehouseId: string
  quantity: number
  reason?: string
}

export class InventoryService extends BaseService {
  constructor(private repository: InventoryRepository) {
    super({
      serviceName: 'InventoryService',
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerEnabled: true,
      timeoutMs: 30000
    })
  }

  /**
   * Check availability for an order
   */
  async checkAvailability(
    items: Array<{ productId: string; quantity: number; warehouseId?: string }>
  ): Promise<{
    available: boolean
    items: Array<{
      productId: string
      requested: number
      available: number
      reserved: number
      sufficient: boolean
    }>
  }> {
    return this.execute(async () => {
      const availability = await Promise.all(
        items.map(async (item) => {
          const total = await this.repository.getTotalQuantity(item.productId)
          const reserved = await this.repository.getTotalReservedQuantity(item.productId)
          const available = total - reserved
          
          return {
            productId: item.productId,
            requested: item.quantity,
            available,
            reserved,
            sufficient: available >= item.quantity
          }
        })
      )

      const allAvailable = availability.every(item => item.sufficient)

      return {
        available: allAvailable,
        items: availability
      }
    })
  }

  /**
   * Reserve inventory for an order
   */
  async reserveInventory(reservations: InventoryReservation[]): Promise<void> {
    return this.execute(async () => {
      // Process reservations
      for (const reservation of reservations) {
        await this.repository.reserveQuantity(
          reservation.productId,
          reservation.warehouseId,
          reservation.quantity
        )

        this.log('info', 'Inventory reserved', {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          quantity: reservation.quantity,
          orderId: reservation.orderId
        })
      }

      this.log('info', 'Inventory reservation completed', { 
        reservationCount: reservations.length 
      })
    })
  }

  /**
   * Release reserved inventory
   */
  async releaseReservedInventory(reservations: InventoryReservation[]): Promise<void> {
    return this.execute(async () => {
      for (const reservation of reservations) {
        await this.repository.releaseReservedQuantity(
          reservation.productId,
          reservation.warehouseId,
          reservation.quantity
        )

        this.log('info', 'Reserved inventory released', {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          quantity: reservation.quantity,
          orderId: reservation.orderId
        })
      }

      this.log('info', 'Inventory release completed', { 
        releaseCount: reservations.length 
      })
    })
  }

  /**
   * Adjust inventory quantities
   */
  async adjustInventory(adjustments: InventoryAdjustment[]): Promise<Inventory[]> {
    return this.execute(async () => {
      const results: Inventory[] = []

      for (const adjustment of adjustments) {
        const result = await this.repository.adjustQuantity(
          adjustment.productId,
          adjustment.warehouseId,
          adjustment.adjustment,
          adjustment.reason
        )

        results.push(result)

        this.log('info', 'Inventory adjusted', {
          productId: adjustment.productId,
          warehouseId: adjustment.warehouseId,
          adjustment: adjustment.adjustment,
          reason: adjustment.reason,
          reference: adjustment.reference
        })
      }

      return results
    })
  }

  /**
   * Transfer inventory between warehouses
   */
  async transferInventory(transfers: InventoryTransfer[]): Promise<void> {
    return this.execute(async () => {
      for (const transfer of transfers) {
        await this.repository.transfer(
          transfer.productId,
          transfer.fromWarehouseId,
          transfer.toWarehouseId,
          transfer.quantity
        )

        this.log('info', 'Inventory transferred', {
          productId: transfer.productId,
          fromWarehouseId: transfer.fromWarehouseId,
          toWarehouseId: transfer.toWarehouseId,
          quantity: transfer.quantity,
          reason: transfer.reason
        })
      }

      this.log('info', 'Inventory transfer completed', { 
        transferCount: transfers.length 
      })
    })
  }

  /**
   * Get inventory for a product
   */
  async getProductInventory(productId: string): Promise<Inventory[]> {
    return this.execute(async () => {
      return await this.repository.getByProductId(productId)
    })
  }

  /**
   * Get inventory for a warehouse
   */
  async getWarehouseInventory(warehouseId: string): Promise<Inventory[]> {
    return this.execute(async () => {
      return await this.repository.getByWarehouseId(warehouseId)
    })
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(): Promise<Inventory[]> {
    return this.execute(async () => {
      return await this.repository.findBelowReorderPoint()
    })
  }

  /**
   * Get warehouse inventory summary
   */
  async getWarehouseSummary(): Promise<Array<{
    warehouse_id: string
    warehouse_name: string
    total_products: number
    total_quantity: number
    total_reserved: number
    low_stock_items: number
  }>> {
    return this.execute(async () => {
      return await this.repository.getWarehouseSummary()
    })
  }

  /**
   * Sync inventory from external system
   */
  async syncFromExternal(
    externalInventory: Array<{
      sku: string
      warehouseCode: string
      quantity: number
      reservedQuantity?: number
    }>
  ): Promise<{
    updated: number
    errors: Array<{ sku: string; error: string }>
  }> {
    const results = {
      updated: 0,
      errors: [] as Array<{ sku: string; error: string }>
    }

    // Process in parallel batches
    await this.parallelExecute(
      externalInventory,
      async (item) => {
        try {
          // Look up product and warehouse IDs
          const productId = await this.getProductIdBySku(item.sku)
          const warehouseId = await this.getWarehouseIdByCode(item.warehouseCode)

          // Get current inventory
          const current = await this.repository.getByProductAndWarehouse(productId, warehouseId)
          
          if (current) {
            // Update existing inventory
            await this.repository.update(current.id, {
              quantity: item.quantity,
              reserved_quantity: item.reservedQuantity || 0,
              last_counted_at: new Date().toISOString(),
              last_counted_by: this.getContext()?.userId || null
            })
          } else {
            // Create new inventory record
            await this.repository.create({
              product_id: productId,
              warehouse_id: warehouseId,
              quantity: item.quantity,
              reserved_quantity: item.reservedQuantity || 0,
              last_counted_at: new Date().toISOString(),
              last_counted_by: this.getContext()?.userId || null
            })
          }

          results.updated++
        } catch (error) {
          results.errors.push({
            sku: item.sku,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      },
      10 // Process 10 items concurrently
    )

    this.log('info', 'Inventory sync completed', results)
    return results
  }

  /**
   * Validate input data
   */
  protected validateInput<T>(data: unknown): T {
    if ((data as any).id !== undefined) {
      // Update operation
      return updateInventorySchema.parse(data) as T
    } else {
      // Create operation
      return createInventorySchema.parse(data) as T
    }
  }

  /**
   * Health check
   */
  protected async runHealthCheck(): Promise<boolean> {
    try {
      // Try to count inventory records
      const count = await this.repository.count()
      return count >= 0
    } catch {
      return false
    }
  }

  // Helper methods (would normally query database)
  private async getProductIdBySku(sku: string): Promise<string> {
    // This would normally use ProductRepository
    // For now, throw an error to indicate missing implementation
    throw new Error('Product lookup by SKU not implemented - requires ProductRepository integration')
  }

  private async getWarehouseIdByCode(code: string): Promise<string> {
    // This would normally use WarehouseRepository
    // For now, throw an error to indicate missing implementation
    throw new Error('Warehouse lookup by code not implemented - requires WarehouseRepository integration')
  }
}

/**
 * Factory function to create an inventory service
 */
export async function createInventoryService(): Promise<InventoryService> {
  const { createInventoryRepository } = await import('@/lib/repositories/inventory.repository')
  const repository = await createInventoryRepository()
  return new InventoryService(repository)
}