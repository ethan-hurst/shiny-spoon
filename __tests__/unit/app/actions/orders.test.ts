import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import {
  cancelOrder,
  createOrder,
  getOrderDetails,
  listOrders,
  updateOrder,
} from '@/app/actions/orders'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    orderCreation: { limit: vi.fn().mockResolvedValue({ success: true }) },
    orderUpdates: { limit: vi.fn().mockResolvedValue({ success: true }) },
  },
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock audit logger
vi.mock('@/lib/audit/audit-logger', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
  })),
}))

describe('Orders Actions', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('createOrder', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const mockProfile = { organization_id: 'org-123' }
    const mockProducts = [
      {
        id: 'prod-1',
        sku: 'SKU001',
        name: 'Product 1',
        description: 'Test product',
        base_price: 10.0,
      },
      {
        id: 'prod-2',
        sku: 'SKU002',
        name: 'Product 2',
        description: 'Test product 2',
        base_price: 20.0,
      },
    ]
    const mockOrder = {
      id: 'order-123',
      order_number: '20250128-0001',
      organization_id: 'org-123',
      customer_id: 'customer-123',
      status: 'pending',
      subtotal: 30.0,
      tax: 3.0,
      total: 33.0,
    }

    const validInput = {
      customer_id: 'customer-123',
      items: [
        { product_id: 'prod-1', quantity: 1, unit_price: 10.0 },
        { product_id: 'prod-2', quantity: 1, unit_price: 20.0 },
      ],
      billing_address: {
        line1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postal_code: '12345',
        country: 'US',
      },
      notes: 'Test order',
    }

    it('should create an order successfully', async () => {
      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })

      // Mock user profile
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          }
        }
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProducts }),
          }
        }
        if (table === 'orders') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockOrder }),
          }
        }
        if (table === 'order_items') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return mockSupabase
      })

      const result = await createOrder(validInput)

      expect(result).toEqual({ success: true, data: mockOrder })
      expect(mockSupabase.from).toHaveBeenCalledWith('orders')
      expect(mockSupabase.from).toHaveBeenCalledWith('order_items')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await createOrder(validInput)

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('should return error when user profile not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: 'Not found' }),
          }
        }
        return mockSupabase
      })

      const result = await createOrder(validInput)

      expect(result).toEqual({ error: 'User profile not found' })
    })

    it('should return error when products not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          }
        }
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: 'Not found' }),
          }
        }
        return mockSupabase
      })

      const result = await createOrder(validInput)

      expect(result).toEqual({ error: 'Failed to fetch products' })
    })
  })

  describe('updateOrder', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const mockProfile = { organization_id: 'org-123' }
    const mockExistingOrder = {
      id: 'order-123',
      organization_id: 'org-123',
      status: 'pending',
    }
    const mockUpdatedOrder = {
      id: 'order-123',
      organization_id: 'org-123',
      status: 'confirmed',
      updated_by: 'user-123',
    }

    const validInput = {
      status: 'confirmed',
      notes: 'Order confirmed',
    }

    it('should update an order successfully', async () => {
      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })

      // Mock user profile
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          }
        }
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValueOnce({ data: mockExistingOrder }) // First call for existing order
              .mockResolvedValueOnce({ data: mockUpdatedOrder }), // Second call for updated order
          }
        }
        return mockSupabase
      })

      const result = await updateOrder('order-123', validInput)

      expect(result).toEqual({ success: true, data: mockUpdatedOrder })
    })

    it('should return error when order not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          }
        }
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: 'Not found' }),
          }
        }
        return mockSupabase
      })

      const result = await updateOrder('order-123', validInput)

      expect(result).toEqual({ error: 'Order not found' })
    })
  })

  describe('cancelOrder', () => {
    it('should call updateOrder with cancelled status', async () => {
      const mockUpdateOrder = vi.fn().mockResolvedValue({ success: true })
      vi.doMock('@/app/actions/orders', () => ({
        updateOrder: mockUpdateOrder,
      }))

      const result = await cancelOrder(
        'order-123',
        'Customer requested cancellation'
      )

      expect(mockUpdateOrder).toHaveBeenCalledWith('order-123', {
        status: 'cancelled',
        notes: 'Cancellation reason: Customer requested cancellation',
      })
    })
  })

  describe('getOrderDetails', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const mockOrder = {
      id: 'order-123',
      order_number: '20250128-0001',
      status: 'pending',
    }

    it('should get order details successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_summary') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockOrder }),
          }
        }
        return mockSupabase
      })

      const result = await getOrderDetails('order-123')

      expect(result).toEqual({ success: true, data: mockOrder })
    })

    it('should return error when order not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_summary') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: 'Not found' }),
          }
        }
        return mockSupabase
      })

      const result = await getOrderDetails('order-123')

      expect(result).toEqual({ error: 'Not found' })
    })
  })

  describe('listOrders', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const mockProfile = { organization_id: 'org-123' }
    const mockOrders = [
      { id: 'order-1', order_number: '20250128-0001', status: 'pending' },
      { id: 'order-2', order_number: '20250128-0002', status: 'confirmed' },
    ]

    it('should list orders successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          }
        }
        if (table === 'order_summary') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: mockOrders, count: 2 }),
          }
        }
        return mockSupabase
      })

      const result = await listOrders()

      expect(result).toEqual({
        success: true,
        data: {
          orders: mockOrders,
          total: 2,
          limit: 20,
          offset: 0,
        },
      })
    })

    it('should apply filters correctly', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          }
        }
        if (table === 'order_summary') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: mockOrders, count: 1 }),
          }
        }
        return mockSupabase
      })

      const result = await listOrders({
        status: 'pending',
        limit: 10,
        offset: 0,
      })

      expect(result).toEqual({
        success: true,
        data: {
          orders: mockOrders,
          total: 1,
          limit: 10,
          offset: 0,
        },
      })
    })
  })
})
