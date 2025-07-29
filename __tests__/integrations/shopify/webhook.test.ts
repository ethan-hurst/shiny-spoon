// PRP-014: Shopify Webhook Integration Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { POST, GET } from '@/app/api/webhooks/shopify/route'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ 
            data: [{
              id: 'test-integration',
              credentials: {
                shop_domain: 'test-store.myshopify.com',
                access_token: 'shpat_test_token',
                webhook_secret: 'test_webhook_secret'
              },
              settings: {
                sync_products: true,
                sync_inventory: true
              }
            }], 
            error: null 
          }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}))

vi.mock('@/lib/integrations/shopify/connector')

describe('Shopify Webhook Handler', () => {
  let mockConnector: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockConnector = {
      handleWebhook: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(ShopifyConnector).mockImplementation(() => mockConnector as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/webhooks/shopify', () => {
    it('should return webhook endpoint status', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        status: 'ok',
        message: 'Shopify webhook endpoint is active'
      })
    })
  })

  describe('POST /api/webhooks/shopify', () => {
    it('should process valid webhook successfully', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'Test Product',
        status: 'active'
      }

      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_123'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConnector.handleWebhook).toHaveBeenCalledWith({
        topic: 'products/create',
        payload: webhookPayload
      })
    })

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'Test Product'
      }

      const body = JSON.stringify(webhookPayload)
      const invalidHmac = 'invalid_signature'

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Hmac-Sha256': invalidHmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_123'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Invalid webhook signature')
    })

    it('should reject webhook with missing signature header', async () => {
      const webhookPayload = { id: 123456789 }
      const body = JSON.stringify(webhookPayload)

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Missing webhook signature')
    })

    it('should reject webhook with missing topic header', async () => {
      const webhookPayload = { id: 123456789 }
      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Missing webhook topic')
    })

    it('should handle product creation webhook', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'New Product',
        status: 'active',
        variants: [
          {
            id: 987654321,
            title: 'Default Title',
            sku: 'NEW-SKU-001',
            price: '29.99'
          }
        ]
      }

      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_123'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConnector.handleWebhook).toHaveBeenCalledWith({
        topic: 'products/create',
        payload: webhookPayload
      })
    })

    it('should handle product update webhook', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'Updated Product',
        status: 'active'
      }

      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/update',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_124'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConnector.handleWebhook).toHaveBeenCalledWith({
        topic: 'products/update',
        payload: webhookPayload
      })
    })

    it('should handle product deletion webhook', async () => {
      const webhookPayload = {
        id: 123456789,
        title: 'Deleted Product'
      }

      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/delete',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_125'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConnector.handleWebhook).toHaveBeenCalledWith({
        topic: 'products/delete',
        payload: webhookPayload
      })
    })

    it('should handle inventory level update webhook', async () => {
      const webhookPayload = {
        id: 111222333,
        inventory_item_id: 555666777,
        location_id: 1,
        available: 25
      }

      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'inventory_levels/update',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_126'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConnector.handleWebhook).toHaveBeenCalledWith({
        topic: 'inventory_levels/update',
        payload: webhookPayload
      })
    })

    it('should handle order creation webhook', async () => {
      const webhookPayload = {
        id: 123456789,
        name: '#1001',
        total_price: '100.00',
        financial_status: 'paid'
      }

      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'orders/create',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_127'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConnector.handleWebhook).toHaveBeenCalledWith({
        topic: 'orders/create',
        payload: webhookPayload
      })
    })

    it('should handle customer creation webhook', async () => {
      const webhookPayload = {
        id: 123456789,
        email: 'new@example.com',
        first_name: 'John',
        last_name: 'Doe'
      }

      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'customers/create',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_128'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConnector.handleWebhook).toHaveBeenCalledWith({
        topic: 'customers/create',
        payload: webhookPayload
      })
    })

    it('should handle webhook processing errors gracefully', async () => {
      const webhookPayload = { id: 123456789 }
      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_129'
      })

      mockConnector.handleWebhook.mockRejectedValue(new Error('Processing failed'))

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Webhook processing failed')
    })

    it('should handle missing integration configuration', async () => {
      // Mock Supabase to return no integration
      vi.mocked(require('@/lib/supabase/server').createClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      } as any)

      const webhookPayload = { id: 123456789 }
      const body = JSON.stringify(webhookPayload)
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_130'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Integration not found')
    })

    it('should handle malformed JSON payload', async () => {
      const body = 'invalid json'
      const hmac = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(body, 'utf8')
        .digest('base64')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-Webhook-Id': 'webhook_131'
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/shopify', {
        method: 'POST',
        headers,
        body
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid JSON payload')
    })
  })
})