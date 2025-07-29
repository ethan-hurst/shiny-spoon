// PRP-014: Shopify Auth Unit Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ShopifyAuth } from '@/lib/integrations/shopify/auth'
import { ShopifyAPIError, ShopifyRateLimitError } from '@/types/shopify.types'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}))

// Mock fetch
global.fetch = vi.fn()

describe('ShopifyAuth', () => {
  let auth: ShopifyAuth
  const mockConfig = {
    shop_domain: 'test-store.myshopify.com',
    access_token: 'shpat_test_token',
    api_version: '2024-01'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    auth = new ShopifyAuth('test-integration', 'test-org', mockConfig)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with correct config', () => {
      expect(auth).toBeInstanceOf(ShopifyAuth)
    })
  })

  describe('initialize', () => {
    it('should validate credentials and test connection', async () => {
      // Mock successful shop info response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          shop: {
            id: 'gid://shopify/Shop/123456789',
            name: 'Test Store',
            domain: 'test-store.myshopify.com'
          }
        })
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.initialize()).resolves.not.toThrow()
    })

    it('should throw error when credentials are missing', async () => {
      const invalidAuth = new ShopifyAuth('test', 'test', {
        shop_domain: '',
        access_token: '',
        api_version: '2024-01'
      })

      await expect(invalidAuth.initialize()).rejects.toThrow('Missing required Shopify credentials')
    })

    it('should throw error when API validation fails', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.initialize()).rejects.toThrow('Failed to initialize Shopify authentication')
    })
  })

  describe('validateCredentials', () => {
    it('should return true for valid credentials', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          shop: {
            id: 'gid://shopify/Shop/123456789',
            name: 'Test Store'
          }
        })
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const result = await auth.validateCredentials()
      expect(result).toBe(true)
    })

    it('should throw error for invalid credentials', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.validateCredentials()).rejects.toThrow('Shopify API validation failed')
    })

    it('should throw error for invalid response format', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.validateCredentials()).rejects.toThrow('Invalid response from Shopify API')
    })
  })

  describe('makeRequest', () => {
    it('should make authenticated request with correct headers', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' })
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await auth.makeRequest('GET', '/admin/api/2024-01/shop.json')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-store.myshopify.com/admin/api/2024-01/shop.json',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': 'shpat_test_token'
          })
        })
      )
    })

    it('should handle rate limiting', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        headers: {
          get: vi.fn().mockReturnValue('60')
        }
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.makeRequest('GET', '/test')).rejects.toThrow(ShopifyRateLimitError)
    })

    it('should handle authentication errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.makeRequest('GET', '/test')).rejects.toThrow('Shopify API authentication failed')
    })
  })

  describe('makeGraphQLRequest', () => {
    it('should make GraphQL request with correct body', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { shop: { id: 'test' } } })
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const query = '{ shop { id } }'
      const variables = { test: 'value' }

      await auth.makeGraphQLRequest(query, variables)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-store.myshopify.com/admin/api/2024-01/graphql.json',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query,
            variables
          })
        })
      )
    })
  })

  describe('getShopInfo', () => {
    it('should return shop information', async () => {
      const mockShopInfo = {
        id: 'gid://shopify/Shop/123456789',
        name: 'Test Store',
        email: 'test@example.com',
        domain: 'test-store.myshopify.com',
        currency: 'USD',
        timezone: 'America/New_York'
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ shop: mockShopInfo })
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const result = await auth.getShopInfo()

      expect(result).toEqual(mockShopInfo)
    })

    it('should throw error when shop info request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.getShopInfo()).rejects.toThrow('Failed to get shop info')
    })
  })

  describe('hasB2BFeatures', () => {
    it('should return true when B2B features are available', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ catalogs: [] })
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const result = await auth.hasB2BFeatures()
      expect(result).toBe(true)
    })

    it('should return false when B2B features are not available', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const result = await auth.hasB2BFeatures()
      expect(result).toBe(false)
    })
  })

  describe('getLocations', () => {
    it('should return locations array', async () => {
      const mockLocations = [
        {
          id: 1,
          name: 'Main Location',
          address1: '123 Main St',
          city: 'New York',
          country: 'United States'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ locations: mockLocations })
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const result = await auth.getLocations()

      expect(result).toEqual(mockLocations)
    })

    it('should throw error when locations request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(auth.getLocations()).rejects.toThrow('Failed to get locations')
    })
  })

  describe('getApiUsage', () => {
    it('should return API usage information', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ shop: { id: 'test' } }),
        headers: {
          get: vi.fn().mockReturnValue('50/100')
        }
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const result = await auth.getApiUsage()

      expect(result).toEqual({
        current: 50,
        limit: 100,
        remaining: 50,
        resetTime: expect.any(Date)
      })
    })
  })

  describe('getBaseUrl', () => {
    it('should return correct base URL', () => {
      const result = auth.getBaseUrl()
      expect(result).toBe('https://test-store.myshopify.com')
    })
  })

  describe('getApiVersion', () => {
    it('should return API version', () => {
      const result = auth.getApiVersion()
      expect(result).toBe('2024-01')
    })

    it('should return default API version when not specified', () => {
      const authWithoutVersion = new ShopifyAuth('test', 'test', {
        shop_domain: 'test.myshopify.com',
        access_token: 'test',
        api_version: ''
      })

      const result = authWithoutVersion.getApiVersion()
      expect(result).toBe('2024-01')
    })
  })

  describe('getAccessToken', () => {
    it('should return access token', () => {
      const result = auth.getAccessToken()
      expect(result).toBe('shpat_test_token')
    })
  })
})