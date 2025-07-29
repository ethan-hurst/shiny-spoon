import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { ShopifyAPIClient } from '@/lib/integrations/shopify/api-client'
import type { ConnectorConfig } from '@/lib/integrations/base-connector'
import { createMockSupabaseClient, mockSupabaseResponse } from '@/__tests__/test-utils/supabase-mock'
import type { Database } from '@/supabase/types/database'

jest.mock('@/lib/integrations/shopify/api-client')
jest.mock('@/lib/supabase/client')

describe('ShopifyConnector', () => {
  let connector: ShopifyConnector
  let mockApiClient: jest.Mocked<ShopifyAPIClient>
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  
  const testConfig: ConnectorConfig = {
    integrationId: 'int-123',
    organizationId: 'org-123',
    credentials: {
      shopDomain: 'test-store.myshopify.com',
      accessToken: 'test-access-token',
      apiKey: 'test-api-key',
      apiSecretKey: 'test-secret-key'
    },
    settings: {
      rateLimit: 2, // Shopify allows 2 requests/second
      batchSize: 250, // Shopify max page size
      apiVersion: '2024-01'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock API client
    mockApiClient = {
      initialize: jest.fn().mockResolvedValue(undefined),
      testConnection: jest.fn().mockResolvedValue(true),
      getProducts: jest.fn(),
      getInventoryLevels: jest.fn(),
      getVariants: jest.fn(),
      getCustomers: jest.fn(),
      getOrders: jest.fn(),
      getPriceRules: jest.fn(),
      updateProduct: jest.fn(),
      updateInventoryLevel: jest.fn(),
      createWebhook: jest.fn(),
      deleteWebhook: jest.fn(),
      getWebhooks: jest.fn()
    } as unknown as jest.Mocked<ShopifyAPIClient>
    
    ;(ShopifyAPIClient as jest.MockedClass<typeof ShopifyAPIClient>).mockImplementation(() => mockApiClient)
    
    mockSupabase = createMockSupabaseClient()
    connector = new ShopifyConnector(testConfig)
    ;(connector as any).supabase = mockSupabase
  })

  describe('initialize', () => {
    it('should initialize the Shopify API client', async () => {
      await connector.initialize()
      
      expect(ShopifyAPIClient).toHaveBeenCalledWith({
        shopDomain: 'test-store.myshopify.com',
        accessToken: 'test-access-token',
        apiVersion: '2024-01'
      })
      expect(mockApiClient.initialize).toHaveBeenCalled()
    })

    it('should register webhooks on initialization', async () => {
      mockApiClient.getWebhooks.mockResolvedValueOnce([])
      mockApiClient.createWebhook.mockResolvedValue({
        webhook: { id: '123', topic: 'products/update' }
      })

      await connector.initialize()

      expect(mockApiClient.createWebhook).toHaveBeenCalledWith({
        topic: 'products/update',
        address: expect.stringContaining('/api/webhooks/shopify'),
        format: 'json'
      })
    })
  })

  describe('fetchProducts', () => {
    it('should fetch and transform Shopify products', async () => {
      const mockShopifyProducts = {
        products: [
          {
            id: 123456789,
            title: 'Test Product 1',
            handle: 'test-product-1',
            body_html: '<p>Product description</p>',
            vendor: 'Test Vendor',
            product_type: 'Electronics',
            tags: 'tag1, tag2',
            status: 'active',
            variants: [
              {
                id: 987654321,
                product_id: 123456789,
                title: 'Default',
                price: '99.99',
                sku: 'TEST-SKU-001',
                inventory_quantity: 100,
                weight: 1.5,
                weight_unit: 'lb'
              }
            ],
            images: [
              {
                id: 111111111,
                src: 'https://example.com/image.jpg',
                alt: 'Product image'
              }
            ],
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      }

      mockApiClient.getProducts.mockResolvedValueOnce(mockShopifyProducts)

      const products = await (connector as any).fetchProducts(10)

      expect(products).toHaveLength(1)
      expect(products[0]).toMatchObject({
        id: 123456789,
        title: 'Test Product 1',
        variants: expect.arrayContaining([
          expect.objectContaining({
            sku: 'TEST-SKU-001',
            price: '99.99'
          })
        ])
      })
      
      expect(mockApiClient.getProducts).toHaveBeenCalledWith({
        limit: 10,
        status: 'active'
      })
    })

    it('should handle pagination for large product catalogs', async () => {
      // First page
      mockApiClient.getProducts
        .mockResolvedValueOnce({
          products: Array(250).fill(null).map((_, i) => ({
            id: i,
            title: `Product ${i}`,
            variants: [{ sku: `SKU-${i}`, price: '10.00' }]
          }))
        })
        .mockResolvedValueOnce({
          products: Array(50).fill(null).map((_, i) => ({
            id: i + 250,
            title: `Product ${i + 250}`,
            variants: [{ sku: `SKU-${i + 250}`, price: '10.00' }]
          }))
        })

      const products = await (connector as any).fetchProducts(300)

      expect(products).toHaveLength(300)
      expect(mockApiClient.getProducts).toHaveBeenCalledTimes(2)
    })
  })

  describe('fetchInventory', () => {
    it('should fetch inventory levels for all locations', async () => {
      const mockInventoryLevels = {
        inventory_levels: [
          {
            inventory_item_id: 111111,
            location_id: 222222,
            available: 50,
            updated_at: '2024-01-01T00:00:00Z'
          },
          {
            inventory_item_id: 333333,
            location_id: 444444,
            available: 100,
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      }

      // Mock variant lookup for SKU mapping
      mockApiClient.getVariants.mockResolvedValueOnce({
        variants: [
          {
            id: 1,
            inventory_item_id: 111111,
            sku: 'TEST-SKU-001'
          },
          {
            id: 2,
            inventory_item_id: 333333,
            sku: 'TEST-SKU-002'
          }
        ]
      })

      mockApiClient.getInventoryLevels.mockResolvedValueOnce(mockInventoryLevels)

      const inventory = await (connector as any).fetchInventory()

      expect(inventory).toHaveLength(2)
      expect(inventory[0]).toMatchObject({
        inventory_item_id: 111111,
        sku: 'TEST-SKU-001',
        location_id: 222222,
        available: 50
      })
    })
  })

  describe('fetchPricing', () => {
    it('should fetch price rules and discounts', async () => {
      const mockPriceRules = {
        price_rules: [
          {
            id: 123,
            title: 'VIP Customer Discount',
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: 'percentage',
            value: '-10.0',
            customer_selection: 'prerequisite',
            prerequisite_customer_ids: [456789],
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-12-31T23:59:59Z'
          }
        ]
      }

      mockApiClient.getPriceRules.mockResolvedValueOnce(mockPriceRules)

      const pricing = await (connector as any).fetchPricing()

      expect(pricing).toHaveLength(1)
      expect(pricing[0]).toMatchObject({
        id: 123,
        title: 'VIP Customer Discount',
        value_type: 'percentage',
        value: '-10.0'
      })
    })
  })

  describe('transformations', () => {
    it('should transform Shopify product to database format', () => {
      const shopifyProduct = {
        id: 123456789,
        title: 'Test Product',
        body_html: '<p>Description</p>',
        vendor: 'Test Vendor',
        variants: [
          {
            id: 987654321,
            sku: 'TEST-SKU-001',
            price: '99.99'
          }
        ],
        status: 'active'
      }

      const transformed = (connector as any).transformProduct(shopifyProduct)

      expect(transformed).toEqual({
        external_id: '123456789',
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        description: 'Description', // HTML stripped
        active: true,
        organization_id: 'org-123'
      })
    })

    it('should handle products with multiple variants', () => {
      const shopifyProduct = {
        id: 123456789,
        title: 'Multi-Variant Product',
        variants: [
          { id: 1, sku: 'VAR-001', price: '99.99' },
          { id: 2, sku: 'VAR-002', price: '109.99' },
          { id: 3, sku: 'VAR-003', price: '119.99' }
        ],
        status: 'active'
      }

      const transformed = (connector as any).transformProduct(shopifyProduct)

      // Should use first variant SKU
      expect(transformed.sku).toBe('VAR-001')
    })

    it('should transform inventory data correctly', () => {
      const shopifyInventory = {
        inventory_item_id: 111111,
        sku: 'TEST-SKU-001',
        location_id: 222222,
        available: 50
      }

      const transformed = (connector as any).transformInventory(shopifyInventory)

      expect(transformed).toEqual({
        sku: 'TEST-SKU-001',
        warehouse_id: '222222',
        quantity: 50,
        organization_id: 'org-123'
      })
    })
  })

  describe('sync operations', () => {
    it('should sync products with variant consolidation', async () => {
      const mockProducts = {
        products: [
          {
            id: 123,
            title: 'Product with Variants',
            variants: [
              { id: 1, sku: 'VAR-001', price: '99.99' },
              { id: 2, sku: 'VAR-002', price: '109.99' }
            ],
            status: 'active'
          }
        ]
      }

      mockApiClient.getProducts.mockResolvedValueOnce(mockProducts)
      mockSupabase.from('products').upsert.mockResolvedValueOnce(
        mockSupabaseResponse([], null)
      )

      const result = await connector.sync('products')

      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(1) // One product despite multiple variants
      
      // Should create separate records for each variant
      expect(mockSupabase.from('product_variants')).toHaveBeenCalled()
    })

    it('should handle Shopify rate limiting', async () => {
      // Mock rate limit error
      const rateLimitError = new Error('Too Many Requests')
      ;(rateLimitError as any).response = {
        status: 429,
        headers: {
          'retry-after': '2'
        }
      }

      mockApiClient.getProducts
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ products: [] })

      const result = await connector.sync('products')

      expect(result.success).toBe(true)
      expect(mockApiClient.getProducts).toHaveBeenCalledTimes(2)
    }, 10000)

    it('should sync inventory with location mapping', async () => {
      // Mock location mapping
      mockSupabase.from('warehouse_mappings').select.mockResolvedValueOnce(
        mockSupabaseResponse([
          {
            external_id: '222222',
            warehouse_id: 'wh-001',
            platform: 'shopify'
          }
        ], null)
      )

      mockApiClient.getVariants.mockResolvedValueOnce({
        variants: [
          { id: 1, inventory_item_id: 111111, sku: 'TEST-SKU-001' }
        ]
      })

      mockApiClient.getInventoryLevels.mockResolvedValueOnce({
        inventory_levels: [
          {
            inventory_item_id: 111111,
            location_id: 222222,
            available: 50
          }
        ]
      })

      mockSupabase.from('inventory').upsert.mockResolvedValueOnce(
        mockSupabaseResponse([], null)
      )

      const result = await connector.sync('inventory')

      expect(result.success).toBe(true)
      expect(mockSupabase.from('inventory').upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            warehouse_id: 'wh-001', // Mapped from external location
            quantity: 50
          })
        ])
      )
    })
  })

  describe('webhook management', () => {
    it('should create required webhooks', async () => {
      const requiredTopics = [
        'products/create',
        'products/update',
        'products/delete',
        'inventory_levels/update',
        'orders/create'
      ]

      mockApiClient.getWebhooks.mockResolvedValueOnce({ webhooks: [] })
      mockApiClient.createWebhook.mockResolvedValue({
        webhook: { id: '123', topic: 'products/update' }
      })

      await (connector as any).setupWebhooks()

      expect(mockApiClient.createWebhook).toHaveBeenCalledTimes(requiredTopics.length)
      requiredTopics.forEach(topic => {
        expect(mockApiClient.createWebhook).toHaveBeenCalledWith(
          expect.objectContaining({ topic })
        )
      })
    })

    it('should not duplicate existing webhooks', async () => {
      mockApiClient.getWebhooks.mockResolvedValueOnce({
        webhooks: [
          {
            id: '123',
            topic: 'products/update',
            address: 'https://example.com/webhooks'
          }
        ]
      })

      await (connector as any).setupWebhooks()

      // Should only create missing webhooks
      expect(mockApiClient.createWebhook).toHaveBeenCalledTimes(4) // 5 required - 1 existing
    })
  })

  describe('error handling', () => {
    it('should handle API scope errors', async () => {
      const scopeError = new Error('Required scope missing')
      ;(scopeError as any).response = {
        status: 403,
        data: {
          errors: 'Unauthorized: Missing read_products scope'
        }
      }

      mockApiClient.getProducts.mockRejectedValueOnce(scopeError)

      const result = await connector.sync('products')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Missing read_products scope')
    })

    it('should handle shop deactivation', async () => {
      const shopError = new Error('Shop unavailable')
      ;(shopError as any).response = {
        status: 402,
        data: {
          errors: 'Shop is currently frozen'
        }
      }

      mockApiClient.getProducts.mockRejectedValueOnce(shopError)

      const result = await connector.sync('products')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Shop is currently frozen')
    })
  })

  describe('connection management', () => {
    it('should test connection with shop info', async () => {
      mockApiClient.testConnection.mockResolvedValueOnce(true)
      
      const isConnected = await connector.testConnection()
      
      expect(isConnected).toBe(true)
      expect(mockApiClient.testConnection).toHaveBeenCalled()
    })

    it('should cleanup webhooks on disconnect', async () => {
      mockApiClient.getWebhooks.mockResolvedValueOnce({
        webhooks: [
          { id: '123', topic: 'products/update' },
          { id: '456', topic: 'inventory_levels/update' }
        ]
      })

      await connector.disconnect()

      expect(mockApiClient.deleteWebhook).toHaveBeenCalledWith('123')
      expect(mockApiClient.deleteWebhook).toHaveBeenCalledWith('456')
    })
  })
})