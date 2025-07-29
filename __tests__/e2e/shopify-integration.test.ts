// PRP-014: Shopify Integration End-to-End Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  }))
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ 
            data: [{
              id: 'test-integration',
              platform: 'shopify',
              credentials: {
                shop_domain: 'test-store.myshopify.com',
                access_token: 'shpat_test_token',
                webhook_secret: 'test_webhook_secret'
              },
              settings: {
                sync_products: true,
                sync_inventory: true,
                sync_customers: true,
                sync_orders: true,
                sync_pricing: true,
                field_mappings: {
                  'shopify_custom_field': 'internal_custom_field'
                },
                location_mappings: {
                  '1': 'warehouse_main',
                  '2': 'warehouse_secondary'
                }
              },
              status: 'active',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-02T00:00:00Z'
            }], 
            error: null 
          }))
        }))
      })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}))

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn()
  }))
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Shopify Integration E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Integration Configuration Flow', () => {
    it('should load existing integration configuration', async () => {
      // Mock successful API response for shop info
      const mockShopInfo = {
        id: 'gid://shopify/Shop/123456789',
        name: 'Test Store',
        domain: 'test-store.myshopify.com',
        email: 'test@example.com',
        currency: 'USD',
        timezone: 'America/New_York'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ shop: mockShopInfo })
      })

      // Import the component dynamically to avoid SSR issues
      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('test-store.myshopify.com')).toBeInTheDocument()
        expect(screen.getByDisplayValue('shpat_test_token')).toBeInTheDocument()
      })
    })

    it('should test connection successfully', async () => {
      // Mock successful connection test
      const mockTestResponse = {
        success: true,
        shop_info: {
          name: 'Test Store',
          domain: 'test-store.myshopify.com'
        },
        b2b_features: true,
        locations: [
          { id: 1, name: 'Main Location' },
          { id: 2, name: 'Secondary Location' }
        ],
        api_usage: {
          current: 50,
          limit: 100,
          remaining: 50
        }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTestResponse)
      })

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const testButton = screen.getByText('Test Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText('Connection successful')).toBeInTheDocument()
      })
    })

    it('should handle connection test failure', async () => {
      // Mock failed connection test
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Invalid credentials' })
      })

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const testButton = screen.getByText('Test Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument()
      })
    })

    it('should save integration configuration', async () => {
      // Mock successful save
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      })

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const saveButton = screen.getByText('Save Configuration')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Configuration saved successfully')).toBeInTheDocument()
      })
    })
  })

  describe('Data Synchronization Flow', () => {
    it('should sync products successfully', async () => {
      // Mock successful sync response
      const mockSyncResponse = {
        success: true,
        synced: 25,
        errors: [],
        warnings: []
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSyncResponse)
      })

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      // Switch to Sync tab
      const syncTab = screen.getByText('Sync')
      fireEvent.click(syncTab)

      const syncProductsButton = screen.getByText('Sync Products')
      fireEvent.click(syncProductsButton)

      await waitFor(() => {
        expect(screen.getByText('Products synced: 25')).toBeInTheDocument()
      })
    })

    it('should sync inventory successfully', async () => {
      const mockSyncResponse = {
        success: true,
        synced: 50,
        errors: [],
        warnings: []
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSyncResponse)
      })

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const syncTab = screen.getByText('Sync')
      fireEvent.click(syncTab)

      const syncInventoryButton = screen.getByText('Sync Inventory')
      fireEvent.click(syncInventoryButton)

      await waitFor(() => {
        expect(screen.getByText('Inventory synced: 50')).toBeInTheDocument()
      })
    })

    it('should handle sync errors gracefully', async () => {
      const mockSyncResponse = {
        success: false,
        synced: 0,
        errors: ['API rate limit exceeded'],
        warnings: []
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSyncResponse)
      })

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const syncTab = screen.getByText('Sync')
      fireEvent.click(syncTab)

      const syncProductsButton = screen.getByText('Sync Products')
      fireEvent.click(syncProductsButton)

      await waitFor(() => {
        expect(screen.getByText('Sync failed')).toBeInTheDocument()
        expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument()
      })
    })
  })

  describe('Webhook Configuration Flow', () => {
    it('should generate webhook URL', async () => {
      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const webhooksTab = screen.getByText('Webhooks')
      fireEvent.click(webhooksTab)

      const generateButton = screen.getByText('Generate Webhook URL')
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue(/https:\/\/.*\/api\/webhooks\/shopify/)).toBeInTheDocument()
      })
    })

    it('should copy webhook URL to clipboard', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      })

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const webhooksTab = screen.getByText('Webhooks')
      fireEvent.click(webhooksTab)

      const copyButton = screen.getByText('Copy URL')
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled()
      })
    })
  })

  describe('API Endpoint Tests', () => {
    it('should test integration endpoint successfully', async () => {
      const mockTestResponse = {
        success: true,
        shop_info: {
          name: 'Test Store',
          domain: 'test-store.myshopify.com'
        },
        b2b_features: true,
        locations: [
          { id: 1, name: 'Main Location' }
        ],
        api_usage: {
          current: 50,
          limit: 100,
          remaining: 50
        }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockTestResponse)
      })

      const { POST } = await import('@/app/api/integrations/shopify/test/route')

      const request = new NextRequest('http://localhost:3000/api/integrations/shopify/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop_domain: 'test-store.myshopify.com',
          access_token: 'shpat_test_token'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle invalid credentials in test endpoint', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Invalid credentials' })
      })

      const { POST } = await import('@/app/api/integrations/shopify/test/route')

      const request = new NextRequest('http://localhost:3000/api/integrations/shopify/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop_domain: 'test-store.myshopify.com',
          access_token: 'invalid_token'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Webhook Processing E2E', () => {
    it('should process product creation webhook end-to-end', async () => {
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

      // Mock the connector to return the transformed product
      const mockTransformedProduct = {
        id: '123456789',
        external_id: '123456789',
        platform: 'shopify',
        title: 'New Product',
        status: 'active',
        variants: [
          {
            id: '987654321',
            external_id: '987654321',
            title: 'Default Title',
            sku: 'NEW-SKU-001',
            price: 29.99
          }
        ]
      }

      // Mock Supabase to simulate database operations
      const mockSupabase = {
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
                    sync_products: true
                  }
                }], 
                error: null 
              }))
            }))
          })),
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }

      vi.mocked(require('@/lib/supabase/server').createClient).mockReturnValue(mockSupabase as any)

      const { POST } = await import('@/app/api/webhooks/shopify/route')

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
      
      // Verify that the webhook event was logged
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_events')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          integration_id: 'test-integration',
          topic: 'products/create',
          payload: webhookPayload
        })
      )
    })

    it('should handle webhook signature verification', async () => {
      const webhookPayload = { id: 123456789 }
      const body = JSON.stringify(webhookPayload)
      const invalidHmac = 'invalid_signature'

      const { POST } = await import('@/app/api/webhooks/shopify/route')

      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'products/create',
        'X-Shopify-Hmac-Sha256': invalidHmac,
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
      expect(data.error).toBe('Invalid webhook signature')
    })
  })

  describe('Error Handling E2E', () => {
    it('should handle network errors gracefully', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const testButton = screen.getByText('Test Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument()
      })
    })

    it('should handle rate limiting errors', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: {
          get: vi.fn().mockReturnValue('60')
        },
        json: vi.fn().mockResolvedValue({ error: 'Rate limit exceeded' })
      }

      ;(global.fetch as any).mockResolvedValue(rateLimitResponse)

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const syncTab = screen.getByText('Sync')
      fireEvent.click(syncTab)

      const syncProductsButton = screen.getByText('Sync Products')
      fireEvent.click(syncProductsButton)

      await waitFor(() => {
        expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
      })
    })

    it('should handle authentication errors', async () => {
      const authErrorResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Invalid access token' })
      }

      ;(global.fetch as any).mockResolvedValue(authErrorResponse)

      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const testButton = screen.getByText('Test Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid access token')).toBeInTheDocument()
      })
    })
  })

  describe('Configuration Validation E2E', () => {
    it('should validate required fields', async () => {
      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      // Clear required fields
      const shopDomainInput = screen.getByLabelText('Shop Domain')
      const accessTokenInput = screen.getByLabelText('Access Token')
      
      fireEvent.change(shopDomainInput, { target: { value: '' } })
      fireEvent.change(accessTokenInput, { target: { value: '' } })

      const saveButton = screen.getByText('Save Configuration')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Shop domain is required')).toBeInTheDocument()
        expect(screen.getByText('Access token is required')).toBeInTheDocument()
      })
    })

    it('should validate shop domain format', async () => {
      const { default: ShopifyIntegrationPage } = await import('@/app/(dashboard)/integrations/shopify/page')
      
      render(<ShopifyIntegrationPage />)

      const shopDomainInput = screen.getByLabelText('Shop Domain')
      fireEvent.change(shopDomainInput, { target: { value: 'invalid-domain' } })

      const testButton = screen.getByText('Test Connection')
      fireEvent.click(testButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid shop domain format')).toBeInTheDocument()
      })
    })
  })
})