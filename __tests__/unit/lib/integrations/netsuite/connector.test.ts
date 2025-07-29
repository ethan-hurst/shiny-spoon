import { NetSuiteConnector } from '@/lib/integrations/netsuite/connector'
import { NetSuiteAPIClient } from '@/lib/integrations/netsuite/api-client'
import type { ConnectorConfig } from '@/lib/integrations/base-connector'
import { createMockSupabaseClient, mockSupabaseResponse } from '@/__tests__/test-utils/supabase-mock'
import type { Database } from '@/supabase/types/database'

jest.mock('@/lib/integrations/netsuite/api-client')
jest.mock('@/lib/supabase/client')

describe('NetSuiteConnector', () => {
  let connector: NetSuiteConnector
  let mockApiClient: jest.Mocked<NetSuiteAPIClient>
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  
  const testConfig: ConnectorConfig = {
    integrationId: 'int-123',
    organizationId: 'org-123',
    credentials: {
      accountId: '123456',
      consumerKey: 'test-consumer-key',
      consumerSecret: 'test-consumer-secret',
      tokenId: 'test-token-id',
      tokenSecret: 'test-token-secret'
    },
    settings: {
      rateLimit: 5,
      batchSize: 50,
      apiVersion: '2023.2'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock API client
    mockApiClient = {
      initialize: jest.fn().mockResolvedValue(undefined),
      testConnection: jest.fn().mockResolvedValue(true),
      searchRecords: jest.fn(),
      getRecord: jest.fn(),
      createRecord: jest.fn(),
      updateRecord: jest.fn(),
      executeQuery: jest.fn()
    } as unknown as jest.Mocked<NetSuiteAPIClient>
    
    ;(NetSuiteAPIClient as jest.MockedClass<typeof NetSuiteAPIClient>).mockImplementation(() => mockApiClient)
    
    mockSupabase = createMockSupabaseClient()
    connector = new NetSuiteConnector(testConfig)
    ;(connector as any).supabase = mockSupabase
  })

  describe('initialize', () => {
    it('should initialize the API client', async () => {
      await connector.initialize()
      
      expect(NetSuiteAPIClient).toHaveBeenCalledWith({
        accountId: '123456',
        consumerKey: 'test-consumer-key',
        consumerSecret: 'test-consumer-secret',
        tokenId: 'test-token-id',
        tokenSecret: 'test-token-secret',
        apiVersion: '2023.2'
      })
      expect(mockApiClient.initialize).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      mockApiClient.initialize.mockRejectedValueOnce(new Error('Auth failed'))
      
      await expect(connector.initialize()).rejects.toThrow('Auth failed')
    })
  })

  describe('fetchProducts', () => {
    it('should fetch and transform NetSuite items', async () => {
      const mockNetSuiteItems = [
        {
          id: 'ITEM123',
          itemId: 'TEST-SKU-001',
          displayName: 'Test Product 1',
          salesDescription: 'A test product',
          basePrice: 99.99,
          isInactive: false,
          lastModifiedDate: '2024-01-01T00:00:00Z'
        },
        {
          id: 'ITEM124',
          itemId: 'TEST-SKU-002',
          displayName: 'Test Product 2',
          salesDescription: null,
          basePrice: 149.99,
          isInactive: false,
          lastModifiedDate: '2024-01-01T00:00:00Z'
        }
      ]

      mockApiClient.searchRecords.mockResolvedValueOnce({
        records: mockNetSuiteItems,
        totalResults: 2,
        pageIndex: 0,
        totalPages: 1
      })

      const products = await (connector as any).fetchProducts(10)

      expect(products).toHaveLength(2)
      expect(products[0]).toEqual({
        id: 'ITEM123',
        itemId: 'TEST-SKU-001',
        displayName: 'Test Product 1',
        salesDescription: 'A test product',
        basePrice: 99.99,
        isInactive: false,
        lastModifiedDate: '2024-01-01T00:00:00Z'
      })
      
      expect(mockApiClient.searchRecords).toHaveBeenCalledWith({
        type: 'inventoryitem',
        filters: expect.any(Array),
        columns: expect.arrayContaining([
          'itemid',
          'displayname',
          'salesdescription',
          'baseprice'
        ])
      })
    })

    it('should handle API errors when fetching products', async () => {
      mockApiClient.searchRecords.mockRejectedValueOnce(
        new Error('NetSuite API error')
      )

      await expect((connector as any).fetchProducts()).rejects.toThrow(
        'NetSuite API error'
      )
    })
  })

  describe('fetchInventory', () => {
    it('should fetch inventory levels using SuiteQL', async () => {
      const mockInventoryData = [
        {
          item: 'TEST-SKU-001',
          location: 'WH-001',
          quantityavailable: 100,
          quantityonhand: 120,
          quantityonorder: 20
        },
        {
          item: 'TEST-SKU-002',
          location: 'WH-001',
          quantityavailable: 50,
          quantityonhand: 50,
          quantityonorder: 0
        }
      ]

      mockApiClient.executeQuery.mockResolvedValueOnce({
        items: mockInventoryData
      })

      const inventory = await (connector as any).fetchInventory(10)

      expect(inventory).toHaveLength(2)
      expect(inventory[0]).toEqual({
        sku: 'TEST-SKU-001',
        location: 'WH-001',
        available: 100,
        onHand: 120,
        onOrder: 20
      })
      
      expect(mockApiClient.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      )
    })
  })

  describe('fetchPricing', () => {
    it('should fetch pricing information', async () => {
      const mockPricingData = [
        {
          id: 'PRICE123',
          item: { id: 'ITEM123', name: 'TEST-SKU-001' },
          pricelevel: { id: '1', name: 'Base Price' },
          price: 99.99,
          currency: { id: '1', name: 'USD' }
        },
        {
          id: 'PRICE124',
          item: { id: 'ITEM123', name: 'TEST-SKU-001' },
          pricelevel: { id: '2', name: 'Wholesale' },
          price: 89.99,
          currency: { id: '1', name: 'USD' }
        }
      ]

      mockApiClient.searchRecords.mockResolvedValueOnce({
        records: mockPricingData,
        totalResults: 2,
        pageIndex: 0,
        totalPages: 1
      })

      const pricing = await (connector as any).fetchPricing(10)

      expect(pricing).toHaveLength(2)
      expect(pricing[0]).toMatchObject({
        sku: 'TEST-SKU-001',
        price: 99.99,
        currency: 'USD',
        priceLevel: 'Base Price'
      })
    })
  })

  describe('transformations', () => {
    it('should transform NetSuite product to database format', () => {
      const netsuiteProduct = {
        id: 'ITEM123',
        itemId: 'TEST-SKU-001',
        displayName: 'Test Product',
        salesDescription: 'Description',
        basePrice: 99.99,
        isInactive: false
      }

      const transformed = (connector as any).transformProduct(netsuiteProduct)

      expect(transformed).toEqual({
        external_id: 'ITEM123',
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        description: 'Description',
        active: true,
        organization_id: 'org-123'
      })
    })

    it('should transform inventory data correctly', () => {
      const netsuiteInventory = {
        sku: 'TEST-SKU-001',
        location: 'WH-001',
        available: 100,
        onHand: 120,
        onOrder: 20
      }

      const transformed = (connector as any).transformInventory(netsuiteInventory)

      expect(transformed).toEqual({
        sku: 'TEST-SKU-001',
        warehouse_id: 'WH-001',
        quantity: 100,
        quantity_on_hand: 120,
        quantity_on_order: 20,
        organization_id: 'org-123'
      })
    })
  })

  describe('sync operations', () => {
    it('should sync products with conflict detection', async () => {
      // Mock fetch
      const mockNetSuiteItems = [
        {
          id: 'ITEM123',
          itemId: 'TEST-SKU-001',
          displayName: 'Updated Product Name',
          salesDescription: 'Updated description',
          basePrice: 109.99,
          isInactive: false,
          lastModifiedDate: new Date().toISOString()
        }
      ]

      mockApiClient.searchRecords.mockResolvedValueOnce({
        records: mockNetSuiteItems,
        totalResults: 1,
        pageIndex: 0,
        totalPages: 1
      })

      // Mock existing data for conflict detection
      mockSupabase.from('products').select.mockResolvedValueOnce(
        mockSupabaseResponse([
          {
            id: 'prod-123',
            external_id: 'ITEM123',
            sku: 'TEST-SKU-001',
            name: 'Old Product Name',
            description: 'Old description',
            updated_at: new Date(Date.now() - 86400000).toISOString()
          }
        ], null)
      )

      mockSupabase.from('products').upsert.mockResolvedValueOnce(
        mockSupabaseResponse([], null)
      )

      const result = await connector.sync('products', {
        conflictDetection: true
      })

      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(1)
      expect(result.conflicts).toHaveLength(2) // name and description conflicts
      expect(result.conflicts?.[0]).toMatchObject({
        field: 'name',
        source_value: 'Updated Product Name',
        target_value: 'Old Product Name'
      })
    })

    it('should handle batch processing for large datasets', async () => {
      // Create 150 mock items
      const mockItems = Array.from({ length: 150 }, (_, i) => ({
        id: `ITEM${i}`,
        itemId: `SKU-${i}`,
        displayName: `Product ${i}`,
        basePrice: i * 10,
        isInactive: false,
        lastModifiedDate: new Date().toISOString()
      }))

      // Mock paginated responses
      mockApiClient.searchRecords
        .mockResolvedValueOnce({
          records: mockItems.slice(0, 50),
          totalResults: 150,
          pageIndex: 0,
          totalPages: 3
        })
        .mockResolvedValueOnce({
          records: mockItems.slice(50, 100),
          totalResults: 150,
          pageIndex: 1,
          totalPages: 3
        })
        .mockResolvedValueOnce({
          records: mockItems.slice(100, 150),
          totalResults: 150,
          pageIndex: 2,
          totalPages: 3
        })

      mockSupabase.from('products').upsert.mockResolvedValue(
        mockSupabaseResponse([], null)
      )

      const result = await connector.sync('products', { limit: 200 })

      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(150)
      
      // Should have made 3 API calls for pagination
      expect(mockApiClient.searchRecords).toHaveBeenCalledTimes(3)
      
      // Should have made 3 database calls (batch size 50)
      expect(mockSupabase.from('products').upsert).toHaveBeenCalledTimes(3)
    })
  })

  describe('error handling', () => {
    it('should retry on rate limit errors', async () => {
      let attemptCount = 0
      mockApiClient.searchRecords.mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          const error = new Error('Rate limit exceeded')
          ;(error as any).code = 'RATE_LIMIT_EXCEEDED'
          throw error
        }
        return {
          records: [{
            id: 'ITEM123',
            itemId: 'TEST-SKU-001',
            displayName: 'Test Product'
          }],
          totalResults: 1,
          pageIndex: 0,
          totalPages: 1
        }
      })

      mockSupabase.from('products').upsert.mockResolvedValue(
        mockSupabaseResponse([], null)
      )

      const result = await connector.sync('products')

      expect(result.success).toBe(true)
      expect(attemptCount).toBe(3) // Failed twice, succeeded on third
    })

    it('should handle NetSuite session expiration', async () => {
      const sessionError = new Error('Session expired')
      ;(sessionError as any).code = 'INVALID_SESSION'
      
      mockApiClient.searchRecords.mockRejectedValueOnce(sessionError)
      mockApiClient.initialize.mockResolvedValueOnce(undefined)
      mockApiClient.searchRecords.mockResolvedValueOnce({
        records: [],
        totalResults: 0,
        pageIndex: 0,
        totalPages: 0
      })

      const result = await connector.sync('products')

      expect(result.success).toBe(true)
      expect(mockApiClient.initialize).toHaveBeenCalledTimes(2) // Initial + retry
    })
  })

  describe('connection management', () => {
    it('should test connection successfully', async () => {
      const isConnected = await connector.testConnection()
      
      expect(isConnected).toBe(true)
      expect(mockApiClient.testConnection).toHaveBeenCalled()
    })

    it('should handle connection test failures', async () => {
      mockApiClient.testConnection.mockResolvedValueOnce(false)
      
      const isConnected = await connector.testConnection()
      
      expect(isConnected).toBe(false)
    })
  })
})