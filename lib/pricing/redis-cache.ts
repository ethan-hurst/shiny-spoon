import { Redis } from '@upstash/redis'

// Cache configuration
const CACHE_TTL = 300 // 5 minutes in seconds
const CACHE_PREFIX = 'pricing:'

// Initialize Redis client
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

// Helper to generate cache keys
export function generateCacheKey(
  productId: string,
  customerId?: string | null,
  quantity?: number,
  date?: string
): string {
  const parts = [CACHE_PREFIX, productId]
  if (customerId) parts.push(customerId)
  if (quantity) parts.push(quantity.toString())
  if (date) parts.push(date)
  return parts.join(':')
}

// Cache operations
export const pricingCache = {
  // Check if Redis is available
  isAvailable(): boolean {
    return redis !== null
  },

  // Get a cached price
  async get<T = any>(key: string): Promise<T | null> {
    if (!redis) return null
    
    try {
      const data = await redis.get(key)
      return data as T
    } catch (error) {
      console.error('Redis cache get error:', error)
      return null
    }
  },

  // Set a cached price with TTL
  async set(key: string, value: any, ttl: number = CACHE_TTL): Promise<void> {
    if (!redis) return
    
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Redis cache set error:', error)
    }
  },

  // Delete a cached price
  async delete(key: string): Promise<void> {
    if (!redis) return
    
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Redis cache delete error:', error)
    }
  },

  // Clear all pricing cache (use pattern matching)
  async clearAll(): Promise<void> {
    if (!redis) return
    
    try {
      // Get all keys matching our pattern
      const keys = await redis.keys(`${CACHE_PREFIX}*`)
      
      if (keys.length > 0) {
        // Delete in batches to avoid timeout
        const batchSize = 100
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize)
          await Promise.all(batch.map(key => redis!.del(key)))
        }
      }
    } catch (error) {
      console.error('Redis cache clear error:', error)
    }
  },

  // Clear cache for a specific product
  async clearProduct(productId: string): Promise<void> {
    if (!redis) return
    
    try {
      const pattern = `${CACHE_PREFIX}${productId}:*`
      const keys = await redis.keys(pattern)
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redis!.del(key)))
      }
    } catch (error) {
      console.error('Redis cache clear product error:', error)
    }
  },

  // Clear cache for a specific customer
  async clearCustomer(customerId: string): Promise<void> {
    if (!redis) return
    
    try {
      const pattern = `${CACHE_PREFIX}*:${customerId}:*`
      const keys = await redis.keys(pattern)
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redis!.del(key)))
      }
    } catch (error) {
      console.error('Redis cache clear customer error:', error)
    }
  },

  // Get cache statistics
  async getStats(): Promise<{
    available: boolean
    keyCount: number
    memoryUsage?: number
  }> {
    if (!redis) {
      return { available: false, keyCount: 0 }
    }

    try {
      const keys = await redis.keys(`${CACHE_PREFIX}*`)
      return {
        available: true,
        keyCount: keys.length,
      }
    } catch (error) {
      console.error('Redis cache stats error:', error)
      return { available: false, keyCount: 0 }
    }
  },
}

// Fallback in-memory cache if Redis is not available
class InMemoryCache {
  private cache: Map<string, { value: any; expiry: number }> = new Map()
  
  get<T = any>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }
    
    return item.value as T
  }
  
  set(key: string, value: any, ttl: number = CACHE_TTL): void {
    const expiry = Date.now() + (ttl * 1000)
    this.cache.set(key, { value, expiry })
  }
  
  delete(key: string): void {
    this.cache.delete(key)
  }
  
  clearAll(): void {
    this.cache.clear()
  }
  
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }
}

// Export a unified cache interface that falls back to in-memory if Redis is not available
const inMemoryCache = new InMemoryCache()

export const cache = {
  async get<T = any>(key: string): Promise<T | null> {
    if (pricingCache.isAvailable()) {
      return pricingCache.get<T>(key)
    }
    return inMemoryCache.get<T>(key)
  },

  async set(key: string, value: any, ttl: number = CACHE_TTL): Promise<void> {
    if (pricingCache.isAvailable()) {
      return pricingCache.set(key, value, ttl)
    }
    inMemoryCache.set(key, value, ttl)
  },

  async delete(key: string): Promise<void> {
    if (pricingCache.isAvailable()) {
      return pricingCache.delete(key)
    }
    inMemoryCache.delete(key)
  },

  async clearAll(): Promise<void> {
    if (pricingCache.isAvailable()) {
      return pricingCache.clearAll()
    }
    inMemoryCache.clearAll()
  },

  async clearProduct(productId: string): Promise<void> {
    if (pricingCache.isAvailable()) {
      return pricingCache.clearProduct(productId)
    }
    inMemoryCache.clearPattern(`${CACHE_PREFIX}${productId}:*`)
  },

  async clearCustomer(customerId: string): Promise<void> {
    if (pricingCache.isAvailable()) {
      return pricingCache.clearCustomer(customerId)
    }
    inMemoryCache.clearPattern(`${CACHE_PREFIX}*:${customerId}:*`)
  },
}