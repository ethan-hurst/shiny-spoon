/**
 * Integration tests for PRP-012: Integration Framework
 * 
 * These tests verify that the integration framework components work together correctly.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { BaseConnector } from '@/lib/integrations/base-connector'
import { AuthManager } from '@/lib/integrations/auth-manager'
import { RateLimiter } from '@/lib/integrations/rate-limiter'
import { WebhookHandler } from '@/lib/integrations/webhook-handler'
import type { 
  Integration, 
  IntegrationPlatformType, 
  SyncResult,
  ConnectorConfig 
} from '@/types/integration.types'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          range: jest.fn(() => ({ data: [], error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: null })),
      })),
    })),
  })),
  rpc: jest.fn(() => Promise.resolve({ data: 'encrypted-data', error: null })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    })),
  },
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockSupabase,
}))

// Test connector implementation
class TestConnector extends BaseConnector {
  get platform(): IntegrationPlatformType {
    return 'custom'
  }

  async authenticate(): Promise<void> {
    // Mock authentication
  }

  async testConnection(): Promise<boolean> {
    return true
  }

  async syncProducts(): Promise<SyncResult> {
    return {
      success: true,
      items_processed: 10,
      items_failed: 0,
      items_skipped: 0,
      errors: [],
    }
  }

  async syncInventory(): Promise<SyncResult> {
    return {
      success: true,
      items_processed: 5,
      items_failed: 0,
      items_skipped: 0,
      errors: [],
    }
  }

  async syncPricing(): Promise<SyncResult> {
    return {
      success: true,
      items_processed: 8,
      items_failed: 0,
      items_skipped: 0,
      errors: [],
    }
  }
}

describe('Integration Framework Tests', () => {
  let connector: TestConnector
  let authManager: AuthManager
  let rateLimiter: RateLimiter
  let webhookHandler: WebhookHandler

  const testConfig: ConnectorConfig = {
    integrationId: 'test-integration-id',
    organizationId: 'test-org-id',
    credentials: {
      api_key: 'test-api-key',
    },
    settings: {
      syncProducts: true,
      syncInventory: true,
      syncPricing: true,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    connector = new TestConnector(testConfig)
    authManager = new AuthManager(testConfig.integrationId, testConfig.organizationId)
    rateLimiter = new RateLimiter(testConfig.integrationId, 'custom')
    webhookHandler = new WebhookHandler()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('BaseConnector', () => {
    it('should initialize successfully', async () => {
      const metadata = connector.getMetadata()
      
      expect(metadata.platform).toBe('custom')
      expect(metadata.integrationId).toBe(testConfig.integrationId)
      expect(metadata.organizationId).toBe(testConfig.organizationId)
    })

    it('should sync products successfully', async () => {
      const result = await connector.sync('products')
      
      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(10)
      expect(result.items_failed).toBe(0)
    })

    it('should sync inventory successfully', async () => {
      const result = await connector.sync('inventory')
      
      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(5)
      expect(result.items_failed).toBe(0)
    })

    it('should sync pricing successfully', async () => {
      const result = await connector.sync('pricing')
      
      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(8)
      expect(result.items_failed).toBe(0)
    })

    it('should handle unsupported entity types', async () => {
      await expect(connector.sync('orders' as any)).rejects.toThrow('orders sync not supported')
    })

    it('should emit events during sync', async () => {
      const startSpy = jest.fn()
      const completeSpy = jest.fn()
      
      connector.on('sync:start', startSpy)
      connector.on('sync:complete', completeSpy)
      
      await connector.sync('products')
      
      expect(startSpy).toHaveBeenCalledWith('products')
      expect(completeSpy).toHaveBeenCalledWith({
        success: true,
        items_processed: 10,
        items_failed: 0,
        items_skipped: 0,
        errors: [],
      })
    })
  })

  describe('AuthManager', () => {
    it('should store API key credentials', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'cred-id',
                integration_id: testConfig.integrationId,
                credential_type: 'api_key',
                encrypted_data: 'encrypted-data',
              },
              error: null,
            })),
          })),
        })),
      })

      const result = await authManager.storeCredentials('api_key', {
        api_key: 'test-api-key',
      })

      expect(result.credential_type).toBe('api_key')
      expect(mockSupabase.rpc).toHaveBeenCalledWith('encrypt_credential', {
        p_credential: JSON.stringify({ api_key: 'test-api-key' }),
      })
    })

    it('should build OAuth authorization URL', async () => {
      const url = await authManager.buildAuthorizationUrl('shopify', {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        additionalParams: { shop: 'test-shop' },
      })

      expect(url).toContain('test-shop.myshopify.com')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback')
    })

    it('should validate API keys correctly', () => {
      expect(AuthManager.validateApiKey('a'.repeat(32), 'shopify')).toBe(false) // Not hex
      expect(AuthManager.validateApiKey('1234567890abcdef'.repeat(2), 'shopify')).toBe(true) // Valid Shopify key
      expect(AuthManager.validateApiKey('short', 'custom')).toBe(false) // Too short
      expect(AuthManager.validateApiKey('valid_api_key_1234567890', 'custom')).toBe(true) // Valid generic key
    })
  })

  describe('RateLimiter', () => {
    beforeEach(() => {
      // Mock rate limit bucket responses
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'rate_limit_buckets') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: {
                    request_count: 0,
                    max_requests: 60,
                    window_start: new Date().toISOString(),
                    window_duration_seconds: 60,
                  },
                  error: null,
                })),
              })),
            })),
            upsert: jest.fn(() => ({ error: null })),
          }
        }
        return mockSupabase.from(table)
      })
    })

    it('should acquire tokens successfully', async () => {
      await expect(rateLimiter.acquire(1)).resolves.not.toThrow()
    })

    it('should get rate limit status', async () => {
      const status = await rateLimiter.getStatus()
      
      expect(status.remaining).toBe(60)
      expect(status.total).toBe(60)
      expect(status.isAtLimit).toBe(false)
    })

    it('should throw rate limit error when at limit', async () => {
      // Mock bucket at limit
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'rate_limit_buckets') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: {
                    request_count: 60,
                    max_requests: 60,
                    window_start: new Date().toISOString(),
                    window_duration_seconds: 60,
                  },
                  error: null,
                })),
              })),
            })),
          }
        }
        return mockSupabase.from(table)
      })

      await expect(rateLimiter.acquire(1)).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('WebhookHandler', () => {
    it('should verify Shopify webhook signature', async () => {
      const secret = 'test-secret'
      const body = '{"test": "data"}'
      const hmac = require('crypto')
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'x-shopify-hmac-sha256': hmac,
      })

      const isValid = await webhookHandler.verifyWebhook('shopify', headers, body, secret)
      expect(isValid).toBe(true)
    })

    it('should reject invalid Shopify webhook signature', async () => {
      const headers = new Headers({
        'x-shopify-hmac-sha256': 'invalid-signature',
      })

      const isValid = await webhookHandler.verifyWebhook('shopify', new Headers(), '{"test": "data"}', 'test-secret')
      expect(isValid).toBe(false)
    })

    it('should parse Shopify webhook payload', () => {
      const headers = new Headers({
        'x-shopify-topic': 'products/create',
        'x-shopify-webhook-id': 'webhook-123',
      })

      const payload = webhookHandler.parsePayload('shopify', '{"id": 123, "title": "Test Product"}', headers)
      
      expect(payload.platform).toBe('shopify')
      expect(payload.event_type).toBe('products/create')
      expect(payload.id).toBe('webhook-123')
    })
  })

  describe('Integration Workflow', () => {
    it('should complete a full sync workflow', async () => {
      // Initialize connector
      await connector.initialize()
      
      // Sync different entity types
      const productResult = await connector.sync('products')
      const inventoryResult = await connector.sync('inventory')
      const pricingResult = await connector.sync('pricing')
      
      // Verify all syncs completed successfully
      expect(productResult.success).toBe(true)
      expect(inventoryResult.success).toBe(true)
      expect(pricingResult.success).toBe(true)
      
      // Verify total items processed
      const totalProcessed = productResult.items_processed + 
                           inventoryResult.items_processed + 
                           pricingResult.items_processed
      expect(totalProcessed).toBe(23) // 10 + 5 + 8
    })

    it('should handle rate limiting during sync', async () => {
      // Mock rate limiter to throw on first call, succeed on second
      let callCount = 0
      const originalAcquire = rateLimiter.acquire.bind(rateLimiter)
      rateLimiter.acquire = jest.fn().mockImplementation(async (weight) => {
        callCount++
        if (callCount === 1) {
          const error = new (require('@/types/integration.types').RateLimitError)(
            'Rate limit exceeded',
            60
          )
          throw error
        }
        return originalAcquire(weight)
      })

      // Use rate limiter in connector
      const testConfigWithRateLimit = {
        ...testConfig,
        rateLimiter,
      }
      const rateLimitedConnector = new TestConnector(testConfigWithRateLimit)

      // This should handle the rate limit and retry
      const result = await rateLimitedConnector.withRateLimit(
        async () => ({ success: true }),
        1
      )

      expect(result.success).toBe(true)
      expect(rateLimiter.acquire).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should standardize HTTP errors', () => {
      const httpError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
        message: 'Request failed',
      }

      const standardized = connector['standardizeError'](httpError)
      
      expect(standardized.code).toBe('AUTHENTICATION_FAILED')
      expect(standardized.message).toBe('Unauthorized')
      expect(standardized.retryable).toBe(false)
    })

    it('should handle rate limit errors', () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { message: 'Too Many Requests' },
        },
        message: 'Rate limited',
      }

      const standardized = connector['standardizeError'](rateLimitError)
      
      expect(standardized.name).toBe('RateLimitError')
      expect(standardized.retryable).toBe(true)
    })

    it('should handle network errors', () => {
      const networkError = {
        code: 'ECONNRESET',
        message: 'Connection reset',
      }

      const standardized = connector['standardizeError'](networkError)
      
      expect(standardized.code).toBe('ECONNRESET')
      expect(standardized.retryable).toBe(true)
    })
  })
})

// Test integration-specific configurations
describe('Platform-Specific Tests', () => {
  describe('NetSuite Integration', () => {
    it('should handle NetSuite OAuth 1.0a error', async () => {
      const authManager = new AuthManager('test-id', 'test-org')
      
      await expect(authManager.buildAuthorizationUrl('netsuite', {
        clientId: 'test',
        clientSecret: 'test',
      })).rejects.toThrow('NetSuite uses OAuth 1.0a')
    })
  })

  describe('Shopify Integration', () => {
    it('should build correct Shopify OAuth URL', async () => {
      const authManager = new AuthManager('test-id', 'test-org')
      
      const url = await authManager.buildAuthorizationUrl('shopify', {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        additionalParams: { shop: 'test-shop' },
      })

      expect(url).toContain('test-shop.myshopify.com/admin/oauth/authorize')
      expect(url).toContain('client_id=test-client-id')
    })
  })

  describe('QuickBooks Integration', () => {
    it('should have correct QuickBooks OAuth configuration', () => {
      const { OAUTH_CONFIGS } = require('@/lib/integrations/auth-manager')
      const qbConfig = OAUTH_CONFIGS.quickbooks
      
      expect(qbConfig.authorizationUrl).toBe('https://appcenter.intuit.com/connect/oauth2')
      expect(qbConfig.tokenUrl).toBe('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer')
    })
  })
})