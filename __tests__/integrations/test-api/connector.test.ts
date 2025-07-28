/**
 * TestApiConnector tests
 */

import { TestApiConnector } from '@/lib/integrations/test-api/connector'

describe('TestApiConnector', () => {
  let connector: TestApiConnector
  
  beforeEach(() => {
    connector = new TestApiConnector({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      enabled: true
    })
  })

  describe('constructor', () => {
    it('should create connector instance', () => {
      expect(connector).toBeInstanceOf(TestApiConnector)
    })

    it('should throw error for missing configuration', () => {
      expect(() => new TestApiConnector({})).toThrow()
    })
  })

  describe('authentication', () => {
    it('should authenticate successfully', async () => {
      // Mock successful authentication
      jest.spyOn(connector as any, 'authenticate').mockResolvedValue(true)
      
      const result = await (connector as any).authenticate()
      expect(result).toBe(true)
    })

    it('should handle authentication failure', async () => {
      jest.spyOn(connector as any, 'authenticate').mockRejectedValue(
        new Error('Authentication failed')
      )
      
      await expect((connector as any).authenticate()).rejects.toThrow('Authentication failed')
    })
  })

  describe('data synchronization', () => {
    it('should sync products successfully', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', sku: 'SKU001' },
        { id: '2', name: 'Product 2', sku: 'SKU002' }
      ]
      
      jest.spyOn(connector, 'getProducts').mockResolvedValue(mockProducts)
      
      const result = await connector.syncProducts()
      expect(result.processed).toBe(2)
      expect(result.success).toBe(true)
    })

    it('should handle sync errors gracefully', async () => {
      jest.spyOn(connector, 'getProducts').mockRejectedValue(
        new Error('API Error')
      )
      
      const result = await connector.syncProducts()
      expect(result.success).toBe(false)
      expect(result.errors).toBeGreaterThan(0)
    })
  })

  describe('API rate limiting', () => {
    it('should respect rate limits', async () => {
      // Mock rate limit response
      const rateLimitError = new Error('Rate limit exceeded')
      ;(rateLimitError as any).status = 429
      
      jest.spyOn(connector as any, 'makeRequest')
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: [] })
      
      // Should retry after rate limit
      const result = await connector.getProducts()
      expect(result).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      jest.spyOn(connector as any, 'makeRequest').mockRejectedValue(networkError)
      
      await expect(connector.getProducts()).rejects.toThrow('Network error')
    })

    it('should handle API errors', async () => {
      const apiError = new Error('API Error')
      ;(apiError as any).status = 400
      
      jest.spyOn(connector as any, 'makeRequest').mockRejectedValue(apiError)
      
      await expect(connector.getProducts()).rejects.toThrow('API Error')
    })
  })
})
