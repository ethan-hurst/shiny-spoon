import { GenericWebhookHandler, handleWebhook } from '@/lib/integrations/webhook-handler'
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { Headers } from 'next/dist/compiled/@edge-runtime/primitives'
import type {
  WebhookEndpoint,
  WebhookEvent,
  IntegrationPlatformType,
} from '@/types/integration.types'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('next/server')

const mockSupabase = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
}

const mockHeaders = {
  get: jest.fn(),
}

;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)

describe('WebhookHandler', () => {
  let webhookHandler: GenericWebhookHandler
  let mockWebhookConfig: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockWebhookConfig = {
      id: 'webhook-123',
      integration_id: 'integration-123',
      organization_id: 'org-123',
      platform: 'shopify',
      endpoint_url: 'https://api.example.com/webhooks/shopify',
      secret: 'test-secret',
      is_active: true,
      integrations: {
        id: 'integration-123',
        organization_id: 'org-123',
        name: 'Test Integration',
        platform: 'shopify',
        config: {
          shop_domain: 'test-shop.myshopify.com',
          access_token: 'test-token'
        }
      }
    }
    
    mockHeaders = new Headers() as jest.Mocked<Headers>
    
    // Mock crypto functions
    ;(crypto.randomUUID as jest.Mock).mockReturnValue('random-uuid-123')
    ;(crypto.timingSafeEqual as jest.Mock).mockImplementation((a, b) => {
      return a.toString() === b.toString()
    })
    
    webhookHandler = new GenericWebhookHandler()
  })

  describe('getWebhookConfig', () => {
    it('should retrieve Shopify webhook config by shop domain', async () => {
      mockHeaders.get.mockImplementation((header: string) => {
        if (header === 'x-shopify-shop-domain') return 'test-shop.myshopify.com'
        return null
      })
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockWebhookConfig,
          error: null
        })
      }
      
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const result = await webhookHandler.getWebhookConfig('shopify', mockHeaders)
      
      expect(result).toEqual({
        ...mockWebhookConfig,
        integration_id: 'integration-123',
        organization_id: 'org-123',
        platform: 'shopify'
      })
      
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_endpoints')
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('integrations'))
    })

    it('should retrieve QuickBooks webhook config by company ID', async () => {
      mockHeaders.get.mockImplementation((header: string) => {
        if (header === 'intuit-company-id') return 'company-123'
        return null
      })
      
      const qbConfig = {
        ...mockWebhookConfig,
        platform: 'quickbooks' as IntegrationPlatformType,
        integrations: {
          ...mockWebhookConfig.integrations,
          platform: 'quickbooks',
          config: { company_id: 'company-123' }
        }
      }
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: qbConfig,
          error: null
        })
      }
      
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const result = await webhookHandler.getWebhookConfig('quickbooks', mockHeaders)
      
      expect(result?.platform).toBe('quickbooks')
    })

    it('should return null when no config found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect } as any)
      
      const result = await webhookHandler.getWebhookConfig('shopify', mockHeaders)
      
      expect(result).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect } as any)
      
      const result = await webhookHandler.getWebhookConfig('shopify', mockHeaders)
      
      expect(result).toBeNull()
    })
  })

  describe('verifyWebhook', () => {
    describe('Shopify verification', () => {
      it('should verify valid Shopify webhook', async () => {
        const body = JSON.stringify({ id: 123, name: 'Product' })
        const secret = 'shopify-secret'
        const expectedHash = 'valid-hash'
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'x-shopify-hmac-sha256') return expectedHash
          return null
        })
        
        const mockHmac = {
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(expectedHash)
        }
        
        ;(crypto.createHmac as jest.Mock).mockReturnValue(mockHmac)
        ;(crypto.timingSafeEqual as jest.Mock).mockReturnValue(true)
        
        const result = await webhookHandler.verifyWebhook('shopify', mockHeaders, body, secret)
        
        expect(result).toBe(true)
        expect(crypto.createHmac).toHaveBeenCalledWith('sha256', secret)
        expect(mockHmac.update).toHaveBeenCalledWith(body, 'utf8')
        expect(mockHmac.digest).toHaveBeenCalledWith('base64')
      })

      it('should reject invalid Shopify webhook', async () => {
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'x-shopify-hmac-sha256') return 'invalid-hash'
          return null
        })
        
        ;(crypto.createHmac as jest.Mock).mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue('valid-hash')
        })
        ;(crypto.timingSafeEqual as jest.Mock).mockReturnValue(false)
        
        const result = await webhookHandler.verifyWebhook('shopify', mockHeaders, '{}', 'secret')
        
        expect(result).toBe(false)
      })

      it('should reject Shopify webhook without signature', async () => {
        mockHeaders.get.mockReturnValue(null)
        
        const result = await webhookHandler.verifyWebhook('shopify', mockHeaders, '{}', 'secret')
        
        expect(result).toBe(false)
      })
    })

    describe('NetSuite verification', () => {
      it('should verify valid NetSuite webhook', async () => {
        const body = JSON.stringify({ recordType: 'salesorder' })
        const secret = 'netsuite-secret'
        const expectedHash = 'valid-hash'
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'x-netsuite-signature') return expectedHash
          return null
        })
        
        ;(crypto.createHmac as jest.Mock).mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(expectedHash)
        })
        ;(crypto.timingSafeEqual as jest.Mock).mockReturnValue(true)
        
        const result = await webhookHandler.verifyWebhook('netsuite', mockHeaders, body, secret)
        
        expect(result).toBe(true)
      })
    })

    describe('QuickBooks verification', () => {
      it('should verify valid QuickBooks webhook', async () => {
        const body = JSON.stringify({ eventNotifications: [] })
        const secret = 'quickbooks-secret'
        const expectedHash = 'valid-hash'
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'intuit-signature') return expectedHash
          return null
        })
        
        ;(crypto.createHmac as jest.Mock).mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(expectedHash)
        })
        ;(crypto.timingSafeEqual as jest.Mock).mockReturnValue(true)
        
        const result = await webhookHandler.verifyWebhook('quickbooks', mockHeaders, body, secret)
        
        expect(result).toBe(true)
      })
    })

    describe('Stripe verification', () => {
      it('should verify valid Stripe webhook with timestamp', async () => {
        const body = JSON.stringify({ type: 'payment_intent.succeeded' })
        const secret = 'stripe-secret'
        const timestamp = Math.floor(Date.now() / 1000).toString()
        const expectedSignature = 'valid-signature'
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'stripe-signature') {
            return `t=${timestamp},v1=${expectedSignature}`
          }
          return null
        })
        
        ;(crypto.createHmac as jest.Mock).mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(expectedSignature)
        })
        ;(crypto.timingSafeEqual as jest.Mock).mockReturnValue(true)
        
        const result = await webhookHandler.verifyWebhook('stripe', mockHeaders, body, secret)
        
        expect(result).toBe(true)
        expect(crypto.createHmac).toHaveBeenCalledWith('sha256', secret)
      })

      it('should reject Stripe webhook with old timestamp', async () => {
        const body = JSON.stringify({ type: 'payment_intent.succeeded' })
        const secret = 'stripe-secret'
        const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString() // 6+ minutes ago
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'stripe-signature') {
            return `t=${oldTimestamp},v1=signature`
          }
          return null
        })
        
        const result = await webhookHandler.verifyWebhook('stripe', mockHeaders, body, secret)
        
        expect(result).toBe(false)
      })

      it('should reject Stripe webhook with invalid format', async () => {
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'stripe-signature') return 'invalid-format'
          return null
        })
        
        const result = await webhookHandler.verifyWebhook('stripe', mockHeaders, '{}', 'secret')
        
        expect(result).toBe(false)
      })
    })

    describe('Generic verification', () => {
      it('should verify simple HMAC format', async () => {
        const body = JSON.stringify({ event: 'test' })
        const secret = 'generic-secret'
        const expectedHash = 'valid-hash'
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'x-webhook-signature') return expectedHash
          return null
        })
        
        ;(crypto.createHmac as jest.Mock).mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(expectedHash)
        })
        
        const result = await webhookHandler.verifyWebhook('custom', mockHeaders, body, secret)
        
        expect(result).toBe(true)
      })

      it('should verify timestamp.signature format', async () => {
        const body = JSON.stringify({ event: 'test' })
        const secret = 'generic-secret'
        const timestamp = Math.floor(Date.now() / 1000).toString()
        const hash = 'valid-hash'
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'x-webhook-signature') return `${timestamp}.${hash}`
          return null
        })
        
        ;(crypto.createHmac as jest.Mock).mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(hash)
        })
        ;(crypto.timingSafeEqual as jest.Mock).mockReturnValue(true)
        
        const result = await webhookHandler.verifyWebhook('custom', mockHeaders, body, secret)
        
        expect(result).toBe(true)
      })

      it('should reject timestamp signature with old timestamp', async () => {
        const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString()
        
        mockHeaders.get.mockImplementation((header: string) => {
          if (header === 'x-webhook-signature') return `${oldTimestamp}.hash`
          return null
        })
        
        const result = await webhookHandler.verifyWebhook('custom', mockHeaders, '{}', 'secret')
        
        expect(result).toBe(false)
      })
    })

    it('should handle verification errors gracefully', async () => {
      ;(crypto.createHmac as jest.Mock).mockImplementation(() => {
        throw new Error('Crypto error')
      })
      
      mockHeaders.get.mockReturnValue('signature')
      
      const result = await webhookHandler.verifyWebhook('shopify', mockHeaders, '{}', 'secret')
      
      expect(result).toBe(false)
    })
  })

  describe('parsePayload', () => {
    it('should parse Shopify webhook payload', () => {
      const body = JSON.stringify({
        id: 123,
        title: 'Product',
        vendor: 'Vendor'
      })
      
      mockHeaders.get.mockImplementation((header: string) => {
        switch (header) {
          case 'x-shopify-webhook-id': return 'webhook-123'
          case 'x-shopify-topic': return 'products/update'
          case 'x-shopify-hmac-sha256': return 'signature-123'
          default: return null
        }
      })
      
      const result = webhookHandler.parsePayload('shopify', body, mockHeaders)
      
      expect(result).toEqual({
        id: 'webhook-123',
        platform: 'shopify',
        event_type: 'products/update',
        payload: { id: 123, title: 'Product', vendor: 'Vendor' },
        signature: 'signature-123',
        timestamp: expect.any(String),
        integration_id: ''
      })
    })

    it('should parse QuickBooks webhook payload', () => {
      const body = JSON.stringify({
        eventNotifications: [{
          id: 'event-123',
          eventType: 'entity.update',
          eventDate: '2024-01-15T10:00:00Z'
        }]
      })
      
      mockHeaders.get.mockImplementation((header: string) => {
        if (header === 'intuit-signature') return 'signature-123'
        return null
      })
      
      const result = webhookHandler.parsePayload('quickbooks', body, mockHeaders)
      
      expect(result).toEqual({
        id: 'event-123',
        platform: 'quickbooks',
        event_type: 'entity.update',
        payload: expect.any(Object),
        signature: 'signature-123',
        timestamp: '2024-01-15T10:00:00Z',
        integration_id: ''
      })
    })

    it('should parse NetSuite webhook payload', () => {
      const body = JSON.stringify({
        id: 'record-123',
        recordType: 'salesorder',
        timestamp: '2024-01-15T10:00:00Z'
      })
      
      mockHeaders.get.mockImplementation((header: string) => {
        if (header === 'x-netsuite-signature') return 'signature-123'
        return null
      })
      
      const result = webhookHandler.parsePayload('netsuite', body, mockHeaders)
      
      expect(result).toEqual({
        id: 'record-123',
        platform: 'netsuite',
        event_type: 'salesorder',
        payload: expect.any(Object),
        signature: 'signature-123',
        timestamp: '2024-01-15T10:00:00Z',
        integration_id: ''
      })
    })

    it('should parse generic webhook payload', () => {
      const body = JSON.stringify({
        id: 'generic-123',
        event: 'test.event',
        data: { key: 'value' }
      })
      
      mockHeaders.get.mockImplementation((header: string) => {
        if (header === 'x-webhook-signature') return 'signature-123'
        return null
      })
      
      const result = webhookHandler.parsePayload('custom' as any, body, mockHeaders)
      
      expect(result).toEqual({
        id: 'generic-123',
        platform: 'custom',
        event_type: 'test.event',
        payload: expect.any(Object),
        signature: 'signature-123',
        timestamp: expect.any(String),
        integration_id: ''
      })
    })

    it('should use random UUID when ID not provided', () => {
      const body = JSON.stringify({ title: 'Product' })
      
      mockHeaders.get.mockReturnValue(null)
      ;(crypto.randomUUID as jest.Mock).mockReturnValue('random-uuid-456')
      
      const result = webhookHandler.parsePayload('shopify', body, mockHeaders)
      
      expect(result.id).toBe('random-uuid-456')
    })

    it('should throw error for invalid JSON', () => {
      const invalidBody = 'invalid-json'
      
      expect(() => webhookHandler.parsePayload('shopify', invalidBody, mockHeaders))
        .toThrow('Failed to parse webhook payload:')
    })

    it('should handle missing event notifications in QuickBooks', () => {
      const body = JSON.stringify({ someData: 'value' })
      
      const result = webhookHandler.parsePayload('quickbooks', body, mockHeaders)
      
      expect(result.id).toBe('random-uuid-123')
      expect(result.event_type).toBe('unknown')
    })
  })

  describe('createSuccessResponse', () => {
    it('should create Shopify success response', () => {
      const response = webhookHandler.createSuccessResponse('shopify')
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })

    it('should create QuickBooks success response', () => {
      const response = webhookHandler.createSuccessResponse('quickbooks')
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
    })

    it('should create generic success response', () => {
      const response = webhookHandler.createSuccessResponse('netsuite')
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
    })
  })

  describe('isDuplicate', () => {
    it('should detect duplicate webhook events', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [{ id: 'log-123' }],
                    error: null
                  })
                })
              })
            })
          })
        })
      } as any)
      
      const result = await webhookHandler.isDuplicate('integration-123', 'event-123', 'products/update')
      
      expect(result).toBe(true)
    })

    it('should return false for new events', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          })
        })
      } as any)
      
      const result = await webhookHandler.isDuplicate('integration-123', 'event-456', 'products/update')
      
      expect(result).toBe(false)
    })

    it('should handle null data response', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                  })
                })
              })
            })
          })
        })
      } as any)
      
      const result = await webhookHandler.isDuplicate('integration-123', 'event-789', 'products/update')
      
      expect(result).toBe(false)
    })
  })

  describe('processWebhook', () => {
    const mockEvent: WebhookEvent = {
      id: 'event-123',
      platform: 'shopify',
      event_type: 'products/update',
      payload: { id: 123 },
      signature: 'signature',
      timestamp: '2024-01-15T10:00:00Z',
      integration_id: 'integration-123'
    }

    it('should skip processing duplicate events', async () => {
      // Mock isDuplicate to return true
      jest.spyOn(webhookHandler, 'isDuplicate').mockResolvedValue(true)
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await webhookHandler.processWebhook(mockWebhookConfig as any, mockEvent)
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_integration_activity', {
        p_integration_id: 'integration-123',
        p_organization_id: 'org-123',
        p_log_type: 'webhook',
        p_severity: 'info',
        p_message: 'Duplicate webhook ignored',
        p_details: {
          event_id: 'event-123',
          event_type: 'products/update'
        }
      })
    })

    it('should process non-duplicate events', async () => {
      jest.spyOn(webhookHandler, 'isDuplicate').mockResolvedValue(false)
      
      await webhookHandler.processWebhook(mockWebhookConfig as any, mockEvent)
      
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })
  })
})