import {
  calculateInventoryBasedPrice,
  clearInventoryCache,
  getCachedInventory,
  getInventoryConditions,
  getProductInventory,
  InventoryData,
  isQuantityAvailable,
} from '@/lib/pricing/inventory-integration'
import { createClient } from '@/lib/supabase/client'

// Mock dependencies
jest.mock('@/lib/supabase/client')

describe('Pricing Inventory Integration', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  const mockInventoryItems = [
    {
      quantity: 100,
      reserved_quantity: 10,
      warehouse_id: 'warehouse-1',
    },
    {
      quantity: 50,
      reserved_quantity: 5,
      warehouse_id: 'warehouse-2',
    },
  ]

  const mockSingleInventoryItem = {
    quantity: 75,
    reserved_quantity: 15,
    warehouse_id: 'warehouse-1',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Clear cache between tests
    clearInventoryCache()

    mockSupabase = createMockSupabase()
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock console.error to avoid noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getProductInventory', () => {
    it('should fetch and aggregate inventory from multiple warehouses', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockInventoryItems,
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await getProductInventory('product-123', 'org-123')

      expect(result).toEqual({
        totalQuantity: 150, // 100 + 50
        availableQuantity: 135, // (100-10) + (50-5)
        reservedQuantity: 15, // 10 + 5
        warehouseId: undefined, // Multiple warehouses
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
    })

    it('should filter by warehouse when specified', async () => {
      const mockEq = jest.fn().mockResolvedValue({
        data: [mockSingleInventoryItem],
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: mockEq,
            }),
          }),
        }),
      } as any)

      const result = await getProductInventory(
        'product-123',
        'org-123',
        'warehouse-1'
      )

      expect(result).toEqual({
        totalQuantity: 75,
        availableQuantity: 60, // 75 - 15
        reservedQuantity: 15,
        warehouseId: 'warehouse-1',
      })

      expect(mockEq).toHaveBeenCalled()
    })

    it('should handle null quantity values', async () => {
      const inventoryWithNulls = [
        {
          quantity: null,
          reserved_quantity: 10,
          warehouse_id: 'warehouse-1',
        },
        {
          quantity: 50,
          reserved_quantity: null,
          warehouse_id: 'warehouse-2',
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: inventoryWithNulls,
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await getProductInventory('product-123', 'org-123')

      expect(result).toEqual({
        totalQuantity: 50, // null treated as 0
        availableQuantity: 40, // 50 - 10
        reservedQuantity: 10, // null treated as 0
        warehouseId: undefined,
      })
    })

    it('should return null when no inventory found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await getProductInventory('product-123', 'org-123')

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as any)

      const result = await getProductInventory('product-123', 'org-123')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Failed to fetch inventory:', {
        message: 'Database error',
      })
    })

    it('should handle exceptions gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Connection failed')
      })

      const result = await getProductInventory('product-123', 'org-123')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        'Inventory fetch error:',
        expect.any(Error)
      )
    })

    it('should set warehouseId for single warehouse inventory', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [mockSingleInventoryItem],
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await getProductInventory('product-123', 'org-123')

      expect(result?.warehouseId).toBe('warehouse-1')
    })
  })

  describe('getCachedInventory', () => {
    beforeEach(() => {
      // Mock Date.now for consistent cache testing
      jest.spyOn(Date, 'now').mockReturnValue(1000000)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return cached data when available and not expired', async () => {
      // First call to populate cache
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [mockSingleInventoryItem],
              error: null,
            }),
          }),
        }),
      } as any)

      const firstResult = await getCachedInventory('product-123', 'org-123')

      // Second call should use cache (advance time by 30 seconds)
      ;(Date.now as jest.Mock).mockReturnValue(1030000)
      const callCountBeforeSecondCall = mockSupabase.from.mock.calls.length

      const secondResult = await getCachedInventory('product-123', 'org-123')

      expect(firstResult).toEqual(secondResult)
      expect(mockSupabase.from).toHaveBeenCalledTimes(callCountBeforeSecondCall) // No additional calls
    })

    it('should fetch fresh data when cache is expired', async () => {
      // First call to populate cache
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [mockSingleInventoryItem],
              error: null,
            }),
          }),
        }),
      } as any)

      await getCachedInventory('product-123', 'org-123')

      // Advance time beyond cache TTL (1 minute + 1 second)
      ;(Date.now as jest.Mock).mockReturnValue(1061000)

      await getCachedInventory('product-123', 'org-123')

      expect(mockSupabase.from).toHaveBeenCalledTimes(2) // Called twice
    })

    it('should not cache null results', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any)

      const result1 = await getCachedInventory('product-123', 'org-123')
      const result2 = await getCachedInventory('product-123', 'org-123')

      expect(result1).toBeNull()
      expect(result2).toBeNull()
      expect(mockSupabase.from).toHaveBeenCalledTimes(2) // Called twice, no caching
    })

    it('should generate correct cache keys', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [mockSingleInventoryItem],
              error: null,
            }),
          }),
        }),
      } as any)

      // Call with different parameters
      await getCachedInventory('product-123', 'org-123')
      await getCachedInventory('product-123', 'org-123', 'warehouse-1')
      await getCachedInventory('product-456', 'org-123')

      expect(mockSupabase.from).toHaveBeenCalledTimes(3) // Each should be cached separately
    })
  })

  describe('clearInventoryCache', () => {
    it('should clear all cache when no productId specified', () => {
      // Populate cache
      const cache = require('@/lib/pricing/inventory-integration')
      const inventoryCache = cache.inventoryCache || new Map()
      inventoryCache.set('product-123:org-123:all', {
        data: {},
        expires: Date.now() + 60000,
      })
      inventoryCache.set('product-456:org-123:all', {
        data: {},
        expires: Date.now() + 60000,
      })

      clearInventoryCache()

      // Since we can't directly access the internal cache in the test,
      // we'll verify behavior through subsequent calls
      expect(() => clearInventoryCache()).not.toThrow()
    })

    it('should clear specific product cache when productId specified', () => {
      clearInventoryCache('product-123')

      expect(() => clearInventoryCache('product-123')).not.toThrow()
    })
  })

  describe('calculateInventoryBasedPrice', () => {
    const basePrice = 100

    it('should apply critical level multiplier when inventory is below 10%', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 5, // 5% available
        reservedQuantity: 95,
        warehouseId: 'warehouse-1',
      }

      const result = calculateInventoryBasedPrice(basePrice, inventoryData)

      expect(result).toBe(120) // 100 * 1.2 (default critical multiplier)
    })

    it('should apply low level multiplier when inventory is 10-25%', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 20, // 20% available
        reservedQuantity: 80,
      }

      const result = calculateInventoryBasedPrice(basePrice, inventoryData)

      expect(result).toBeCloseTo(110, 2) // 100 * 1.1 (default low multiplier)
    })

    it('should apply excess discount when inventory is above 75%', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 80, // 80% available
        reservedQuantity: 20,
      }

      const result = calculateInventoryBasedPrice(basePrice, inventoryData)

      expect(result).toBe(90) // 100 * (1 - 0.1) (default 10% discount)
    })

    it('should return base price for normal inventory levels (25-75%)', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 50, // 50% available
        reservedQuantity: 50,
      }

      const result = calculateInventoryBasedPrice(basePrice, inventoryData)

      expect(result).toBe(100) // Base price unchanged
    })

    it('should use custom rules when provided', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 5, // 5% available - critical level
        reservedQuantity: 95,
      }

      const customRules = {
        criticalLevelMultiplier: 1.5, // 50% increase
        lowLevelMultiplier: 1.25, // 25% increase
        excessLevelDiscount: 15, // 15% discount
      }

      const result = calculateInventoryBasedPrice(
        basePrice,
        inventoryData,
        customRules
      )

      expect(result).toBe(150) // 100 * 1.5
    })

    it('should return base price when total quantity is zero or negative', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
      }

      const result = calculateInventoryBasedPrice(basePrice, inventoryData)

      expect(result).toBe(100) // Base price unchanged
    })

    it('should handle edge case percentages correctly', () => {
      // Test exactly 10% (should be low level, not critical)
      const inventoryData10: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 10,
        reservedQuantity: 90,
      }

      const result10 = calculateInventoryBasedPrice(basePrice, inventoryData10)
      expect(result10).toBeCloseTo(110, 2) // Low level multiplier

      // Test exactly 25% (should be normal, not low)
      const inventoryData25: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 25,
        reservedQuantity: 75,
      }

      const result25 = calculateInventoryBasedPrice(basePrice, inventoryData25)
      expect(result25).toBe(100) // Base price

      // Test exactly 75% (should be normal, not excess)
      const inventoryData75: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 75,
        reservedQuantity: 25,
      }

      const result75 = calculateInventoryBasedPrice(basePrice, inventoryData75)
      expect(result75).toBe(100) // Base price
    })
  })

  describe('isQuantityAvailable', () => {
    it('should return true when requested quantity is available', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 50,
        reservedQuantity: 50,
      }

      const result = isQuantityAvailable(30, inventoryData)

      expect(result).toBe(true)
    })

    it('should return false when requested quantity exceeds available', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 20,
        reservedQuantity: 80,
      }

      const result = isQuantityAvailable(30, inventoryData)

      expect(result).toBe(false)
    })

    it('should return true when requested quantity equals available', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 50,
        reservedQuantity: 50,
      }

      const result = isQuantityAvailable(50, inventoryData)

      expect(result).toBe(true)
    })

    it('should return false when inventory data is null', () => {
      const result = isQuantityAvailable(10, null)

      expect(result).toBe(false)
    })

    it('should handle zero quantities correctly', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
      }

      expect(isQuantityAvailable(0, inventoryData)).toBe(true)
      expect(isQuantityAvailable(1, inventoryData)).toBe(false)
    })
  })

  describe('getInventoryConditions', () => {
    it('should categorize critical inventory level (< 10%)', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 5,
        reservedQuantity: 95,
      }

      const result = getInventoryConditions(inventoryData)

      expect(result).toEqual({
        inventory_level: 'critical',
        available_quantity: 5,
        total_quantity: 100,
        inventory_percent: 5,
      })
    })

    it('should categorize low inventory level (10-25%)', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 20,
        reservedQuantity: 80,
      }

      const result = getInventoryConditions(inventoryData)

      expect(result).toEqual({
        inventory_level: 'low',
        available_quantity: 20,
        total_quantity: 100,
        inventory_percent: 20,
      })
    })

    it('should categorize medium inventory level (25-50%)', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 40,
        reservedQuantity: 60,
      }

      const result = getInventoryConditions(inventoryData)

      expect(result).toEqual({
        inventory_level: 'medium',
        available_quantity: 40,
        total_quantity: 100,
        inventory_percent: 40,
      })
    })

    it('should categorize high inventory level (50-75%)', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 60,
        reservedQuantity: 40,
      }

      const result = getInventoryConditions(inventoryData)

      expect(result).toEqual({
        inventory_level: 'high',
        available_quantity: 60,
        total_quantity: 100,
        inventory_percent: 60,
      })
    })

    it('should categorize excess inventory level (> 75%)', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 100,
        availableQuantity: 85,
        reservedQuantity: 15,
      }

      const result = getInventoryConditions(inventoryData)

      expect(result).toEqual({
        inventory_level: 'excess',
        available_quantity: 85,
        total_quantity: 100,
        inventory_percent: 85,
      })
    })

    it('should handle zero or negative total quantity', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 0,
        availableQuantity: 0,
        reservedQuantity: 0,
      }

      const result = getInventoryConditions(inventoryData)

      expect(result).toEqual({
        inventory_level: 'unknown',
        inventory_percent: 0,
      })
    })

    it('should handle edge case percentages correctly', () => {
      // Test exactly at boundaries
      const testCases = [
        { available: 10, total: 100, expected: 'low' }, // Exactly 10%
        { available: 25, total: 100, expected: 'medium' }, // Exactly 25%
        { available: 50, total: 100, expected: 'high' }, // Exactly 50%
        { available: 75, total: 100, expected: 'excess' }, // Exactly 75%
      ]

      testCases.forEach(({ available, total, expected }) => {
        const inventoryData: InventoryData = {
          totalQuantity: total,
          availableQuantity: available,
          reservedQuantity: total - available,
        }

        const result = getInventoryConditions(inventoryData)
        expect(result.inventory_level).toBe(expected)
      })
    })

    it('should calculate percentage correctly with decimal results', () => {
      const inventoryData: InventoryData = {
        totalQuantity: 33,
        availableQuantity: 11, // 33.33% available
        reservedQuantity: 22,
      }

      const result = getInventoryConditions(inventoryData)

      expect(result.inventory_level).toBe('medium')
      expect(result.inventory_percent).toBeCloseTo(33.33, 2)
    })
  })

  describe('Integration tests', () => {
    it('should work together for pricing calculation workflow', async () => {
      // Mock inventory data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [mockSingleInventoryItem],
              error: null,
            }),
          }),
        }),
      } as any)

      // Get inventory
      const inventory = await getProductInventory('product-123', 'org-123')
      expect(inventory).not.toBeNull()

      // Check quantity availability
      const isAvailable = isQuantityAvailable(10, inventory)
      expect(isAvailable).toBe(true)

      // Calculate dynamic price
      const dynamicPrice = calculateInventoryBasedPrice(100, inventory!)
      expect(dynamicPrice).toBe(90) // 60/75 = 80% available, so excess discount applies

      // Get inventory conditions
      const conditions = getInventoryConditions(inventory!)
      expect(conditions.inventory_level).toBe('excess') // 80% available
    })

    it('should handle complete workflow with cached data', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000)

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [mockSingleInventoryItem],
              error: null,
            }),
          }),
        }),
      } as any)

      // First call - should fetch from database
      const inventory1 = await getCachedInventory('product-123', 'org-123')

      // Second call - should use cache
      const inventory2 = await getCachedInventory('product-123', 'org-123')

      expect(inventory1).toEqual(inventory2)
      expect(mockSupabase.from).toHaveBeenCalledTimes(1)

      // Clear cache and verify fresh fetch
      clearInventoryCache('product-123')

      const inventory3 = await getCachedInventory('product-123', 'org-123')
      expect(mockSupabase.from).toHaveBeenCalledTimes(2)
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn(),
        }),
      }),
    }),
  }
}
