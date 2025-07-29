// @ts-ignore - undici types not available in test environment
import { FormData } from 'undici'
import {
  bulkUpdateCustomerPrices,
  calculatePrice,
  createCustomerPricing,
  createPricingRule,
  createProductPricing,
} from '@/app/actions/pricing'
import {
  createMockSupabaseClient,
  createMockQueryBuilder,
  setupAuthenticatedUser,
  setupUnauthenticatedUser,
  setupQueryResult,
} from '@/__tests__/utils/supabase-mock'

// Mock Next.js modules
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

// Mock Redis cache
jest.mock('@/lib/pricing/redis-cache', () => ({
  cache: {
    clearAll: jest.fn().mockResolvedValue(true),
    clearProduct: jest.fn().mockResolvedValue(true),
    clear: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
}))

// Create mock Supabase client
const mockSupabase = createMockSupabaseClient()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
  createServerClient: jest.fn(() => mockSupabase),
}))

describe('Pricing Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupAuthenticatedUser(mockSupabase)
  })

  describe('createProductPricing', () => {
    it('should create product pricing with valid data', async () => {
      const formData = new FormData()
      formData.append('product_id', '550e8400-e29b-41d4-a716-446655440000')
      formData.append('cost', '50.00')
      formData.append('base_price', '100.00')
      formData.append('min_margin_percent', '30')
      formData.append('currency', 'USD')
      formData.append('pricing_unit', 'EACH')
      formData.append('unit_quantity', '1')

      const mockQueryBuilder = createMockQueryBuilder()
      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      await createProductPricing(formData as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('product_pricing')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        product_id: '550e8400-e29b-41d4-a716-446655440000',
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
      formData.append('product_id', '550e8400-e29b-41d4-a716-446655440001')
      formData.append('cost', 'invalid')
      formData.append('base_price', '100') // Valid base price so cost validation doesn't fail

      const mockQueryBuilder = createMockQueryBuilder()
      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      await createProductPricing(formData as any)

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          cost: 0,
          base_price: 100,
        })
      )
    })

    it('should throw error when unauthorized', async () => {
      setupUnauthenticatedUser(mockSupabase)

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

      const mockRulesBuilder = createMockQueryBuilder()
      const mockBreaksBuilder = createMockQueryBuilder()
      
      // Set up the response for the pricing rule creation
      setupQueryResult(mockRulesBuilder, { id: 'new-rule-id' })
      
      // Mock the from calls
      mockSupabase.from
        .mockReturnValueOnce(mockRulesBuilder) // For pricing_rules
        .mockReturnValueOnce(mockBreaksBuilder) // For quantity_breaks

      await createPricingRule(formData as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
      expect(mockRulesBuilder.insert).toHaveBeenCalledWith({
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

      const mockRulesBuilder = createMockQueryBuilder()
      
      // Set up the response for the pricing rule creation
      setupQueryResult(mockRulesBuilder, { id: 'promo-rule-id' })
      
      // Mock the from call
      mockSupabase.from.mockReturnValueOnce(mockRulesBuilder)

      await createPricingRule(formData as any)

      expect(mockRulesBuilder.insert).toHaveBeenCalledWith(
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
      formData.append('customer_id', '550e8400-e29b-41d4-a716-446655440002')
      formData.append('product_id', '550e8400-e29b-41d4-a716-446655440000')
      formData.append('override_price', '85.00')

      const mockQueryBuilder = createMockQueryBuilder()
      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      await createCustomerPricing(formData as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('customer_pricing')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        customer_id: '550e8400-e29b-41d4-a716-446655440002',
        product_id: '550e8400-e29b-41d4-a716-446655440000',
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
      formData.append('customer_id', '550e8400-e29b-41d4-a716-446655440002')
      formData.append('product_id', '550e8400-e29b-41d4-a716-446655440000')
      formData.append('override_discount_percent', '15')

      const mockQueryBuilder = createMockQueryBuilder()
      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      await createCustomerPricing(formData as any)

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
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
      formData.append('customer_id', '550e8400-e29b-41d4-a716-446655440002')
      formData.append(
        'updates',
        JSON.stringify([
          { sku: 'PROD-1', price: 90, reason: 'Negotiated rate' },
          { sku: 'PROD-2', discount_percent: 10, reason: 'Volume discount' },
        ])
      )
      formData.append('apply_to_all_warehouses', 'true')

      // Mock product lookups
      const productQuery1 = createMockQueryBuilder()
      setupQueryResult(productQuery1, {
        id: 'product-1-id',
        product_pricing: { base_price: 100, cost: 50 },
      })
      
      const productQuery2 = createMockQueryBuilder()
      setupQueryResult(productQuery2, null)
      
      const insertQuery1 = createMockQueryBuilder()
      insertQuery1.insert.mockResolvedValue({ error: null })
      
      const insertQuery2 = createMockQueryBuilder()
      insertQuery2.insert.mockResolvedValue({ error: null })
      
      const productQuery3 = createMockQueryBuilder()
      setupQueryResult(productQuery3, {
        id: 'product-2-id',
        product_pricing: { base_price: 200, cost: 100 },
      })
      
      const productQuery4 = createMockQueryBuilder()
      setupQueryResult(productQuery4, null)
      
      mockSupabase.from
        .mockReturnValueOnce(productQuery1)
        .mockReturnValueOnce(productQuery2)
        .mockReturnValueOnce(insertQuery1)
        .mockReturnValueOnce(insertQuery2)
        .mockReturnValueOnce(productQuery3)
        .mockReturnValueOnce(productQuery4)
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
        count: null,
        status: 200,
        statusText: 'OK',
      })

      const result: any = await bulkUpdateCustomerPrices(formData as any)

      // Verify the RPC call was made with correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'bulk_update_customer_prices_transaction',
        {
          p_customer_id: '550e8400-e29b-41d4-a716-446655440002',
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
      formData.append('customer_id', '550e8400-e29b-41d4-a716-446655440002')
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
        count: null,
        status: 200,
        statusText: 'OK',
      })

      const result: any = await bulkUpdateCustomerPrices(formData as any)

      // Verify the RPC call was made
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'bulk_update_customer_prices_transaction',
        {
          p_customer_id: '550e8400-e29b-41d4-a716-446655440002',
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
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        customer_id: '550e8400-e29b-41d4-a716-446655440002',
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
        count: null,
        status: 200,
        statusText: 'OK',
      })

      const result = await calculatePrice(data)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_product_price', {
        p_product_id: '550e8400-e29b-41d4-a716-446655440000',
        p_customer_id: '550e8400-e29b-41d4-a716-446655440002',
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
        product_id: '550e8400-e29b-41d4-a716-446655440000',
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
        count: null,
        status: 200,
        statusText: 'OK',
      })

      await calculatePrice(data)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_product_price', {
        p_product_id: '550e8400-e29b-41d4-a716-446655440000',
        p_customer_id: null,
        p_quantity: 1,
        p_requested_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    })

    it('should handle calculation errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'Product not found',
          details: '',
          hint: '',
          code: '404',
          name: 'PostgrestError'
        },
        count: null,
        status: 404,
        statusText: 'Not Found',
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
