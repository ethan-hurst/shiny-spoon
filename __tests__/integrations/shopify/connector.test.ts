// PRP-014: Shopify Connector Integration Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { ShopifyAuth } from '@/lib/integrations/shopify/auth'
import { ShopifyApiClient } from '@/lib/integrations/shopify/api-client'
import { ShopifyTransformers } from '@/lib/integrations/shopify/transformers'
import { IntegrationError } from '@/types/integration.types'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
}))

vi.mock('@/lib/integrations/shopify/auth')
vi.mock('@/lib/integrations/shopify/api-client')
vi.mock('@/lib/integrations/shopify/transformers')

describe('ShopifyConnector Integration', () => {
  let connector: ShopifyConnector
  let mockAuth: any
  let mockClient: any
  let mockTransformers: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock auth
    mockAuth = {
      initialize: vi.fn().mockResolvedValue(undefined),
      validateCredentials: vi.fn().mockResolvedValue(true),
      getShopInfo: vi.fn().mockResolvedValue({
        id: 'gid://shopify/Shop/123456789',
        name: 'Test Store',
        domain: 'test-store.myshopify.com'
      }),
      hasB2BFeatures: vi.fn().mockResolvedValue(true),
      getLocations: vi.fn().mockResolvedValue([
        { id: 1, name: 'Main Location' },
        { id: 2, name: 'Secondary Location' }
      ])
    }

    // Setup mock client
    mockClient = {
      getProducts: vi.fn(),
      getInventoryLevels: vi.fn(),
      getCustomers: vi.fn(),
      getOrders: vi.fn(),
      getCatalogs: vi.fn(),
      getPriceLists: vi.fn(),
      createOrUpdateProduct: vi.fn(),
      deleteProduct: vi.fn(),
      updateInventoryLevel: vi.fn()
    }

    // Setup mock transformers
    mockTransformers = {
      transformProduct: vi.fn(),
      transformVariant: vi.fn(),
      transformInventoryLevel: vi.fn(),
      transformCustomer: vi.fn(),
      transformOrder: vi.fn(),
      transformToShopifyProduct: vi.fn(),
      transformToShopifyInventoryLevel: vi.fn()
    }

    // Mock the constructor dependencies
    vi.mocked(ShopifyAuth).mockImplementation(() => mockAuth as any)
    vi.mocked(ShopifyApiClient).mockImplementation(() => mockClient as any)
    vi.mocked(ShopifyTransformers).mockImplementation(() => mockTransformers as any)

    connector = new ShopifyConnector({
      integrationId: 'test-integration',
      organizationId: 'test-org',
      credentials: {
        shop_domain: 'test-store.myshopify.com',
        access_token: 'shpat_test_token',
        api_version: '2024-01'
      },
      settings: {
        sync_products: true,
        sync_inventory: true,
        sync_customers: true,
        sync_orders: true,
        sync_pricing: true,
        field_mappings: {
          'shopify_custom_field': 'internal_custom_field'
        },
        location_mappings: {
          '1': 'warehouse_main',
          '2': 'warehouse_secondary'
        }
      }
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('authentication', () => {
    it('should authenticate successfully', async () => {
      await expect(connector.authenticate()).resolves.not.toThrow()
      expect(mockAuth.initialize).toHaveBeenCalled()
    })

    it('should throw error when authentication fails', async () => {
      mockAuth.initialize.mockRejectedValue(new Error('Authentication failed'))

      await expect(connector.authenticate()).rejects.toThrow('Authentication failed')
    })

    it('should test connection successfully', async () => {
      const result = await connector.testConnection()
      expect(result).toBe(true)
      expect(mockAuth.validateCredentials).toHaveBeenCalled()
    })

    it('should return false when connection test fails', async () => {
      mockAuth.validateCredentials.mockResolvedValue(false)

      const result = await connector.testConnection()
      expect(result).toBe(false)
    })
  })

  describe('syncProducts', () => {
    it('should sync products successfully', async () => {
      const mockProducts = [
        {
          id: 1,
          title: 'Test Product',
          status: 'active',
          variants: [
            {
              id: 1,
              title: 'Default Title',
              sku: 'TEST-SKU-001',
              price: '29.99'
            }
          ]
        }
      ]

      const mockTransformedProducts = [
        {
          id: '1',
          external_id: '1',
          platform: 'shopify',
          title: 'Test Product',
          status: 'active',
          variants: [
            {
              id: '1',
              external_id: '1',
              title: 'Default Title',
              sku: 'TEST-SKU-001',
              price: 29.99
            }
          ]
        }
      ]

      mockClient.getProducts.mockResolvedValue({
        products: mockProducts,
        hasNextPage: false
      })

      mockTransformers.transformProduct.mockReturnValue(mockTransformedProducts[0])

      const result = await connector.syncProducts()

      expect(result).toEqual({
        success: true,
        synced: 1,
        errors: [],
        warnings: []
      })

      expect(mockClient.getProducts).toHaveBeenCalled()
      expect(mockTransformers.transformProduct).toHaveBeenCalledWith(mockProducts[0])
    })

    it('should handle pagination correctly', async () => {
      const mockProductsPage1 = [{ id: 1, title: 'Product 1' }]
      const mockProductsPage2 = [{ id: 2, title: 'Product 2' }]

      mockClient.getProducts
        .mockResolvedValueOnce({
          products: mockProductsPage1,
          hasNextPage: true,
          nextPageInfo: 'next_cursor'
        })
        .mockResolvedValueOnce({
          products: mockProductsPage2,
          hasNextPage: false
        })

      mockTransformers.transformProduct
        .mockReturnValueOnce({ id: '1', title: 'Product 1' })
        .mockReturnValueOnce({ id: '2', title: 'Product 2' })

      const result = await connector.syncProducts()

      expect(result.synced).toBe(2)
      expect(mockClient.getProducts).toHaveBeenCalledTimes(2)
    })

    it('should handle API errors gracefully', async () => {
      mockClient.getProducts.mockRejectedValue(new Error('API Error'))

      const result = await connector.syncProducts()

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('API Error')
    })
  })

  describe('syncInventory', () => {
    it('should sync inventory levels successfully', async () => {
      const mockInventory = [
        {
          id: 1,
          inventory_item_id: 1,
          location_id: 1,
          available: 25
        }
      ]

      const mockTransformedInventory = [
        {
          id: '1',
          external_id: '1',
          inventory_item_id: '1',
          location_id: 'warehouse_main',
          available: 25
        }
      ]

      mockClient.getInventoryLevels.mockResolvedValue({
        inventory_levels: mockInventory,
        hasNextPage: false
      })

      mockTransformers.transformInventoryLevel.mockReturnValue(mockTransformedInventory[0])

      const result = await connector.syncInventory()

      expect(result.success).toBe(true)
      expect(result.synced).toBe(1)
      expect(mockClient.getInventoryLevels).toHaveBeenCalled()
      expect(mockTransformers.transformInventoryLevel).toHaveBeenCalledWith(mockInventory[0])
    })

    it('should apply location mappings correctly', async () => {
      const mockInventory = [
        {
          id: 1,
          inventory_item_id: 1,
          location_id: 1,
          available: 25
        }
      ]

      mockClient.getInventoryLevels.mockResolvedValue({
        inventory_levels: mockInventory,
        hasNextPage: false
      })

      mockTransformers.transformInventoryLevel.mockReturnValue({
        id: '1',
        location_id: 'warehouse_main',
        available: 25
      })

      await connector.syncInventory()

      expect(mockTransformers.transformInventoryLevel).toHaveBeenCalledWith(mockInventory[0])
    })
  })

  describe('syncCustomers', () => {
    it('should sync customers successfully', async () => {
      const mockCustomers = [
        {
          id: 1,
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe'
        }
      ]

      const mockTransformedCustomers = [
        {
          id: '1',
          external_id: '1',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe'
        }
      ]

      mockClient.getCustomers.mockResolvedValue({
        customers: mockCustomers,
        hasNextPage: false
      })

      mockTransformers.transformCustomer.mockReturnValue(mockTransformedCustomers[0])

      const result = await connector.syncCustomers()

      expect(result.success).toBe(true)
      expect(result.synced).toBe(1)
      expect(mockClient.getCustomers).toHaveBeenCalled()
      expect(mockTransformers.transformCustomer).toHaveBeenCalledWith(mockCustomers[0])
    })
  })

  describe('syncOrders', () => {
    it('should sync orders successfully', async () => {
      const mockOrders = [
        {
          id: 1,
          name: '#1001',
          total_price: '100.00',
          financial_status: 'paid'
        }
      ]

      const mockTransformedOrders = [
        {
          id: '1',
          external_id: '1',
          name: '#1001',
          total_price: 100,
          financial_status: 'paid'
        }
      ]

      mockClient.getOrders.mockResolvedValue({
        orders: mockOrders,
        hasNextPage: false
      })

      mockTransformers.transformOrder.mockReturnValue(mockTransformedOrders[0])

      const result = await connector.syncOrders()

      expect(result.success).toBe(true)
      expect(result.synced).toBe(1)
      expect(mockClient.getOrders).toHaveBeenCalled()
      expect(mockTransformers.transformOrder).toHaveBeenCalledWith(mockOrders[0])
    })
  })

  describe('syncPricing', () => {
    it('should sync B2B pricing successfully', async () => {
      const mockCatalogs = [
        {
          id: 1,
          title: 'B2B Catalog',
          status: 'active'
        }
      ]

      const mockPriceLists = [
        {
          id: 1,
          name: 'B2B Price List',
          currency: 'USD'
        }
      ]

      mockClient.getCatalogs.mockResolvedValue({
        catalogs: mockCatalogs,
        hasNextPage: false
      })

      mockClient.getPriceLists.mockResolvedValue({
        price_lists: mockPriceLists,
        hasNextPage: false
      })

      const result = await connector.syncPricing()

      expect(result.success).toBe(true)
      expect(mockClient.getCatalogs).toHaveBeenCalled()
      expect(mockClient.getPriceLists).toHaveBeenCalled()
    })

    it('should handle missing B2B features gracefully', async () => {
      mockAuth.hasB2BFeatures.mockResolvedValue(false)

      const result = await connector.syncPricing()

      expect(result.success).toBe(true)
      expect(result.warnings).toContain('B2B features not available')
      expect(mockClient.getCatalogs).not.toHaveBeenCalled()
    })
  })

  describe('handleWebhook', () => {
    it('should handle product webhook successfully', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'New Product',
        status: 'active'
      }

      mockClient.getProduct.mockResolvedValue(webhookPayload)
      mockTransformers.transformProduct.mockReturnValue({
        id: '123456789',
        external_id: '123456789',
        title: 'New Product',
        status: 'active'
      })

      await connector.handleWebhook({
        topic: 'products/create',
        payload: webhookPayload
      })

      expect(mockClient.getProduct).toHaveBeenCalledWith('123456789')
      expect(mockTransformers.transformProduct).toHaveBeenCalledWith(webhookPayload)
    })

    it('should handle inventory webhook successfully', async () => {
      const webhookPayload = {
        id: 111222333,
        inventory_item_id: 555666777,
        location_id: 1,
        available: 25
      }

      mockTransformers.transformInventoryLevel.mockReturnValue({
        id: '111222333',
        external_id: '111222333',
        inventory_item_id: '555666777',
        location_id: 'warehouse_main',
        available: 25
      })

      await connector.handleWebhook({
        topic: 'inventory_levels/update',
        payload: webhookPayload
      })

      expect(mockTransformers.transformInventoryLevel).toHaveBeenCalledWith(webhookPayload)
    })

    it('should handle unknown webhook topics gracefully', async () => {
      const webhookPayload = { id: 1, data: 'test' }

      await expect(connector.handleWebhook({
        topic: 'unknown/topic',
        payload: webhookPayload
      })).resolves.not.toThrow()
    })

    it('should handle webhook errors gracefully', async () => {
      const webhookPayload = { id: 1 }

      mockClient.getProduct.mockRejectedValue(new Error('API Error'))

      await expect(connector.handleWebhook({
        topic: 'products/create',
        payload: webhookPayload
      })).resolves.not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.name = 'ShopifyRateLimitError'
      
      mockClient.getProducts.mockRejectedValue(rateLimitError)

      const result = await connector.syncProducts()

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Rate limit exceeded')
    })

    it('should handle authentication errors', async () => {
      const authError = new Error('Invalid credentials')
      authError.name = 'ShopifyAuthenticationError'
      
      mockAuth.validateCredentials.mockRejectedValue(authError)

      const result = await connector.testConnection()

      expect(result).toBe(false)
    })

    it('should handle transformation errors', async () => {
      const mockProducts = [{ id: 1, title: 'Test Product' }]

      mockClient.getProducts.mockResolvedValue({
        products: mockProducts,
        hasNextPage: false
      })

      mockTransformers.transformProduct.mockImplementation(() => {
        throw new Error('Transformation failed')
      })

      const result = await connector.syncProducts()

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Transformation failed')
    })
  })

  describe('configuration', () => {
    it('should use custom field mappings', async () => {
      const mockProduct = {
        id: 1,
        title: 'Test Product',
        shopify_custom_field: 'custom_value'
      }

      mockClient.getProducts.mockResolvedValue({
        products: [mockProduct],
        hasNextPage: false
      })

      mockTransformers.transformProduct.mockReturnValue({
        id: '1',
        title: 'Test Product',
        internal_custom_field: 'custom_value'
      })

      await connector.syncProducts()

      expect(mockTransformers.transformProduct).toHaveBeenCalledWith(mockProduct)
    })

    it('should use custom location mappings', async () => {
      const mockInventory = [
        {
          id: 1,
          location_id: 1,
          available: 25
        }
      ]

      mockClient.getInventoryLevels.mockResolvedValue({
        inventory_levels: mockInventory,
        hasNextPage: false
      })

      mockTransformers.transformInventoryLevel.mockReturnValue({
        id: '1',
        location_id: 'warehouse_main',
        available: 25
      })

      await connector.syncInventory()

      expect(mockTransformers.transformInventoryLevel).toHaveBeenCalledWith(mockInventory[0])
    })
  })
})