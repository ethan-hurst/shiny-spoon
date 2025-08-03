import type { RateLimiter } from '@/lib/integrations/base-connector'
import { ShopifyApiClient } from '@/lib/integrations/shopify/api-client'
import { ShopifyAPIError, ShopifyRateLimitError } from '@/types/shopify.types'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock AbortController
const mockAbortController = {
  abort: jest.fn(),
  signal: {},
}
global.AbortController = jest.fn(() => mockAbortController) as any

describe('ShopifyApiClient', () => {
  let apiClient: ShopifyApiClient
  let mockRateLimiter: jest.Mocked<RateLimiter>

  const config = {
    shop: 'test-shop.myshopify.com',
    accessToken: 'test-access-token',
    apiVersion: '2023-10',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Mock Rate Limiter
    mockRateLimiter = {
      acquire: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      waitForAvailability: jest.fn().mockResolvedValue(undefined),
      getQueueLength: jest.fn().mockReturnValue(0),
    }

    // Create API client instance
    apiClient = new ShopifyApiClient({
      ...config,
      rateLimiter: mockRateLimiter,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('constructor', () => {
    it('should initialize with correct endpoint and headers', () => {
      expect(apiClient['endpoint']).toBe(
        `https://${config.shop}/admin/api/${config.apiVersion}/graphql.json`
      )
      expect(apiClient['headers']).toEqual({
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      })
    })

    it('should work without rate limiter', () => {
      const clientWithoutRateLimit = new ShopifyApiClient(config)
      expect(clientWithoutRateLimit).toBeInstanceOf(ShopifyApiClient)
    })
  })

  describe('query', () => {
    const mockGraphQLResponse = {
      data: {
        products: {
          edges: [
            { node: { id: '1', title: 'Product 1' } },
            { node: { id: '2', title: 'Product 2' } },
          ],
        },
      },
      extensions: {
        cost: {
          actualQueryCost: 5,
          throttleStatus: {
            maximumAvailable: 1000,
            currentlyAvailable: 995,
          },
        },
      },
    }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockGraphQLResponse),
        headers: new Map(),
      })
    })

    it('should execute GraphQL query successfully', async () => {
      const query = `
        {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `
      const variables = { first: 10 }

      const result = await apiClient.query(query, variables)

      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(expect.any(Number))
      expect(mockRateLimiter.release).toHaveBeenCalledWith(expect.any(Number))

      expect(mockFetch).toHaveBeenCalledWith(
        `https://${config.shop}/admin/api/${config.apiVersion}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': config.accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
          signal: mockAbortController.signal,
        }
      )

      expect(result).toEqual(mockGraphQLResponse)
    })

    it('should estimate query cost correctly', async () => {
      const query = `
        {
          products(first: 50) {
            edges {
              node {
                id
                title
                variants(first: 10) {
                  edges {
                    node {
                      id
                      sku
                    }
                  }
                }
              }
            }
          }
        }
      `

      await apiClient.query(query)

      // Should acquire tokens based on estimated cost
      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(expect.any(Number))
      const estimatedCost = mockRateLimiter.acquire.mock.calls[0][0]
      expect(estimatedCost).toBeGreaterThan(1)
    })

    it('should update API call limits from response', async () => {
      await apiClient.query('{ shop { name } }')

      const limits = apiClient.getApiCallLimits()
      expect(limits.used).toBe(5) // From mockGraphQLResponse
      expect(limits.limit).toBe(1000)
      expect(limits.available).toBe(995)
    })

    it('should handle rate limiting errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '120']]),
        json: jest.fn().mockResolvedValue({}),
      })

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow(
        ShopifyRateLimitError
      )
    })

    it('should handle GraphQL errors', async () => {
      const errorResponse = {
        data: null,
        errors: [
          {
            message: 'Field "invalidField" doesn\'t exist on type "Shop"',
            extensions: {
              code: 'BAD_USER_INPUT',
            },
          },
        ],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(errorResponse),
      })

      await expect(
        apiClient.query('{ shop { invalidField } }')
      ).rejects.toThrow(ShopifyAPIError)
    })

    it('should handle throttling errors', async () => {
      const throttleResponse = {
        data: null,
        errors: [
          {
            message: 'Throttled',
            extensions: {
              code: 'THROTTLED',
            },
          },
        ],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(throttleResponse),
      })

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow(
        ShopifyRateLimitError
      )
    })

    it('should handle timeout errors', async () => {
      // Mock fetch to immediately reject with AbortError to simulate timeout
      mockFetch.mockImplementation(() => {
        return Promise.reject(new Error('Timeout'))
      })

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow(
        ShopifyAPIError
      )
    }, 10000) // Reasonable timeout

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection failed'))

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow(
        ShopifyAPIError
      )
    })

    it('should work without rate limiter', async () => {
      const clientWithoutRateLimit = new ShopifyApiClient(config)

      const result = await clientWithoutRateLimit.query('{ shop { name } }')

      expect(result).toEqual(mockGraphQLResponse)
    })

    it('should not release tokens on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow()

      expect(mockRateLimiter.acquire).toHaveBeenCalled()
      expect(mockRateLimiter.release).not.toHaveBeenCalled()
    })
  })

  describe('mutation', () => {
    it('should execute GraphQL mutation', async () => {
      const mockMutationResponse = {
        data: {
          productCreate: {
            product: {
              id: 'gid://shopify/Product/123',
              title: 'New Product',
            },
            userErrors: [],
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockMutationResponse),
      })

      const mutation = `
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `
      const variables = {
        input: {
          title: 'New Product',
          productType: 'Widget',
        },
      }

      const result = await apiClient.mutation(mutation, variables)

      expect(result).toEqual(mockMutationResponse)
    })
  })

  describe('bulkOperation', () => {
    it('should start bulk operation successfully', async () => {
      const mockBulkResponse = {
        data: {
          bulkOperationRunQuery: {
            bulkOperation: {
              id: 'gid://shopify/BulkOperation/123',
              status: 'CREATED',
              errorCode: null,
              createdAt: '2023-01-01T00:00:00Z',
              url: null,
              partialDataUrl: null,
            },
            userErrors: [],
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockBulkResponse),
      })

      const query = `
        {
          products {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `

      const result = await apiClient.bulkOperation(query)

      expect(result).toEqual(
        mockBulkResponse.data.bulkOperationRunQuery.bulkOperation
      )
    })

    it('should handle bulk operation user errors', async () => {
      const mockErrorResponse = {
        data: {
          bulkOperationRunQuery: {
            bulkOperation: null,
            userErrors: [
              {
                field: ['query'],
                message: 'Invalid query syntax',
              },
            ],
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockErrorResponse),
      })

      await expect(apiClient.bulkOperation('invalid query')).rejects.toThrow(
        ShopifyAPIError
      )
    })

    it('should handle missing data response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: null }),
      })

      await expect(apiClient.bulkOperation('{ products }')).rejects.toThrow(
        ShopifyAPIError
      )
    })
  })

  describe('getBulkOperationStatus', () => {
    it('should get bulk operation status successfully', async () => {
      const mockStatusResponse = {
        data: {
          node: {
            id: 'gid://shopify/BulkOperation/123',
            status: 'COMPLETED',
            errorCode: null,
            createdAt: '2023-01-01T00:00:00Z',
            completedAt: '2023-01-01T00:05:00Z',
            url: 'https://example.com/bulk-data.jsonl',
            partialDataUrl: null,
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockStatusResponse),
      })

      const result = await apiClient.getBulkOperationStatus(
        'gid://shopify/BulkOperation/123'
      )

      expect(result).toEqual(mockStatusResponse.data.node)
    })

    it('should handle bulk operation not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: { node: null } }),
      })

      await expect(
        apiClient.getBulkOperationStatus('gid://shopify/BulkOperation/999')
      ).rejects.toThrow(ShopifyAPIError)
    })
  })

  describe('cancelBulkOperation', () => {
    it('should cancel bulk operation successfully', async () => {
      const mockCancelResponse = {
        data: {
          bulkOperationCancel: {
            bulkOperation: {
              id: 'gid://shopify/BulkOperation/123',
              status: 'CANCELED',
            },
            userErrors: [],
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockCancelResponse),
      })

      await apiClient.cancelBulkOperation('gid://shopify/BulkOperation/123')

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle cancel bulk operation errors', async () => {
      const mockErrorResponse = {
        data: {
          bulkOperationCancel: {
            bulkOperation: null,
            userErrors: [
              {
                field: ['id'],
                message: 'Bulk operation cannot be canceled',
              },
            ],
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockErrorResponse),
      })

      await expect(
        apiClient.cancelBulkOperation('gid://shopify/BulkOperation/123')
      ).rejects.toThrow(ShopifyAPIError)
    })
  })

  describe('getApiCallLimits', () => {
    it('should return initial API call limits', () => {
      const limits = apiClient.getApiCallLimits()

      expect(limits).toEqual({
        used: 0,
        limit: 1000,
        available: 1000,
      })
    })

    it('should update limits after API calls', async () => {
      const mockResponse = {
        data: { shop: { name: 'Test Shop' } },
        extensions: {
          cost: {
            actualQueryCost: 15,
            throttleStatus: {
              maximumAvailable: 1000,
              currentlyAvailable: 985,
            },
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      })

      await apiClient.query('{ shop { name } }')

      const limits = apiClient.getApiCallLimits()
      expect(limits).toEqual({
        used: 15,
        limit: 1000,
        available: 985,
      })
    })
  })

  describe('estimateQueryCost', () => {
    it('should estimate basic query cost', () => {
      const cost = apiClient['estimateQueryCost']('{ shop { name } }')
      expect(cost).toBe(2) // Base cost + field count
    })

    it('should estimate cost with connections', () => {
      const query = `
        {
          products(first: 100) {
            edges {
              node {
                id
                variants(first: 50) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      `
      const cost = apiClient['estimateQueryCost'](query)
      expect(cost).toBeGreaterThan(1)
    })

    it('should estimate higher cost for mutations', () => {
      const mutation = `
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
            }
          }
        }
      `
      const cost = apiClient['estimateQueryCost'](mutation)
      expect(cost).toBeGreaterThan(10) // Mutations cost more
    })

    it('should return minimum cost of 1', () => {
      const cost = apiClient['estimateQueryCost']('')
      expect(cost).toBe(1)
    })
  })

  describe('mapErrorCodeToStatus', () => {
    it('should map known error codes to status codes', () => {
      expect(apiClient['mapErrorCodeToStatus']('THROTTLED')).toBe(429)
      expect(apiClient['mapErrorCodeToStatus']('ACCESS_DENIED')).toBe(403)
      expect(apiClient['mapErrorCodeToStatus']('NOT_FOUND')).toBe(404)
      expect(apiClient['mapErrorCodeToStatus']('INTERNAL_SERVER_ERROR')).toBe(
        500
      )
    })

    it('should return 400 for unknown error codes', () => {
      expect(apiClient['mapErrorCodeToStatus']('UNKNOWN_ERROR')).toBe(400)
    })
  })

  describe('static helper methods', () => {
    describe('buildProductQuery', () => {
      it('should build complete product query with metafields', () => {
        const query = ShopifyApiClient.buildProductQuery(true, 50)

        expect(query).toContain('id')
        expect(query).toContain('title')
        expect(query).toContain('variants(first: 50)')
        expect(query).toContain('metafields(namespace: "truthsource"')
      })

      it('should build product query without metafields', () => {
        const query = ShopifyApiClient.buildProductQuery(false)

        expect(query).toContain('id')
        expect(query).toContain('title')
        expect(query).not.toContain('metafields')
      })
    })

    describe('buildInventoryQuery', () => {
      it('should build complete inventory query', () => {
        const query = ShopifyApiClient.buildInventoryQuery()

        expect(query).toContain('id')
        expect(query).toContain('available')
        expect(query).toContain('item')
        expect(query).toContain('location')
      })
    })

    describe('buildCustomerQuery', () => {
      it('should build customer query with company', () => {
        const query = ShopifyApiClient.buildCustomerQuery(true)

        expect(query).toContain('id')
        expect(query).toContain('email')
        expect(query).toContain('addresses')
        expect(query).toContain('company')
      })

      it('should build customer query without company', () => {
        const query = ShopifyApiClient.buildCustomerQuery(false)

        expect(query).toContain('id')
        expect(query).toContain('email')
        expect(query).not.toContain('company')
      })
    })
  })

  describe('error handling', () => {
    it('should preserve ShopifyAPIError instances', async () => {
      const customError = new ShopifyAPIError('Custom error', 'CUSTOM_ERROR')
      mockFetch.mockRejectedValue(customError)

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow(
        customError
      )
    })

    it('should handle generic errors', async () => {
      mockFetch.mockRejectedValue(new Error('Generic error'))

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow(
        ShopifyAPIError
      )
    })

    it('should handle unknown error types', async () => {
      mockFetch.mockRejectedValue('String error')

      await expect(apiClient.query('{ shop { name } }')).rejects.toThrow(
        ShopifyAPIError
      )
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should handle complete bulk operation workflow', async () => {
      // Mock bulk operation start
      const mockBulkStartResponse = {
        data: {
          bulkOperationRunQuery: {
            bulkOperation: {
              id: 'gid://shopify/BulkOperation/123',
              status: 'CREATED',
              errorCode: null,
              createdAt: '2023-01-01T00:00:00Z',
              url: null,
              partialDataUrl: null,
            },
            userErrors: [],
          },
        },
      }

      // Mock bulk operation status
      const mockStatusResponse = {
        data: {
          node: {
            id: 'gid://shopify/BulkOperation/123',
            status: 'COMPLETED',
            errorCode: null,
            createdAt: '2023-01-01T00:00:00Z',
            completedAt: '2023-01-01T00:05:00Z',
            url: 'https://example.com/bulk-data.jsonl',
            partialDataUrl: null,
          },
        },
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockBulkStartResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockStatusResponse),
        })

      // Start bulk operation
      const bulkOp = await apiClient.bulkOperation(
        '{ products { edges { node { id } } } }'
      )
      expect(bulkOp.status).toBe('CREATED')

      // Check status
      const status = await apiClient.getBulkOperationStatus(bulkOp.id)
      expect(status.status).toBe('COMPLETED')
      expect(status.url).toBeTruthy()
    })

    it('should handle rate limiting throughout workflow', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: { shop: { name: 'Test' } },
          extensions: {
            cost: {
              actualQueryCost: 1,
              throttleStatus: { maximumAvailable: 1000 },
            },
          },
        }),
      })

      // Execute multiple queries
      await apiClient.query('{ shop { name } }')
      await apiClient.mutation(
        'mutation { productCreate(input: {}) { product { id } } }'
      )
      await apiClient.query('{ products(first: 10) { edges { node { id } } } }')

      // Should have acquired and released tokens for each call
      expect(mockRateLimiter.acquire).toHaveBeenCalledTimes(3)
      expect(mockRateLimiter.release).toHaveBeenCalledTimes(3)
    })
  })
})
