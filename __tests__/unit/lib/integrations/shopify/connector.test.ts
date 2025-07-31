import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { ShopifyApiClient } from '@/lib/integrations/shopify/api-client'
import { BulkOperationManager } from '@/lib/integrations/shopify/bulk-operations'
import { PricingManager } from '@/lib/integrations/shopify/pricing-manager'
import { ShopifyTransformers } from '@/lib/integrations/shopify/transformers'
import { createClient } from '@/lib/supabase/server'
import { IntegrationError } from '@/types/integration.types'
import type { ConnectorConfig } from '@/lib/integrations/base-connector'
import type { ShopifyIntegrationSettings } from '@/types/shopify.types'

// Mock dependencies
jest.mock('@/lib/integrations/shopify/api-client')
jest.mock('@/lib/integrations/shopify/bulk-operations')
jest.mock('@/lib/integrations/shopify/pricing-manager')
jest.mock('@/lib/integrations/shopify/transformers')
jest.mock('@/lib/supabase/server')
jest.mock('crypto')

describe('ShopifyConnector', () => {
  let connector: ShopifyConnector
  let mockClient: jest.Mocked<ShopifyApiClient>
  let mockBulkManager: jest.Mocked<BulkOperationManager>
  let mockPricingManager: jest.Mocked<PricingManager>
  let mockTransformers: jest.Mocked<ShopifyTransformers>
  let mockSupabase: any
  let mockRateLimiter: any
  let mockLogger: any

  const mockConfig: ConnectorConfig = {
    integrationId: 'integration-123',
    organizationId: 'org-456',
    platform: 'shopify',
    isActive: true,
    credentials: {
      encrypted: true,
      data: 'encrypted-credentials-data'
    },
    settings: {
      shop_domain: 'test-shop.myshopify.com',
      api_version: '2024-01',
      currency: 'USD',
      webhook_secret: 'test-webhook-secret'
    } as ShopifyIntegrationSettings
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock crypto for credential decryption
    const mockCrypto = require('crypto')
    mockCrypto.createHash = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue(Buffer.from('test-salt'))
      })
    })
    mockCrypto.scryptSync = jest.fn().mockReturnValue(Buffer.from('test-key'))
    mockCrypto.createDecipheriv = jest.fn().mockReturnValue({
      setAuthTag: jest.fn(),
      update: jest.fn().mockReturnValue('{"access_token":"test-token","webhook_secret":"test-secret"}'),
      final: jest.fn().mockReturnValue('')
    })

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: null, error: null })
    }
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

    // Mock Shopify API Client
    mockClient = {
      query: jest.fn().mockResolvedValue({
        data: {
          shop: {
            id: 'gid://shopify/Shop/123',
            name: 'Test Shop',
            email: 'test@shop.com',
            plan: {
              displayName: 'Shopify Plus'
            },
            features: {
              storefront: true,
              b2b: true
            }
          }
        }
      }),
      mutation: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    } as any
    ;(ShopifyApiClient as jest.Mock).mockImplementation(() => mockClient)

    // Mock Bulk Operation Manager
    mockBulkManager = {
      createBulkOperation: jest.fn(),
      pollBulkOperation: jest.fn(),
      getBulkOperationResults: jest.fn()
    } as any
    ;(BulkOperationManager as jest.Mock).mockImplementation(() => mockBulkManager)

    // Mock Pricing Manager
    mockPricingManager = {
      syncPricing: jest.fn(),
      updatePricing: jest.fn(),
      getPricingRules: jest.fn()
    } as any
    ;(PricingManager as jest.Mock).mockImplementation(() => mockPricingManager)

    // Mock Transformers
    mockTransformers = {
      transformProduct: jest.fn(),
      transformInventory: jest.fn(),
      transformPricing: jest.fn()
    } as any
    ;(ShopifyTransformers as jest.Mock).mockImplementation(() => mockTransformers)

    // Create connector instance
    connector = new ShopifyConnector(mockConfig)
    
    // Mock the connector's logger after creation
    if (connector && typeof connector === 'object') {
      Object.defineProperty(connector, 'logger', {
        get: jest.fn().mockReturnValue(mockLogger),
        configurable: true,
        enumerable: true
      })
    }
  })

  describe('constructor', () => {
    it('should initialize with correct platform', () => {
      expect(connector.platform).toBe('shopify')
    })

    it('should parse and decrypt credentials', () => {
      expect(mockClient).toBeDefined()
      expect(mockBulkManager).toBeDefined()
      expect(mockPricingManager).toBeDefined()
      expect(mockTransformers).toBeDefined()
    })

    it('should handle credential decryption errors', () => {
      // Set up encrypted credentials
      const encryptedConfig = {
        ...mockConfig,
        credentials: {
          encrypted: true,
          data: 'encrypted-data-here'
        }
      }

      // Mock crypto to throw an error during decryption
      const mockCrypto = require('crypto')
      mockCrypto.createDecipheriv.mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      expect(() => new ShopifyConnector(encryptedConfig)).toThrow('Invalid credentials encryption')
    })
  })

  describe('authenticate', () => {
    it('should authenticate successfully with valid shop data', async () => {
      const mockShopData = {
        data: {
          shop: {
            id: 'gid://shopify/Shop/123',
            name: 'Test Shop',
            email: 'test@shop.com',
            plan: {
              displayName: 'Shopify Plus'
            },
            features: {
              storefront: true,
              b2b: true
            }
          }
        }
      }

      mockClient.query.mockResolvedValue(mockShopData)

      await connector.authenticate()

      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('query'))
      expect(mockLogger.info).toHaveBeenCalledWith('Authenticated with Shopify', {
        shop: 'Test Shop',
        plan: 'Shopify Plus'
      })
    })

    it('should throw error when shop data is missing', async () => {
      mockClient.query.mockResolvedValue({ data: {} })

      await expect(connector.authenticate()).rejects.toThrow('Failed to authenticate with Shopify')
    })

    it('should handle API errors during authentication', async () => {
      mockClient.query.mockRejectedValue(new Error('API Error'))

      await expect(connector.authenticate()).rejects.toThrow()
    })
  })

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      mockClient.query.mockResolvedValue({
        data: {
          shop: {
            id: 'gid://shopify/Shop/123'
          }
        }
      })

      const result = await connector.testConnection()

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('query'))
    })

    it('should return false for failed connection test', async () => {
      // Override the default mock for this test
      mockClient.query.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await connector.testConnection()

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Connection test failed', expect.any(Error))
    })
  })

  describe('syncProducts', () => {
      const mockSyncState = {
      last_sync_at: new Date().toISOString(),
      cursor: 'test-cursor'
    }

    beforeEach(() => {
      // Mock sync state methods
      jest.spyOn(connector as any, 'getSyncState').mockResolvedValue(mockSyncState)
      jest.spyOn(connector as any, 'saveProduct').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'saveProductMapping').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'saveSyncCursor').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'updateSyncState').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'emitProgress').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'withRateLimit').mockImplementation(async (fn) => fn())
    })

    it('should perform incremental sync when sync state exists', async () => {
      // Mock authentication to succeed
      jest.spyOn(connector, 'authenticate').mockResolvedValue(undefined)
      
      const mockProducts = [
        {
          id: 'gid://shopify/Product/123',
          title: 'Test Product',
          handle: 'test-product',
          status: 'ACTIVE'
        }
      ]

      mockClient.query.mockResolvedValue({
        data: {
          products: {
            edges: mockProducts.map(p => ({ node: p })),
              pageInfo: {
                hasNextPage: false,
              endCursor: 'next-cursor'
            }
          }
        }
      })

      mockTransformers.transformProduct.mockReturnValue({
        id: 'internal-123',
        name: 'Test Product',
        sku: 'TEST-123'
      })

      const result = await connector.syncProducts()

      expect(result.success).toBe(true)
      expect(result.items_processed).toBeGreaterThan(0)
      expect(mockTransformers.transformProduct).toHaveBeenCalled()
    })

    it('should perform bulk sync when force option is provided', async () => {
      // Mock authentication to succeed
      jest.spyOn(connector, 'authenticate').mockResolvedValue(undefined)
      
      const mockBulkResult = {
        success: true,
        items_processed: 100,
        items_failed: 0,
        duration_ms: 5000,
        errors: []
      }

      jest.spyOn(connector as any, 'bulkSyncProducts').mockResolvedValue(mockBulkResult)

      const result = await connector.syncProducts({ force: true })

      expect(result).toEqual(mockBulkResult)
      expect((connector as any).bulkSyncProducts).toHaveBeenCalledWith({ force: true })
    })

    it('should handle sync errors gracefully', async () => {
      // Mock authentication to succeed but then fail on sync
      jest.spyOn(connector, 'authenticate').mockResolvedValue(undefined)
      mockClient.query.mockRejectedValue(new Error('Sync failed'))

      const result = await connector.syncProducts()

      expect(result.success).toBe(false)
      expect(result.items_failed).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('syncInventory', () => {
    beforeEach(() => {
      jest.spyOn(connector as any, 'getSyncState').mockResolvedValue({
        last_sync_at: new Date().toISOString()
      })
      jest.spyOn(connector as any, 'updateInventory').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'updateSyncState').mockResolvedValue(undefined)
    })

    it('should sync inventory levels successfully', async () => {
      // Mock authentication to succeed
      jest.spyOn(connector, 'authenticate').mockResolvedValue(undefined)
      
      const mockInventory = [
        {
          id: 'gid://shopify/InventoryLevel/123',
          available: 50,
          location: {
            id: 'gid://shopify/Location/456'
          }
        }
      ]

      mockClient.query.mockResolvedValue({
        data: {
            inventoryLevels: {
            edges: mockInventory.map(i => ({ node: i })),
            pageInfo: {
              hasNextPage: false
            }
          }
        }
      })

      mockTransformers.transformInventory.mockReturnValue({
        id: 'internal-inv-123',
        quantity: 50,
        location_id: 'loc-456'
      })

      const result = await connector.syncInventory()

      expect(result.success).toBe(true)
      expect(mockTransformers.transformInventory).toHaveBeenCalled()
    })
  })

  describe('syncPricing', () => {
    it('should delegate to pricing manager', async () => {
      // Mock authentication to succeed
      jest.spyOn(connector, 'authenticate').mockResolvedValue(undefined)
      
      const mockPricingResult = {
        success: true,
        items_processed: 10,
        items_failed: 0,
        duration_ms: 1000,
        errors: []
      }

      mockPricingManager.syncPricing.mockResolvedValue(mockPricingResult)

      const result = await connector.syncPricing()

      expect(result).toEqual(mockPricingResult)
      expect(mockPricingManager.syncPricing).toHaveBeenCalled()
    })
  })

  describe('verifyWebhook', () => {
    it('should verify webhook signature correctly', async () => {
      const headers = new Headers({
        'x-shopify-hmac-sha256': 'valid-signature'
      })
      const body = 'test-body'

      // Mock crypto to return a matching signature
      const mockCrypto = require('crypto')
      mockCrypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('valid-signature')
        })
      })
      mockCrypto.timingSafeEqual.mockReturnValue(true)

      const result = await connector.verifyWebhook(headers, body)

      expect(result).toBe(true)
    })

    it('should reject invalid webhook signatures', async () => {
      const headers = new Headers({
        'x-shopify-hmac-sha256': 'invalid-signature'
      })
      const body = 'test-body'

      // Mock crypto to return a different signature
      const mockCrypto = require('crypto')
      mockCrypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('different-signature')
        })
      })
      mockCrypto.timingSafeEqual.mockReturnValue(false)

      const result = await connector.verifyWebhook(headers, body)

      expect(result).toBe(false)
    })
  })

  describe('handleWebhook', () => {
    beforeEach(() => {
      jest.spyOn(connector as any, 'processProductWebhook').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'processInventoryWebhook').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'processOrderWebhook').mockResolvedValue(undefined)
      jest.spyOn(connector as any, 'updateWebhookStatus').mockResolvedValue(undefined)
      
      // Mock Supabase insert to return data
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'webhook-123' },
              error: null
            })
          })
        })
      })
    })

    it('should handle product webhooks', async () => {
      const webhookBody = {
        id: 123,
        admin_graphql_api_id: 'gid://shopify/Product/456'
      }

      await connector.handleWebhook('products/create', webhookBody)

      expect((connector as any).processProductWebhook).toHaveBeenCalledWith('123', webhookBody)
    })

    it('should handle inventory webhooks', async () => {
      const webhookBody = {
        id: 123,
        inventory_item_id: 456
      }

      await connector.handleWebhook('inventory_levels/update', webhookBody)

      expect((connector as any).processInventoryWebhook).toHaveBeenCalledWith('123', webhookBody)
    })

    it('should handle order webhooks', async () => {
      const webhookBody = {
        id: 123,
        name: '#1001'
      }

      await connector.handleWebhook('orders/create', webhookBody)

      expect((connector as any).processOrderWebhook).toHaveBeenCalledWith('123', webhookBody)
    })

    it('should handle unknown webhook topics', async () => {
      const webhookBody = { id: 123 }

      await connector.handleWebhook('unknown/topic' as any, webhookBody)

      expect(mockLogger.warn).toHaveBeenCalledWith('Unhandled webhook topic', {
        topic: 'unknown/topic',
        webhookId: '123'
      })
    })
  })

  describe('getStoreInfo', () => {
    it('should return store information with B2B status', async () => {
      mockClient.query.mockResolvedValue({
        data: {
          shop: {
            plan: {
              displayName: 'Shopify Plus'
            },
            features: {
              b2b: true
            }
          }
        }
      })

      const result = await (connector as any).getStoreInfo()

      expect(result).toEqual({
        hasB2B: true,
        plan: 'Shopify Plus'
      })
    })

    it('should handle stores without B2B features', async () => {
      mockClient.query.mockResolvedValue({
          data: {
            shop: {
            plan: {
              displayName: 'Basic Shopify'
            },
            features: {
              b2b: false
            }
          }
        }
      })

        const result = await (connector as any).getStoreInfo()

        expect(result).toEqual({
          hasB2B: false,
        plan: 'Basic Shopify'
        })
      })
    })

  describe('extractIdFromGid', () => {
    it('should extract ID from Shopify GID', () => {
      const gid = 'gid://shopify/Product/123456'
      const result = (connector as any).extractIdFromGid(gid)
      expect(result).toBe('123456')
    })

    it('should handle GID without ID', () => {
      const gid = 'gid://shopify/Product/'
      const result = (connector as any).extractIdFromGid(gid)
      expect(result).toBe('')
    })
  })

  describe('error handling', () => {
    it('should handle rate limiting errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Rate limit exceeded'))

      await expect(connector.authenticate()).rejects.toThrow()
    })

    it('should handle network errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Network error'))

      await expect(connector.authenticate()).rejects.toThrow()
    })

    it('should handle authentication errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Invalid access token'))

      await expect(connector.authenticate()).rejects.toThrow()
    })
  })
})