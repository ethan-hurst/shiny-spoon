import { PricingEngine } from '@/lib/pricing/pricing-engine'
import {
  PriceCalculationRequest,
  PriceContext,
  PricingRuleRecord,
} from '@/types/pricing.types'
import {
  createMockQueryBuilder,
  setupSupabaseMocks,
} from '../../../utils/supabase-mocks'

// Mock dependencies
jest.mock('@/lib/supabase/client')
jest.mock('@/lib/pricing/redis-cache', () => ({
  pricingCache: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    clearProduct: jest.fn(),
    clearCustomer: jest.fn(),
  },
}))

describe('PricingEngine', () => {
  let pricingEngine: PricingEngine
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    setupSupabaseMocks()

    // Mock supabase responses
    mockSupabase = {
      rpc: jest.fn().mockResolvedValue({
        data: [
          {
            base_price: 100,
            final_price: 90,
            discount_amount: 10,
            discount_percent: 10,
            margin_percent: 30,
            applied_rules: [],
          },
        ],
        error: null,
      }),
      from: jest.fn(() => createMockQueryBuilder()),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    }

    // Create pricing engine with mocked client
    pricingEngine = new PricingEngine()
    // Inject the mock client if the constructor allows it
    ;(pricingEngine as any).supabase = mockSupabase
  })

  describe('calculatePrice', () => {
    it('should calculate base price correctly with no discounts', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product-id',
        quantity: 1,
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            base_price: 100,
            final_price: 100,
            discount_amount: 0,
            discount_percent: 0,
            margin_percent: 50,
            applied_rules: [],
          },
        ],
        error: null,
      })

      const result = await pricingEngine.calculatePrice(request)

      expect(result.base_price).toBe(100)
      expect(result.final_price).toBe(100)
      expect(result.discount_amount).toBe(0)
      expect(result.discount_percent).toBe(0)
    })

    it('should apply quantity breaks correctly', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product-id',
        quantity: 100,
        customer_id: 'test-customer-id',
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            base_price: 100,
            final_price: 85,
            discount_amount: 15,
            discount_percent: 15,
            margin_percent: 40,
            applied_rules: [
              {
                rule_id: 'rule-1',
                type: 'quantity',
                name: 'Bulk Discount',
                discount_type: 'percentage',
                discount_value: 15,
                discount_amount: 15,
              },
            ],
          },
        ],
        error: null,
      })

      const result = await pricingEngine.calculatePrice(request)

      expect(result.final_price).toBe(85)
      expect(result.discount_percent).toBe(15)
      expect(result.applied_rules).toHaveLength(1)
      expect(result.applied_rules[0]?.type).toBe('quantity')
    })

    it('should handle customer-specific pricing', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product-id',
        customer_id: 'vip-customer-id',
        quantity: 10,
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            base_price: 100,
            final_price: 75,
            discount_amount: 25,
            discount_percent: 25,
            margin_percent: 35,
            applied_rules: [
              {
                rule_id: 'rule-2',
                type: 'customer',
                name: 'VIP Customer Discount',
                discount_type: 'percentage',
                discount_value: 25,
                discount_amount: 25,
              },
            ],
          },
        ],
        error: null,
      })

      const result = await pricingEngine.calculatePrice(request)

      expect(result.final_price).toBe(75)
      expect(result.discount_percent).toBe(25)
      expect(result.applied_rules[0]?.type).toBe('customer')
    })

    it('should handle promotional pricing with dates', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product-id',
        quantity: 1,
        requested_date: '2024-12-25', // Christmas promotion
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            base_price: 100,
            final_price: 80,
            discount_amount: 20,
            discount_percent: 20,
            margin_percent: 30,
            applied_rules: [
              {
                rule_id: 'rule-3',
                type: 'promotion',
                name: 'Christmas Sale',
                discount_type: 'percentage',
                discount_value: 20,
                discount_amount: 20,
              },
            ],
          },
        ],
        error: null,
      })

      const result = await pricingEngine.calculatePrice(request)

      expect(result.final_price).toBe(80)
      expect(result.applied_rules[0]?.type).toBe('promotion')
      expect(result.applied_rules[0]?.name).toBe('Christmas Sale')
    })

    it('should handle errors from the database', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product-id',
        quantity: 1,
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      })

      await expect(pricingEngine.calculatePrice(request)).rejects.toThrow(
        'Price calculation failed: Database error'
      )
    })

    it('should handle empty results', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'non-existent-product',
        quantity: 1,
      }

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      })

      await expect(pricingEngine.calculatePrice(request)).rejects.toThrow(
        'No pricing data returned'
      )
    })
  })

  describe('getApplicableRules', () => {
    it('should filter rules by date range', async () => {
      // Use dynamic dates relative to today
      const today = new Date()
      const testDate = new Date(today.getFullYear(), today.getMonth() + 1, 15) // Next month, 15th day
      const summerStart = new Date(today.getFullYear(), today.getMonth(), 1) // Start of current month
      const summerEnd = new Date(today.getFullYear(), today.getMonth() + 2, 31) // End of month after next
      const winterStart = new Date(today.getFullYear(), today.getMonth() + 6, 1) // 6 months later
      const winterEnd = new Date(today.getFullYear(), today.getMonth() + 8, 28) // 8 months later

      const context: PriceContext = {
        productId: 'test-product',
        quantity: 10,
        date: testDate,
        basePrice: 100,
        cost: 50,
        minMargin: 20,
        organizationId: 'test-org',
      }

      const mockRules = [
        {
          id: 'rule-1',
          name: 'Summer Sale',
          rule_type: 'promotion',
          start_date: summerStart.toISOString().split('T')[0],
          end_date: summerEnd.toISOString().split('T')[0],
          is_active: true,
          conditions: {},
        },
        {
          id: 'rule-2',
          name: 'Winter Sale',
          rule_type: 'promotion',
          start_date: winterStart.toISOString().split('T')[0],
          end_date: winterEnd.toISOString().split('T')[0],
          is_active: true,
          conditions: {},
        },
      ]

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockRules, error: null }),
      }))

      const rules = await pricingEngine.getApplicableRules(context)

      // Should only return Summer Sale rule
      expect(rules).toHaveLength(1)
      expect(rules[0]?.name).toBe('Summer Sale')
    })

    it('should filter rules by product and category', async () => {
      const context: PriceContext = {
        productId: 'test-product',
        productCategory: 'electronics',
        quantity: 5,
        date: new Date(),
        basePrice: 100,
        cost: 50,
        minMargin: 20,
        organizationId: 'test-org',
      }

      const mockRules = [
        {
          id: 'rule-1',
          name: 'Product Specific',
          rule_type: 'product',
          product_id: 'test-product',
          is_active: true,
          conditions: {},
        },
        {
          id: 'rule-2',
          name: 'Category Wide',
          rule_type: 'category',
          category_id: 'electronics',
          is_active: true,
          conditions: {},
        },
        {
          id: 'rule-3',
          name: 'Different Product',
          rule_type: 'product',
          product_id: 'other-product',
          is_active: true,
          conditions: {},
        },
      ]

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockRules, error: null }),
      }))

      const rules = await pricingEngine.getApplicableRules(context)

      // Should return product specific and category rules, but not different product
      expect(rules).toHaveLength(2)
      expect(rules.map((r) => r.name)).toContain('Product Specific')
      expect(rules.map((r) => r.name)).toContain('Category Wide')
      expect(rules.map((r) => r.name)).not.toContain('Different Product')
    })
  })

  describe('applyRule', () => {
    it('should apply percentage discount correctly', () => {
      const rule: PricingRuleRecord = {
        id: 'rule-1',
        name: 'Test Discount',
        rule_type: 'tier',
        discount_type: 'percentage',
        discount_value: 10,
        conditions: {},
        is_active: true,
        priority: 1,
        is_exclusive: false,
        can_stack: true,
        organization_id: 'test-org',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const context: PriceContext = {
        productId: 'test-product',
        quantity: 1,
        date: new Date(),
        basePrice: 100,
        cost: 50,
        minMargin: 20,
        organizationId: 'test-org',
      }

      const result = pricingEngine.applyRule(rule, 100, context)

      expect(result.applied).toBe(true)
      expect(result.newPrice).toBe(90)
      expect(result.appliedRule.discount_amount).toBe(10)
    })

    it('should apply fixed discount correctly', () => {
      const rule: PricingRuleRecord = {
        id: 'rule-1',
        name: 'Fixed Discount',
        rule_type: 'tier',
        discount_type: 'fixed',
        discount_value: 15,
        conditions: {},
        is_active: true,
        priority: 1,
        is_exclusive: false,
        can_stack: true,
        organization_id: 'test-org',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const context: PriceContext = {
        productId: 'test-product',
        quantity: 1,
        date: new Date(),
        basePrice: 100,
        cost: 50,
        minMargin: 20,
        organizationId: 'test-org',
      }

      const result = pricingEngine.applyRule(rule, 100, context)

      expect(result.applied).toBe(true)
      expect(result.newPrice).toBe(85)
      expect(result.appliedRule.discount_amount).toBe(15)
    })

    it('should apply special price correctly', () => {
      const rule: PricingRuleRecord = {
        id: 'rule-1',
        name: 'Special Price',
        rule_type: 'override',
        discount_type: 'price',
        discount_value: 75,
        conditions: {},
        is_active: true,
        priority: 1,
        is_exclusive: false,
        can_stack: true,
        organization_id: 'test-org',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const context: PriceContext = {
        productId: 'test-product',
        quantity: 1,
        date: new Date(),
        basePrice: 100,
        cost: 50,
        minMargin: 20,
        organizationId: 'test-org',
      }

      const result = pricingEngine.applyRule(rule, 100, context)

      expect(result.applied).toBe(true)
      expect(result.newPrice).toBe(75)
      expect(result.appliedRule.discount_amount).toBe(25)
    })

    it('should handle quantity breaks', () => {
      const rule: PricingRuleRecord = {
        id: 'rule-1',
        name: 'Quantity Discount',
        rule_type: 'quantity',
        conditions: {},
        is_active: true,
        priority: 1,
        is_exclusive: false,
        can_stack: true,
        organization_id: 'test-org',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Quantity breaks would be handled separately in the actual implementation
      // const quantityBreaks = [
      //   {
      //     id: 'qb-1',
      //     rule_id: 'rule-1',
      //     min_quantity: 10,
      //     max_quantity: 50,
      //     discount_type: 'percentage',
      //     discount_value: 5,
      //     created_at: new Date().toISOString(),
      //   },
      //   {
      //     id: 'qb-2',
      //     rule_id: 'rule-1',
      //     min_quantity: 51,
      //     max_quantity: null,
      //     discount_type: 'percentage',
      //     discount_value: 10,
      //     created_at: new Date().toISOString(),
      //   },
      // ]

      // Test quantity 25 (should get 5% discount)
      const context1: PriceContext = {
        productId: 'test-product',
        quantity: 25,
        date: new Date(),
        basePrice: 100,
        cost: 50,
        minMargin: 20,
        organizationId: 'test-org',
      }

      const result1 = pricingEngine.applyRule(rule, 100, context1)
      expect(result1.newPrice).toBe(95)

      // Test quantity 100 (should get 10% discount)
      const context2: PriceContext = {
        ...context1,
        quantity: 100,
      }

      const result2 = pricingEngine.applyRule(rule, 100, context2)
      expect(result2.newPrice).toBe(90)

      // Test quantity 5 (no applicable break)
      const context3: PriceContext = {
        ...context1,
        quantity: 5,
      }

      const result3 = pricingEngine.applyRule(rule, 100, context3)
      expect(result3.applied).toBe(false)
    })
  })

  describe('enforceMinimumMargin', () => {
    it('should enforce minimum margin correctly', () => {
      const cost = 70
      const minMargin = 30 // 30%

      // Price that would give 20% margin (too low)
      const lowPrice = 87.5
      const adjustedPrice = pricingEngine.enforceMinimumMargin(
        lowPrice,
        cost,
        minMargin
      )

      // Should be adjusted to maintain 30% margin
      expect(adjustedPrice).toBe(100)
    })

    it('should not adjust price if margin is already sufficient', () => {
      const cost = 50
      const minMargin = 20
      const goodPrice = 100 // 50% margin

      const adjustedPrice = pricingEngine.enforceMinimumMargin(
        goodPrice,
        cost,
        minMargin
      )

      expect(adjustedPrice).toBe(goodPrice)
    })
  })

  describe('caching', () => {
    it('should cache price calculations', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product-id',
        quantity: 1,
      }

      // Mock cache miss on first call
      mockPricingCache.get.mockResolvedValueOnce(null)

      // First call - should invoke RPC and cache result
      await pricingEngine.calculatePrice(request)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)
      expect(mockPricingCache.set).toHaveBeenCalledTimes(1)

      // Mock cache hit on second call
      mockPricingCache.get.mockResolvedValueOnce({
        base_price: 100,
        final_price: 90,
        discount_amount: 10,
        discount_percent: 10,
        margin_percent: 30,
        applied_rules: [],
      })

      // Second call should use cache and not invoke RPC again
      await pricingEngine.calculatePrice(request)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1) // Still 1, no additional call
      expect(mockPricingCache.get).toHaveBeenCalledTimes(2)
    })

    it('should clear cache for specific product', async () => {
      await pricingEngine.clearCache('test-product-id')
      expect(mockPricingCache.clearProduct).toHaveBeenCalledWith(
        'test-product-id'
      )
    })

    it('should clear all cache', async () => {
      await pricingEngine.clearCache()
      expect(mockPricingCache.clear).toHaveBeenCalled()
    })
  })
})
