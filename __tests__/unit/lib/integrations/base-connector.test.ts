import { BaseConnector } from '@/lib/integrations/base-connector'
import type { ConnectorConfig, SyncResult } from '@/lib/integrations/base-connector'
import { createMockSupabaseClient, mockSupabaseResponse } from '@/__tests__/test-utils/supabase-mock'
import type { Database } from '@/supabase/types/database'

// Mock implementation for testing abstract class
class TestConnector extends BaseConnector {
  async initialize(): Promise<void> {
    // Test implementation
  }

  async testConnection(): Promise<boolean> {
    return true
  }

  async disconnect(): Promise<void> {
    // Test implementation
  }

  protected async fetchProducts(limit?: number): Promise<any[]> {
    return [
      {
        id: 'test-product-1',
        name: 'Test Product 1',
        sku: 'TEST-001',
        price: 99.99
      }
    ]
  }

  protected async fetchInventory(limit?: number): Promise<any[]> {
    return [
      {
        sku: 'TEST-001',
        quantity: 100,
        warehouse_id: 'warehouse-1'
      }
    ]
  }

  protected async fetchPricing(limit?: number): Promise<any[]> {
    return [
      {
        sku: 'TEST-001',
        price: 99.99,
        currency: 'USD'
      }
    ]
  }

  protected async fetchCustomers(limit?: number): Promise<any[]> {
    return [
      {
        id: 'customer-1',
        name: 'Test Customer',
        email: 'test@example.com'
      }
    ]
  }

  protected async fetchOrders(limit?: number): Promise<any[]> {
    return [
      {
        id: 'order-1',
        customer_id: 'customer-1',
        total: 99.99,
        items: []
      }
    ]
  }

  protected transformProduct(data: any): Partial<Database['public']['Tables']['products']['Insert']> {
    return {
      external_id: data.id,
      name: data.name,
      sku: data.sku,
      description: data.description || null,
      active: true
    }
  }

  protected transformInventory(data: any): Partial<Database['public']['Tables']['inventory']['Insert']> {
    return {
      sku: data.sku,
      quantity: data.quantity,
      warehouse_id: data.warehouse_id
    }
  }

  protected transformPricing(data: any): Partial<Database['public']['Tables']['product_pricing']['Insert']> {
    return {
      sku: data.sku,
      base_price: data.price,
      currency: data.currency || 'USD'
    }
  }

  protected transformCustomer(data: any): Partial<Database['public']['Tables']['customers']['Insert']> {
    return {
      external_id: data.id,
      name: data.name,
      email: data.email
    }
  }

  protected transformOrder(data: any): Partial<Database['public']['Tables']['orders']['Insert']> {
    return {
      external_id: data.id,
      customer_id: data.customer_id,
      total_amount: data.total,
      status: 'pending'
    }
  }
}

describe('BaseConnector', () => {
  let connector: TestConnector
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  
  const testConfig: ConnectorConfig = {
    integrationId: 'int-123',
    organizationId: 'org-123',
    credentials: {
      apiKey: 'test-key',
      apiSecret: 'test-secret'
    },
    settings: {
      rateLimit: 10,
      batchSize: 100
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
    connector = new TestConnector(testConfig)
    // Inject mock Supabase client
    ;(connector as any).supabase = mockSupabase
  })

  describe('sync', () => {
    it('should sync products successfully', async () => {
      // Mock successful database operations
      const mockProducts: Database['public']['Tables']['products']['Row'][] = [
        {
          id: 'prod-123',
          organization_id: 'org-123',
          external_id: 'test-product-1',
          name: 'Test Product 1',
          sku: 'TEST-001',
          description: null,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      mockSupabase.from('products').upsert.mockResolvedValueOnce(
        mockSupabaseResponse(mockProducts, null)
      )

      const result = await connector.sync('products', {
        limit: 10,
        force: false
      })

      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(1)
      expect(result.items_created).toBeGreaterThanOrEqual(0)
      expect(result.items_updated).toBeGreaterThanOrEqual(0)
      expect(result.items_failed).toBe(0)
      
      // Verify correct data was passed to upsert
      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      expect(mockSupabase.from('products').upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            organization_id: 'org-123',
            external_id: 'test-product-1',
            name: 'Test Product 1',
            sku: 'TEST-001'
          })
        ])
      )
    })

    it('should handle sync errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      mockSupabase.from('products').upsert.mockResolvedValueOnce(
        mockSupabaseResponse(null, dbError)
      )

      const result = await connector.sync('products', { limit: 10 })

      expect(result.success).toBe(false)
      expect(result.items_failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to sync products batch')
    })

    it('should respect batch size limits', async () => {
      // Override fetchProducts to return many items
      connector.fetchProducts = jest.fn().mockResolvedValue(
        Array.from({ length: 250 }, (_, i) => ({
          id: `product-${i}`,
          name: `Product ${i}`,
          sku: `SKU-${i}`,
          price: i * 10
        }))
      )

      mockSupabase.from('products').upsert.mockResolvedValue(
        mockSupabaseResponse([], null)
      )

      await connector.sync('products', { limit: 250 })

      // Should have been called 3 times (100 + 100 + 50)
      expect(mockSupabase.from('products').upsert).toHaveBeenCalledTimes(3)
    })

    it('should handle dry run mode', async () => {
      const result = await connector.sync('products', {
        limit: 10,
        dryRun: true
      })

      expect(result.success).toBe(true)
      expect(result.dry_run).toBe(true)
      expect(result.items_processed).toBe(1)
      
      // Should not call database in dry run
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should detect and report conflicts', async () => {
      // Mock existing data
      mockSupabase.from('products').select.mockResolvedValueOnce(
        mockSupabaseResponse([
          {
            id: 'prod-123',
            external_id: 'test-product-1',
            name: 'Old Product Name',
            sku: 'TEST-001',
            updated_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
          }
        ], null)
      )

      mockSupabase.from('products').upsert.mockResolvedValueOnce(
        mockSupabaseResponse([], null)
      )

      const result = await connector.sync('products', {
        conflictDetection: true
      })

      expect(result.conflicts).toBeDefined()
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts?.[0]).toMatchObject({
        record_id: 'test-product-1',
        field: 'name',
        source_value: 'Test Product 1',
        target_value: 'Old Product Name'
      })
    })
  })

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      const startTime = Date.now()
      
      // Mock multiple batches
      connector.fetchProducts = jest.fn()
        .mockResolvedValueOnce([{ id: '1', name: 'Product 1', sku: 'SKU-1' }])
        .mockResolvedValueOnce([{ id: '2', name: 'Product 2', sku: 'SKU-2' }])
        .mockResolvedValueOnce([])

      mockSupabase.from('products').upsert.mockResolvedValue(
        mockSupabaseResponse([], null)
      )

      // Set rate limit to 2 requests per second
      connector.config.settings.rateLimit = 2

      await connector.sync('products', { limit: 100 })

      const elapsedTime = Date.now() - startTime
      
      // Should take at least 1 second for 3 requests at 2/sec
      expect(elapsedTime).toBeGreaterThanOrEqual(1000)
    }, 10000) // Increase timeout for rate limit test
  })

  describe('connection management', () => {
    it('should test connection successfully', async () => {
      const isConnected = await connector.testConnection()
      expect(isConnected).toBe(true)
    })

    it('should handle connection test failures', async () => {
      connector.testConnection = jest.fn().mockResolvedValue(false)
      const isConnected = await connector.testConnection()
      expect(isConnected).toBe(false)
    })

    it('should disconnect cleanly', async () => {
      await expect(connector.disconnect()).resolves.not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      connector.fetchProducts = jest.fn().mockRejectedValue(
        new Error('Network timeout')
      )

      const result = await connector.sync('products')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Network timeout')
    })

    it('should handle invalid data gracefully', async () => {
      connector.fetchProducts = jest.fn().mockResolvedValue([
        { id: null, name: 'Invalid Product' } // Missing required fields
      ])

      mockSupabase.from('products').upsert.mockResolvedValue(
        mockSupabaseResponse([], null)
      )

      const result = await connector.sync('products')

      // Should still try to process even with invalid data
      expect(result.items_processed).toBe(1)
    })
  })

  describe('signal handling', () => {
    it('should abort sync when signal is triggered', async () => {
      const abortController = new AbortController()
      
      // Mock slow fetch to allow abort
      connector.fetchProducts = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        abortController.abort()
        return [{ id: '1', name: 'Product 1', sku: 'SKU-1' }]
      })

      const result = await connector.sync('products', {
        signal: abortController.signal
      })

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Sync aborted')
    })
  })
})