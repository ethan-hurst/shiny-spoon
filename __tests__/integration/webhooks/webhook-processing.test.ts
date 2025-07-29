import { WebhookService } from '@/lib/sync/services/webhook-service'
import { SyncEngine } from '@/lib/sync/sync-engine'
import { createServerClient } from '@/lib/supabase/server'
import { WebhookType, WebhookEvent } from '@/lib/sync/types'
import { setupTestDatabase, cleanupTestDatabase } from '@/tests/helpers/database'
import crypto from 'crypto'

describe('Webhook Processing Integration Tests', () => {
  let webhookService: WebhookService
  let syncEngine: SyncEngine
  let supabase: any
  let testOrgId: string
  let testIntegrationId: string
  let webhookSecret: string

  beforeAll(async () => {
    const testData = await setupTestDatabase()
    testOrgId = testData.organizationId
    testIntegrationId = testData.integrationId
    webhookSecret = 'test-webhook-secret-' + crypto.randomBytes(16).toString('hex')
    supabase = createServerClient()

    // Set up webhook configuration
    await supabase
      .from('integrations')
      .update({
        config: {
          webhook_secret: webhookSecret,
          webhook_url: 'https://api.test.com/webhooks'
        }
      })
      .eq('id', testIntegrationId)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(() => {
    webhookService = new WebhookService()
    syncEngine = new SyncEngine()
  })

  describe('Shopify Webhook Processing', () => {
    it('should process product update webhook from Shopify', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'Test Product',
        vendor: 'Test Vendor',
        product_type: 'Test Type',
        variants: [
          {
            id: 987654321,
            sku: 'TEST-SKU-001',
            price: '99.99',
            inventory_quantity: 100
          }
        ],
        updated_at: new Date().toISOString()
      }

      const webhookEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: WebhookType.PRODUCT_UPDATE,
        source: 'shopify',
        data: webhookPayload,
        received_at: new Date().toISOString(),
        signature: generateShopifySignature(webhookPayload, webhookSecret)
      }

      // Process webhook
      const result = await webhookService.processWebhook(webhookEvent)
      expect(result.success).toBe(true)

      // Verify product was created/updated
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('external_id', '123456789')
        .single()

      expect(product).toBeDefined()
      expect(product.name).toBe('Test Product')
      expect(product.sku).toBe('TEST-SKU-001')

      // Verify pricing was updated
      const { data: pricing } = await supabase
        .from('product_pricing')
        .select('*')
        .eq('sku', 'TEST-SKU-001')
        .single()

      expect(pricing.base_price).toBe(99.99)

      // Verify inventory was updated
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', 'TEST-SKU-001')
        .single()

      expect(inventory.quantity).toBe(100)
    })

    it('should process inventory level update webhook', async () => {
      // Create product first
      await supabase
        .from('products')
        .insert({
          organization_id: testOrgId,
          sku: 'TEST-SKU-002',
          name: 'Test Product 2',
          external_id: '123456790'
        })

      const webhookPayload = {
        inventory_item_id: 123456790,
        location_id: 987654321,
        available: 50,
        updated_at: new Date().toISOString()
      }

      const webhookEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: WebhookType.INVENTORY_UPDATE,
        source: 'shopify',
        data: webhookPayload,
        received_at: new Date().toISOString(),
        signature: generateShopifySignature(webhookPayload, webhookSecret)
      }

      // Process webhook
      const result = await webhookService.processWebhook(webhookEvent)
      expect(result.success).toBe(true)

      // Verify inventory was updated
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('external_id', '123456790')
        .single()

      expect(inventory.quantity).toBe(50)
    })

    it('should process order creation webhook', async () => {
      const webhookPayload = {
        id: 1234567890,
        order_number: 'ORD-001',
        email: 'customer@example.com',
        total_price: '199.98',
        line_items: [
          {
            sku: 'TEST-SKU-001',
            quantity: 2,
            price: '99.99'
          }
        ],
        created_at: new Date().toISOString()
      }

      const webhookEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: WebhookType.ORDER_CREATED,
        source: 'shopify',
        data: webhookPayload,
        received_at: new Date().toISOString(),
        signature: generateShopifySignature(webhookPayload, webhookSecret)
      }

      // Process webhook
      const result = await webhookService.processWebhook(webhookEvent)
      expect(result.success).toBe(true)

      // Verify order was created
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('external_id', '1234567890')
        .single()

      expect(order).toBeDefined()
      expect(order.order_number).toBe('ORD-001')
      expect(order.total_amount).toBe(199.98)

      // Verify inventory was reduced
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', 'TEST-SKU-001')
        .single()

      expect(inventory.quantity).toBeLessThan(100) // Original was 100
      expect(inventory.reserved_quantity).toBe(2)
    })
  })

  describe('NetSuite Webhook Processing', () => {
    it('should process item update webhook from NetSuite', async () => {
      const webhookPayload = {
        type: 'inventoryitem',
        id: 'ITEM123',
        fields: {
          itemid: 'TEST-SKU-003',
          displayname: 'Test Item 3',
          purchaseprice: 75.00,
          cost: 50.00,
          quantityonhand: 200
        },
        timestamp: new Date().toISOString()
      }

      const webhookEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: WebhookType.PRODUCT_UPDATE,
        source: 'netsuite',
        data: webhookPayload,
        received_at: new Date().toISOString(),
        signature: generateNetSuiteSignature(webhookPayload, webhookSecret)
      }

      // Process webhook
      const result = await webhookService.processWebhook(webhookEvent)
      expect(result.success).toBe(true)

      // Verify product was created/updated
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('sku', 'TEST-SKU-003')
        .single()

      expect(product).toBeDefined()
      expect(product.name).toBe('Test Item 3')
      expect(product.cost).toBe(50.00)

      // Verify inventory
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', 'TEST-SKU-003')
        .single()

      expect(inventory.quantity).toBe(200)
    })

    it('should process sales order webhook from NetSuite', async () => {
      const webhookPayload = {
        type: 'salesorder',
        id: 'SO123456',
        fields: {
          tranid: 'SO-2024-001',
          entity: 'CUST123',
          total: 500.00,
          items: [
            {
              item: 'TEST-SKU-003',
              quantity: 5,
              rate: 100.00
            }
          ],
          trandate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      }

      const webhookEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: WebhookType.ORDER_CREATED,
        source: 'netsuite',
        data: webhookPayload,
        received_at: new Date().toISOString(),
        signature: generateNetSuiteSignature(webhookPayload, webhookSecret)
      }

      // Process webhook
      const result = await webhookService.processWebhook(webhookEvent)
      expect(result.success).toBe(true)

      // Verify order was created
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('external_id', 'SO123456')
        .single()

      expect(order).toBeDefined()
      expect(order.order_number).toBe('SO-2024-001')
      expect(order.total_amount).toBe(500.00)
    })
  })

  describe('Webhook Validation and Security', () => {
    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'Test Product'
      }

      const webhookEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: WebhookType.PRODUCT_UPDATE,
        source: 'shopify',
        data: webhookPayload,
        received_at: new Date().toISOString(),
        signature: 'invalid-signature'
      }

      // Process webhook
      const result = await webhookService.processWebhook(webhookEvent)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid webhook signature')

      // Verify webhook was logged as failed
      const { data: webhookLog } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookEvent.id)
        .single()

      expect(webhookLog.status).toBe('failed')
      expect(webhookLog.error).toContain('Invalid signature')
    })

    it('should handle duplicate webhook deliveries', async () => {
      const webhookPayload = {
        id: 123456791,
        title: 'Test Product Duplicate'
      }

      const webhookEvent: WebhookEvent = {
        id: 'duplicate-webhook-id',
        type: WebhookType.PRODUCT_UPDATE,
        source: 'shopify',
        data: webhookPayload,
        received_at: new Date().toISOString(),
        signature: generateShopifySignature(webhookPayload, webhookSecret)
      }

      // Process webhook first time
      const result1 = await webhookService.processWebhook(webhookEvent)
      expect(result1.success).toBe(true)

      // Process same webhook again
      const result2 = await webhookService.processWebhook(webhookEvent)
      expect(result2.success).toBe(true)
      expect(result2.data?.status).toBe('duplicate')

      // Verify only one webhook log exists
      const { count } = await supabase
        .from('webhook_logs')
        .select('*', { count: 'exact', head: true })
        .eq('webhook_id', webhookEvent.id)

      expect(count).toBe(1)
    })
  })

  describe('Webhook Retry Logic', () => {
    it('should retry failed webhooks with exponential backoff', async () => {
      // Create a failed webhook log
      const { data: webhookLog } = await supabase
        .from('webhook_logs')
        .insert({
          webhook_id: crypto.randomUUID(),
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          type: WebhookType.PRODUCT_UPDATE,
          status: 'failed',
          retry_count: 0,
          payload: {
            id: 123456792,
            title: 'Retry Test Product'
          },
          error: 'Temporary failure',
          created_at: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
        })
        .select()
        .single()

      // Retry failed webhooks
      const result = await webhookService.retryFailedWebhooks()
      expect(result.success).toBe(true)
      expect(result.data?.processed).toBeGreaterThan(0)

      // Verify webhook was retried
      const { data: updatedLog } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookLog.webhook_id)
        .single()

      expect(updatedLog.retry_count).toBe(1)
      expect(updatedLog.status).toBe('processed')
    })

    it('should stop retrying after max attempts', async () => {
      // Create a webhook log that has already been retried max times
      const { data: webhookLog } = await supabase
        .from('webhook_logs')
        .insert({
          webhook_id: crypto.randomUUID(),
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          type: WebhookType.PRODUCT_UPDATE,
          status: 'failed',
          retry_count: 5, // Max retries
          payload: {
            id: 123456793,
            title: 'Max Retry Test'
          },
          error: 'Permanent failure',
          created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        })
        .select()
        .single()

      // Retry failed webhooks
      const result = await webhookService.retryFailedWebhooks()
      expect(result.success).toBe(true)

      // Verify webhook was not retried
      const { data: updatedLog } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookLog.webhook_id)
        .single()

      expect(updatedLog.retry_count).toBe(5) // Unchanged
      expect(updatedLog.status).toBe('failed') // Still failed
    })
  })
})

// Helper functions
function generateShopifySignature(payload: any, secret: string): string {
  const message = JSON.stringify(payload)
  return crypto
    .createHmac('sha256', secret)
    .update(message, 'utf8')
    .digest('base64')
}

function generateNetSuiteSignature(payload: any, secret: string): string {
  const message = JSON.stringify(payload)
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
}