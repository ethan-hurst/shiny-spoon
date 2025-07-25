import {
  calculateBatchPrices,
  calculatePrice,
  calculatePriceWithExplanation,
  comparePrices,
  getQuantityBreakPrices,
  getQuickPrice,
  validatePriceMargin,
} from '@/lib/pricing/calculate-price'
// PricingEngine is mocked in this test
import { PriceCalculationRequest } from '@/types/pricing.types'

// Mock the pricing engine
jest.mock('@/lib/pricing/pricing-engine', () => ({
  getPricingEngine: jest.fn(() => ({
    calculatePrice: jest.fn(),
    calculateBatchPrices: jest.fn(),
  })),
  PricingEngine: jest.fn(),
}))

describe('Price Calculation Utilities', () => {
  let mockEngine: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockEngine = {
      calculatePrice: jest.fn(),
      calculateBatchPrices: jest.fn(),
    }
    const { getPricingEngine } = require('@/lib/pricing/pricing-engine')
    getPricingEngine.mockReturnValue(mockEngine)
  })

  describe('calculatePrice', () => {
    it('should calculate a single price', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product',
        quantity: 10,
      }

      const expectedResult = {
        base_price: 100,
        final_price: 90,
        discount_amount: 10,
        discount_percent: 10,
        margin_percent: 40,
        applied_rules: [],
      }

      mockEngine.calculatePrice.mockResolvedValue(expectedResult)

      const result = await calculatePrice(request)

      expect(mockEngine.calculatePrice).toHaveBeenCalledWith(request)
      expect(result).toEqual(expectedResult)
    })
  })

  describe('calculateBatchPrices', () => {
    it('should calculate prices for multiple products', async () => {
      const requests: PriceCalculationRequest[] = [
        { product_id: 'product-1', quantity: 5 },
        { product_id: 'product-2', quantity: 10 },
      ]

      const expectedMap = new Map([
        [
          'product-1',
          {
            base_price: 50,
            final_price: 45,
            discount_amount: 5,
            discount_percent: 10,
            margin_percent: 35,
            applied_rules: [],
          },
        ],
        [
          'product-2',
          {
            base_price: 100,
            final_price: 85,
            discount_amount: 15,
            discount_percent: 15,
            margin_percent: 40,
            applied_rules: [],
          },
        ],
      ])

      mockEngine.calculateBatchPrices.mockResolvedValue(expectedMap)

      const result = await calculateBatchPrices(requests)

      expect(mockEngine.calculateBatchPrices).toHaveBeenCalledWith(requests)
      expect(result).toEqual(expectedMap)
    })
  })

  describe('getQuickPrice', () => {
    it('should return final price for quick display', async () => {
      mockEngine.calculatePrice.mockResolvedValue({
        base_price: 100,
        final_price: 85,
        discount_amount: 15,
        discount_percent: 15,
        margin_percent: 40,
        applied_rules: [],
      })

      const price = await getQuickPrice('test-product', 'test-customer', 10)

      expect(price).toBe(85)
      expect(mockEngine.calculatePrice).toHaveBeenCalledWith({
        product_id: 'test-product',
        customer_id: 'test-customer',
        quantity: 10,
      })
    })

    it('should return 0 on error', async () => {
      mockEngine.calculatePrice.mockRejectedValue(new Error('Test error'))

      const price = await getQuickPrice('test-product')

      expect(price).toBe(0)
    })

    it('should use default quantity of 1', async () => {
      mockEngine.calculatePrice.mockResolvedValue({
        base_price: 100,
        final_price: 100,
        discount_amount: 0,
        discount_percent: 0,
        margin_percent: 50,
        applied_rules: [],
      })

      await getQuickPrice('test-product')

      expect(mockEngine.calculatePrice).toHaveBeenCalledWith({
        product_id: 'test-product',
        customer_id: undefined,
        quantity: 1,
      })
    })
  })

  describe('calculatePriceWithExplanation', () => {
    it('should provide detailed price breakdown', async () => {
      const request: PriceCalculationRequest = {
        product_id: 'test-product',
        customer_id: 'test-customer',
        quantity: 50,
      }

      mockEngine.calculatePrice.mockResolvedValue({
        base_price: 100,
        final_price: 75,
        discount_amount: 25,
        discount_percent: 25,
        margin_percent: 35,
        applied_rules: [
          {
            rule_id: 'rule-1',
            type: 'quantity',
            name: 'Bulk Discount',
            discount_type: 'percentage',
            discount_value: 15,
            discount_amount: 15,
          },
          {
            rule_id: 'rule-2',
            type: 'customer',
            name: 'VIP Customer',
            discount_type: 'percentage',
            discount_value: 10,
            discount_amount: 10,
          },
        ],
      })

      const { result, explanation } =
        await calculatePriceWithExplanation(request)

      expect(result.final_price).toBe(75)
      expect(explanation).toContain('Base price: $100.00')
      expect(explanation).toContain('Applied discounts:')
      expect(explanation).toContain('• Bulk Discount (15% off) = -$15.00')
      expect(explanation).toContain('• VIP Customer (10% off) = -$10.00')
      expect(explanation).toContain('Total discount: $25.00 (25.0%)')
      expect(explanation).toContain('Final price: $75.00')
      expect(explanation).toContain('Margin: 35.0%')
    })

    it('should handle no discounts', async () => {
      mockEngine.calculatePrice.mockResolvedValue({
        base_price: 100,
        final_price: 100,
        discount_amount: 0,
        discount_percent: 0,
        margin_percent: 50,
        applied_rules: [],
      })

      const { explanation } = await calculatePriceWithExplanation({
        product_id: 'test-product',
        quantity: 1,
      })

      expect(explanation).toContain('Base price: $100.00')
      expect(explanation).toContain('Final price: $100.00')
      expect(explanation).not.toContain('Applied discounts:')
    })
  })

  describe('comparePrices', () => {
    it('should compare prices across different scenarios', async () => {
      const productId = 'test-product'
      const scenarios = [
        { quantity: 1, label: 'Regular Price' },
        { customerId: 'vip-customer', quantity: 1, label: 'VIP Price' },
        { quantity: 100, label: 'Bulk Price' },
      ]

      mockEngine.calculatePrice
        .mockResolvedValueOnce({
          base_price: 100,
          final_price: 100,
          discount_amount: 0,
          discount_percent: 0,
          margin_percent: 50,
          applied_rules: [],
        })
        .mockResolvedValueOnce({
          base_price: 100,
          final_price: 85,
          discount_amount: 15,
          discount_percent: 15,
          margin_percent: 42,
          applied_rules: [],
        })
        .mockResolvedValueOnce({
          base_price: 100,
          final_price: 80,
          discount_amount: 20,
          discount_percent: 20,
          margin_percent: 40,
          applied_rules: [],
        })

      const results = await comparePrices(productId, scenarios)

      expect(results).toHaveLength(3)
      expect(results[0]?.savings).toBe(0)
      expect(results[1]?.savings).toBe(15)
      expect(results[2]?.savings).toBe(20)
      expect(results[2]?.savingsPercent).toBe(20)
    })
  })

  describe('getQuantityBreakPrices', () => {
    it('should calculate prices for different quantity tiers', async () => {
      const productId = 'test-product'
      const quantities = [1, 10, 50, 100]

      mockEngine.calculatePrice
        .mockResolvedValueOnce({
          base_price: 100,
          final_price: 100,
          discount_amount: 0,
          discount_percent: 0,
          margin_percent: 50,
          applied_rules: [],
        })
        .mockResolvedValueOnce({
          base_price: 100,
          final_price: 950, // Total for 10 units
          discount_amount: 50,
          discount_percent: 5,
          margin_percent: 47,
          applied_rules: [],
        })
        .mockResolvedValueOnce({
          base_price: 100,
          final_price: 4500, // Total for 50 units
          discount_amount: 500,
          discount_percent: 10,
          margin_percent: 45,
          applied_rules: [],
        })
        .mockResolvedValueOnce({
          base_price: 100,
          final_price: 8500, // Total for 100 units
          discount_amount: 1500,
          discount_percent: 15,
          margin_percent: 42,
          applied_rules: [],
        })

      const results = await getQuantityBreakPrices(
        productId,
        undefined,
        quantities
      )

      expect(results).toHaveLength(4)
      expect(results[0]?.unitPrice).toBe(100)
      expect(results[1]?.unitPrice).toBe(95)
      expect(results[2]?.unitPrice).toBe(90)
      expect(results[3]?.unitPrice).toBe(85)
      expect(results[3]?.savingsPercent).toBe(15)
    })

    it('should use default quantities if not provided', async () => {
      mockEngine.calculatePrice.mockResolvedValue({
        base_price: 100,
        final_price: 100,
        discount_amount: 0,
        discount_percent: 0,
        margin_percent: 50,
        applied_rules: [],
      })

      await getQuantityBreakPrices('test-product')

      // Should be called 5 times for default quantities [1, 10, 25, 50, 100]
      expect(mockEngine.calculatePrice).toHaveBeenCalledTimes(5)
    })
  })

  describe('validatePriceMargin', () => {
    it('should validate margin meets minimum requirement', () => {
      const result = validatePriceMargin(100, 60, 30)

      expect(result.isValid).toBe(true)
      expect(result.currentMargin).toBe(40) // (100-60)/100 * 100 = 40%
      expect(result.requiredPrice).toBeCloseTo(85.71, 2) // 60/(1-0.30) = 85.71
    })

    it('should detect insufficient margin', () => {
      const result = validatePriceMargin(80, 60, 30)

      expect(result.isValid).toBe(false)
      expect(result.currentMargin).toBe(25) // (80-60)/80 * 100 = 25%
      expect(result.requiredPrice).toBeCloseTo(85.71, 2)
    })

    it('should handle zero price', () => {
      const result = validatePriceMargin(0, 50, 20)

      expect(result.isValid).toBe(false)
      expect(result.currentMargin).toBe(-Infinity)
      expect(result.requiredPrice).toBeCloseTo(62.5, 2)
    })

    it('should handle negative margin requirements', () => {
      const result = validatePriceMargin(100, 120, 20)

      expect(result.isValid).toBe(false)
      expect(result.currentMargin).toBe(-20) // Selling at a loss
      expect(result.requiredPrice).toBe(150) // 120/(1-0.20) = 150
    })
  })
})
