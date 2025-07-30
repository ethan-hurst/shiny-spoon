import crypto from 'crypto'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { ShopifyApiClient } from '@/lib/integrations/shopify/api-client'
import { BulkOperationManager } from '@/lib/integrations/shopify/bulk-operations'
import { PricingManager } from '@/lib/integrations/shopify/pricing-manager'
import { ShopifyTransformers } from '@/lib/integrations/shopify/transformers'
import { incrementalSyncProducts } from '@/lib/integrations/shopify/connector-helpers'
import { createClient } from '@/lib/supabase/server'
import { IntegrationPlatform } from '@/types/integration.types'
import type { ConnectorConfig } from '@/lib/integrations/base-connector'
import type { ShopifyIntegrationSettings, ShopifyWebhookTopic } from '@/types/shopify.types'

// Mock dependencies
jest.mock('@/lib/integrations/shopify/api-client')
jest.mock('@/lib/integrations/shopify/bulk-operations')
jest.mock('@/lib/integrations/shopify/pricing-manager')
jest.mock('@/lib/integrations/shopify/transformers')
jest.mock('@/lib/integrations/shopify/connector-helpers')
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
      access_token: 'test-access-token',
      webhook_secret: 'test-webhook-secret',
      storefront_access_token: 'test-storefront-token'
    },
    settings: {
      shop_domain: 'test-shop.myshopify.com',
      api_version: '2024-01',
      currency: 'USD',
      location_mappings: {
        'shopify-location-1': 'warehouse-1',
        'shopify-location-2': 'warehouse-2'
      }
    } as ShopifyIntegrationSettings
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock crypto functions
    const mockCreateHmac = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-hash')
    })
    const mockTimingSafeEqual = jest.fn().mockReturnValue(true)
    const mockCreateHash = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(Buffer.from('mock-salt'))
    })
    const mockScryptSync = jest.fn().mockReturnValue(Buffer.from('mock-key'))
    const mockRandomUUID = jest.fn().mockReturnValue('mock-uuid')

    ;(crypto.createHmac as jest.Mock) = mockCreateHmac
    ;(crypto.timingSafeEqual as jest.Mock) = mockTimingSafeEqual
    ;(crypto.createHash as jest.Mock) = mockCreateHash
    ;(crypto.scryptSync as jest.Mock) = mockScryptSync
    ;(crypto.randomUUID as jest.Mock) = mockRandomUUID

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)

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
      query: jest.fn(),
      mutation: jest.fn(),
      getApiCallLimits: jest.fn().mockReturnValue({ used: 0, limit: 1000, available: 1000 })
    } as any
    ;(ShopifyApiClient as jest.Mock).mockImplementation(() => mockClient)

    // Mock Bulk Operation Manager
    mockBulkManager = {
      createBulkQuery: jest.fn(),
      waitForCompletion: jest.fn(),
      processResults: jest.fn(),
      handleBulkOperationWebhook: jest.fn()
    } as any
    ;(BulkOperationManager as jest.Mock).mockImplementation(() => mockBulkManager)

    // Mock Pricing Manager
    mockPricingManager = {
      syncCatalogs: jest.fn()
    } as any
    ;(PricingManager as jest.Mock).mockImplementation(() => mockPricingManager)

    // Mock Transformers
    mockTransformers = {
      transformProduct: jest.fn(),
      transformInventory: jest.fn(),
      transformInventoryFromWebhook: jest.fn(),
      transformOrder: jest.fn()
    } as any
    ;(ShopifyTransformers as jest.Mock).mockImplementation(() => mockTransformers)

    // Create connector instance
    connector = new ShopifyConnector(mockConfig)
    ;(connector as any).rateLimiter = mockRateLimiter
    ;(connector as any).logger = mockLogger
  })

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(connector.platform).toBe(IntegrationPlatform.SHOPIFY)
      
      expect(ShopifyApiClient).toHaveBeenCalledWith({
        shop: mockConfig.settings.shop_domain,
        accessToken: mockConfig.credentials.access_token,
        apiVersion: mockConfig.settings.api_version,
        rateLimiter: mockRateLimiter
      })

      expect(ShopifyTransformers).toHaveBeenCalled()
      expect(BulkOperationManager).toHaveBeenCalledWith(mockClient, mockConfig.integrationId)
      expect(PricingManager).toHaveBeenCalledWith(
        mockClient,
        mockConfig.integrationId,
        mockConfig.organizationId,
        { currency: mockConfig.settings.currency }
      )
    })

    it('should handle encrypted credentials', () => {
      const encryptedConfig = {
        ...mockConfig,
        credentials: {
          encrypted: true,
          data: Buffer.concat([
            Buffer.alloc(16), // IV
            Buffer.from('encrypted-data'),
            Buffer.alloc(16) // Auth tag
          ]).toString('base64')
        }
      }

      // Mock crypto operations for decryption
      const mockCreateDecipheriv = jest.fn().mockReturnValue({
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue('{"access_token":"decrypted-token",'),
        final: jest.fn().mockReturnValue('"webhook_secret":"decrypted-secret"}')
      })
      ;(crypto.createDecipheriv as jest.Mock) = mockCreateDecipheriv

      process.env.ENCRYPTION_KEY = 'test-encryption-key'

      expect(() => new ShopifyConnector(encryptedConfig)).not.toThrow()
      expect(crypto.createHash).toHaveBeenCalledWith('sha256')
      expect(crypto.scryptSync).toHaveBeenCalled()
      expect(crypto.createDecipheriv).toHaveBeenCalledWith('aes-256-gcm', expect.any(Buffer), expect.any(Buffer))
    })

    it('should handle decryption errors', () => {
      const encryptedConfig = {
        ...mockConfig,
        credentials: {
          encrypted: true,
          data: 'invalid-base64'
        }
      }

      process.env.ENCRYPTION_KEY = 'test-encryption-key'
      const mockCreateDecipheriv = jest.fn().mockReturnValue({
        setAuthTag: jest.fn(),
        update: jest.fn().mockImplementation(() => { throw new Error('Decryption failed') }),
        final: jest.fn()
      })
      ;(crypto.createDecipheriv as jest.Mock) = mockCreateDecipheriv

      expect(() => new ShopifyConnector(encryptedConfig)).toThrow('Invalid credentials encryption')
    })
  })

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      const mockShopResponse = {
        data: {
          shop: {
            id: 'shop-123',
            name: 'Test Shop',
            email: 'test@shop.com',
            plan: { displayName: 'Shopify Plus' }
          }
        }
      }

      mockClient.query.mockResolvedValue(mockShopResponse)
      const mockEmit = jest.fn()
      ;(connector as any).emit = mockEmit

      await connector.authenticate()

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('query')
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Authenticated with Shopify', {
        shop: 'Test Shop',
        plan: 'Shopify Plus'
      })
      expect(mockEmit).toHaveBeenCalledWith('authenticated', {
        integrationId: mockConfig.integrationId,
        shop: 'Test Shop'
      })
    })

    it('should handle authentication failure', async () => {
      mockClient.query.mockResolvedValue({ data: null })
      const mockHandleError = jest.fn()
      ;(connector as any).handleError = mockHandleError

      await expect(connector.authenticate()).rejects.toThrow()
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.any(Error),
        'Authentication failed'
      )
    })

    it('should handle API errors during authentication', async () => {
      const error = new Error('API Error')
      mockClient.query.mockRejectedValue(error)
      const mockHandleError = jest.fn()
      ;(connector as any).handleError = mockHandleError

      await expect(connector.authenticate()).rejects.toThrow()
      expect(mockHandleError).toHaveBeenCalledWith(error, 'Authentication failed')
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockClient.query.mockResolvedValue({
        data: { shop: { id: 'shop-123' } }
      })

      const result = await connector.testConnection()

      expect(result).toBe(true)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('shop { id }')
      )
    })

    it('should handle connection test failure', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection failed'))

      const result = await connector.testConnection()

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Connection test failed',
        expect.any(Error)
      )
    })

    it('should handle missing shop data', async () => {
      mockClient.query.mockResolvedValue({ data: null })

      const result = await connector.testConnection()

      expect(result).toBe(false)
    })
  })

  describe('syncProducts', () => {
    beforeEach(() => {
      // Mock getSyncState
      ;(connector as any).getSyncState = jest.fn()
      
      // Mock withRetry
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
      
      // Mock authenticate
      connector.authenticate = jest.fn().mockResolvedValue(undefined)
    })

    it('should perform bulk sync for initial sync', async () => {
      ;(connector as any).getSyncState.mockResolvedValue(null)
      ;(connector as any).bulkSyncProducts = jest.fn().mockResolvedValue({
        success: true,
        items_processed: 100,
        items_failed: 0,
        duration_ms: 5000,
        errors: []
      })

      const result = await connector.syncProducts()

      expect((connector as any).bulkSyncProducts).toHaveBeenCalledWith(undefined)
      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(100)
    })

    it('should perform incremental sync when sync state exists', async () => {
      const mockSyncState = {
        last_sync_at: new Date('2023-01-01'),
        last_cursor: 'cursor-123'
      }

      ;(connector as any).getSyncState.mockResolvedValue(mockSyncState)
      ;(incrementalSyncProducts as jest.Mock).mockResolvedValue({
        processed: 50,
        failed: 2,
        errors: [new Error('Sync error 1'), new Error('Sync error 2')]
      })

      const result = await connector.syncProducts()

      expect(incrementalSyncProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          client: mockClient,
          transformers: mockTransformers,
          logger: mockLogger
        }),
        mockSyncState,
        undefined
      )
      expect(result).toEqual({
        success: false,
        items_processed: 50,
        items_failed: 2,
        duration_ms: expect.any(Number),
        errors: [
          { message: 'Sync error 1', code: 'SYNC_ERROR' },
          { message: 'Sync error 2', code: 'SYNC_ERROR' }
        ]
      })
    })

    it('should force bulk sync when requested', async () => {
      const mockSyncState = { last_sync_at: new Date('2023-01-01') }
      ;(connector as any).getSyncState.mockResolvedValue(mockSyncState)
      ;(connector as any).bulkSyncProducts = jest.fn().mockResolvedValue({
        success: true,
        items_processed: 200,
        items_failed: 0,
        duration_ms: 10000,
        errors: []
      })

      const result = await connector.syncProducts({ force: true })

      expect((connector as any).bulkSyncProducts).toHaveBeenCalledWith({ force: true })
      expect(result.items_processed).toBe(200)
    })

    it('should handle sync errors', async () => {
      const error = new Error('Sync failed')
      ;(connector as any).getSyncState.mockRejectedValue(error)
      const mockHandleError = jest.fn()
      ;(connector as any).handleError = mockHandleError

      await expect(connector.syncProducts()).rejects.toThrow(error)
      expect(mockHandleError).toHaveBeenCalledWith(error, 'Product sync failed')
    })
  })

  describe('syncInventory', () => {
    beforeEach(() => {
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
      ;(connector as any).withRateLimit = jest.fn().mockImplementation((fn) => fn())
      connector.authenticate = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).updateSyncState = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).updateInventory = jest.fn().mockResolvedValue(undefined)
    })

    it('should sync inventory successfully', async () => {
      const mockInventoryResponse = {
        data: {
          location: {
            id: 'shopify-location-1',
            name: 'Main Warehouse',
            inventoryLevels: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null
              },
              edges: [
                {
                  node: {
                    item: { id: 'item-1', sku: 'SKU001' },
                    available: 100
                  }
                },
                {
                  node: {
                    item: { id: 'item-2', sku: 'SKU002' },
                    available: 50
                  }
                }
              ]
            }
          }
        }
      }

      mockClient.query.mockResolvedValue(mockInventoryResponse)
      mockTransformers.transformInventory.mockReturnValue({
        product_id: 'product-1',
        warehouse_id: 'warehouse-1',
        quantity: 100
      })

      const result = await connector.syncInventory()

      expect(result).toEqual({
        success: true,
        items_processed: 4, // 2 items × 2 locations
        items_failed: 0,
        duration_ms: expect.any(Number),
        errors: []
      })

      expect(mockClient.query).toHaveBeenCalledTimes(2) // Once per location
      expect(mockTransformers.transformInventory).toHaveBeenCalledTimes(4)
      expect((connector as any).updateInventory).toHaveBeenCalledTimes(4)
    })

    it('should handle missing location mappings', async () => {
      const configWithoutMappings = {
        ...mockConfig,
        settings: {
          ...mockConfig.settings,
          location_mappings: {}
        }
      }

      const connectorWithoutMappings = new ShopifyConnector(configWithoutMappings)
      ;(connectorWithoutMappings as any).withRetry = jest.fn().mockImplementation((fn) => fn())
      connectorWithoutMappings.authenticate = jest.fn().mockResolvedValue(undefined)

      await expect(connectorWithoutMappings.syncInventory()).rejects.toThrow(
        'No location mappings configured'
      )
    })

    it('should handle pagination', async () => {
      const mockFirstPageResponse = {
        data: {
          location: {
            id: 'shopify-location-1',
            name: 'Main Warehouse',
            inventoryLevels: {
              pageInfo: {
                hasNextPage: true,
                endCursor: 'cursor-123'
              },
              edges: [
                {
                  node: {
                    item: { id: 'item-1', sku: 'SKU001' },
                    available: 100
                  }
                }
              ]
            }
          }
        }
      }

      const mockSecondPageResponse = {
        data: {
          location: {
            id: 'shopify-location-1',
            name: 'Main Warehouse',
            inventoryLevels: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null
              },
              edges: [
                {
                  node: {
                    item: { id: 'item-2', sku: 'SKU002' },
                    available: 50
                  }
                }
              ]
            }
          }
        }
      }

      mockClient.query
        .mockResolvedValueOnce(mockFirstPageResponse)
        .mockResolvedValueOnce(mockSecondPageResponse)
        .mockResolvedValueOnce(mockFirstPageResponse)
        .mockResolvedValueOnce(mockSecondPageResponse)

      mockTransformers.transformInventory.mockReturnValue({
        product_id: 'product-1',
        warehouse_id: 'warehouse-1',
        quantity: 100
      })

      await connector.syncInventory()

      expect(mockClient.query).toHaveBeenCalledTimes(4) // 2 pages × 2 locations
    })

    it('should handle dry run mode', async () => {
      const mockInventoryResponse = {
        data: {
          location: {
            id: 'shopify-location-1',
            name: 'Main Warehouse',
            inventoryLevels: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  node: {
                    item: { id: 'item-1', sku: 'SKU001' },
                    available: 100
                  }
                }
              ]
            }
          }
        }
      }

      mockClient.query.mockResolvedValue(mockInventoryResponse)

      const result = await connector.syncInventory({ dryRun: true })

      expect(result.items_processed).toBe(2) // 1 item × 2 locations
      expect(mockLogger.info).toHaveBeenCalledWith('Dry run: Would sync inventory', {
        sku: 'SKU001',
        available: 100
      })
      expect((connector as any).updateInventory).not.toHaveBeenCalled()
      expect((connector as any).updateSyncState).not.toHaveBeenCalled()
    })

    it('should handle inventory transformation errors', async () => {
      const mockInventoryResponse = {
        data: {
          location: {
            id: 'shopify-location-1',
            name: 'Main Warehouse',
            inventoryLevels: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [
                {
                  node: {
                    item: { id: 'item-1', sku: 'SKU001' },
                    available: 100
                  }
                }
              ]
            }
          }
        }
      }

      mockClient.query.mockResolvedValue(mockInventoryResponse)
      mockTransformers.transformInventory.mockImplementation(() => {
        throw new Error('Transform failed')
      })

      const result = await connector.syncInventory()

      expect(result.success).toBe(false)
      expect(result.items_failed).toBe(2) // 1 item × 2 locations
      expect(result.errors).toHaveLength(2)
    })

    it('should handle missing location data', async () => {
      mockClient.query.mockResolvedValue({
        data: { location: null }
      })

      await connector.syncInventory()

      expect(mockLogger.warn).toHaveBeenCalledWith('Location not found', {
        locationId: 'shopify-location-1'
      })
    })

    it('should respect sync limits', async () => {
      const mockInventoryResponse = {
        data: {
          location: {
            id: 'shopify-location-1',
            name: 'Main Warehouse',
            inventoryLevels: {
              pageInfo: { hasNextPage: true, endCursor: 'cursor-123' },
              edges: Array.from({ length: 250 }, (_, i) => ({
                node: {
                  item: { id: `item-${i}`, sku: `SKU${i.toString().padStart(3, '0')}` },
                  available: 100
                }
              }))
            }
          }
        }
      }

      mockClient.query.mockResolvedValue(mockInventoryResponse)
      mockTransformers.transformInventory.mockReturnValue({
        product_id: 'product-1',
        warehouse_id: 'warehouse-1',
        quantity: 100
      })

      const result = await connector.syncInventory({ limit: 100 })

      expect(result.items_processed).toBe(100)
    })
  })

  describe('syncPricing', () => {
    beforeEach(() => {
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
      connector.authenticate = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).getStoreInfo = jest.fn()
    })

    it('should sync pricing for B2B enabled stores', async () => {
      ;(connector as any).getStoreInfo.mockResolvedValue({
        hasB2B: true,
        plan: 'Shopify Plus'
      })

      const mockPricingResult = {
        success: true,
        items_processed: 50,
        items_failed: 0,
        duration_ms: 3000,
        errors: []
      }

      mockPricingManager.syncCatalogs.mockResolvedValue(mockPricingResult)

      const result = await connector.syncPricing()

      expect(mockPricingManager.syncCatalogs).toHaveBeenCalledWith(undefined)
      expect(result).toEqual(mockPricingResult)
    })

    it('should skip pricing sync for non-B2B stores', async () => {
      ;(connector as any).getStoreInfo.mockResolvedValue({
        hasB2B: false,
        plan: 'Basic Shopify'
      })

      const result = await connector.syncPricing()

      expect(result).toEqual({
        success: true,
        items_processed: 0,
        items_failed: 0,
        duration_ms: 0,
        errors: []
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Store does not have B2B features enabled'
      )
      expect(mockPricingManager.syncCatalogs).not.toHaveBeenCalled()
    })

    it('should handle pricing sync errors', async () => {
      const error = new Error('Pricing sync failed')
      ;(connector as any).getStoreInfo.mockRejectedValue(error)
      const mockHandleError = jest.fn()
      ;(connector as any).handleError = mockHandleError

      await expect(connector.syncPricing()).rejects.toThrow(error)
      expect(mockHandleError).toHaveBeenCalledWith(error, 'Pricing sync failed')
    })
  })

  describe('verifyWebhook', () => {
    it('should verify webhook signature correctly', async () => {
      const mockHeaders = new Map([['x-shopify-hmac-sha256', 'mock-hash']])
      const body = 'webhook-body'

      const result = await connector.verifyWebhook(mockHeaders as any, body)

      expect(result).toBe(true)
      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', mockConfig.credentials.webhook_secret)
      expect(crypto.timingSafeEqual).toHaveBeenCalled()
    })

    it('should reject webhook without signature', async () => {
      const mockHeaders = new Map()
      const body = 'webhook-body'

      const result = await connector.verifyWebhook(mockHeaders as any, body)

      expect(result).toBe(false)
    })

    it('should reject webhook with invalid signature', async () => {
      const mockHeaders = new Map([['x-shopify-hmac-sha256', 'invalid-hash']])
      const body = 'webhook-body'

      ;(crypto.timingSafeEqual as jest.Mock).mockReturnValue(false)

      const result = await connector.verifyWebhook(mockHeaders as any, body)

      expect(result).toBe(false)
    })
  })

  describe('handleWebhook', () => {
    const mockWebhookBody = {
      id: 'webhook-123',
      webhook_id: 'webhook-123',
      api_version: '2024-01',
      title: 'Test Product'
    }

    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'stored-webhook-123' }
      })
      mockSupabase.insert.mockReturnValue(mockSupabase)
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.update.mockReturnValue(mockSupabase)
      mockSupabase.eq.mockReturnValue(mockSupabase)

      ;(connector as any).processProductWebhook = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).processInventoryWebhook = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).processOrderWebhook = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).updateWebhookStatus = jest.fn().mockResolvedValue(undefined)
    })

    it('should handle product webhook', async () => {
      await connector.handleWebhook('products/create', mockWebhookBody)

      expect(mockSupabase.from).toHaveBeenCalledWith('shopify_webhook_events')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        integration_id: mockConfig.integrationId,
        organization_id: mockConfig.organizationId,
        event_id: mockWebhookBody.webhook_id,
        topic: 'products/create',
        shop_domain: mockConfig.settings.shop_domain,
        api_version: mockWebhookBody.api_version,
        payload: mockWebhookBody,
        status: 'pending'
      })

      expect((connector as any).processProductWebhook).toHaveBeenCalledWith(
        'stored-webhook-123',
        mockWebhookBody
      )
      expect((connector as any).updateWebhookStatus).toHaveBeenCalledWith(
        'stored-webhook-123',
        'completed'
      )
    })

    it('should handle inventory webhook', async () => {
      await connector.handleWebhook('inventory_levels/update', mockWebhookBody)

      expect((connector as any).processInventoryWebhook).toHaveBeenCalledWith(
        'stored-webhook-123',
        mockWebhookBody
      )
    })

    it('should handle order webhook', async () => {
      await connector.handleWebhook('orders/create', mockWebhookBody)

      expect((connector as any).processOrderWebhook).toHaveBeenCalledWith(
        'stored-webhook-123',
        mockWebhookBody
      )
    })

    it('should handle bulk operations webhook', async () => {
      await connector.handleWebhook('bulk_operations/finish', mockWebhookBody)

      expect(mockBulkManager.handleBulkOperationWebhook).toHaveBeenCalledWith(mockWebhookBody)
    })

    it('should handle unknown webhook topics', async () => {
      await connector.handleWebhook('unknown/topic' as ShopifyWebhookTopic, mockWebhookBody)

      expect(mockLogger.warn).toHaveBeenCalledWith('Unhandled webhook topic: unknown/topic')
      expect((connector as any).updateWebhookStatus).toHaveBeenCalledWith(
        'stored-webhook-123',
        'completed'
      )
    })

    it('should handle webhook storage errors', async () => {
      const error = new Error('Database error')
      mockSupabase.single.mockResolvedValue({ error })

      await expect(connector.handleWebhook('products/create', mockWebhookBody)).rejects.toThrow(error)
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to store webhook', { error })
    })

    it('should handle webhook processing errors', async () => {
      const error = new Error('Processing failed')
      ;(connector as any).processProductWebhook.mockRejectedValue(error)

      await expect(connector.handleWebhook('products/create', mockWebhookBody)).rejects.toThrow(error)
      expect((connector as any).updateWebhookStatus).toHaveBeenCalledWith(
        'stored-webhook-123',
        'failed',
        'Processing failed'
      )
    })

    it('should generate event ID when missing', async () => {
      const bodyWithoutId = { title: 'Test Product' }

      await connector.handleWebhook('products/create', bodyWithoutId)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'mock-uuid'
        })
      )
    })
  })

  describe('private helper methods', () => {
    describe('bulkSyncProducts', () => {
      beforeEach(() => {
        ;(connector as any).saveProduct = jest.fn().mockResolvedValue(undefined)
        ;(connector as any).saveProductMapping = jest.fn().mockResolvedValue(undefined)
      })

      it('should perform bulk sync successfully', async () => {
        const mockBulkOperation = { id: 'bulk-op-123', status: 'CREATED' }
        const mockCompletedOperation = {
          id: 'bulk-op-123',
          status: 'COMPLETED',
          url: 'https://example.com/results.jsonl'
        }
        const mockResult = {
          success: true,
          items_processed: 100,
          items_failed: 0,
          duration_ms: 5000,
          errors: []
        }

        mockBulkManager.createBulkQuery.mockResolvedValue(mockBulkOperation)
        mockBulkManager.waitForCompletion.mockResolvedValue(mockCompletedOperation)
        mockBulkManager.processResults.mockResolvedValue(mockResult)

        ShopifyApiClient.buildProductQuery = jest.fn().mockReturnValue('id title handle')

        const result = await (connector as any).bulkSyncProducts()

        expect(mockBulkManager.createBulkQuery).toHaveBeenCalledWith(
          expect.stringContaining('products')
        )
        expect(mockBulkManager.waitForCompletion).toHaveBeenCalledWith('bulk-op-123')
        expect(mockBulkManager.processResults).toHaveBeenCalledWith(
          'https://example.com/results.jsonl',
          expect.any(Function)
        )
        expect(result).toEqual(mockResult)
      })

      it('should handle bulk operation failures', async () => {
        const mockBulkOperation = { id: 'bulk-op-123', status: 'CREATED' }
        const mockFailedOperation = {
          id: 'bulk-op-123',
          status: 'FAILED',
          errorCode: 'INTERNAL_ERROR'
        }

        mockBulkManager.createBulkQuery.mockResolvedValue(mockBulkOperation)
        mockBulkManager.waitForCompletion.mockResolvedValue(mockFailedOperation)

        await expect((connector as any).bulkSyncProducts()).rejects.toThrow(
          'Bulk operation failed: INTERNAL_ERROR'
        )
      })

      it('should handle dry run mode in bulk sync', async () => {
        const mockBulkOperation = { id: 'bulk-op-123', status: 'CREATED' }
        const mockCompletedOperation = {
          id: 'bulk-op-123',
          status: 'COMPLETED',
          url: 'https://example.com/results.jsonl'
        }

        mockBulkManager.createBulkQuery.mockResolvedValue(mockBulkOperation)
        mockBulkManager.waitForCompletion.mockResolvedValue(mockCompletedOperation)
        mockBulkManager.processResults.mockImplementation(async (url, processor) => {
          // Simulate processing products
          await processor({ id: 'product-1', title: 'Test Product' })
          return {
            success: true,
            items_processed: 1,
            items_failed: 0,
            duration_ms: 1000,
            errors: []
          }
        })

        await (connector as any).bulkSyncProducts({ dryRun: true })

        expect(mockLogger.info).toHaveBeenCalledWith('Dry run: Would sync product', {
          id: 'product-1',
          title: 'Test Product'
        })
        expect((connector as any).saveProduct).not.toHaveBeenCalled()
      })
    })

    describe('processProductWebhook', () => {
      beforeEach(() => {
        ;(connector as any).saveProduct = jest.fn().mockResolvedValue(undefined)
        ;(connector as any).saveProductMapping = jest.fn().mockResolvedValue(undefined)
      })

      it('should process product webhook successfully', async () => {
        const mockProduct = {
          id: 'product-123',
          admin_graphql_api_id: 'gid://shopify/Product/123',
          title: 'Test Product'
        }

        const mockTransformed = {
          id: 'internal-product-123',
          name: 'Test Product',
          sku: 'TEST-SKU'
        }

        mockTransformers.transformProduct.mockReturnValue(mockTransformed)

        await (connector as any).processProductWebhook('webhook-123', mockProduct)

        expect(mockTransformers.transformProduct).toHaveBeenCalledWith(mockProduct)
        expect((connector as any).saveProduct).toHaveBeenCalledWith(mockTransformed)
        expect((connector as any).saveProductMapping).toHaveBeenCalledWith(
          mockProduct.admin_graphql_api_id,
          mockTransformed.id
        )
      })

      it('should handle product webhook processing errors', async () => {
        const mockProduct = { id: 'product-123', title: 'Test Product' }
        const error = new Error('Transform failed')

        mockTransformers.transformProduct.mockImplementation(() => {
          throw error
        })

        await expect(
          (connector as any).processProductWebhook('webhook-123', mockProduct)
        ).rejects.toThrow(error)

        expect(mockLogger.error).toHaveBeenCalledWith('Failed to process product webhook', {
          webhookId: 'webhook-123',
          error
        })
      })
    })

    describe('processInventoryWebhook', () => {
      beforeEach(() => {
        ;(connector as any).updateInventory = jest.fn().mockResolvedValue(undefined)
      })

      it('should process inventory webhook successfully', async () => {
        const mockInventory = {
          location_id: 'shopify-location-1',
          inventory_item_id: 'item-123',
          available: 100
        }

        const mockTransformed = {
          product_id: 'product-123',
          warehouse_id: 'warehouse-1',  
          quantity: 100
        }

        mockTransformers.transformInventoryFromWebhook.mockReturnValue(mockTransformed)

        await (connector as any).processInventoryWebhook('webhook-123', mockInventory)

        expect(mockTransformers.transformInventoryFromWebhook).toHaveBeenCalledWith(
          mockInventory,
          'warehouse-1'
        )
        expect((connector as any).updateInventory).toHaveBeenCalledWith(mockTransformed)
      })

      it('should handle missing location mapping', async () => {
        const mockInventory = {
          location_id: 'unmapped-location',
          inventory_item_id: 'item-123',
          available: 100
        }

        await (connector as any).processInventoryWebhook('webhook-123', mockInventory)

        expect(mockLogger.warn).toHaveBeenCalledWith('No warehouse mapping for location', {
          locationId: 'unmapped-location'
        })
        expect((connector as any).updateInventory).not.toHaveBeenCalled()
      })

      it('should handle nested location ID', async () => {
        const mockInventory = {
          inventory_level: {
            location_id: 'shopify-location-1'
          },
          inventory_item_id: 'item-123',
          available: 100
        }

        mockTransformers.transformInventoryFromWebhook.mockReturnValue({
          product_id: 'product-123',
          warehouse_id: 'warehouse-1',
          quantity: 100
        })

        await (connector as any).processInventoryWebhook('webhook-123', mockInventory)

        expect(mockTransformers.transformInventoryFromWebhook).toHaveBeenCalledWith(
          mockInventory,
          'warehouse-1'
        )
      })

      it('should handle missing location ID', async () => {
        const mockInventory = {
          inventory_item_id: 'item-123',
          available: 100
        }

        await expect(
          (connector as any).processInventoryWebhook('webhook-123', mockInventory)
        ).rejects.toThrow('Missing location ID in inventory webhook')

        expect(mockLogger.error).toHaveBeenCalledWith('No location ID found in inventory webhook', {
          webhookId: 'webhook-123',
          inventoryKeys: ['inventory_item_id', 'available']
        })
      })
    })

    describe('processOrderWebhook', () => {
      it('should process order webhook successfully', async () => {
        const mockOrder = {
          id: 'order-123',
          number: 1001,
          total_price: '99.99'
        }

        const mockTransformed = {
          id: 'internal-order-123',
          order_number: '1001',
          total: 99.99
        }

        mockTransformers.transformOrder.mockReturnValue(mockTransformed)
        const mockEmit = jest.fn()
        ;(connector as any).emit = mockEmit

        await (connector as any).processOrderWebhook('webhook-123', mockOrder)

        expect(mockTransformers.transformOrder).toHaveBeenCalledWith(mockOrder)
        expect(mockEmit).toHaveBeenCalledWith('order:created', {
          integrationId: mockConfig.integrationId,
          order: mockTransformed
        })
      })

      it('should handle order webhook processing errors', async () => {
        const mockOrder = { id: 'order-123' }
        const error = new Error('Transform failed')

        mockTransformers.transformOrder.mockImplementation(() => {
          throw error
        })

        await expect(
          (connector as any).processOrderWebhook('webhook-123', mockOrder)
        ).rejects.toThrow(error)

        expect(mockLogger.error).toHaveBeenCalledWith('Failed to process order webhook', {
          webhookId: 'webhook-123',
          error
        })
      })
    })

    describe('extractIdFromGid', () => {
      it('should extract ID from valid GID', () => {
        const gid = 'gid://shopify/Product/123456789'
        const result = (connector as any).extractIdFromGid(gid)
        expect(result).toBe('123456789')
      })

      it('should handle invalid GID format', () => {
        const invalidGid = 'invalid-gid-format'
        const result = (connector as any).extractIdFromGid(invalidGid)
        expect(result).toBe('invalid-gid-format')
        expect(mockLogger.warn).toHaveBeenCalledWith('Invalid GID format', { gid: invalidGid })
      })

      it('should extract ID from simple path format', () => {
        const pathGid = 'some/path/123456'
        const result = (connector as any).extractIdFromGid(pathGid)
        expect(result).toBe('123456')
      })

      it('should handle non-numeric ID', () => {
        const nonNumericGid = 'some/path/abc123'
        const result = (connector as any).extractIdFromGid(nonNumericGid)
        expect(result).toBe('some/path/abc123')
        expect(mockLogger.warn).toHaveBeenCalledWith('Invalid GID format', { gid: nonNumericGid })
      })
    })

    describe('getStoreInfo', () => {
      it('should get store info successfully', async () => {
        const mockResponse = {
          data: {
            shop: {
              plan: { displayName: 'Shopify Plus' },
              features: { b2b: true }
            }
          }
        }

        mockClient.query.mockResolvedValue(mockResponse)

        const result = await (connector as any).getStoreInfo()

        expect(result).toEqual({
          hasB2B: true,
          plan: 'Shopify Plus'
        })
      })

      it('should handle missing store data', async () => {
        mockClient.query.mockResolvedValue({ data: null })

        const result = await (connector as any).getStoreInfo()

        expect(result).toEqual({
          hasB2B: false,
          plan: 'Unknown'
        })
      })
    })

    describe('database operations', () => {
      describe('getSyncState', () => {
        it('should get sync state successfully', async () => {
          const mockSyncState = {
            last_sync_at: new Date().toISOString(),
            last_cursor: 'cursor-123'
          }

          mockSupabase.single.mockResolvedValue({ data: mockSyncState })

          const result = await (connector as any).getSyncState('product')

          expect(mockSupabase.from).toHaveBeenCalledWith('shopify_sync_state')
          expect(mockSupabase.select).toHaveBeenCalledWith('*')
          expect(mockSupabase.eq).toHaveBeenCalledWith('integration_id', mockConfig.integrationId)
          expect(mockSupabase.eq).toHaveBeenCalledWith('entity_type', 'product')
          expect(result).toEqual(mockSyncState)
        })
      })

      describe('updateSyncState', () => {
        it('should update sync state successfully', async () => {
          mockSupabase.upsert.mockResolvedValue({ error: null })

          const updates = {
            total_synced: 100,
            cursor: 'new-cursor'
          }

          await (connector as any).updateSyncState('product', updates)

          expect(mockSupabase.from).toHaveBeenCalledWith('shopify_sync_state')
          expect(mockSupabase.upsert).toHaveBeenCalledWith({
            integration_id: mockConfig.integrationId,
            entity_type: 'product',
            last_sync_at: expect.any(String),
            sync_version: 0,
            total_synced: 100,
            last_cursor: 'new-cursor'
          })
        })

        it('should handle sync state update errors', async () => {
          const error = new Error('Database error')
          mockSupabase.upsert.mockResolvedValue({ error })

          await expect(
            (connector as any).updateSyncState('product', {})
          ).rejects.toThrow('Failed to update sync state: Database error')

          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to update sync state for product',
            error
          )
        })
      })

      describe('saveProduct', () => {
        it('should save product successfully', async () => {
          const mockProduct = {
            id: 'product-123',
            name: 'Test Product',
            sku: 'TEST-SKU',
            description: 'Test Description',
            price: 99.99,
            status: 'active',
            external_id: 'shopify-123'
          }

          mockSupabase.upsert.mockResolvedValue({ error: null })

          await (connector as any).saveProduct(mockProduct)

          expect(mockSupabase.from).toHaveBeenCalledWith('products')
          expect(mockSupabase.upsert).toHaveBeenCalledWith({
            organization_id: mockConfig.organizationId,
            name: mockProduct.name,
            sku: mockProduct.sku,
            description: mockProduct.description,
            price: mockProduct.price,
            status: mockProduct.status,
            external_id: mockProduct.external_id,
            updated_at: expect.any(String)
          })
        })

        it('should handle product save errors', async () => {
          const error = new Error('Database error')
          mockSupabase.upsert.mockResolvedValue({ error })

          await expect(
            (connector as any).saveProduct({ name: 'Test Product' })
          ).rejects.toThrow('Failed to save product: Database error')
        })
      })
    })
  })

  describe('error handling', () => {
    it('should handle general sync errors', async () => {
      const error = new Error('General sync error')
      ;(connector as any).withRetry = jest.fn().mockRejectedValue(error)
      const mockHandleError = jest.fn()
      ;(connector as any).handleError = mockHandleError

      await expect(connector.syncProducts()).rejects.toThrow(error)
      expect(mockHandleError).toHaveBeenCalledWith(error, 'Product sync failed')
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should handle complete product sync workflow', async () => {
      // Mock all dependencies for complete workflow
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
      connector.authenticate = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).getSyncState = jest.fn().mockResolvedValue(null)
      ;(connector as any).bulkSyncProducts = jest.fn().mockResolvedValue({
        success: true,
        items_processed: 150,
        items_failed: 0,
        duration_ms: 8000,
        errors: []
      })

      const result = await connector.syncProducts()

      expect(connector.authenticate).toHaveBeenCalled()
      expect((connector as any).getSyncState).toHaveBeenCalledWith('product')
      expect((connector as any).bulkSyncProducts).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(150)
    })

    it('should handle rate limiting throughout workflow', async () => {
      ;(connector as any).withRetry = jest.fn().mockImplementation((fn) => fn())
      ;(connector as any).withRateLimit = jest.fn().mockImplementation((fn) => fn())
      connector.authenticate = jest.fn().mockResolvedValue(undefined)
      ;(connector as any).updateSyncState = jest.fn().mockResolvedValue(undefined)

      const mockInventoryResponse = {
        data: {
          location: {
            inventoryLevels: {
              pageInfo: { hasNextPage: false },
              edges: []
            }
          }
        }
      }

      mockClient.query.mockResolvedValue(mockInventoryResponse)

      await connector.syncInventory()

      expect((connector as any).withRateLimit).toHaveBeenCalled()
    })
  })
})