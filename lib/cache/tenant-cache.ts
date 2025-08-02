import { redis, CACHE_TTL } from '@/lib/cache/redis-client'
import { getCurrentTenant } from '@/lib/queue/distributed-queue'

export interface TenantCacheOptions {
  ttl?: number
  namespace?: string
  isolated?: boolean // Whether cache should be tenant-specific
}

/**
 * Tenant-aware caching system
 * Provides cache isolation and tracking per tenant
 */
export class TenantCache {
  /**
   * Get value from cache with tenant isolation
   */
  async get<T>(
    key: string,
    options: TenantCacheOptions = {}
  ): Promise<T | null> {
    const tenantId = getCurrentTenant()
    const cacheKey = this.buildKey(key, tenantId, options)
    
    try {
      const cached = await redis?.get<T>(cacheKey)
      if (cached) {
        // Track cache hit rate per tenant
        await this.trackCacheMetric(tenantId, 'hit')
      } else {
        await this.trackCacheMetric(tenantId, 'miss')
      }
      return cached
    } catch (error) {
      console.error(`Cache get error for tenant ${tenantId}:`, error)
      return null
    }
  }

  /**
   * Set value in cache with tenant isolation
   */
  async set<T>(
    key: string,
    value: T,
    options: TenantCacheOptions = {}
  ): Promise<void> {
    const tenantId = getCurrentTenant()
    const cacheKey = this.buildKey(key, tenantId, options)
    const ttl = options.ttl || CACHE_TTL.MEDIUM
    
    try {
      await redis?.setex(cacheKey, ttl, JSON.stringify(value))
      await this.trackCacheMetric(tenantId, 'set')
    } catch (error) {
      console.error(`Cache set error for tenant ${tenantId}:`, error)
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: TenantCacheOptions = {}): Promise<void> {
    const tenantId = getCurrentTenant()
    const cacheKey = this.buildKey(key, tenantId, options)
    
    try {
      await redis?.del(cacheKey)
    } catch (error) {
      console.error(`Cache delete error for tenant ${tenantId}:`, error)
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string, options: TenantCacheOptions = {}): Promise<void> {
    const tenantId = getCurrentTenant()
    const searchPattern = this.buildKey(pattern, tenantId, options)
    
    try {
      if (!redis) return
      
      let cursor = 0
      const keysToDelete: string[] = []

      // Use SCAN to find matching keys
      do {
        const result = await redis.scan(cursor, {
          match: searchPattern,
          count: 100,
        })
        
        if (result) {
          cursor = result[0]
          keysToDelete.push(...result[1])
        }
      } while (cursor !== 0)

      // Delete keys in batches
      if (keysToDelete.length > 0) {
        const batchSize = 100
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize)
          await redis.del(...batch)
        }
        await this.trackCacheMetric(tenantId, 'invalidate', keysToDelete.length)
      }
    } catch (error) {
      console.error(`Cache invalidation error for tenant ${tenantId}:`, error)
    }
  }

  /**
   * Build cache key with tenant context
   */
  private buildKey(
    key: string,
    tenantId?: string,
    options: TenantCacheOptions = {}
  ): string {
    const parts: string[] = []
    
    if (options.namespace) {
      parts.push(options.namespace)
    }
    
    // Add tenant isolation by default unless explicitly disabled
    if (options.isolated !== false && tenantId) {
      parts.push(`tenant:${tenantId}`)
    }
    
    parts.push(key)
    
    return parts.join(':')
  }

  /**
   * Track cache metrics per tenant
   */
  private async trackCacheMetric(
    tenantId?: string,
    operation: 'hit' | 'miss' | 'set' | 'invalidate',
    count: number = 1
  ): Promise<void> {
    if (!tenantId || !redis) return
    
    const metric = `cache:${operation}:${tenantId}`
    const hour = new Date().getHours()
    const hourKey = `${metric}:${hour}`
    
    try {
      await redis.incrby(hourKey, count)
      await redis.expire(hourKey, 3600 * 24) // 24 hour retention
    } catch (error) {
      // Ignore metric tracking errors
    }
  }

  /**
   * Get cache statistics for a tenant
   */
  async getStats(tenantId: string): Promise<{
    hits: number
    misses: number
    sets: number
    invalidations: number
    hitRate: number
  }> {
    if (!redis) {
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        hitRate: 0,
      }
    }

    const hour = new Date().getHours()
    const keys = {
      hits: `cache:hit:${tenantId}:${hour}`,
      misses: `cache:miss:${tenantId}:${hour}`,
      sets: `cache:set:${tenantId}:${hour}`,
      invalidations: `cache:invalidate:${tenantId}:${hour}`,
    }

    const [hits, misses, sets, invalidations] = await Promise.all([
      redis.get<number>(keys.hits) || 0,
      redis.get<number>(keys.misses) || 0,
      redis.get<number>(keys.sets) || 0,
      redis.get<number>(keys.invalidations) || 0,
    ])

    const total = Number(hits) + Number(misses)
    const hitRate = total > 0 ? Number(hits) / total : 0

    return {
      hits: Number(hits),
      misses: Number(misses),
      sets: Number(sets),
      invalidations: Number(invalidations),
      hitRate,
    }
  }

  /**
   * Clear all cache for a tenant
   */
  async clearTenant(tenantId: string): Promise<void> {
    await this.invalidate('*', { isolated: true })
  }

  /**
   * Warm cache with preloaded data
   */
  async warm<T>(
    data: Record<string, T>,
    options: TenantCacheOptions = {}
  ): Promise<void> {
    const promises = Object.entries(data).map(([key, value]) =>
      this.set(key, value, options)
    )
    await Promise.all(promises)
  }
}

// Export singleton instance
export const tenantCache = new TenantCache()

// Convenience methods
export const getTenantCache = tenantCache.get.bind(tenantCache)
export const setTenantCache = tenantCache.set.bind(tenantCache)
export const invalidateTenantCache = tenantCache.invalidate.bind(tenantCache)