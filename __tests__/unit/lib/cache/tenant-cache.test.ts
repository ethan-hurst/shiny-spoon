import { TenantCache } from '@/lib/cache/tenant-cache'
import { redis } from '@/lib/cache/redis-client'
import * as distributedQueue from '@/lib/queue/distributed-queue'

// Mock dependencies
jest.mock('@/lib/cache/redis-client')
jest.mock('@/lib/queue/distributed-queue')

describe('TenantCache', () => {
  let tenantCache: TenantCache
  let mockRedis: any
  const testTenantId = 'test-tenant-123'

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock Redis client
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      incrby: jest.fn(),
      expire: jest.fn(),
    }
    
    ;(redis as any) = mockRedis
    
    // Mock getCurrentTenant
    jest.spyOn(distributedQueue, 'getCurrentTenant').mockReturnValue(testTenantId)
    
    tenantCache = new TenantCache()
  })

  describe('get', () => {
    it('should get value from cache with tenant isolation', async () => {
      const testData = { id: 1, name: 'Test Item' }
      mockRedis.get.mockResolvedValue(testData)

      const result = await tenantCache.get('test-key')

      expect(mockRedis.get).toHaveBeenCalledWith(`tenant:${testTenantId}:test-key`)
      expect(result).toEqual(testData)
    })

    it('should track cache hit', async () => {
      mockRedis.get.mockResolvedValue({ data: 'test' })

      await tenantCache.get('test-key')

      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringContaining(`cache:hit:${testTenantId}`),
        1
      )
    })

    it('should track cache miss', async () => {
      mockRedis.get.mockResolvedValue(null)

      await tenantCache.get('test-key')

      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringContaining(`cache:miss:${testTenantId}`),
        1
      )
    })

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'))

      const result = await tenantCache.get('test-key')

      expect(result).toBeNull()
    })

    it('should respect namespace option', async () => {
      await tenantCache.get('test-key', { namespace: 'products' })

      expect(mockRedis.get).toHaveBeenCalledWith(`products:tenant:${testTenantId}:test-key`)
    })

    it('should allow bypassing tenant isolation', async () => {
      await tenantCache.get('test-key', { isolated: false })

      expect(mockRedis.get).toHaveBeenCalledWith('test-key')
    })
  })

  describe('set', () => {
    it('should set value in cache with tenant isolation', async () => {
      const testData = { id: 1, name: 'Test Item' }
      
      await tenantCache.set('test-key', testData)

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `tenant:${testTenantId}:test-key`,
        300, // Default TTL
        JSON.stringify(testData)
      )
    })

    it('should use custom TTL', async () => {
      await tenantCache.set('test-key', 'value', { ttl: 3600 })

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `tenant:${testTenantId}:test-key`,
        3600,
        JSON.stringify('value')
      )
    })

    it('should track cache set operation', async () => {
      await tenantCache.set('test-key', 'value')

      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringContaining(`cache:set:${testTenantId}`),
        1
      )
    })
  })

  describe('delete', () => {
    it('should delete value from cache', async () => {
      await tenantCache.delete('test-key')

      expect(mockRedis.del).toHaveBeenCalledWith(`tenant:${testTenantId}:test-key`)
    })
  })

  describe('invalidate', () => {
    it('should invalidate cache by pattern', async () => {
      mockRedis.scan.mockResolvedValueOnce([100, ['key1', 'key2']])
        .mockResolvedValueOnce([0, ['key3']])

      await tenantCache.invalidate('test-*')

      expect(mockRedis.scan).toHaveBeenCalledWith(0, {
        match: `tenant:${testTenantId}:test-*`,
        count: 100,
      })
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2')
      expect(mockRedis.del).toHaveBeenCalledWith('key3')
    })

    it('should track invalidation operations', async () => {
      mockRedis.scan.mockResolvedValue([0, ['key1', 'key2', 'key3']])

      await tenantCache.invalidate('test-*')

      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringContaining(`cache:invalidate:${testTenantId}`),
        3
      )
    })

    it('should handle empty scan results', async () => {
      mockRedis.scan.mockResolvedValue([0, []])

      await tenantCache.invalidate('test-*')

      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('hit')) return 85
        if (key.includes('miss')) return 15
        if (key.includes('set')) return 100
        if (key.includes('invalidate')) return 5
        return 0
      })

      const stats = await tenantCache.getStats(testTenantId)

      expect(stats).toEqual({
        hits: 85,
        misses: 15,
        sets: 100,
        invalidations: 5,
        hitRate: 0.85,
      })
    })

    it('should handle missing Redis', async () => {
      ;(redis as any) = null
      tenantCache = new TenantCache()

      const stats = await tenantCache.getStats(testTenantId)

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        hitRate: 0,
      })
    })
  })

  describe('clearTenant', () => {
    it('should clear all cache for a tenant', async () => {
      mockRedis.scan.mockResolvedValue([0, ['key1', 'key2']])

      await tenantCache.clearTenant(testTenantId)

      expect(mockRedis.scan).toHaveBeenCalledWith(0, {
        match: `tenant:${testTenantId}:*`,
        count: 100,
      })
      expect(mockRedis.del).toHaveBeenCalled()
    })
  })

  describe('warm', () => {
    it('should warm cache with multiple values', async () => {
      const data = {
        'product:1': { id: 1, name: 'Product 1' },
        'product:2': { id: 2, name: 'Product 2' },
      }

      await tenantCache.warm(data)

      expect(mockRedis.setex).toHaveBeenCalledTimes(2)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `tenant:${testTenantId}:product:1`,
        300,
        JSON.stringify(data['product:1'])
      )
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `tenant:${testTenantId}:product:2`,
        300,
        JSON.stringify(data['product:2'])
      )
    })
  })

  describe('buildKey', () => {
    it('should build correct cache keys', () => {
      // Access private method for testing
      const buildKey = (tenantCache as any).buildKey.bind(tenantCache)

      // Default behavior
      expect(buildKey('test', 'tenant1')).toBe('tenant:tenant1:test')

      // With namespace
      expect(buildKey('test', 'tenant1', { namespace: 'products' }))
        .toBe('products:tenant:tenant1:test')

      // Without isolation
      expect(buildKey('test', 'tenant1', { isolated: false }))
        .toBe('test')

      // No tenant ID
      expect(buildKey('test', undefined)).toBe('test')
    })
  })
})