import { NetSuiteConnector } from '@/lib/integrations/netsuite/connector'
import { NetSuiteAuth } from '@/lib/integrations/netsuite/auth'
import { NetSuiteApiClient } from '@/lib/integrations/netsuite/api-client'
import { NetSuiteQueries } from '@/lib/integrations/netsuite/queries'
import { NetSuiteTransformers } from '@/lib/integrations/netsuite/transformers'
import { createClient } from '@/lib/supabase/server'
import { IntegrationError } from '@/types/integration.types'
import type { ConnectorConfig } from '@/lib/integrations/base-connector'
import type { NetSuiteIntegrationConfig } from '@/types/netsuite.types'

// Mock dependencies
jest.mock('@/lib/integrations/netsuite/auth')
jest.mock('@/lib/integrations/netsuite/api-client')
jest.mock('@/lib/integrations/netsuite/queries')
jest.mock('@/lib/integrations/netsuite/transformers')
jest.mock('@/lib/supabase/server')

describe('NetSuiteConnector', () => {
  let connector: NetSuiteConnector
  let mockAuth: jest.Mocked<NetSuiteAuth>
  let mockClient: jest.Mocked<NetSuiteApiClient>
  let mockQueries: jest.Mocked<NetSuiteQueries>
  let mockTransformers: jest.Mocked<NetSuiteTransformers>
  let mockSupabase: any
  let mockRateLimiter: any
  let mockLogger: any

  const mockConfig: ConnectorConfig = {
    integrationId: 'integration-123',
    organizationId: 'org-456',
    platform: 'netsuite',
    isActive: true,
    settings: {
      account_id: 'test-account-123',
      datacenter_url: 'https://123456.suitetalk.api.netsuite.com',
      consumer_key: 'test-consumer-key',
      consumer_secret: 'test-consumer-secret',
      token_id: 'test-token-id',
      token_secret: 'test-token-secret',
      field_mappings: {
        product: {
          sku: 'itemid',
          name: 'displayname',
          description: 'description'
        }
      }
    } as NetSuiteIntegrationConfig
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Create a comprehensive mock object that supports all method chains
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis()
      }),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          last_sync_date: new Date('2023-01-01').toISOString(),
          last_sync_token: '0'
        }
      }),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: null, error: null })
      }
    }

    // Create mockSupabase that always returns the same mock chain
    mockSupabase = {
      from: jest.fn().mockReturnValue(mockChain)
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock rate limiter
    mockRateLimiter = {
      acquire: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    }

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }

    // Mock NetSuite Auth
    mockAuth = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getValidAccessToken: jest.fn().mockResolvedValue('valid-token')
    } as any
    ;(NetSuiteAuth as jest.Mock).mockImplementation(() => mockAuth)

    // Mock NetSuite API Client
    mockClient = {
      executeSuiteQL: jest.fn()
    } as any
    ;(NetSuiteApiClient as jest.Mock).mockImplementation(() => mockClient)

    // Mock NetSuite Queries
    mockQueries = {
      getProductsQuery: jest.fn().mockReturnValue('SELECT * FROM item'),
      getInventoryQuery: jest.fn().mockReturnValue('SELECT * FROM inventoryitem'),
      getPricingQuery: jest.fn().mockReturnValue('SELECT * FROM pricing')
    } as any
    ;(NetSuiteQueries as jest.Mock).mockImplementation(() => mockQueries)

    // Mock NetSuite Transformers
    mockTransformers = {
      transformProduct: jest.fn(),
      transformInventory: jest.fn(),
      transformPricing: jest.fn()
    } as any
    ;(NetSuiteTransformers as jest.Mock).mockImplementation(() => mockTransformers)

    // Create connector instance
    connector = new NetSuiteConnector(mockConfig)
    ;(connector as any).rateLimiter = mockRateLimiter
    ;(connector as any).logger = mockLogger
  })

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(connector.platform).toBe('netsuite')
      expect(NetSuiteAuth).toHaveBeenCalledWith(
        mockConfig.integrationId,
        mockConfig.organizationId,
        mockConfig.settings
      )
      expect(NetSuiteApiClient).toHaveBeenCalledWith(
        mockAuth,
        mockConfig.settings.account_id,
        mockConfig.settings.datacenter_url,
        mockRateLimiter
      )
      expect(NetSuiteQueries).toHaveBeenCalled()
      expect(NetSuiteTransformers).toHaveBeenCalledWith(
        mockConfig.settings.field_mappings
      )
    })
  })

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      const mockEmit = jest.fn()
      ;(connector as any).emit = mockEmit

      await connector.authenticate()

      expect(mockAuth.initialize).toHaveBeenCalled()
      expect(mockAuth.getValidAccessToken).toHaveBeenCalled()
      expect(mockEmit).toHaveBeenCalledWith('authenticated', {
        integrationId: mockConfig.integrationId
      })
      expect(mockLogger.info).toHaveBeenCalledWith('NetSuite authentication successful')
    })

    it('should handle authentication errors', async () => {
      const error = new Error('Authentication failed')
      mockAuth.initialize.mockRejectedValue(error)

      const mockHandleError = jest.fn()
      ;(connector as any).handleError = mockHandleError

      await expect(connector.authenticate()).rejects.toThrow(error)
      expect(mockHandleError).toHaveBeenCalledWith(error, 'Authentication failed')
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockClient.executeSuiteQL.mockResolvedValue({
        items: [{ id: '1' }]
      })

      const result = await connector.testConnection()

      expect(result).toBe(true)
      expect(mockClient.executeSuiteQL).toHaveBeenCalledWith(
        'SELECT id FROM item WHERE ROWNUM <= 1'
      )
      expect(mockLogger.info).toHaveBeenCalledWith('NetSuite connection test successful')
    })

    it('should handle connection test failure', async () => {
      mockClient.executeSuiteQL.mockRejectedValue(new Error('Connection failed'))

      const result = await connector.testConnection()

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('NetSuite connection test failed', {
        error: expect.any(Error)
      })
    })

    it('should return true for empty result set', async () => {
      mockClient.executeSuiteQL.mockResolvedValue({
        items: []
      })

      const result = await connector.testConnection()

      expect(result).toBe(true)
    })
  })

  describe('syncProducts', () => {
    beforeEach(() => {
      // Mock product query result
      mockClient.executeSuiteQL.mockResolvedValue({
        items: mockProducts,
        hasMore: false
      })

      // Mock product transformations
      mockTransformers.transformProduct
        .mockResolvedValueOnce({
          sku: 'ITEM001',
          name: 'Product 1',
          external_id: 'item001'
        })
        .mockResolvedValueOnce({
          sku: 'ITEM002',
          name: 'Product 2',
          external_id: 'item002'
        })

      // Mock retry wrapper
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
    })

    const mockProducts = [
      { itemid: 'ITEM001', displayname: 'Product 1' },
      { itemid: 'ITEM002', displayname: 'Product 2' }
    ]

    it('should sync products successfully', async () => {
      const mockEmit = jest.fn()
      ;(connector as any).emit = mockEmit

      const result = await connector.syncProducts()

      expect(result).toEqual({
        success: true,
        items_processed: 2,
        items_failed: 0,
        items_skipped: 0,
        errors: [],
        next_cursor: undefined
      })

      expect(mockQueries.getProductsQuery).toHaveBeenCalledWith({
        modifiedAfter: new Date('2023-01-01'),
        limit: 1000,
        offset: 0
      })

      expect(mockTransformers.transformProduct).toHaveBeenCalledTimes(2)
      
      // Access the mock through the from() chain
      const mockFrom = mockSupabase.from as jest.Mock
      const mockUpsert = mockFrom().upsert
      expect(mockUpsert).toHaveBeenCalledTimes(2)
    })

    it('should handle pagination', async () => {
      mockClient.executeSuiteQL
        .mockResolvedValueOnce({
          items: mockProducts,
          hasMore: true
        })
        .mockResolvedValueOnce({
          items: [],
          hasMore: false
        })

      await connector.syncProducts({ limit: 2 })

      expect(mockClient.executeSuiteQL).toHaveBeenCalledTimes(2)
    })

    it('should handle sync options', async () => {
      await connector.syncProducts({
        limit: 500,
        cursor: '100',
        dryRun: true
      })

      expect(mockQueries.getProductsQuery).toHaveBeenCalledWith({
        modifiedAfter: expect.any(Date),
        limit: 500,
        offset: 100
      })

      // Should not update sync state in dry run mode
      // Access the mock through the from() chain
      const mockFrom = mockSupabase.from as jest.Mock
      const mockUpsert = mockFrom().upsert
      expect(mockUpsert).toHaveBeenCalledTimes(2) // Only for products, not sync state
    })

    it('should handle product transformation errors', async () => {
      mockTransformers.transformProduct
        .mockResolvedValueOnce({
          sku: 'ITEM001',
          name: 'Product 1'
        })
        .mockRejectedValueOnce(new Error('Transform failed'))

      const result = await connector.syncProducts()

      expect(result).toEqual({
        success: false,
        items_processed: 1,
        items_failed: 1,
        items_skipped: 0,
        errors: [{
          item_id: 'ITEM002',
          error: 'Transform failed',
          details: mockProducts[1]
        }],
        next_cursor: undefined
      })
    })

    it('should emit progress events', async () => {
      const mockEmit = jest.fn()
      ;(connector as any).emit = mockEmit

      // Create 150 products to trigger progress event
      const manyProducts = Array.from({ length: 150 }, (_, i) => ({
        itemid: `ITEM${i.toString().padStart(3, '0')}`,
        displayname: `Product ${i}`
      }))

      mockClient.executeSuiteQL.mockResolvedValue({
        items: manyProducts,
        hasMore: false
      })

      mockTransformers.transformProduct.mockResolvedValue({
        sku: 'ITEM001',
        name: 'Product 1'
      })

      await connector.syncProducts()

      // Should emit progress at 100th item
      expect(mockEmit).toHaveBeenCalledWith('sync:progress', {
        current: 100,
        total: -1
      })
    })

    it('should handle rate limiting', async () => {
      const mockWithRateLimit = jest.fn().mockResolvedValue({
        items: mockProducts,
        hasMore: false
      })
      ;(connector as any).withRateLimit = mockWithRateLimit

      await connector.syncProducts()

      expect(mockWithRateLimit).toHaveBeenCalledWith(
        expect.any(Function),
        2
      )
    })
  })

  describe('syncInventory', () => {
    const mockLocations = [
      { id: '1', name: 'Main Warehouse', makeinventoryavailable: true },
      { id: '2', name: 'Secondary Warehouse', makeinventoryavailable: true },
      { id: '3', name: 'Inactive Warehouse', makeinventoryavailable: false }
    ]

    const mockInventoryItems = [
      { itemid: 'ITEM001', available: 100, location: '1' },
      { itemid: 'ITEM002', available: 50, location: '1' }
    ]

    beforeEach(() => {
      // Mock getLocations method
      ;(connector as any).getLocations = jest.fn().mockResolvedValue(mockLocations)

      // Mock inventory query result
      mockClient.executeSuiteQL.mockResolvedValue({
        items: mockInventoryItems
      })

      // Mock transformed inventory
      mockTransformers.transformInventory.mockResolvedValue({
        product_sku: 'ITEM001',
        warehouse_code: 'MAIN',
        quantity_available: 100
      })

      // Mock updateInventory method
      ;(connector as any).updateInventory = jest.fn().mockResolvedValue(undefined)

      // Mock retry wrapper
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
    })

    it('should sync inventory successfully', async () => {
      const result = await connector.syncInventory()

      expect(result).toEqual({
        success: true,
        items_processed: 4, // 2 items × 2 active locations
        items_failed: 0,
        items_skipped: 0,
        errors: []
      })

      expect((connector as any).getLocations).toHaveBeenCalled()
      expect(mockQueries.getInventoryQuery).toHaveBeenCalledTimes(2) // Only active locations
      expect(mockTransformers.transformInventory).toHaveBeenCalledTimes(4)
    })

    it('should skip inactive locations', async () => {
      await connector.syncInventory()

      // Should only query active locations (2 out of 3)
      expect(mockQueries.getInventoryQuery).toHaveBeenCalledTimes(2)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping location Inactive Warehouse - inventory not available'
      )
    })

    it('should handle inventory transformation errors', async () => {
      mockTransformers.transformInventory
        .mockResolvedValueOnce({
          product_sku: 'ITEM001',
          quantity_available: 100
        })
        .mockRejectedValueOnce(new Error('Transform failed'))
        .mockResolvedValueOnce({
          product_sku: 'ITEM001',
          quantity_available: 100
        })
        .mockResolvedValueOnce({
          product_sku: 'ITEM002',
          quantity_available: 50
        })

      const result = await connector.syncInventory()

      expect(result).toEqual({
        success: false,
        items_processed: 3,
        items_failed: 1,
        items_skipped: 0,
        errors: [{
          item_id: 'ITEM002',
          error: 'Transform failed',
          details: {
            item: mockInventoryItems[1],
            location: 'Main Warehouse'
          }
        }]
      })
    })

    it('should emit progress events', async () => {
      const mockEmit = jest.fn()
      ;(connector as any).emit = mockEmit

      // Create 60 inventory items to trigger progress event
      const manyItems = Array.from({ length: 60 }, (_, i) => ({
        itemid: `ITEM${i.toString().padStart(3, '0')}`,
        available: 100
      }))

      mockClient.executeSuiteQL.mockResolvedValue({
        items: manyItems
      })

      await connector.syncInventory()

      // Should emit progress at 50th item
      expect(mockEmit).toHaveBeenCalledWith('sync:progress', {
        current: 50,
        total: -1
      })
    })

    it('should handle sync options', async () => {
      const modifiedAfter = new Date('2023-06-01')

      await connector.syncInventory({
        filters: { modifiedAfter }
      })

      expect(mockQueries.getInventoryQuery).toHaveBeenCalledWith({
        locationId: '1',
        modifiedAfter
      })
    })
  })

  describe('syncPricing', () => {
    const mockPricingData = [
      { itemid: 'ITEM001', pricelevel: '1', rate: 10.99 },
      { itemid: 'ITEM001', pricelevel: '2', rate: 9.99 },
      { itemid: 'ITEM002', pricelevel: '1', rate: 15.99 }
    ]

    beforeEach(() => {
      mockClient.executeSuiteQL.mockResolvedValue({
        items: mockPricingData
      })

      mockTransformers.transformPricing.mockImplementation((itemId, prices) => {
        return Promise.resolve(prices.map((p: any) => ({
          product_sku: itemId,
          price_tier: p.pricelevel,
          unit_price: p.rate
        })))
      })

      ;(connector as any).updatePricing = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
    })

    it('should sync pricing successfully', async () => {
      const result = await connector.syncPricing()

      expect(result).toEqual({
        success: true,
        items_processed: 2, // 2 unique items
        items_failed: 0,
        items_skipped: 0,
        errors: []
      })

      expect(mockQueries.getPricingQuery).toHaveBeenCalled()
      expect(mockTransformers.transformPricing).toHaveBeenCalledTimes(2)
      expect((connector as any).updatePricing).toHaveBeenCalledTimes(2)
    })

    it('should group pricing by item', async () => {
      await connector.syncPricing()

      // ITEM001 should have 2 price records, ITEM002 should have 1
      expect(mockTransformers.transformPricing).toHaveBeenCalledWith('ITEM001', [
        { itemid: 'ITEM001', pricelevel: '1', rate: 10.99 },
        { itemid: 'ITEM001', pricelevel: '2', rate: 9.99 }
      ])
      expect(mockTransformers.transformPricing).toHaveBeenCalledWith('ITEM002', [
        { itemid: 'ITEM002', pricelevel: '1', rate: 15.99 }
      ])
    })

    it('should handle pricing transformation errors', async () => {
      mockTransformers.transformPricing
        .mockResolvedValueOnce([{ product_sku: 'ITEM001', unit_price: 10.99 }])
        .mockRejectedValueOnce(new Error('Transform failed'))

      const result = await connector.syncPricing()

      expect(result).toEqual({
        success: false,
        items_processed: 1,
        items_failed: 1,
        items_skipped: 0,
        errors: [{
          item_id: 'ITEM002',
          error: 'Transform failed',
          details: [{ itemid: 'ITEM002', pricelevel: '1', rate: 15.99 }]
        }]
      })
    })
  })

  describe('handleWebhook', () => {
    const mockWebhookPayload = {
      eventId: 'event-123',
      eventType: 'ITEM_UPDATED',
      recordType: 'item',
      recordId: 'item-456',
      data: { id: 'item-456', name: 'Updated Item' }
    }

    beforeEach(() => {
      mockSupabase.insert.mockResolvedValue({ error: null })
    })

    it('should queue webhook for processing', async () => {
      await connector.handleWebhook(mockWebhookPayload)

      expect(mockSupabase.from).toHaveBeenCalledWith('netsuite_webhook_events')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        integration_id: mockConfig.integrationId,
        event_id: mockWebhookPayload.eventId,
        event_type: mockWebhookPayload.eventType,
        entity_type: mockWebhookPayload.recordType,
        entity_id: mockWebhookPayload.recordId,
        payload: mockWebhookPayload,
        status: 'pending'
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'NetSuite webhook queued for processing',
        {
          eventId: mockWebhookPayload.eventId,
          eventType: mockWebhookPayload.eventType,
          recordType: mockWebhookPayload.recordType
        }
      )
    })

    it('should handle webhook queueing errors', async () => {
      const error = new Error('Database error')
      mockSupabase.insert.mockResolvedValue({ error })

      await expect(connector.handleWebhook(mockWebhookPayload)).rejects.toThrow(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to queue webhook event',
        { error, payload: mockWebhookPayload }
      )
    })
  })

  describe('helper methods', () => {
    describe('getSyncState', () => {
      it('should get sync state successfully', async () => {
        const mockSyncState = {
          last_sync_date: new Date().toISOString(),
          total_synced: 100
        }

        mockSupabase.single.mockResolvedValue({ data: mockSyncState })

        const result = await (connector as any).getSyncState('product')

        expect(mockSupabase.from).toHaveBeenCalledWith('netsuite_sync_state')
        expect(mockSupabase.select).toHaveBeenCalledWith('*')
        expect(mockSupabase.eq).toHaveBeenCalledWith('integration_id', mockConfig.integrationId)
        expect(mockSupabase.eq).toHaveBeenCalledWith('entity_type', 'product')
        expect(result).toEqual(mockSyncState)
      })
    })

    describe('updateSyncState', () => {
      it('should update sync state successfully', async () => {
        const updates = {
          last_sync_date: new Date(),
          total_synced: 150
        }

        mockSupabase.upsert.mockResolvedValue({ error: null })

        await (connector as any).updateSyncState('product', updates)

        expect(mockSupabase.from).toHaveBeenCalledWith('netsuite_sync_state')
        expect(mockSupabase.upsert).toHaveBeenCalledWith({
          integration_id: mockConfig.integrationId,
          entity_type: 'product',
          ...updates
        })
      })
    })

    describe('getLocations', () => {
      it('should get active locations', async () => {
        const mockLocations = [
          { id: '1', name: 'Main Warehouse' },
          { id: '2', name: 'Secondary Warehouse' }
        ]

        mockClient.executeSuiteQL.mockResolvedValue({
          items: mockLocations
        })

        const result = await (connector as any).getLocations()

        expect(mockClient.executeSuiteQL).toHaveBeenCalledWith(
          expect.stringContaining('FROM location')
        )
        expect(result).toEqual(mockLocations)
      })
    })

    describe('saveProduct', () => {
      it('should save product successfully', async () => {
        const mockProduct = {
          sku: 'ITEM001',
          name: 'Test Product',
          external_id: 'item001'
        }

        // Set up the mock expectations
        const mockFrom = mockSupabase.from as jest.Mock
        const mockUpsert = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis()
        })
        const mockEq = jest.fn().mockReturnThis()
        
        mockFrom.mockReturnValue({
          upsert: mockUpsert,
          eq: mockEq
        })

        await (connector as any).saveProduct(mockProduct)

        expect(mockFrom).toHaveBeenCalledWith('products')
        expect(mockUpsert).toHaveBeenCalledWith({
          sku: mockProduct.sku,
          name: mockProduct.name,
          description: mockProduct.description,
          price: mockProduct.price,
          weight: mockProduct.weight,
          dimensions: mockProduct.dimensions,
          is_active: mockProduct.is_active,
          external_id: mockProduct.external_id,
          external_updated_at: mockProduct.external_updated_at,
          metadata: mockProduct.metadata,
          organization_id: mockConfig.organizationId
        })
      })

      it('should handle save errors', async () => {
        const mockProduct = { sku: 'ITEM001', name: 'Test Product' }
        const error = new Error('Database error')

        const mockFrom = mockSupabase.from as jest.Mock
        const mockUpsert = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis()
        })
        const mockEq = jest.fn().mockReturnThis()
        
        mockFrom.mockReturnValue({
          upsert: mockUpsert,
          eq: mockEq
        })

        await expect((connector as any).saveProduct(mockProduct)).rejects.toThrow(
          'Failed to save product ITEM001: Database error'
        )
      })
    })

    describe('updateInventory', () => {
      beforeEach(() => {
        // Mock warehouse lookup
        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: 'warehouse-123' } })
          .mockResolvedValueOnce({ data: { id: 'product-456' } })

        mockSupabase.upsert.mockResolvedValue({ error: null })
      })

      it('should update inventory successfully', async () => {
        const mockInventory = {
          warehouse_code: 'MAIN',
          product_sku: 'ITEM001',
          quantity_available: 100,
          quantity_on_order: 20
        }

        await (connector as any).updateInventory(mockInventory)

        expect(mockSupabase.from).toHaveBeenCalledWith('warehouses')
        expect(mockSupabase.from).toHaveBeenCalledWith('products')
        expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
        expect(mockSupabase.upsert).toHaveBeenCalledWith({
          product_id: 'product-456',
          warehouse_id: 'warehouse-123',
          quantity: mockInventory.quantity_available,
          reserved_quantity: mockInventory.quantity_on_order,
          reorder_point: mockInventory.reorder_point,
          reorder_quantity: mockInventory.preferred_stock_level,
          last_sync: expect.any(String),
          sync_status: 'synced',
          organization_id: mockConfig.organizationId
        })
      })

      it('should handle missing warehouse', async () => {
        mockSupabase.single.mockResolvedValueOnce({ data: null })

        const mockInventory = {
          warehouse_code: 'MISSING',
          product_sku: 'ITEM001'
        }

        await expect((connector as any).updateInventory(mockInventory)).rejects.toThrow(
          'Warehouse not found: MISSING'
        )
      })

      it('should handle missing product', async () => {
        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: 'warehouse-123' } })
          .mockResolvedValueOnce({ data: null })

        const mockInventory = {
          warehouse_code: 'MAIN',
          product_sku: 'MISSING'
        }

        await expect((connector as any).updateInventory(mockInventory)).rejects.toThrow(
          'Product not found: MISSING'
        )
      })
    })

    describe('updatePricing', () => {
      beforeEach(() => {
        mockSupabase.single.mockResolvedValue({ data: { id: 'product-456' } })
        mockSupabase.upsert.mockResolvedValue({ error: null })
      })

      it('should update pricing successfully', async () => {
        const mockPricing = [
          {
            product_sku: 'ITEM001',
            price_tier: 'standard',
            unit_price: 10.99,
            currency_code: 'USD'
          }
        ]

        await (connector as any).updatePricing(mockPricing)

        expect(mockSupabase.from).toHaveBeenCalledWith('products')
        expect(mockSupabase.from).toHaveBeenCalledWith('product_pricing')
        expect(mockSupabase.upsert).toHaveBeenCalledWith({
          product_id: 'product-456',
          price_tier: 'standard',
          unit_price: 10.99,
          currency_code: 'USD',
          min_quantity: 1,
          external_id: mockPricing[0].external_id,
          external_updated_at: mockPricing[0].external_updated_at
        })
      })

      it('should skip missing products', async () => {
        mockSupabase.single.mockResolvedValue({ data: null })

        const mockPricing = [
          {
            product_sku: 'MISSING',
            unit_price: 10.99
          }
        ]

        await (connector as any).updatePricing(mockPricing)

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Product not found for pricing: MISSING'
        )
        expect(mockSupabase.upsert).not.toHaveBeenCalled()
      })
    })

    describe('withRateLimit', () => {
      it('should acquire and release rate limiter tokens', async () => {
        const mockFn = jest.fn().mockResolvedValue('result')

        const result = await (connector as any).withRateLimit(mockFn, 2)

        expect(mockRateLimiter.acquire).toHaveBeenCalledWith(2)
        expect(mockFn).toHaveBeenCalled()
        expect(mockRateLimiter.release).toHaveBeenCalledWith(2)
        expect(result).toBe('result')
      })

      it('should release tokens even on error', async () => {
        const error = new Error('Function failed')
        const mockFn = jest.fn().mockRejectedValue(error)

        await expect((connector as any).withRateLimit(mockFn, 2)).rejects.toThrow(error)

        expect(mockRateLimiter.acquire).toHaveBeenCalledWith(2)
        expect(mockRateLimiter.release).toHaveBeenCalledWith(2)
      })
    })

    describe('handleError', () => {
      it('should handle IntegrationError', () => {
        const mockEmit = jest.fn()
        ;(connector as any).emit = mockEmit

        const error = new IntegrationError('Test error', 'TEST_ERROR')

        ;(connector as any).handleError(error, 'Test context')

        expect(mockEmit).toHaveBeenCalledWith('error', error)
        expect(mockLogger.error).toHaveBeenCalledWith('Test context', {
          error: 'Test error',
          code: 'TEST_ERROR',
          details: undefined
        })
      })

      it('should wrap generic errors', () => {
        const mockEmit = jest.fn()
        ;(connector as any).emit = mockEmit

        const error = new Error('Generic error')

        ;(connector as any).handleError(error, 'Test context')

        expect(mockEmit).toHaveBeenCalledWith('error', expect.any(IntegrationError))
        expect(mockLogger.error).toHaveBeenCalledWith('Test context', {
          error: 'Generic error',
          code: 'NETSUITE_ERROR',
          details: undefined
        })
      })

      it('should handle non-Error objects', () => {
        const mockEmit = jest.fn()
        ;(connector as any).emit = mockEmit

        ;(connector as any).handleError('String error', 'Test context')

        expect(mockEmit).toHaveBeenCalledWith('error', expect.any(IntegrationError))
        expect(mockLogger.error).toHaveBeenCalledWith('Test context', {
          error: 'String error',
          code: 'NETSUITE_ERROR',
          details: undefined
        })
      })
    })
  })

  describe('error handling', () => {
    it('should handle sync errors gracefully', async () => {
      const error = new Error('Sync failed')
      ;(connector as any).withRetry = jest.fn().mockRejectedValue(error)

      const mockHandleError = jest.fn()
      ;(connector as any).handleError = mockHandleError

      await expect(connector.syncProducts()).rejects.toThrow(error)
      expect(mockHandleError).toHaveBeenCalledWith(error, 'Product sync failed')
    })

    it('should handle authentication failures during sync', async () => {
      mockAuth.getValidAccessToken.mockRejectedValue(new Error('Auth failed'))

      await expect(connector.testConnection()).resolves.toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'NetSuite connection test failed',
        { error: expect.any(Error) }
      )
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should handle complete sync workflow', async () => {
      // Setup all mocks for a complete workflow
      mockSupabase.single.mockResolvedValue({
        data: { last_sync_date: new Date('2023-01-01') }
      })

      mockClient.executeSuiteQL.mockResolvedValue({
        items: [{ itemid: 'ITEM001', displayname: 'Product 1' }],
        hasMore: false
      })

      mockTransformers.transformProduct.mockResolvedValue({
        sku: 'ITEM001',
        name: 'Product 1'
      })

      mockSupabase.upsert.mockResolvedValue({ error: null })
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())

      const result = await connector.syncProducts()

      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(1)
      expect(mockAuth.initialize).toHaveBeenCalled()
      expect(mockClient.executeSuiteQL).toHaveBeenCalled()
      expect(mockTransformers.transformProduct).toHaveBeenCalled()
      expect(mockSupabase.upsert).toHaveBeenCalled()
    })

    it('should handle rate limiting throughout workflow', async () => {
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
      mockSupabase.single.mockResolvedValue({ data: null })
      mockClient.executeSuiteQL.mockResolvedValue({ items: [], hasMore: false })

      await connector.syncProducts()

      expect(mockRateLimiter.acquire).toHaveBeenCalled()
      expect(mockRateLimiter.release).toHaveBeenCalled()
    })
  })
})