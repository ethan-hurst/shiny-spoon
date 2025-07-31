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
  calculateFillRate
} from '@/lib/inventory/calculations'
import type { Inventory, InventoryWithRelations } from '@/types/inventory.types'

describe('Inventory Calculations', () => {
  describe('calculateAvailableQuantity', () => {
    it('should calculate available quantity correctly', () => {
      const inventory = {
        quantity: 100,
        reserved_quantity: 25
      }
      
      expect(calculateAvailableQuantity(inventory)).toBe(75)
    })

    it('should handle zero quantities', () => {
      const inventory = {
        quantity: 0,
        reserved_quantity: 0
      }
      
      expect(calculateAvailableQuantity(inventory)).toBe(0)
    })

    it('should never return negative available quantity', () => {
      const inventory = {
        quantity: 10,
        reserved_quantity: 20
      }
      
      expect(calculateAvailableQuantity(inventory)).toBe(0)
    })

    it('should handle null/undefined values', () => {
      const inventory1 = {
        quantity: null as any,
        reserved_quantity: 10
      }
      expect(calculateAvailableQuantity(inventory1)).toBe(0)

      const inventory2 = {
        quantity: 50,
        reserved_quantity: undefined as any
      }
      expect(calculateAvailableQuantity(inventory2)).toBe(50)

      const inventory3 = {
        quantity: undefined as any,
        reserved_quantity: undefined as any
      }
      expect(calculateAvailableQuantity(inventory3)).toBe(0)
    })
  })

  describe('calculateInventoryValue', () => {
    it('should calculate inventory value correctly', () => {
      const inventory = { quantity: 50 }
      const price = 19.99
      
      expect(calculateInventoryValue(inventory, price)).toBeCloseTo(999.5, 2)
    })

    it('should handle zero quantity', () => {
      const inventory = { quantity: 0 }
      const price = 100
      
      expect(calculateInventoryValue(inventory, price)).toBe(0)
    })

    it('should handle zero price', () => {
      const inventory = { quantity: 100 }
      const price = 0
      
      expect(calculateInventoryValue(inventory, price)).toBe(0)
    })

    it('should handle null/undefined quantity', () => {
      const inventory1 = { quantity: null as any }
      expect(calculateInventoryValue(inventory1, 10)).toBe(0)

      const inventory2 = { quantity: undefined as any }
      expect(calculateInventoryValue(inventory2, 10)).toBe(0)
    })

    it('should handle decimal values', () => {
      const inventory = { quantity: 3 }
      const price = 9.99
      
      expect(calculateInventoryValue(inventory, price)).toBeCloseTo(29.97, 2)
    })
  })

  describe('getStockStatus', () => {
    it('should return out_of_stock when available is 0', () => {
      const inventory = {
        quantity: 10,
        reserved_quantity: 10,
        reorder_point: 20
      }
      
      expect(getStockStatus(inventory)).toBe('out_of_stock')
    })

    it('should return out_of_stock when available is negative', () => {
      const inventory = {
        quantity: 5,
        reserved_quantity: 10,
        reorder_point: 20
      }
      
      expect(getStockStatus(inventory)).toBe('out_of_stock')
    })

    it('should return critical when available is <= 50% of reorder point', () => {
      const inventory1 = {
        quantity: 5,
        reserved_quantity: 0,
        reorder_point: 10
      }
      expect(getStockStatus(inventory1)).toBe('critical')

      const inventory2 = {
        quantity: 10,
        reserved_quantity: 0,
        reorder_point: 20
      }
      expect(getStockStatus(inventory2)).toBe('critical')
    })

    it('should return low when available is <= reorder point', () => {
      const inventory1 = {
        quantity: 15,
        reserved_quantity: 0,
        reorder_point: 20
      }
      expect(getStockStatus(inventory1)).toBe('low')

      const inventory2 = {
        quantity: 20,
        reserved_quantity: 0,
        reorder_point: 20
      }
      expect(getStockStatus(inventory2)).toBe('low')
    })

    it('should return normal when available is > reorder point', () => {
      const inventory = {
        quantity: 50,
        reserved_quantity: 5,
        reorder_point: 20
      }
      
      expect(getStockStatus(inventory)).toBe('normal')
    })

    it('should handle null/undefined reorder point', () => {
      const inventory = {
        quantity: 10,
        reserved_quantity: 0,
        reorder_point: null as any
      }
      
      expect(getStockStatus(inventory)).toBe('normal')
    })

    it('should handle edge cases with decimal calculations', () => {
      const inventory = {
        quantity: 11,
        reserved_quantity: 0,
        reorder_point: 21 // 50% = 10.5, ceil = 11
      }
      
      expect(getStockStatus(inventory)).toBe('critical')
    })
  })

  describe('calculateDaysOfStock', () => {
    it('should calculate days of stock correctly', () => {
      expect(calculateDaysOfStock(100, 10)).toBe(10)
      expect(calculateDaysOfStock(50, 5)).toBe(10)
      expect(calculateDaysOfStock(7, 1)).toBe(7)
    })

    it('should floor the result for partial days', () => {
      expect(calculateDaysOfStock(100, 15)).toBe(6) // 6.66... → 6
      expect(calculateDaysOfStock(50, 7)).toBe(7) // 7.14... → 7
    })

    it('should return null for zero or negative daily usage', () => {
      expect(calculateDaysOfStock(100, 0)).toBeNull()
      expect(calculateDaysOfStock(100, -5)).toBeNull()
    })

    it('should handle zero available quantity', () => {
      expect(calculateDaysOfStock(0, 10)).toBe(0)
    })
  })

  describe('calculateReorderQuantity', () => {
    it('should return 0 when above reorder point', () => {
      const inventory = {
        quantity: 100,
        reserved_quantity: 10,
        reorder_point: 50,
        reorder_quantity: 100
      }
      
      expect(calculateReorderQuantity(inventory)).toBe(0)
    })

    it('should calculate basic reorder quantity', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 0,
        reorder_point: 50,
        reorder_quantity: 100
      }
      
      const result = calculateReorderQuantity(inventory, 7, 0)
      expect(result).toBe(70) // baseReorderQuantity (100) - available (30) = 70
    })

    it('should account for lead time usage', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 0,
        reorder_point: 50,
        reorder_quantity: 100
      }
      
      const result = calculateReorderQuantity(inventory, 7, 10)
      // baseReorderQuantity (100) + usageDuringLeadTime (70) - available (30) = 140
      expect(result).toBe(140)
    })

    it('should round up to nearest 10', () => {
      const inventory = {
        quantity: 25,
        reserved_quantity: 0,
        reorder_point: 50,
        reorder_quantity: 100
      }
      
      const result = calculateReorderQuantity(inventory, 7, 5)
      // baseReorderQuantity (100) + usageDuringLeadTime (35) - available (25) = 110
      expect(result).toBe(110)
    })

    it('should handle edge case at exactly reorder point', () => {
      const inventory = {
        quantity: 50,
        reserved_quantity: 0,
        reorder_point: 50,
        reorder_quantity: 100
      }
      
      const result = calculateReorderQuantity(inventory, 7, 5)
      // baseReorderQuantity (100) + usageDuringLeadTime (35) - available (50) = 85 → 90
      expect(result).toBe(90)
    })

    it('should never return negative quantity', () => {
      const inventory = {
        quantity: 200,
        reserved_quantity: 0,
        reorder_point: 50,
        reorder_quantity: 50
      }
      
      // Even though available (200) > baseReorderQuantity (50) + usageDuringLeadTime (35)
      // We're above reorder point so should return 0
      const result = calculateReorderQuantity(inventory, 7, 5)
      expect(result).toBe(0)
    })

    it('should handle null/undefined values', () => {
      const inventory = {
        quantity: 10,
        reserved_quantity: 0,
        reorder_point: null as any,
        reorder_quantity: null as any
      }
      
      // With null reorder_point (treated as 0), available (10) > 0, so return 0
      expect(calculateReorderQuantity(inventory)).toBe(0)
    })

    it('should use default lead time when not provided', () => {
      const inventory = {
        quantity: 30,
        reserved_quantity: 0,
        reorder_point: 50,
        reorder_quantity: 100
      }
      
      // Uses default lead time of 7 days with 0 average daily usage
      const result = calculateReorderQuantity(inventory)
      expect(result).toBe(70) // baseReorderQuantity (100) - available (30) = 70
    })
  })

  describe('calculateTurnoverRatio', () => {
    it('should calculate turnover ratio correctly', () => {
      expect(calculateTurnoverRatio(500000, 100000)).toBe(5)
      expect(calculateTurnoverRatio(1000000, 250000)).toBe(4)
      expect(calculateTurnoverRatio(300000, 300000)).toBe(1)
    })

    it('should handle decimal results', () => {
      expect(calculateTurnoverRatio(750000, 500000)).toBe(1.5)
      expect(calculateTurnoverRatio(100000, 75000)).toBeCloseTo(1.333, 3)
    })

    it('should return 0 for zero or negative average inventory', () => {
      expect(calculateTurnoverRatio(500000, 0)).toBe(0)
      expect(calculateTurnoverRatio(500000, -100000)).toBe(0)
    })

    it('should handle zero COGS', () => {
      expect(calculateTurnoverRatio(0, 100000)).toBe(0)
    })
  })

  describe('groupInventoryByStatus', () => {
    it('should group inventory items by status', () => {
      const items = [
        { quantity: 0, reserved_quantity: 0, reorder_point: 10 }, // out_of_stock
        { quantity: 5, reserved_quantity: 0, reorder_point: 10 }, // critical
        { quantity: 15, reserved_quantity: 0, reorder_point: 20 }, // low
        { quantity: 100, reserved_quantity: 10, reorder_point: 20 }, // normal
        { quantity: 200, reserved_quantity: 0, reorder_point: 50 }, // normal
      ]
      
      const result = groupInventoryByStatus(items)
      
      expect(result).toEqual({
        outOfStock: 1,
        critical: 1,
        low: 1,
        normal: 2
      })
    })

    it('should handle empty array', () => {
      const result = groupInventoryByStatus([])
      
      expect(result).toEqual({
        outOfStock: 0,
        critical: 0,
        low: 0,
        normal: 0
      })
    })

    it('should handle all items in one category', () => {
      const items = [
        { quantity: 0, reserved_quantity: 0, reorder_point: 10 },
        { quantity: 0, reserved_quantity: 0, reorder_point: 20 },
        { quantity: 5, reserved_quantity: 10, reorder_point: 30 },
      ]
      
      const result = groupInventoryByStatus(items)
      
      expect(result).toEqual({
        outOfStock: 3,
        critical: 0,
        low: 0,
        normal: 0
      })
    })

    it('should handle items with reserved quantities', () => {
      const items = [
        { quantity: 100, reserved_quantity: 100, reorder_point: 20 }, // out_of_stock (available = 0)
        { quantity: 50, reserved_quantity: 40, reorder_point: 20 }, // critical (available = 10)
        { quantity: 50, reserved_quantity: 30, reorder_point: 20 }, // low (available = 20)
        { quantity: 100, reserved_quantity: 20, reorder_point: 50 }, // normal (available = 80)
      ]
      
      const result = groupInventoryByStatus(items)
      
      expect(result).toEqual({
        outOfStock: 1,
        critical: 1,
        low: 1,
        normal: 1
      })
    })
  })

  describe('calculateTotalInventoryValue', () => {
    it('should calculate total value for multiple items', () => {
      const items: InventoryWithRelations[] = [
        {
          id: '1',
          organization_id: 'org-1',
          product_id: 'prod-1',
          warehouse_id: 'wh-1',
          quantity: 10,
          reserved_quantity: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          product: { id: 'prod-1', base_price: 50 } as any
        },
        {
          id: '2',
          organization_id: 'org-1',
          product_id: 'prod-2',
          warehouse_id: 'wh-1',
          quantity: 20,
          reserved_quantity: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          product: { id: 'prod-2', base_price: 25 } as any
        },
        {
          id: '3',
          organization_id: 'org-1',
          product_id: 'prod-3',
          warehouse_id: 'wh-1',
          quantity: 5,
          reserved_quantity: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          product: { id: 'prod-3', base_price: 100 } as any
        }
      ]
      
      const total = calculateTotalInventoryValue(items)
      // (10 * 50) + (20 * 25) + (5 * 100) = 500 + 500 + 500 = 1500
      expect(total).toBe(1500)
    })

    it('should handle items without products', () => {
      const items: InventoryWithRelations[] = [
        {
          id: '1',
          organization_id: 'org-1',
          product_id: 'prod-1',
          warehouse_id: 'wh-1',
          quantity: 10,
          reserved_quantity: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          product: null as any
        },
        {
          id: '2',
          organization_id: 'org-1',
          product_id: 'prod-2',
          warehouse_id: 'wh-1',
          quantity: 20,
          reserved_quantity: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          product: { id: 'prod-2', base_price: 25 } as any
        }
      ]
      
      const total = calculateTotalInventoryValue(items)
      // (10 * 0) + (20 * 25) = 0 + 500 = 500
      expect(total).toBe(500)
    })

    it('should handle empty array', () => {
      expect(calculateTotalInventoryValue([])).toBe(0)
    })

    it('should handle products without base_price', () => {
      const items: InventoryWithRelations[] = [
        {
          id: '1',
          organization_id: 'org-1',
          product_id: 'prod-1',
          warehouse_id: 'wh-1',
          quantity: 10,
          reserved_quantity: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          product: { id: 'prod-1' } as any
        }
      ]
      
      const total = calculateTotalInventoryValue(items)
      expect(total).toBe(0)
    })
  })

  describe('validateInventoryAdjustment', () => {
    it('should validate valid adjustments', () => {
      expect(validateInventoryAdjustment(100, 150)).toEqual({ valid: true })
      expect(validateInventoryAdjustment(100, 50)).toEqual({ valid: true })
      expect(validateInventoryAdjustment(0, 100)).toEqual({ valid: true })
    })

    it('should reject non-integer quantities', () => {
      expect(validateInventoryAdjustment(100, 150.5)).toEqual({
        valid: false,
        error: 'Quantity must be a whole number'
      })
      
      expect(validateInventoryAdjustment(100, 99.99)).toEqual({
        valid: false,
        error: 'Quantity must be a whole number'
      })
    })

    it('should reject negative quantities by default', () => {
      expect(validateInventoryAdjustment(100, -10)).toEqual({
        valid: false,
        error: 'Quantity cannot be negative'
      })
    })

    it('should allow negative quantities when specified', () => {
      expect(validateInventoryAdjustment(100, -10, true)).toEqual({ valid: true })
    })

    it('should reject quantities exceeding maximum', () => {
      expect(validateInventoryAdjustment(100, 1000000)).toEqual({
        valid: false,
        error: 'Quantity exceeds maximum allowed value'
      })
    })

    it('should reject unchanged quantities', () => {
      expect(validateInventoryAdjustment(100, 100)).toEqual({
        valid: false,
        error: 'New quantity must be different from current quantity'
      })
    })

    it('should validate zero as valid new quantity', () => {
      expect(validateInventoryAdjustment(100, 0)).toEqual({ valid: true })
    })

    it('should validate maximum allowed value', () => {
      expect(validateInventoryAdjustment(100, 999999)).toEqual({ valid: true })
    })
  })

  describe('formatQuantity', () => {
    it('should format quantities with commas', () => {
      expect(formatQuantity(1000)).toBe('1,000')
      expect(formatQuantity(1000000)).toBe('1,000,000')
      expect(formatQuantity(123456789)).toBe('123,456,789')
    })

    it('should handle small numbers without commas', () => {
      expect(formatQuantity(0)).toBe('0')
      expect(formatQuantity(1)).toBe('1')
      expect(formatQuantity(999)).toBe('999')
    })

    it('should add units when provided', () => {
      expect(formatQuantity(1, 'item')).toBe('1 item')
      expect(formatQuantity(2, 'item')).toBe('2 items')
      expect(formatQuantity(1000, 'unit')).toBe('1,000 units')
    })

    it('should handle pluralization correctly', () => {
      expect(formatQuantity(0, 'box')).toBe('0 boxs') // Note: simple pluralization
      expect(formatQuantity(1, 'box')).toBe('1 box')
      expect(formatQuantity(2, 'box')).toBe('2 boxs')
    })

    it('should format without unit when not provided', () => {
      expect(formatQuantity(12345)).toBe('12,345')
      expect(formatQuantity(12345, undefined)).toBe('12,345')
      expect(formatQuantity(12345, '')).toBe('12,345')
    })

    it('should handle negative numbers', () => {
      expect(formatQuantity(-1000)).toBe('-1,000')
      expect(formatQuantity(-5, 'item')).toBe('-5 items')
    })
  })

  describe('calculateFillRate', () => {
    it('should calculate fill rate correctly', () => {
      expect(calculateFillRate(90, 100)).toBe(90)
      expect(calculateFillRate(75, 100)).toBe(75)
      expect(calculateFillRate(100, 100)).toBe(100)
    })

    it('should round to nearest integer', () => {
      expect(calculateFillRate(2, 3)).toBe(67) // 66.666... → 67
      expect(calculateFillRate(1, 3)).toBe(33) // 33.333... → 33
      expect(calculateFillRate(5, 7)).toBe(71) // 71.428... → 71
    })

    it('should return 100% for zero total orders', () => {
      expect(calculateFillRate(0, 0)).toBe(100)
    })

    it('should handle zero fulfilled orders', () => {
      expect(calculateFillRate(0, 100)).toBe(0)
    })

    it('should handle edge cases', () => {
      expect(calculateFillRate(1, 1)).toBe(100)
      expect(calculateFillRate(99, 100)).toBe(99)
      expect(calculateFillRate(999, 1000)).toBe(100) // 99.9 → 100
    })
  })
})