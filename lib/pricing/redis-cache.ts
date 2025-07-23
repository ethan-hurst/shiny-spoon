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