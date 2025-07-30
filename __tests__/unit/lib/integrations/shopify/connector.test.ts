import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'

// Mock the API client
const mockApiClient = {
  query: jest.fn(),
  mutation: jest.fn(),
  getProducts: jest.fn(),
  getInventoryLevels: jest.fn(),
  getPriceRules: jest.fn(),
  createWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  getWebhooks: jest.fn(),
  testConnection: jest.fn(),
} as any

jest.mock('@/lib/integrations/shopify/api-client', () => ({
  ShopifyApiClient: jest.fn(() => mockApiClient),
}))

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    upsert: jest.fn().mockReturnThis(),
  })),
  auth: {
    getUser: jest.fn(),
  },
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}))

describe('ShopifyConnector', () => {
  let connector: ShopifyConnector

  const testConfig = {
    integrationId: 'int-123',
    organizationId: 'org-456',
    credentials: {
      access_token: 'test-access-token',
      webhook_secret: 'test-webhook-secret',
    },
    settings: {
      shop_domain: 'test-store.myshopify.com',
      api_version: '2024-01',
      currency: 'USD',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock responses
    mockApiClient.query.mockResolvedValue({
      data: {
        shop: {
          name: 'Test Store',
          plan: { displayName: 'Basic' },
        },
      },
    })

    mockApiClient.getProducts.mockResolvedValue({
      products: [
        {
          id: 'gid://shopify/Product/123456789',
          title: 'Test Product',
          handle: 'test-product',
          variants: {
            nodes: [
              {
                id: 'gid://shopify/ProductVariant/987654321',
                sku: 'TEST-SKU-001',
                price: '29.99',
                inventoryQuantity: 100,
              },
            ],
          },
        },
      ],
    })

    mockApiClient.getInventoryLevels.mockResolvedValue({
      inventoryLevels: [
        {
          id: 'gid://shopify/InventoryLevel/111',
          available: 50,
          location: { id: 'gid://shopify/Location/1' },
        },
      ],
    })

    mockApiClient.getPriceRules.mockResolvedValue({
      priceRules: [
        {
          id: 'gid://shopify/PriceRule/222',
          title: 'Test Discount',
          value: 10,
        },
      ],
    })

    mockApiClient.createWebhook.mockResolvedValue({
      webhook: {
        id: 'gid://shopify/Webhook/333',
        topic: 'products/update',
        address: 'https://example.com/api/webhooks/shopify',
      },
    })

    mockApiClient.getWebhooks.mockResolvedValue({
      webhooks: [
        {
          id: 'gid://shopify/Webhook/333',
          topic: 'products/update',
          address: 'https://example.com/api/webhooks/shopify',
        },
      ],
    })

    mockApiClient.testConnection.mockResolvedValue(true)

    // Setup Supabase mocks
    mockSupabase.from.mockImplementation((table) => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn().mockReturnThis(),
      }
      
      if (table === 'sync_states') {
        queryBuilder.select.mockResolvedValue({
          data: [{ cursor: null, last_sync: null }],
          error: null,
        })
      }
      
      if (table === 'products') {
        queryBuilder.insert.mockResolvedValue({
          data: [{ id: 'prod-123' }],
          error: null,
        })
      }
      
      if (table === 'inventory_levels') {
        queryBuilder.upsert.mockResolvedValue({
          data: [{ id: 'inv-123' }],
          error: null,
        })
      }
      
      return queryBuilder
    })

    connector = new ShopifyConnector(testConfig)
  })

  describe('initialization', () => {
    it('should create a connector instance', () => {
      expect(connector).toBeInstanceOf(ShopifyConnector)
    })

    it('should have the correct platform', () => {
      expect(connector.platform).toBe('shopify')
    })

    it('should have the correct integration ID', () => {
      expect(connector.getMetadata().integrationId).toBe('int-123')
    })

    it('should have the correct organization ID', () => {
      expect(connector.getMetadata().organizationId).toBe('org-456')
    })
  })

  describe('webhook verification', () => {
    it('should have webhook verification method', () => {
      expect(typeof connector.verifyWebhook).toBe('function')
    })

    it('should have webhook handling method', () => {
      expect(typeof connector.handleWebhook).toBe('function')
    })
  })

  describe('connection management', () => {
    it('should disconnect gracefully', async () => {
      await connector.disconnect()
      
      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('metadata', () => {
    it('should return correct metadata', () => {
      const metadata = connector.getMetadata()
      
      expect(metadata).toEqual({
        platform: 'shopify',
        integrationId: 'int-123',
        organizationId: 'org-456',
        authenticated: false,
      })
    })
  })
})