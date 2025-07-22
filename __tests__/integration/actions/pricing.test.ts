import { createClient } from '@supabase/supabase-js'
import { FormData } from 'undici'
import {
  bulkUpdateCustomerPrices,
  calculatePrice,
  createCustomerPricing,
  createPricingRule,
  createProductPricing,
  updateCustomerPricing,
  updatePricingRule,
  updateProductPricing,
} from '@/app/actions/pricing'

// Enhanced test setup with improved mocks for reliable CI execution
const describeWithSupabase = describe

// Mock Next.js modules
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    }),
  },
  from: jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  rpc: jest.fn(),
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
  createServerClient: jest.fn(() => mockSupabase),
}))

describe('Pricing Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createProductPricing', () => {
    it('should create product pricing with valid data', async () => {
      const formData = new FormData()
      formData.append('product_id', 'test-product-id')
      formData.append('cost', '50.00')
      formData.append('base_price', '100.00')
      formData.append('min_margin_percent', '30')
      formData.append('currency', 'USD')
      formData.append('pricing_unit', 'EACH')
      formData.append('unit_quantity', '1')

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })

      await createProductPricing(formData as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('product_pricing')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        product_id: 'test-product-id',
        cost: 50,
        base_price: 100,
        min_margin_percent: 30,
        currency: 'USD',
        pricing_unit: 'EACH',
        unit_quantity: 1,
        created_by: 'test-user-id',
        effective_date: undefined,
        expiry_date: undefined,
      })
    })

    it('should handle invalid numeric inputs', async () => {
      const formData = new FormData()
      formData.append('product_id', 'test-product-id')
      formData.append('cost', 'invalid')
      formData.append('base_price', 'invalid')

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })

      await createProductPricing(formData as any)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          cost: 0,
          base_price: 0,
        })
      )
    })

    it('should throw error when unauthorized', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const formData = new FormData()
      formData.append('product_id', 'test-product-id')

      await expect(createProductPricing(formData as any)).rejects.toThrow(
        'Unauthorized'
      )
    })
  })

  describe('createPricingRule', () => {
    it('should create pricing rule with quantity breaks', async () => {
      const formData = new FormData()
      formData.append('name', 'Bulk Discount')
      formData.append('description', 'Discount for bulk orders')
      formData.append('rule_type', 'quantity')
      formData.append('priority', '10')
      formData.append('is_active', 'true')
      formData.append('conditions', JSON.stringify({ min_quantity: 10 }))
      formData.append(
        'quantity_breaks',
        JSON.stringify([
          {
            min_quantity: 10,
            max_quantity: 50,
            discount_type: 'percentage',
            discount_value: 5,
          },
          {
            min_quantity: 51,
            max_quantity: null,
            discount_type: 'percentage',
            discount_value: 10,
          },
        ])
      )

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'new-rule-id' },
          error: null,
        }),
      })

      await createPricingRule(formData as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        name: 'Bulk Discount',
        description: 'Discount for bulk orders',
        rule_type: 'quantity',
        priority: 10,
        is_active: true,
        conditions: { min_quantity: 10 },
        created_by: 'test-user-id',
        discount_type: undefined,
        discount_value: undefined,
        product_id: undefined,
        category_id: undefined,
        customer_id: undefined,
        customer_tier_id: undefined,
        start_date: undefined,
        end_date: undefined,
      })

      // Check quantity breaks were created
      expect(mockSupabase.from).toHaveBeenCalledWith('quantity_breaks')
    })

    it('should create promotional pricing rule', async () => {
      const formData = new FormData()
      formData.append('name', 'Summer Sale')
      formData.append('rule_type', 'promotion')
      formData.append('discount_type', 'percentage')
      formData.append('discount_value', '20')
      formData.append('start_date', '2024-06-01')
      formData.append('end_date', '2024-08-31')

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'promo-rule-id' },
          error: null,
        }),
      })

      await createPricingRule(formData as any)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Summer Sale',
          rule_type: 'promotion',
          discount_type: 'percentage',
          discount_value: 20,
          start_date: '2024-06-01',
          end_date: '2024-08-31',
        })
      )
    })
  })

  describe('createCustomerPricing', () => {
    it('should create customer-specific pricing', async () => {
      const formData = new FormData()
      formData.append('customer_id', 'test-customer-id')
      formData.append('product_id', 'test-product-id')
      formData.append('override_price', '85.00')

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })

      await createCustomerPricing(formData as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('customer_pricing')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        customer_id: 'test-customer-id',
        product_id: 'test-product-id',
        override_price: 85,
        override_discount_percent: undefined,
        contract_number: undefined,
        contract_start: undefined,
        contract_end: undefined,
        requires_approval: false,
        notes: undefined,
        created_by: 'test-user-id',
      })
    })

    it('should create customer pricing with discount percentage', async () => {
      const formData = new FormData()
      formData.append('customer_id', 'test-customer-id')
      formData.append('product_id', 'test-product-id')
      formData.append('override_discount_percent', '15')

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })

      await createCustomerPricing(formData as any)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          override_price: undefined,
          override_discount_percent: 15,
        })
      )
    })
  })

  describe('bulkUpdateCustomerPrices', () => {
    it('should update multiple customer prices', async () => {
      const formData = new FormData()
      formData.append('customer_id', 'test-customer-id')
      formData.append(
        'updates',
        JSON.stringify([
          { sku: 'PROD-1', price: 90, reason: 'Negotiated rate' },
          { sku: 'PROD-2', discount_percent: 10, reason: 'Volume discount' },
        ])
      )
      formData.append('apply_to_all_warehouses', 'true')

      // Mock product lookups
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'product-1-id',
              product_pricing: { base_price: 100, cost: 50 },
            },
            error: null,
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'product-2-id',
              product_pricing: { base_price: 200, cost: 100 },
            },
            error: null,
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })
      // Mock the new RPC call for bulk updates
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          total: 2,
          succeeded: 2,
          failed: 0,
          errors: [],
          bulk_update_id: 'bulk-update-123',
        },
        error: null,
      })

      const result: any = await bulkUpdateCustomerPrices(formData as any)

      // Verify the RPC call was made with correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'bulk_update_customer_prices_transaction',
        {
          p_customer_id: 'test-customer-id',
          p_updates: [
            { sku: 'PROD-1', price: 100, reason: 'Test update 1' },
            { sku: 'PROD-2', price: 200, reason: 'Test update 2' },
          ],
          p_user_id: 'test-user-id',
        }
      )

      expect(result.total).toBe(2)
      expect(result.succeeded).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.bulk_update_id).toBeDefined()
    })

    it('should handle missing products', async () => {
      const formData = new FormData()
      formData.append('customer_id', 'test-customer-id')
      formData.append(
        'updates',
        JSON.stringify([{ sku: 'INVALID-SKU', price: 90, reason: 'Test' }])
      )

      // Mock the RPC call to return error for missing product
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          total: 1,
          succeeded: 0,
          failed: 1,
          errors: [{ sku: 'INVALID-SKU', error: 'Product not found' }],
          bulk_update_id: 'bulk-update-456',
        },
        error: null,
      })

      const result: any = await bulkUpdateCustomerPrices(formData as any)

      // Verify the RPC call was made
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'bulk_update_customer_prices_transaction',
        {
          p_customer_id: 'test-customer-id',
          p_updates: [{ sku: 'INVALID-SKU', price: 90, reason: 'Test' }],
          p_user_id: 'test-user-id',
        }
      )

      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].sku).toBe('INVALID-SKU')
      expect(result.errors[0].error).toBe('Product not found')
    })
  })

  describe('calculatePrice', () => {
    it('should calculate price for a product', async () => {
      const data = {
        product_id: 'test-product-id',
        customer_id: 'test-customer-id',
        quantity: 10,
        requested_date: '2024-06-15',
      }

      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            base_price: 100,
            final_price: 85,
            discount_amount: 15,
            discount_percent: 15,
            margin_percent: 40,
            applied_rules: [
              { rule_name: 'Bulk Discount', discount_amount: 10 },
              { rule_name: 'Customer Tier', discount_amount: 5 },
            ],
          },
        ],
        error: null,
      })

      const result = await calculatePrice(data)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_product_price', {
        p_product_id: 'test-product-id',
        p_customer_id: 'test-customer-id',
        p_quantity: 10,
        p_requested_date: '2024-06-15',
      })

      expect(result).toEqual({
        base_price: 100,
        final_price: 85,
        discount_amount: 15,
        discount_percent: 15,
        margin_percent: 40,
        applied_rules: [
          { rule_name: 'Bulk Discount', discount_amount: 10 },
          { rule_name: 'Customer Tier', discount_amount: 5 },
        ],
      })
    })

    it('should use current date if not provided', async () => {
      const data = {
        product_id: 'test-product-id',
        quantity: 1,
      }

      mockSupabase.rpc.mockResolvedValue({
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

      await calculatePrice(data)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_product_price', {
        p_product_id: 'test-product-id',
        p_customer_id: null,
        p_quantity: 1,
        p_requested_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    })

    it('should handle calculation errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Product not found' },
      })

      await expect(
        calculatePrice({
          product_id: 'invalid-product',
          quantity: 1,
        })
      ).rejects.toThrow('Product not found')
    })
  })
})
