import { 
  withCache, 
  invalidateCache, 
  batchGetCache, 
  batchSetCache,
  cacheKey,
  CACHE_TTL,
  CACHE_PREFIX
} from '@/lib/cache/redis-client'
import { Redis } from '@upstash/redis'

// Mock Upstash Redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
    pipeline: jest.fn(),
    scan: jest.fn(),
  }))
}))

describe('Redis Cache Client', () => {
  let mockRedis: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockRedis = new Redis()
    
    // Setup environment variables
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
  })

  describe('withCache', () => {
    it('should return cached value on cache hit', async () => {
      const cachedData = { id: 1, name: 'Test Product' }
      mockRedis.get.mockResolvedValue(cachedData)

      const fetcher = jest.fn()
      const result = await withCache('test-key', fetcher)

      expect(result).toEqual(cachedData)
      expect(fetcher).not.toHaveBeenCalled()
      expect(mockRedis.get).toHaveBeenCalledWith('test-key')
    })

    it('should call fetcher and cache result on cache miss', async () => {
      const freshData = { id: 1, name: 'Fresh Product' }
      mockRedis.get.mockResolvedValue(null)
      
      const fetcher = jest.fn().mockResolvedValue(freshData)
      const result = await withCache('test-key', fetcher, CACHE_TTL.MEDIUM)

      expect(result).toEqual(freshData)
      expect(fetcher).toHaveBeenCalled()
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        CACHE_TTL.MEDIUM,
        JSON.stringify(freshData)
      )
    })

    it('should handle cache errors gracefully', async () => {
      const freshData = { id: 1, name: 'Fresh Product' }
      mockRedis.get.mockRejectedValue(new Error('Redis error'))
      
      const fetcher = jest.fn().mockResolvedValue(freshData)
      const result = await withCache('test-key', fetcher)

      expect(result).toEqual(freshData)
      expect(fetcher).toHaveBeenCalled()
    })

    it('should work without Redis when not configured', async () => {
      // Remove Redis config
      delete process.env.UPSTASH_REDIS_REST_URL
      
      const freshData = { id: 1, name: 'Fresh Product' }
      const fetcher = jest.fn().mockResolvedValue(freshData)
      
      const result = await withCache('test-key', fetcher)

      expect(result).toEqual(freshData)
      expect(fetcher).toHaveBeenCalled()
      expect(mockRedis.get).not.toHaveBeenCalled()
    })
  })

  describe('invalidateCache', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.scan.mockResolvedValueOnce([5, ['key1', 'key2']])
      mockRedis.scan.mockResolvedValueOnce([0, ['key3']])

      await invalidateCache('products:*')

      expect(mockRedis.scan).toHaveBeenCalledTimes(2)
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3')
    })

    it('should handle empty results', async () => {
      mockRedis.scan.mockResolvedValue([0, []])

      await invalidateCache('nonexistent:*')

      expect(mockRedis.scan).toHaveBeenCalled()
      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })

  describe('batchGetCache', () => {
    it('should return cached values for multiple keys', async () => {
      const values = [
        { id: 1, name: 'Product 1' },
        null,
        { id: 3, name: 'Product 3' }
      ]
      mockRedis.mget.mockResolvedValue(values)

      const result = await batchGetCache(['key1', 'key2', 'key3'])

      expect(result).toEqual(values)
      expect(mockRedis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3')
    })

    it('should return null array for empty keys', async () => {
      const result = await batchGetCache([])

      expect(result).toEqual([])
      expect(mockRedis.mget).not.toHaveBeenCalled()
    })
  })

  describe('batchSetCache', () => {
    it('should set multiple cache entries', async () => {
      const pipeline = {
        setex: jest.fn(),
        exec: jest.fn().mockResolvedValue([])
      }
      mockRedis.pipeline.mockReturnValue(pipeline)

      const items = [
        { key: 'key1', value: { id: 1 }, ttl: 300 },
        { key: 'key2', value: { id: 2 } },
      ]

      await batchSetCache(items)

      expect(pipeline.setex).toHaveBeenCalledWith('key1', 300, JSON.stringify({ id: 1 }))
      expect(pipeline.setex).toHaveBeenCalledWith('key2', CACHE_TTL.MEDIUM, JSON.stringify({ id: 2 }))
      expect(pipeline.exec).toHaveBeenCalled()
    })
  })

  describe('cacheKey', () => {
    it('should generate proper cache keys', () => {
      expect(cacheKey('PRODUCTS', 'org-123', 'list')).toBe('products:org-123:list')
      expect(cacheKey('INVENTORY', 'org-456', 'product', '789')).toBe('inventory:org-456:product:789')
    })
  })
})