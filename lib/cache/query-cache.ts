/**
 * Database query caching for TruthSource
 */

export interface CacheConfig {
  ttl: number // Time to live in seconds
  maxSize: number // Maximum number of cached items
  namespace: string // Cache namespace for organization isolation
}

export interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: number
  ttl: number
  hits: number
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
  avgResponseTime: number
}

export class QueryCache {
  private cache = new Map<string, CacheEntry>()
  private stats = {
    hits: 0,
    misses: 0,
    totalResponseTime: 0,
    requestCount: 0,
  }
  private config: CacheConfig

  constructor(config: CacheConfig) {
    this.config = config
    this.startCleanupInterval()
  }

  /**
   * Generate cache key from query parameters
   */
  private generateKey(query: string, params: any[] = []): string {
    const paramString = JSON.stringify(params)
    return `${this.config.namespace}:${this.hashString(query + paramString)}`
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /**
   * Get cached data
   */
  async get<T>(query: string, params: any[] = []): Promise<T | null> {
    const key = this.generateKey(query, params)
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // Update hit count
    entry.hits++
    this.stats.hits++
    return entry.data
  }

  /**
   * Set cached data
   */
  async set<T>(
    query: string,
    data: T,
    params: any[] = [],
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey(query, params)
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl,
      hits: 0,
    }

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastUsed()
    }

    this.cache.set(key, entry)
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidate(pattern: string): Promise<void> {
    const keysToDelete: string[] = []

    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key))
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate =
      totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0
    const avgResponseTime =
      this.stats.requestCount > 0
        ? this.stats.totalResponseTime / this.stats.requestCount
        : 0

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate,
      avgResponseTime,
    }
  }

  /**
   * Evict least used cache entries
   */
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null
    let minHits = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.hits < minHits) {
        minHits = entry.hits
        leastUsedKey = key
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
    }
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > entry.ttl * 1000) {
          keysToDelete.push(key)
        }
      }

      keysToDelete.forEach((key) => this.cache.delete(key))
    }, 60000) // Clean up every minute
  }

  /**
   * Record response time for statistics
   */
  recordResponseTime(responseTime: number): void {
    this.stats.totalResponseTime += responseTime
    this.stats.requestCount++
  }
}

// Cache instances for different query types
const cacheInstances = new Map<string, QueryCache>()

export function getQueryCache(namespace: string): QueryCache {
  if (!cacheInstances.has(namespace)) {
    const config: CacheConfig = {
      ttl: 300, // 5 minutes default
      maxSize: 1000,
      namespace,
    }
    cacheInstances.set(namespace, new QueryCache(config))
  }
  return cacheInstances.get(namespace)!
}

// Cached query wrapper
export function withQueryCache<T extends (...args: any[]) => any>(
  fn: T,
  cacheNamespace: string,
  ttl: number = 300
): T {
  return (async (...args: Parameters<T>) => {
    const cache = getQueryCache(cacheNamespace)
    const query = args[0] // Assume first argument is the query
    const params = args.slice(1) // Remaining arguments are parameters

    // Try to get from cache
    const cached = await cache.get(query, params)
    if (cached) {
      return cached
    }

    // Execute query and cache result
    const startTime = Date.now()
    const result = await fn(...args)
    const responseTime = Date.now() - startTime

    // Cache the result
    await cache.set(query, result, params, ttl)
    cache.recordResponseTime(responseTime)

    return result
  }) as T
}

// Cache invalidation helpers
export async function invalidateProductCache(
  organizationId: string
): Promise<void> {
  const cache = getQueryCache(`products:${organizationId}`)
  await cache.invalidate('products')
}

export async function invalidateOrderCache(
  organizationId: string
): Promise<void> {
  const cache = getQueryCache(`orders:${organizationId}`)
  await cache.invalidate('orders')
}

export async function invalidateCustomerCache(
  organizationId: string
): Promise<void> {
  const cache = getQueryCache(`customers:${organizationId}`)
  await cache.invalidate('customers')
}

export async function invalidateInventoryCache(
  organizationId: string
): Promise<void> {
  const cache = getQueryCache(`inventory:${organizationId}`)
  await cache.invalidate('inventory')
}

// Cache-aware Supabase client wrapper
export function createCachedClient(supabase: any, organizationId: string) {
  const cachedSupabase = { ...supabase }

  // Override the from method to add caching
  cachedSupabase.from = (table: string) => {
    const originalFrom = supabase.from(table)
    const cache = getQueryCache(`${table}:${organizationId}`)

    return {
      ...originalFrom,
      select: async (columns?: string) => {
        const query = `SELECT ${columns || '*'} FROM ${table}`
        const params = []

        // Try cache first
        const cached = await cache.get(query, params)
        if (cached) {
          return cached
        }

        // Execute query
        const result = await originalFrom.select(columns)

        // Cache successful results
        if (result.data && !result.error) {
          await cache.set(query, result, params)
        }

        return result
      },
    }
  }

  return cachedSupabase
}
