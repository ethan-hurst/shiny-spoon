import { createMocks } from 'node-mocks-http'
import { POST as netsuiteWebhook } from '@/app/api/webhooks/netsuite/route'
import { POST as shopifyWebhook } from '@/app/api/webhooks/shopify/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { SyncEngine } from '@/lib/sync/sync-engine'
import crypto from 'crypto'

jest.mock('@/lib/supabase/admin')
jest.mock('@/lib/sync/sync-engine')

describe('Sync Webhooks Integration Tests', () => {
  let mockSupabase: any
  let mockSyncEngine: jest.Mocked<SyncEngine>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase admin client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock sync engine
    mockSyncEngine = new SyncEngine() as jest.Mocked<SyncEngine>
  })

  describe('NetSuite Webhook', () => {
    const validSecret = 'test-netsuite-secret'
    process.env.NETSUITE_WEBHOOK_SECRET = validSecret

    it('should process inventory update webhook', async () => {
      const webhookPayload = {
        type: 'inventory.updated',
        timestamp: new Date().toISOString(),
        data: {
          itemId: 'NS001',
          locationId: 'LOC1',
          quantityAvailable: 150,
          quantityOnHand: 200,
          quantityCommitted: 50,
        },
      }

      const signature = crypto
        .createHmac('sha256', validSecret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-netsuite-signature': signature,
          'content-type': 'application/json',
        },
        body: webhookPayload,
      })

      // Mock organization lookup
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'org-123', name: 'Test Org' },
              error: null,
            }),
          }
        }
        if (table === 'webhook_events') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: { id: 'event-123' },
              error: null,
            }),
          }
        }
        if (table === 'inventory') {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const response = await netsuiteWebhook(req as any)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_events')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'netsuite',
          event_type: 'inventory.updated',
          status: 'processed',
        })
      )
    })

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        type: 'inventory.updated',
        data: { itemId: 'NS001' },
      }

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-netsuite-signature': 'invalid-signature',
          'content-type': 'application/json',
        },
        body: webhookPayload,
      })

      const response = await netsuiteWebhook(req as any)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Invalid signature')
    })

    it('should handle order status webhook', async () => {
      const webhookPayload = {
        type: 'order.status_changed',
        timestamp: new Date().toISOString(),
        data: {
          orderId: 'ORD-12345',
          previousStatus: 'pending_fulfillment',
          newStatus: 'partially_fulfilled',
          items: [
            {
              itemId: 'NS001',
              quantityOrdered: 10,
              quantityFulfilled: 5,
            },
          ],
        },
      }

      const signature = crypto
        .createHmac('sha256', validSecret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-netsuite-signature': signature,
          'content-type': 'application/json',
        },
        body: webhookPayload,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: { id: 'order-123' },
              error: null,
            }),
          }
        }
        if (table === 'webhook_events') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: { id: 'event-124' },
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const response = await netsuiteWebhook(req as any)

      expect(response.status).toBe(200)
      expect(mockSupabase.from).toHaveBeenCalledWith('orders')
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillment_status: 'partially_fulfilled',
        })
      )
    })

    it('should handle pricing update webhook and trigger sync', async () => {
      const webhookPayload = {
        type: 'pricing.updated',
        timestamp: new Date().toISOString(),
        data: {
          priceListId: 'PL001',
          items: [
            {
              itemId: 'NS001',
              basePrice: 99.99,
              currency: 'USD',
            },
            {
              itemId: 'NS002',
              basePrice: 149.99,
              currency: 'USD',
            },
          ],
        },
      }

      const signature = crypto
        .createHmac('sha256', validSecret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-netsuite-signature': signature,
          'content-type': 'application/json',
        },
        body: webhookPayload,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'org-123' },
              error: null,
            }),
          }
        }
        if (table === 'sync_jobs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'sync-456',
                organization_id: 'org-123',
                sync_type: 'pricing',
                status: 'pending',
              },
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      mockSyncEngine.executeSync = jest.fn().mockResolvedValue({
        success: true,
        records_processed: 2,
        records_updated: 2,
        records_failed: 0,
        errors: [],
      })

      const response = await netsuiteWebhook(req as any)

      expect(response.status).toBe(200)
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_type: 'pricing',
          source_system: 'netsuite',
          target_system: 'shopify',
        })
      )
    })
  })

  describe('Shopify Webhook', () => {
    const validSecret = 'test-shopify-secret'
    process.env.SHOPIFY_WEBHOOK_SECRET = validSecret

    it('should process inventory level update webhook', async () => {
      const webhookPayload = {
        inventory_item_id: 44444444444,
        location_id: 55555555555,
        available: 42,
        updated_at: new Date().toISOString(),
      }

      const payloadString = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', validSecret)
        .update(payloadString, 'utf8')
        .digest('base64')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-topic': 'inventory_levels/update',
          'x-shopify-shop-domain': 'test-shop.myshopify.com',
          'content-type': 'application/json',
        },
        body: payloadString,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'org-123', shopify_domain: 'test-shop.myshopify.com' },
              error: null,
            }),
          }
        }
        if (table === 'inventory') {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const response = await shopifyWebhook(req as any)

      expect(response.status).toBe(200)
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          external_id: '44444444444',
          quantity: 42,
          location_id: '55555555555',
          platform: 'shopify',
        })
      )
    })

    it('should reject webhook with invalid HMAC', async () => {
      const webhookPayload = {
        inventory_item_id: 44444444444,
        available: 42,
      }

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-shopify-hmac-sha256': 'invalid-hmac',
          'x-shopify-topic': 'inventory_levels/update',
          'content-type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      })

      const response = await shopifyWebhook(req as any)

      expect(response.status).toBe(401)
      expect(response.statusText).toBe('Unauthorized')
    })

    it('should handle product update webhook', async () => {
      const webhookPayload = {
        id: 7777777777,
        title: 'Updated Product',
        vendor: 'Test Vendor',
        variants: [
          {
            id: 8888888888,
            sku: 'TEST-SKU-001',
            price: '129.99',
            inventory_quantity: 25,
          },
        ],
        updated_at: new Date().toISOString(),
      }

      const payloadString = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', validSecret)
        .update(payloadString, 'utf8')
        .digest('base64')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-topic': 'products/update',
          'x-shopify-shop-domain': 'test-shop.myshopify.com',
          'content-type': 'application/json',
        },
        body: payloadString,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'products') {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: { id: 'prod-123' },
              error: null,
            }),
          }
        }
        if (table === 'product_variants') {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const response = await shopifyWebhook(req as any)

      expect(response.status).toBe(200)
      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      expect(mockSupabase.from).toHaveBeenCalledWith('product_variants')
    })

    it('should handle order creation webhook', async () => {
      const webhookPayload = {
        id: 5555555555,
        email: 'customer@example.com',
        financial_status: 'paid',
        fulfillment_status: null,
        line_items: [
          {
            id: 6666666666,
            variant_id: 7777777777,
            quantity: 2,
            price: '49.99',
          },
        ],
        total_price: '99.98',
        created_at: new Date().toISOString(),
      }

      const payloadString = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', validSecret)
        .update(payloadString, 'utf8')
        .digest('base64')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-topic': 'orders/create',
          'x-shopify-shop-domain': 'test-shop.myshopify.com',
          'content-type': 'application/json',
        },
        body: payloadString,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'org-123' },
              error: null,
            }),
          }
        }
        if (table === 'orders') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: { id: 'order-123' },
              error: null,
            }),
          }
        }
        if (table === 'order_items') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }
        }
        if (table === 'sync_jobs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'sync-789' },
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const response = await shopifyWebhook(req as any)

      expect(response.status).toBe(200)
      expect(mockSupabase.from).toHaveBeenCalledWith('orders')
      expect(mockSupabase.from).toHaveBeenCalledWith('order_items')
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
    })
  })

  describe('Webhook Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const webhookPayload = {
        type: 'inventory.updated',
        data: { itemId: 'NS001', quantityAvailable: 100 },
      }

      const signature = crypto
        .createHmac('sha256', process.env.NETSUITE_WEBHOOK_SECRET!)
        .update(JSON.stringify(webhookPayload))
        .digest('hex')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-netsuite-signature': signature,
          'content-type': 'application/json',
        },
        body: webhookPayload,
      })

      mockSupabase.from.mockImplementation(() => {
        return {
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection error' },
          }),
        }
      })

      const response = await netsuiteWebhook(req as any)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toContain('Failed to process webhook')
    })

    it('should handle malformed webhook payloads', async () => {
      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-shopify-hmac-sha256': 'some-hmac',
          'x-shopify-topic': 'inventory_levels/update',
          'content-type': 'application/json',
        },
        body: 'invalid-json-{{{',
      })

      const response = await shopifyWebhook(req as any)

      expect(response.status).toBe(400)
    })

    it('should implement idempotency for duplicate webhooks', async () => {
      const webhookPayload = {
        type: 'inventory.updated',
        eventId: 'evt-123-unique',
        data: { itemId: 'NS001', quantityAvailable: 100 },
      }

      const signature = crypto
        .createHmac('sha256', process.env.NETSUITE_WEBHOOK_SECRET!)
        .update(JSON.stringify(webhookPayload))
        .digest('hex')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-netsuite-signature': signature,
          'content-type': 'application/json',
        },
        body: webhookPayload,
      })

      // First call - event doesn't exist
      mockSupabase.from.mockImplementationOnce((table: string) => {
        if (table === 'webhook_events') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // Not found
            }),
          }
        }
        return mockSupabase
      })

      const response1 = await netsuiteWebhook(req as any)
      expect(response1.status).toBe(200)

      // Second call - event already exists
      mockSupabase.from.mockImplementationOnce((table: string) => {
        if (table === 'webhook_events') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'existing-event', event_id: 'evt-123-unique' },
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const response2 = await netsuiteWebhook(req as any)
      expect(response2.status).toBe(200)
      const body = await response2.json()
      expect(body.message).toContain('already processed')
    })
  })

  describe('Webhook Performance', () => {
    it('should handle high-volume inventory updates efficiently', async () => {
      const largePayload = {
        type: 'inventory.bulk_update',
        timestamp: new Date().toISOString(),
        data: {
          items: Array(1000)
            .fill(null)
            .map((_, i) => ({
              itemId: `NS${i.toString().padStart(4, '0')}`,
              locationId: 'LOC1',
              quantityAvailable: Math.floor(Math.random() * 1000),
            })),
        },
      }

      const signature = crypto
        .createHmac('sha256', process.env.NETSUITE_WEBHOOK_SECRET!)
        .update(JSON.stringify(largePayload))
        .digest('hex')

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'x-netsuite-signature': signature,
          'content-type': 'application/json',
        },
        body: largePayload,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory') {
          return {
            upsert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }
        }
        if (table === 'sync_jobs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'sync-bulk-123' },
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const startTime = Date.now()
      const response = await netsuiteWebhook(req as any)
      const processingTime = Date.now() - startTime

      expect(response.status).toBe(200)
      expect(processingTime).toBeLessThan(5000) // Should process within 5 seconds
      expect(mockSupabase.upsert).toHaveBeenCalled()
    })
  })
})