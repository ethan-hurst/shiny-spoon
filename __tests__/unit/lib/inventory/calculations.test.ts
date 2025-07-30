import { describe, expect, it } from '@jest/globals'
import {
  calculateAvailableQuantity,
  calculateInventoryValue,
  getStockStatus,
  calculateDaysOfStock,
  calculateReorderQuantity,
  calculateTurnoverRatio,
  groupInventoryByStatus,
  calculateTotalInventoryValue,
  validateInventoryAdjustment,
  formatQuantity,
  calculateFillRate,
} from '@/lib/inventory/calculations'

describe('Inventory Calculations', () => {
  describe('calculateAvailableQuantity', () => {
    it('should calculate available quantity correctly', () => {
      const inventory = {
        quantity: 100,
        reserved_quantity: 30,
      }

      const available = calculateAvailableQuantity(inventory)

      expect(available).toBe(70) // 100 - 30
    })

    it('should handle zero quantities', () => {
      const inventory = {
        quantity: 0,
        reserved_quantity: 0,
      }

      const available = calculateAvailableQuantity(inventory)

      expect(available).toBe(0)
    })

    it('should handle null/undefined values', () => {
      const inventory = {
        quantity: null as any,
        reserved_quantity: undefined as any,
      }

      const available = calculateAvailableQuantity(inventory)

      expect(available).toBe(0)
    })

    it('should never return negative values', () => {
      const inventory = {
        quantity: 10,
        reserved_quantity: 20,
      }

      const available = calculateAvailableQuantity(inventory)

      expect(available).toBe(0) // Should be 0, not -10
    })
  })

  describe('calculateInventoryValue', () => {
    it('should calculate inventory value correctly', () => {
      const inventory = { quantity: 50 }
      const productPrice = 25.99

      const value = calculateInventoryValue(inventory, productPrice)

      expect(value).toBe(1299.5) // 50 * 25.99
    })

    it('should handle zero quantity', () => {
      const inventory = { quantity: 0 }
      const productPrice = 100

      const value = calculateInventoryValue(inventory, productPrice)

      expect(value).toBe(0)
    })

    it('should handle null quantity', () => {
      const inventory = { quantity: null as any }
      const productPrice = 100

      const value = calculateInventoryValue(inventory, productPrice)

      expect(value).toBe(0)
    })
  })

  describe('getStockStatus', () => {
    it('should return out_of_stock when no available inventory', () => {
      const inventory = {
        quantity: 0,
        reserved_quantity: 0,
        reorder_point: 10,
      }

      const status = getStockStatus(inventory)

      expect(status).toBe('out_of_stock')
    })

    it('should return critical when below 50% of reorder point', () => {
      const inventory = {
        quantity: 15,
        reserved_quantity: 5,
        reorder_point: 20,
      }

      const status = getStockStatus(inventory)

      expect(status).toBe('critical') // 10 available, reorder point is 20, 50% is 10
    })

    it('should return low when below reorder point', () => {
      const inventory = {
        quantity: 25,
        reserved_quantity: 5,
        reorder_point: 20,
      }

      const status = getStockStatus(inventory)

      expect(status).toBe('low') // 20 available, reorder point is 20
    })

    it('should return normal when above reorder point', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 5,
        reorder_point: 20,
      }

      const status = getStockStatus(inventory)

      expect(status).toBe('normal') // 25 available, reorder point is 20
    })

    it('should handle null reorder point', () => {
      const inventory = {
        quantity: 10,
        reserved_quantity: 0,
        reorder_point: null as any,
      }

      const status = getStockStatus(inventory)

      expect(status).toBe('normal') // Should default to normal when no reorder point
    })
  })

  describe('calculateDaysOfStock', () => {
    it('should calculate days of stock correctly', () => {
      const availableQuantity = 100
      const averageDailyUsage = 10

      const days = calculateDaysOfStock(availableQuantity, averageDailyUsage)

      expect(days).toBe(10) // 100 / 10
    })

    it('should return null when average daily usage is zero', () => {
      const availableQuantity = 100
      const averageDailyUsage = 0

      const days = calculateDaysOfStock(availableQuantity, averageDailyUsage)

      expect(days).toBeNull()
    })

    it('should return null when average daily usage is negative', () => {
      const availableQuantity = 100
      const averageDailyUsage = -5

      const days = calculateDaysOfStock(availableQuantity, averageDailyUsage)

      expect(days).toBeNull()
    })

    it('should handle fractional results', () => {
      const availableQuantity = 100
      const averageDailyUsage = 3

      const days = calculateDaysOfStock(availableQuantity, averageDailyUsage)

      expect(days).toBe(33) // Math.floor(100 / 3)
    })
  })

  describe('calculateReorderQuantity', () => {
    it('should return 0 when above reorder point', () => {
      const inventory = {
        quantity: 100,
        reserved_quantity: 10,
        reorder_point: 50,
        reorder_quantity: 200,
      }

      const reorderQty = calculateReorderQuantity(inventory)

      expect(reorderQty).toBe(0) // 90 available, reorder point is 50
    })

    it('should calculate reorder quantity when below reorder point', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 10,
        reorder_point: 50,
        reorder_quantity: 200,
      }

      const reorderQty = calculateReorderQuantity(inventory)

      expect(reorderQty).toBe(180) // 200 + 0 - 20 = 180, rounded to nearest 10
    })

    it('should account for lead time usage', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 10,
        reorder_point: 50,
        reorder_quantity: 200,
      }
      const leadTimeDays = 14
      const averageDailyUsage = 5

      const reorderQty = calculateReorderQuantity(inventory, leadTimeDays, averageDailyUsage)

      expect(reorderQty).toBe(250) // 200 + (14 * 5) - 20 = 250, rounded to nearest 10
    })

    it('should round up to nearest 10', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 10,
        reorder_point: 50,
        reorder_quantity: 200,
      }

      const reorderQty = calculateReorderQuantity(inventory)

      expect(reorderQty % 10).toBe(0) // Should be divisible by 10
    })

    it('should handle null values', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 10,
        reorder_point: null as any,
        reorder_quantity: null as any,
      }

      const reorderQty = calculateReorderQuantity(inventory)

      expect(reorderQty).toBe(0) // Should default to 0 when no reorder point
    })
  })

  describe('calculateTurnoverRatio', () => {
    it('should calculate turnover ratio correctly', () => {
      const costOfGoodsSold = 10000
      const averageInventoryValue = 5000

      const ratio = calculateTurnoverRatio(costOfGoodsSold, averageInventoryValue)

      expect(ratio).toBe(2) // 10000 / 5000
    })

    it('should return 0 when average inventory value is zero', () => {
      const costOfGoodsSold = 10000
      const averageInventoryValue = 0

      const ratio = calculateTurnoverRatio(costOfGoodsSold, averageInventoryValue)

      expect(ratio).toBe(0)
    })

    it('should return 0 when average inventory value is negative', () => {
      const costOfGoodsSold = 10000
      const averageInventoryValue = -1000

      const ratio = calculateTurnoverRatio(costOfGoodsSold, averageInventoryValue)

      expect(ratio).toBe(0)
    })
  })

  describe('groupInventoryByStatus', () => {
    it('should group inventory items by status correctly', () => {
      const inventoryItems = [
        { quantity: 0, reserved_quantity: 0, reorder_point: 10 }, // out of stock
        { quantity: 5, reserved_quantity: 0, reorder_point: 20 }, // critical (5 available, 50% of 20 is 10)
        { quantity: 15, reserved_quantity: 5, reorder_point: 20 }, // low (10 available, reorder point is 20)
        { quantity: 30, reserved_quantity: 5, reorder_point: 20 }, // normal (25 available, above reorder point)
        { quantity: 25, reserved_quantity: 5, reorder_point: 20 }, // normal (20 available, at reorder point)
      ]



      const grouped = groupInventoryByStatus(inventoryItems)

      expect(grouped.outOfStock).toBe(1)
      expect(grouped.critical).toBe(2)
      expect(grouped.low).toBe(1)
      expect(grouped.normal).toBe(1)
    })

    it('should handle empty array', () => {
      const inventoryItems: any[] = []

      const grouped = groupInventoryByStatus(inventoryItems)

      expect(grouped.outOfStock).toBe(0)
      expect(grouped.critical).toBe(0)
      expect(grouped.low).toBe(0)
      expect(grouped.normal).toBe(0)
    })
  })

  describe('validateInventoryAdjustment', () => {
    it('should validate positive adjustment', () => {
      const currentQuantity = 100
      const newQuantity = 150

      const result = validateInventoryAdjustment(currentQuantity, newQuantity)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should validate negative adjustment when allowed', () => {
      const currentQuantity = 100
      const newQuantity = 50
      const allowNegative = true

      const result = validateInventoryAdjustment(currentQuantity, newQuantity, allowNegative)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject negative adjustment when not allowed', () => {
      const currentQuantity = 100
      const newQuantity = -10
      const allowNegative = false

      const result = validateInventoryAdjustment(currentQuantity, newQuantity, allowNegative)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Quantity cannot be negative')
    })

    it('should handle zero quantities', () => {
      const currentQuantity = 0
      const newQuantity = 10

      const result = validateInventoryAdjustment(currentQuantity, newQuantity)

      expect(result.valid).toBe(true)
    })
  })

  describe('formatQuantity', () => {
    it('should format quantity with default unit', () => {
      const quantity = 100

      const formatted = formatQuantity(quantity)

      expect(formatted).toBe('100')
    })

    it('should format quantity with custom unit', () => {
      const quantity = 100
      const unit = 'boxes'

      const formatted = formatQuantity(quantity, unit)

      expect(formatted).toBe('100 boxess')
    })

    it('should handle zero quantity', () => {
      const quantity = 0
      const unit = 'pieces'

      const formatted = formatQuantity(quantity, unit)

      expect(formatted).toBe('0 piecess')
    })
  })

  describe('calculateFillRate', () => {
    it('should calculate fill rate correctly', () => {
      const fulfilledOrders = 80
      const totalOrders = 100

      const fillRate = calculateFillRate(fulfilledOrders, totalOrders)

      expect(fillRate).toBe(80) // 80% as percentage
    })

    it('should return 100 when no orders', () => {
      const fulfilledOrders = 0
      const totalOrders = 0

      const fillRate = calculateFillRate(fulfilledOrders, totalOrders)

      expect(fillRate).toBe(100)
    })

    it('should handle 100% fill rate', () => {
      const fulfilledOrders = 100
      const totalOrders = 100

      const fillRate = calculateFillRate(fulfilledOrders, totalOrders)

      expect(fillRate).toBe(100)
    })
  })
})