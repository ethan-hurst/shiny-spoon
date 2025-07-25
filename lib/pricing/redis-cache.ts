// Simple in-memory cache implementation
// In production, this would use Redis or another caching solution

interface CacheEntry<T> {
  value: T
  expiry: number
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    // Validate TTL parameter
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('TTL must be a positive number')
    }
    
    // Set reasonable maximum TTL (30 days)
    const MAX_TTL_SECONDS = 30 * 24 * 60 * 60
    if (ttlSeconds > MAX_TTL_SECONDS) {
      throw new Error(`TTL cannot exceed ${MAX_TTL_SECONDS} seconds (30 days)`)
    }
    
    const expiry = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiry })
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async flush(): Promise<void> {
    this.cache.clear()
  }
}

export const cache = new SimpleCache()

/**
 * Generates a cache key string for a price entry based on product ID and optional customer ID, quantity, and date.
 *
 * @param productId - The unique identifier for the product
 * @param customerId - Optional customer identifier to further scope the cache key
 * @param quantity - Optional quantity value to distinguish cache entries
 * @param date - Optional date string to differentiate cache keys by date
 * @returns A colon-delimited cache key string incorporating the provided parameters
 */
export function generateCacheKey(
  productId: string,
  customerId?: string,
  quantity?: number,
  date?: string
): string {
  const parts = ['price', productId]
  if (customerId) parts.push(customerId)
  if (quantity) parts.push(quantity.toString())
  if (date) parts.push(date)
  return parts.join(':')
}