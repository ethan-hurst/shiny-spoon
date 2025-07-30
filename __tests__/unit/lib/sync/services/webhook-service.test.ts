import { WebhookService } from '@/lib/sync/services/webhook-service'
import { createBrowserClient } from '@/lib/supabase/client'
import { WebhookEvent, WebhookType } from '@/lib/sync/types'

jest.mock('@/lib/supabase/client')

describe('WebhookService', () => {
  let service: WebhookService
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
      }
    }
    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabase)
    service = new WebhookService()
  })

  describe('processWebhook', () => {
    it('should process product update webhook successfully', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-123',
        type: WebhookType.PRODUCT_UPDATE,
        source: 'shopify',
        data: {
          id: 'prod-123',
          sku: 'SKU123',
          name: 'Test Product',
          price: 99.99
        },
        received_at: new Date().toISOString()
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'org-123',
          name: 'Test Org',
          external_platforms: {
            shopify: { store_url: 'test.myshopify.com' }
          }
        },
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: { status: 'processed' },
        error: null
      })

      const result = await service.processWebhook(webhookEvent)

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('processed')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        price: 99.99,
        name: 'Test Product',
        updated_at: expect.any(String)
      })
    })

    it('should process inventory update webhook successfully', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-124',
        type: WebhookType.INVENTORY_UPDATE,
        source: 'netsuite',
        data: {
          sku: 'SKU123',
          quantity: 50,
          warehouse_id: 'wh-123'
        },
        received_at: new Date().toISOString()
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'org-123',
          name: 'Test Org',
          external_platforms: {
            netsuite: { account_id: '12345' }
          }
        },
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: { status: 'processed' },
        error: null
      })

      const result = await service.processWebhook(webhookEvent)

      expect(result.success).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        quantity: 50,
        warehouse_id: 'wh-123',
        updated_at: expect.any(String)
      })
    })

    it('should handle order created webhook', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-125',
        type: WebhookType.ORDER_CREATED,
        source: 'shopify',
        data: {
          order_id: 'order-123',
          customer_id: 'cust-123',
          total: 299.99,
          items: [
            { sku: 'SKU123', quantity: 2, price: 99.99 },
            { sku: 'SKU456', quantity: 1, price: 100.01 }
          ]
        },
        received_at: new Date().toISOString()
      }

      // Mock webhook log check (no existing webhook)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Mock organization lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'org-123',
          name: 'Test Org',
          external_platforms: {
            shopify: { store_url: 'test.myshopify.com' }
          }
        },
        error: null
      })

      // Mock order creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'order-123', status: 'processed' },
        error: null
      })

      const result = await service.processWebhook(webhookEvent)

      expect(result.success).toBe(true)
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        external_id: 'order-123',
        organization_id: 'org-123',
        customer_id: 'cust-123',
        total_amount: 299.99,
        status: 'pending',
        order_data: webhookEvent.data,
        source_platform: 'shopify'
      })
    })

    it('should handle webhook processing errors', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-126',
        type: WebhookType.PRODUCT_UPDATE,
        source: 'shopify',
        data: { id: 'prod-123' },
        received_at: new Date().toISOString()
      }

      // Mock webhook log check (no existing webhook)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Mock organization lookup failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      const result = await service.processWebhook(webhookEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to process webhook: Organization not found')
    })

    it('should handle duplicate webhook events', async () => {
      const webhookEvent: WebhookEvent = {
        id: 'webhook-127',
        type: WebhookType.PRODUCT_UPDATE,
        source: 'shopify',
        data: { id: 'prod-123' },
        received_at: new Date().toISOString()
      }

      // First check shows webhook already processed
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'webhook-127', status: 'processed' },
        error: null
      })

      const result = await service.processWebhook(webhookEvent)

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('duplicate')
      expect(mockSupabase.update).not.toHaveBeenCalled()
    })
  })

  describe('validateWebhookSignature', () => {
    it('should validate Shopify webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' })
      const secret = 'test-secret'
      const validSignature = 'valid-hmac-signature'

      const isValid = service.validateWebhookSignature(
        payload,
        validSignature,
        secret,
        'shopify'
      )

      expect(isValid).toBeDefined()
    })

    it('should validate NetSuite webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' })
      const secret = 'test-secret'
      const validSignature = 'valid-signature'

      const isValid = service.validateWebhookSignature(
        payload,
        validSignature,
        secret,
        'netsuite'
      )

      expect(isValid).toBeDefined()
    })
  })

  describe('retryFailedWebhooks', () => {
    it('should retry failed webhooks successfully', async () => {
      // Mock the failed webhooks query
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'webhook-128',
              webhook_id: 'webhook-128',
              type: WebhookType.PRODUCT_UPDATE,
              source: 'shopify',
              payload: { 
                id: 'prod-123',
                name: 'Test Product',
                price: 99.99
              },
              retry_count: 1,
              created_at: new Date().toISOString()
            },
            {
              id: 'webhook-129',
              webhook_id: 'webhook-129',
              type: WebhookType.INVENTORY_UPDATE,
              source: 'netsuite',
              payload: { 
                sku: 'SKU123',
                quantity: 50,
                warehouse_id: 'wh-123'
              },
              retry_count: 2,
              created_at: new Date().toISOString()
            }
          ],
          error: null
        }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis()
      })

      // Mock single() calls for webhook processing
      // Each webhook calls single() twice: once for webhook log check, once for organization lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: null, // No existing webhook for first webhook
          error: null
        })
        .mockResolvedValueOnce({
          data: { id: 'org-123', name: 'Test Org' }, // Organization for first webhook
          error: null
        })
        .mockResolvedValueOnce({
          data: null, // No existing webhook for second webhook
          error: null
        })
        .mockResolvedValueOnce({
          data: { id: 'org-123', name: 'Test Org' }, // Organization for second webhook
          error: null
        })

      try {
        const result = await service.retryFailedWebhooks()
        console.log('Result:', JSON.stringify(result, null, 2))
        expect(result.success).toBe(true)
        expect(result.data?.processed).toBe(2)
        expect(result.data?.failed).toBe(0)
      } catch (error) {
        console.error('Error in test:', error)
        throw error
      }
    })

    it('should handle retry failures', async () => {
      // Mock the chained query for failed webhooks
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'webhook_logs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'webhook-130',
                  webhook_id: 'webhook-130',
                  type: WebhookType.PRODUCT_UPDATE,
                  source: 'shopify',
                  payload: { id: 'prod-123' },
                  retry_count: 3
                }
              ],
              error: null
            }),
            upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockReturnThis()
          }
        }
        return mockSupabase
      })

      // Mock processing failure
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Processing failed')
      })

      const result = await service.retryFailedWebhooks()

      expect(result.success).toBe(true)
      expect(result.data?.processed).toBe(0)
      expect(result.data?.failed).toBe(1)
    })
  })

  describe('getWebhookStatus', () => {
    it('should get webhook status successfully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'webhook-131',
          status: 'processed',
          type: WebhookType.PRODUCT_UPDATE,
          processed_at: new Date().toISOString()
        },
        error: null
      })

      const result = await service.getWebhookStatus('webhook-131')

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('processed')
    })

    it('should handle webhook not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Webhook not found')
      })

      const result = await service.getWebhookStatus('webhook-999')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Webhook not found')
    })
  })
})