// PRP-014: Shopify API Client Unit Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ShopifyApiClient } from '@/lib/integrations/shopify/api-client'
import { ShopifyAuth } from '@/lib/integrations/shopify/auth'
import { ShopifyAPIError, ShopifyRateLimitError } from '@/types/shopify.types'

// Mock ShopifyAuth
vi.mock('@/lib/integrations/shopify/auth')

describe('ShopifyApiClient', () => {
  let client: ShopifyApiClient
  let mockAuth: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockAuth = {
      makeRequest: vi.fn(),
      makeGraphQLRequest: vi.fn(),
      getApiVersion: vi.fn().mockReturnValue('2024-01')
    }

    client = new ShopifyApiClient(
      mockAuth as any,
      {
        shop_domain: 'test-store.myshopify.com',
        access_token: 'shpat_test_token',
        api_version: '2024-01'
      }
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with auth and config', () => {
      expect(client).toBeInstanceOf(ShopifyApiClient)
    })
  })

  describe('makeRequest', () => {
    it('should delegate to auth makeRequest', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'test' }) }
      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.makeRequest('GET', '/test', null, { 'Custom-Header': 'value' })

      expect(mockAuth.makeRequest).toHaveBeenCalledWith('GET', '/test', null, { 'Custom-Header': 'value' })
      expect(result).toBe(mockResponse)
    })

    it('should handle rate limiting', async () => {
      const rateLimitError = new ShopifyRateLimitError('Rate limit exceeded', 60)
      mockAuth.makeRequest.mockRejectedValue(rateLimitError)

      await expect(client.makeRequest('GET', '/test')).rejects.toThrow(ShopifyRateLimitError)
    })
  })

  describe('makeGraphQLRequest', () => {
    it('should delegate to auth makeGraphQLRequest', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: { shop: { id: 'test' } } }) }
      mockAuth.makeGraphQLRequest.mockResolvedValue(mockResponse)

      const query = '{ shop { id } }'
      const variables = { test: 'value' }

      const result = await client.makeGraphQLRequest(query, variables)

      expect(mockAuth.makeGraphQLRequest).toHaveBeenCalledWith(query, variables)
      expect(result).toBe(mockResponse)
    })
  })

  describe('getProducts', () => {
    it('should fetch products with correct parameters', async () => {
      const mockProducts = [
        {
          id: 1,
          title: 'Test Product',
          handle: 'test-product',
          status: 'active'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ products: mockProducts }),
        headers: {
          get: vi.fn().mockReturnValue('<https://test.myshopify.com/admin/api/2024-01/products.json?page_info=next_cursor>; rel="next"')
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getProducts({
        limit: 50,
        status: 'active',
        vendor: 'Test Vendor'
      })

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/products.json?limit=50&status=active&vendor=Test%20Vendor'
      )

      expect(result).toEqual({
        products: mockProducts,
        hasNextPage: true,
        nextPageInfo: 'next_cursor'
      })
    })

    it('should handle pagination correctly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ products: [] }),
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getProducts()

      expect(result).toEqual({
        products: [],
        hasNextPage: false,
        nextPageInfo: undefined
      })
    })

    it('should throw error when products request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await expect(client.getProducts()).rejects.toThrow('Failed to get products')
    })
  })

  describe('getProduct', () => {
    it('should fetch single product by ID', async () => {
      const mockProduct = {
        id: 1,
        title: 'Test Product',
        handle: 'test-product'
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ product: mockProduct })
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getProduct('1', 'id,title,handle')

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/products/1.json?fields=id%2Ctitle%2Chandle'
      )

      expect(result).toEqual(mockProduct)
    })

    it('should throw error when product request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await expect(client.getProduct('999')).rejects.toThrow('Failed to get product 999')
    })
  })

  describe('getInventoryLevels', () => {
    it('should fetch inventory levels with filters', async () => {
      const mockInventory = [
        {
          id: 1,
          available: 10,
          location_id: 1,
          inventory_item_id: 1
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ inventory_levels: mockInventory }),
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getInventoryLevels({
        inventory_item_ids: [1, 2],
        location_ids: [1],
        limit: 50
      })

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/inventory_levels.json?inventory_item_ids%5B%5D=1&inventory_item_ids%5B%5D=2&location_ids%5B%5D=1&limit=50'
      )

      expect(result).toEqual({
        inventory_levels: mockInventory,
        hasNextPage: false,
        nextPageInfo: undefined
      })
    })

    it('should throw error when inventory request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await expect(client.getInventoryLevels()).rejects.toThrow('Failed to get inventory levels')
    })
  })

  describe('updateInventoryLevel', () => {
    it('should update inventory level', async () => {
      const mockInventory = {
        id: 1,
        available: 15,
        location_id: 1,
        inventory_item_id: 1
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ inventory_level: mockInventory })
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.updateInventoryLevel(1, 1, 15)

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'POST',
        '/admin/api/2024-01/inventory_levels/set.json',
        {
          location_id: 1,
          inventory_item_id: 1,
          available: 15
        }
      )

      expect(result).toEqual(mockInventory)
    })

    it('should throw error when inventory update fails', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await expect(client.updateInventoryLevel(1, 1, 15)).rejects.toThrow('Failed to update inventory level')
    })
  })

  describe('getCustomers', () => {
    it('should fetch customers with pagination', async () => {
      const mockCustomers = [
        {
          id: 1,
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ customers: mockCustomers }),
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getCustomers({
        limit: 50,
        created_at_min: '2024-01-01'
      })

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/customers.json?limit=50&created_at_min=2024-01-01'
      )

      expect(result).toEqual({
        customers: mockCustomers,
        hasNextPage: false,
        nextPageInfo: undefined
      })
    })
  })

  describe('getOrders', () => {
    it('should fetch orders with filters', async () => {
      const mockOrders = [
        {
          id: 1,
          name: '#1001',
          total_price: '100.00',
          financial_status: 'paid'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ orders: mockOrders }),
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getOrders({
        limit: 50,
        status: 'any',
        financial_status: 'paid'
      })

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/orders.json?limit=50&status=any&financial_status=paid'
      )

      expect(result).toEqual({
        orders: mockOrders,
        hasNextPage: false,
        nextPageInfo: undefined
      })
    })
  })

  describe('getCatalogs', () => {
    it('should fetch B2B catalogs', async () => {
      const mockCatalogs = [
        {
          id: 1,
          title: 'B2B Catalog',
          status: 'active'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ catalogs: mockCatalogs }),
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getCatalogs()

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/catalogs.json'
      )

      expect(result).toEqual({
        catalogs: mockCatalogs,
        hasNextPage: false,
        nextPageInfo: undefined
      })
    })

    it('should throw error when catalogs request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await expect(client.getCatalogs()).rejects.toThrow('Failed to get catalogs')
    })
  })

  describe('getPriceLists', () => {
    it('should fetch price lists', async () => {
      const mockPriceLists = [
        {
          id: 1,
          name: 'B2B Price List',
          currency: 'USD'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ price_lists: mockPriceLists }),
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getPriceLists()

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/price_lists.json'
      )

      expect(result).toEqual({
        price_lists: mockPriceLists,
        hasNextPage: false,
        nextPageInfo: undefined
      })
    })
  })

  describe('createOrUpdateProduct', () => {
    it('should create new product', async () => {
      const productData = {
        title: 'New Product',
        body_html: '<p>Product description</p>',
        vendor: 'Test Vendor'
      }

      const mockProduct = {
        id: 1,
        ...productData
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ product: mockProduct })
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.createOrUpdateProduct(productData)

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'POST',
        '/admin/api/2024-01/products.json',
        { product: productData }
      )

      expect(result).toEqual(mockProduct)
    })

    it('should update existing product', async () => {
      const productData = {
        id: 1,
        title: 'Updated Product',
        body_html: '<p>Updated description</p>'
      }

      const mockProduct = {
        id: 1,
        title: 'Updated Product',
        body_html: '<p>Updated description</p>'
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ product: mockProduct })
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.createOrUpdateProduct(productData)

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'PUT',
        '/admin/api/2024-01/products/1.json',
        { product: productData }
      )

      expect(result).toEqual(mockProduct)
    })
  })

  describe('deleteProduct', () => {
    it('should delete product', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await client.deleteProduct('1')

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'DELETE',
        '/admin/api/2024-01/products/1.json'
      )
    })

    it('should throw error when delete fails', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await expect(client.deleteProduct('999')).rejects.toThrow('Failed to delete product 999')
    })
  })

  describe('getWebhooks', () => {
    it('should fetch webhooks', async () => {
      const mockWebhooks = [
        {
          id: 1,
          topic: 'products/create',
          address: 'https://example.com/webhook'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ webhooks: mockWebhooks }),
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.getWebhooks()

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'GET',
        '/admin/api/2024-01/webhooks.json'
      )

      expect(result).toEqual({
        webhooks: mockWebhooks,
        hasNextPage: false,
        nextPageInfo: undefined
      })
    })
  })

  describe('createWebhook', () => {
    it('should create webhook', async () => {
      const webhookData = {
        topic: 'products/create',
        address: 'https://example.com/webhook',
        format: 'json'
      }

      const mockWebhook = {
        id: 1,
        ...webhookData
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ webhook: mockWebhook })
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      const result = await client.createWebhook(webhookData)

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'POST',
        '/admin/api/2024-01/webhooks.json',
        { webhook: webhookData }
      )

      expect(result).toEqual(mockWebhook)
    })
  })

  describe('deleteWebhook', () => {
    it('should delete webhook', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      }

      mockAuth.makeRequest.mockResolvedValue(mockResponse)

      await client.deleteWebhook('1')

      expect(mockAuth.makeRequest).toHaveBeenCalledWith(
        'DELETE',
        '/admin/api/2024-01/webhooks/1.json'
      )
    })
  })
})