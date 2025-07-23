import type { Inventory, InventoryWithRelations } from '@/types/inventory.types'

/**
 * Calculate available inventory (on_hand - reserved)
 */
export function calculateAvailableQuantity(inventory: Pick<Inventory, 'quantity' | 'reserved_quantity'>): number {
  const onHand = inventory.quantity || 0
  const reserved = inventory.reserved_quantity || 0
  return Math.max(0, onHand - reserved)
}

/**
 * Calculate inventory value based on quantity and product price
 */
export function calculateInventoryValue(
  inventory: Pick<Inventory, 'quantity'>,
  productPrice: number
): number {
  const quantity = inventory.quantity || 0
  return quantity * productPrice
}

/**
 * Determine stock status based on available quantity and reorder point
 */
export function getStockStatus(
  inventory: Pick<Inventory, 'quantity' | 'reserved_quantity' | 'reorder_point'>
): 'out_of_stock' | 'critical' | 'low' | 'normal' {
  const available = calculateAvailableQuantity(inventory)
  const reorderPoint = inventory.reorder_point || 0

  if (available <= 0) return 'out_of_stock'
  if (available <= Math.ceil(reorderPoint * 0.5)) return 'critical'
  if (available <= reorderPoint) return 'low'
  return 'normal'
}

/**
 * Calculate days of stock remaining based on average daily usage
 */
export function calculateDaysOfStock(
  availableQuantity: number,
  averageDailyUsage: number
): number | null {
  if (averageDailyUsage <= 0) return null
  return Math.floor(availableQuantity / averageDailyUsage)
}

/**
 * Calculate reorder quantity based on reorder point and lead time
 */
export function calculateReorderQuantity(
  currentInventory: Pick<Inventory, 'quantity' | 'reserved_quantity' | 'reorder_point' | 'reorder_quantity'>,
  leadTimeDays: number = 7,
  averageDailyUsage: number = 0
): number {
  const available = calculateAvailableQuantity(currentInventory)
  const reorderPoint = currentInventory.reorder_point || 0
  const baseReorderQuantity = currentInventory.reorder_quantity || 0

  // If we're below reorder point, calculate how much to order
  if (available <= reorderPoint) {
    // Account for usage during lead time
    const usageDuringLeadTime = leadTimeDays * averageDailyUsage
    
    // Order enough to cover lead time usage plus the base reorder quantity
    const suggestedQuantity = baseReorderQuantity + usageDuringLeadTime - available
    
    // Round up to nearest 10 for cleaner ordering
    return Math.ceil(suggestedQuantity / 10) * 10
  }

  return 0
}

/**
 * Calculate inventory turnover ratio
 */
export function calculateTurnoverRatio(
  costOfGoodsSold: number,
  averageInventoryValue: number
): number {
  if (averageInventoryValue <= 0) return 0
  return costOfGoodsSold / averageInventoryValue
}

/**
 * Group inventory by status for dashboard stats
 */
export function groupInventoryByStatus(
  inventoryItems: Array<Pick<Inventory, 'quantity' | 'reserved_quantity' | 'reorder_point'>>
): {
  outOfStock: number
  critical: number
  low: number
  normal: number
} {
  const grouped = {
    outOfStock: 0,
    critical: 0,
    low: 0,
    normal: 0,
  }

  inventoryItems.forEach(item => {
    const status = getStockStatus(item)
    switch (status) {
      case 'out_of_stock':
        grouped.outOfStock++
        break
      case 'critical':
        grouped.critical++
        break
      case 'low':
        grouped.low++
        break
      case 'normal':
        grouped.normal++
        break
    }
  })

  return grouped
}

/**
 * Calculate total inventory value for multiple items
 */
export function calculateTotalInventoryValue(
  inventoryItems: Array<InventoryWithRelations>
): number {
  return inventoryItems.reduce((total, item) => {
    const value = calculateInventoryValue(item, item.product?.base_price || 0)
    return total + value
  }, 0)
}

/**
 * Validate if an adjustment is valid
 */
export function validateInventoryAdjustment(
  currentQuantity: number,
  newQuantity: number,
  allowNegative: boolean = false
): { valid: boolean; error?: string } {
  if (!Number.isInteger(newQuantity)) {
    return { valid: false, error: 'Quantity must be a whole number' }
  }

  if (!allowNegative && newQuantity < 0) {
    return { valid: false, error: 'Quantity cannot be negative' }
  }

  if (newQuantity > 999999) {
    return { valid: false, error: 'Quantity exceeds maximum allowed value' }
  }

  if (newQuantity === currentQuantity) {
    return { valid: false, error: 'New quantity must be different from current quantity' }
  }

  return { valid: true }
}

/**
 * Format quantity with appropriate units
 */
export function formatQuantity(quantity: number, unit?: string): string {
  const formatted = new Intl.NumberFormat('en-US').format(quantity)
  return unit ? `${formatted} ${unit}${quantity !== 1 ? 's' : ''}` : formatted
}

/**
 * Calculate fill rate (percentage of orders that can be fulfilled)
 */
export function calculateFillRate(
  fulfilledOrders: number,
  totalOrders: number
): number {
  if (totalOrders === 0) return 100
  return Math.round((fulfilledOrders / totalOrders) * 100)
}