import { NetSuiteApiClient } from '@/lib/integrations/netsuite/api-client'
import { NetSuiteAuth } from '@/lib/integrations/netsuite/auth'
import {
  IntegrationError,
  RateLimitError,
  AuthenticationError
} from '@/types/integration.types'
import type { RateLimiter } from '@/lib/integrations/base-connector'

// Mock dependencies
jest.mock('@/lib/integrations/netsuite/auth')
jest.mock('node-fetch', () => jest.fn())

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('NetSuiteApiClient', () => {
  let apiClient: NetSuiteApiClient
  let mockAuth: jest.Mocked<NetSuiteAuth>
  let mockRateLimiter: jest.Mocked<RateLimiter>
  
  const datacenterUrl = 'https://1234567.suitetalk.api.netsuite.com'
  const validToken = 'valid-access-token'

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock NetSuite Auth
    mockAuth = {
      getValidAccessToken: jest.fn().mockResolvedValue(validToken),
      refreshToken: jest.fn(),
      isTokenValid: jest.fn(),
      revokeToken: jest.fn(),
      testConnection: jest.fn()
    } as any

    // Mock Rate Limiter
    mockRateLimiter = {
      acquire: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      waitForAvailability: jest.fn().mockResolvedValue(undefined),
      getQueueLength: jest.fn().mockReturnValue(0)
    }

    // Create API client instance
    apiClient = new NetSuiteApiClient(mockAuth, datacenterUrl, mockRateLimiter)
  })

  describe('constructor', () => {
    it('should initialize with correct URLs', () => {
      expect(apiClient['baseUrl']).toBe(`${datacenterUrl}/services/rest`)
      expect(apiClient['suiteQLUrl']).toBe(`${datacenterUrl}/services/rest/query/v1/suiteql`)
    })

    it('should work without rate limiter', () => {
      const clientWithoutRateLimit = new NetSuiteApiClient(mockAuth, datacenterUrl)
      expect(clientWithoutRateLimit).toBeInstanceOf(NetSuiteApiClient)
    })
  })

  describe('executeSuiteQL', () => {
    const mockSuiteQLResponse = {
      items: [
        { id: '1', name: 'Product 1' },
        { id: '2', name: 'Product 2' }
      ],
      hasMore: false,
      totalResults: 2
    }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSuiteQLResponse),
        status: 200,
        headers: new Map()
      })
    })

    it('should execute SuiteQL query successfully', async () => {
      const query = 'SELECT id, name FROM item WHERE itemtype = \'InvtPart\''
      
      const result = await apiClient.executeSuiteQL(query)

      expect(mockAuth.getValidAccessToken).toHaveBeenCalled()
      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(2)
      expect(mockRateLimiter.release).toHaveBeenCalledWith(2)
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${datacenterUrl}/services/rest/query/v1/suiteql`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Prefer': 'respond-async,wait=10'
          },
          body: JSON.stringify({ q: query })
        }
      )

      expect(result).toEqual({
        items: mockSuiteQLResponse.items,
        hasMore: false,
        totalResults: 2,
        links: undefined
      })
    })

    it('should add LIMIT clause when specified', async () => {
      const query = 'SELECT id, name FROM item'
      
      await apiClient.executeSuiteQL(query, { limit: 500 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: `${query} LIMIT 500` })
        })
      )
    })

    it('should add OFFSET clause when specified', async () => {
      const query = 'SELECT id, name FROM item'
      
      await apiClient.executeSuiteQL(query, { offset: 100 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: `${query} LIMIT 1000 OFFSET 100` })
        })
      )
    })

    it('should add both LIMIT and OFFSET clauses', async () => {
      const query = 'SELECT id, name FROM item'
      
      await apiClient.executeSuiteQL(query, { limit: 500, offset: 100 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: `${query} LIMIT 500 OFFSET 100` })
        })
      )
    })

    it('should not add LIMIT/OFFSET if already present in query', async () => {
      const query = 'SELECT id, name FROM item LIMIT 100 OFFSET 50'
      
      await apiClient.executeSuiteQL(query, { limit: 500, offset: 100 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: query })
        })
      )
    })

    it('should validate and clamp limit values', async () => {
      const query = 'SELECT id, name FROM item'
      
      // Test minimum limit
      await apiClient.executeSuiteQL(query, { limit: 0 })
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: `${query} LIMIT 1` })
        })
      )

      // Test maximum limit
      await apiClient.executeSuiteQL(query, { limit: 20000 })
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: `${query} LIMIT 10000` })
        })
      )
    })

    it('should validate and clamp offset values', async () => {
      const query = 'SELECT id, name FROM item'
      
      await apiClient.executeSuiteQL(query, { offset: -100 })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: `${query} LIMIT 1000 OFFSET 0` })
        })
      )
    })

    it('should use stream mode when specified', async () => {
      const query = 'SELECT id, name FROM item'
      
      await apiClient.executeSuiteQL(query, { preferQueryMode: 'stream' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Prefer': 'transient'
          })
        })
      )
    })

    it('should detect hasMore from result count', async () => {
      const mockResponseWithLimit = {
        items: new Array(100).fill({ id: '1', name: 'Product' }),
        hasMore: false
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponseWithLimit)
      })

      const result = await apiClient.executeSuiteQL('SELECT * FROM item', { limit: 100 })

      expect(result.hasMore).toBe(true) // Should be true because items.length === limit
    })

    it('should release rate limiter token on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(apiClient.executeSuiteQL('SELECT * FROM item')).rejects.toThrow()

      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(2)
      expect(mockRateLimiter.release).toHaveBeenCalledWith(2)
    })

    it('should work without rate limiter', async () => {
      const clientWithoutRateLimit = new NetSuiteApiClient(mockAuth, datacenterUrl)
      
      const result = await clientWithoutRateLimit.executeSuiteQL('SELECT * FROM item')

      expect(result).toEqual(expect.objectContaining({
        items: mockSuiteQLResponse.items
      }))
    })
  })

  describe('getRecord', () => {
    const mockRecord = { id: '123', name: 'Test Item' }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRecord)
      })
    })

    it('should get record successfully', async () => {
      const result = await apiClient.getRecord('item', '123')

      expect(mockAuth.getValidAccessToken).toHaveBeenCalled()
      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(1)
      expect(mockRateLimiter.release).toHaveBeenCalledWith(1)

      expect(mockFetch).toHaveBeenCalledWith(
        `${datacenterUrl}/services/rest/record/v1/item/123`,
        {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Accept': 'application/json'
          }
        }
      )

      expect(result).toEqual(mockRecord)
    })

    it('should release rate limiter token on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(apiClient.getRecord('item', '123')).rejects.toThrow()

      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(1)
      expect(mockRateLimiter.release).toHaveBeenCalledWith(1)
    })
  })

  describe('createRecord', () => {
    const mockCreateData = { name: 'New Item', itemtype: 'InvtPart' }
    const mockCreatedRecord = { id: '456', ...mockCreateData }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCreatedRecord)
      })
    })

    it('should create record successfully', async () => {
      const result = await apiClient.createRecord('item', mockCreateData)

      expect(mockFetch).toHaveBeenCalledWith(
        `${datacenterUrl}/services/rest/record/v1/item`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(mockCreateData)
        }
      )

      expect(result).toEqual(mockCreatedRecord)
    })
  })

  describe('updateRecord', () => {
    const mockUpdateData = { name: 'Updated Item' }
    const mockUpdatedRecord = { id: '123', ...mockUpdateData }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUpdatedRecord)
      })
    })

    it('should update record successfully', async () => {
      const result = await apiClient.updateRecord('item', '123', mockUpdateData)

      expect(mockFetch).toHaveBeenCalledWith(
        `${datacenterUrl}/services/rest/record/v1/item/123`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(mockUpdateData)
        }
      )

      expect(result).toEqual(mockUpdatedRecord)
    })
  })

  describe('deleteRecord', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({})
      })
    })

    it('should delete record successfully', async () => {
      await apiClient.deleteRecord('item', '123')

      expect(mockFetch).toHaveBeenCalledWith(
        `${datacenterUrl}/services/rest/record/v1/item/123`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Accept': 'application/json'
          }
        }
      )
    })
  })

  describe('executeBatchSuiteQL', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          items: [{ id: '1' }],
          hasMore: false
        })
      })
    })

    it('should execute batch queries sequentially', async () => {
      const queries = [
        'SELECT id FROM item WHERE id = 1',
        'SELECT id FROM item WHERE id = 2'
      ]

      const results = await apiClient.executeBatchSuiteQL(queries)

      expect(results).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getRecordMetadata', () => {
    const mockMetadata = { fields: [], recordType: 'item' }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockMetadata)
      })
    })

    it('should get record metadata successfully', async () => {
      const result = await apiClient.getRecordMetadata('item')

      expect(mockFetch).toHaveBeenCalledWith(
        `${datacenterUrl}/services/rest/metadata-catalog/record/item`,
        {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Accept': 'application/json'
          }
        }
      )

      expect(result).toEqual(mockMetadata)
    })
  })

  describe('searchRecords', () => {
    const mockSearchResponse = {
      items: [{ id: '1', name: 'Item 1' }],
      hasMore: false
    }

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResponse)
      })
    })

    it('should build and execute search query', async () => {
      const conditions = {
        itemtype: 'InvtPart',
        inactive: false,
        id: 123
      }

      const result = await apiClient.searchRecords('item', conditions, {
        select: ['id', 'itemid', 'displayname'],
        orderBy: 'itemid',
        limit: 100,
        offset: 50
      })

      const expectedQuery = "SELECT id, itemid, displayname FROM item WHERE itemtype = 'InvtPart' AND inactive = 'F' AND id = 123 ORDER BY itemid LIMIT 100 OFFSET 50"
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: expectedQuery })
        })
      )

      expect(result).toEqual(mockSearchResponse)
    })

    it('should handle different value types in conditions', async () => {
      const conditions = {
        name: 'Test Item',
        price: 99.99,
        active: true,
        category: null,
        ids: [1, 2, 3]
      }

      await apiClient.searchRecords('item', conditions)

      const expectedQuery = "SELECT * FROM item WHERE name = 'Test Item' AND price = 99.99 AND active = 'T' AND category IS NULL AND ids IN (1, 2, 3)"
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: expectedQuery })
        })
      )
    })

    it('should handle string array conditions', async () => {
      const conditions = {
        types: ['A', 'B', 'C']
      }

      await apiClient.searchRecords('item', conditions)

      const expectedQuery = "SELECT * FROM item WHERE types IN ('A', 'B', 'C')"
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: expectedQuery })
        })
      )
    })

    it('should escape single quotes in string values', async () => {
      const conditions = {
        name: "O'Reilly's Item"
      }

      await apiClient.searchRecords('item', conditions)

      const expectedQuery = "SELECT * FROM item WHERE name = 'O''Reilly''s Item'"
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ q: expectedQuery })
        })
      )
    })

    it('should validate table and field identifiers', async () => {
      await expect(
        apiClient.searchRecords('invalid-table!', {})
      ).rejects.toThrow(IntegrationError)

      await expect(
        apiClient.searchRecords('item', { 'invalid-field!': 'value' })
      ).rejects.toThrow(IntegrationError)
    })

    it('should reject empty arrays in conditions', async () => {
      const conditions = {
        ids: []
      }

      await expect(
        apiClient.searchRecords('item', conditions)
      ).rejects.toThrow(IntegrationError)
    })

    it('should reject undefined values in conditions', async () => {
      const conditions = {
        name: undefined
      }

      await expect(
        apiClient.searchRecords('item', conditions)
      ).rejects.toThrow(IntegrationError)
    })

    it('should reject unsupported data types in conditions', async () => {
      const conditions = {
        data: { nested: 'object' }
      }

      await expect(
        apiClient.searchRecords('item', conditions)
      ).rejects.toThrow(IntegrationError)
    })

    it('should reject unsupported array element types', async () => {
      const conditions = {
        data: [{ id: 1 }, { id: 2 }]
      }

      await expect(
        apiClient.searchRecords('item', conditions)
      ).rejects.toThrow(IntegrationError)
    })
  })

  describe('handleApiError', () => {
    it('should handle rate limit errors', async () => {
      const errorResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['Retry-After', '120']]),
        json: jest.fn().mockResolvedValue({
          title: 'Rate limit exceeded',
          detail: 'Too many requests'
        })
      }

      mockFetch.mockResolvedValue(errorResponse)

      await expect(apiClient.getRecord('item', '123')).rejects.toThrow(RateLimitError)
    })

    it('should handle authentication errors', async () => {
      const errorResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({
          title: 'Authentication failed',
          detail: 'Invalid access token'
        })
      }

      mockFetch.mockResolvedValue(errorResponse)

      await expect(apiClient.getRecord('item', '123')).rejects.toThrow(AuthenticationError)
    })

    it('should handle generic API errors', async () => {
      const errorResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({
          title: 'Invalid request',
          detail: 'Missing required field',
          'o:errorCode': 'INVALID_REQUEST'
        })
      }

      mockFetch.mockResolvedValue(errorResponse)

      await expect(apiClient.getRecord('item', '123')).rejects.toThrow(IntegrationError)
    })

    it('should handle errors with malformed JSON', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      }

      mockFetch.mockResolvedValue(errorResponse)

      await expect(apiClient.getRecord('item', '123')).rejects.toThrow(IntegrationError)
    })

    it('should mark server errors as retryable', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({})
      }

      mockFetch.mockResolvedValue(errorResponse)

      try {
        await apiClient.getRecord('item', '123')
      } catch (error) {
        expect(error).toBeInstanceOf(IntegrationError)
        expect((error as IntegrationError).retryable).toBe(true)
      }
    })
  })

  describe('iterateSuiteQLResults', () => {
    it('should iterate through paginated results', async () => {
      const mockResponses = [
        {
          items: [{ id: '1' }, { id: '2' }],
          hasMore: true
        },
        {
          items: [{ id: '3' }, { id: '4' }],
          hasMore: false
        }
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponses[0])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponses[1])
        })

      const batches: any[][] = []
      for await (const batch of apiClient.iterateSuiteQLResults('SELECT * FROM item', { pageSize: 2 })) {
        batches.push(batch)
      }

      expect(batches).toHaveLength(2)
      expect(batches[0]).toEqual([{ id: '1' }, { id: '2' }])
      expect(batches[1]).toEqual([{ id: '3' }, { id: '4' }])
    })

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          items: [],
          hasMore: false
        })
      })

      const batches: any[][] = []
      for await (const batch of apiClient.iterateSuiteQLResults('SELECT * FROM item')) {
        batches.push(batch)
      }

      expect(batches).toHaveLength(0)
    })
  })

  describe('getAllSuiteQLResults', () => {
    it('should get all results from multiple pages', async () => {
      const mockResponses = [
        {
          items: [{ id: '1' }, { id: '2' }],
          hasMore: true
        },
        {
          items: [{ id: '3' }],
          hasMore: false
        }
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponses[0])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponses[1])
        })

      const results = await apiClient.getAllSuiteQLResults('SELECT * FROM item')

      expect(results).toEqual([
        { id: '1' },
        { id: '2' },
        { id: '3' }
      ])
    })

    it('should respect maxResults limit', async () => {
      const mockResponse = {
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        hasMore: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      })

      const results = await apiClient.getAllSuiteQLResults('SELECT * FROM item', { maxResults: 2 })

      expect(results).toHaveLength(2)
      expect(results).toEqual([{ id: '1' }, { id: '2' }])
    })
  })

  describe('validateIdentifier', () => {
    it('should accept valid identifiers', () => {
      const validIdentifiers = [
        'item',
        'item_table',
        'Item123',
        '_private',
        'table.column',
        'schema.table'
      ]

      validIdentifiers.forEach(identifier => {
        expect(() => apiClient['validateIdentifier'](identifier)).not.toThrow()
      })
    })

    it('should reject invalid identifiers', () => {
      const invalidIdentifiers = [
        'item-table', // Hyphen not allowed
        '123item', // Cannot start with number
        'item!', // Special characters not allowed
        'item table', // Spaces not allowed
        'item..column', // Double dots not allowed
        '.item', // Cannot start with dot
        '' // Empty string
      ]

      invalidIdentifiers.forEach(identifier => {
        expect(() => apiClient['validateIdentifier'](identifier)).toThrow(IntegrationError)
      })
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should handle complete CRUD workflow', async () => {
      // Mock successful responses for each operation
      const mockCreateResponse = { id: '123', name: 'Test Item' }
      const mockGetResponse = { id: '123', name: 'Test Item', status: 'active' }
      const mockUpdateResponse = { id: '123', name: 'Updated Item', status: 'active' }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockCreateResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockGetResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUpdateResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({})
        })

      // Create
      const created = await apiClient.createRecord('item', { name: 'Test Item' })
      expect(created.id).toBe('123')

      // Read
      const fetched = await apiClient.getRecord('item', '123')
      expect(fetched.status).toBe('active')

      // Update
      const updated = await apiClient.updateRecord('item', '123', { name: 'Updated Item' })
      expect(updated.name).toBe('Updated Item')

      // Delete
      await apiClient.deleteRecord('item', '123')

      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('should handle rate limiting throughout workflow', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ items: [], hasMore: false })
      })

      await apiClient.executeSuiteQL('SELECT * FROM item')
      await apiClient.getRecord('item', '123')
      await apiClient.createRecord('item', {})

      // SuiteQL should acquire 2 tokens, other operations should acquire 1 token each
      expect(mockRateLimiter.acquire).toHaveBeenCalledTimes(3)
      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(2) // SuiteQL
      expect(mockRateLimiter.acquire).toHaveBeenCalledWith(1) // GET and POST

      expect(mockRateLimiter.release).toHaveBeenCalledTimes(3)
    })
  })
})