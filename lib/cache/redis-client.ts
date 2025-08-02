import { Redis } from '@upstash/redis'

// Initialize Redis client
export const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Cache configuration
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const

// Cache key prefixes
export const CACHE_PREFIX = {
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  ORDERS: 'orders',
  ANALYTICS: 'analytics',
  USER: 'user',
  REPORTS: 'reports',
} as const

// Generic cache wrapper with TTL
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // If Redis is not configured, just return the fetcher result
  if (!redis) {
    return fetcher()
  }

  try {
    // Try to get from cache
    const cached = await redis.get<T>(key)
    if (cached !== null) {
      // Cache hit
      console.log(`[Cache] Hit: ${key}`)
      return cached
    }
  } catch (error) {
    // Log error but continue with fetcher
    console.error('[Cache] Get error:', error)
  }

  // Cache miss - fetch fresh data
  console.log(`[Cache] Miss: ${key}`)
  const fresh = await fetcher()

  // Store in cache (fire and forget)
  try {
    await redis.setex(key, ttl, JSON.stringify(fresh))
  } catch (error) {
    // Log error but don't fail the request
    console.error('[Cache] Set error:', error)
  }

  return fresh
}

// Invalidate cache by key or pattern
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return

  try {
    // For Upstash, we need to use SCAN to find keys
    let cursor = 0
    const keysToDelete: string[] = []

    do {
      const result = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      })
      cursor = result[0]
      keysToDelete.push(...result[1])
    } while (cursor !== 0)

    // Delete keys in batches
    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete)
      console.log(`[Cache] Invalidated ${keysToDelete.length} keys matching: ${pattern}`)
    }
  } catch (error) {
    console.error('[Cache] Invalidation error:', error)
  }
}

// Batch get from cache
export async function batchGetCache<T>(keys: string[]): Promise<(T | null)[]> {
  if (!redis || keys.length === 0) {
    return keys.map(() => null)
  }

  try {
    const values = await redis.mget<(T | null)[]>(...keys)
    return values
  } catch (error) {
    console.error('[Cache] Batch get error:', error)
    return keys.map(() => null)
  }
}

// Batch set to cache
export async function batchSetCache<T>(
  items: Array<{ key: string; value: T; ttl?: number }>
): Promise<void> {
  if (!redis || items.length === 0) return

  try {
    const pipeline = redis.pipeline()
    
    for (const item of items) {
      pipeline.setex(
        item.key,
        item.ttl || CACHE_TTL.MEDIUM,
        JSON.stringify(item.value)
      )
    }
    
    await pipeline.exec()
    console.log(`[Cache] Batch set ${items.length} items`)
  } catch (error) {
    console.error('[Cache] Batch set error:', error)
  }
}

// Cache warmer for preloading critical data
export async function warmCache(
  warmers: Array<{
    key: string
    fetcher: () => Promise<any>
    ttl?: number
  }>
): Promise<void> {
  console.log(`[Cache] Warming ${warmers.length} keys...`)
  
  const promises = warmers.map(async ({ key, fetcher, ttl }) => {
    try {
      const data = await fetcher()
      if (redis) {
        await redis.setex(key, ttl || CACHE_TTL.LONG, JSON.stringify(data))
      }
    } catch (error) {
      console.error(`[Cache] Warm error for ${key}:`, error)
    }
  })
  
  await Promise.allSettled(promises)
  console.log('[Cache] Warming complete')
}

// Helper to generate cache keys
export function cacheKey(
  prefix: keyof typeof CACHE_PREFIX,
  ...parts: (string | number)[]
): string {
  return `${CACHE_PREFIX[prefix]}:${parts.join(':')}`
}