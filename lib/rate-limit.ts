import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Create Redis instance
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// Rate limiters for different operations
export const rateLimiters = {
  // Order creation: 10 orders per minute per user
  orderCreation: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'rl:order:create',
      })
    : null,

  // API calls: 100 requests per minute per IP
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        analytics: true,
        prefix: 'rl:api',
      })
    : null,

  // Bulk operations: 5 per hour per user
  bulkOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        analytics: true,
        prefix: 'rl:bulk',
      })
    : null,

  // Export operations: 20 per hour per user
  export: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 h'),
        analytics: true,
        prefix: 'rl:export',
      })
    : null,

  // Authentication: 5 attempts per 15 minutes per IP
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '15 m'),
        analytics: true,
        prefix: 'rl:auth',
      })
    : null,
}

// Helper function to check rate limit
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  if (!limiter) {
    // If Redis is not configured, allow all requests
    return { success: true }
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  return {
    success,
    limit,
    remaining,
    reset,
  }
}

// Middleware helper for server actions
export async function withRateLimit<T extends (...args: any[]) => any>(
  action: T,
  limiter: Ratelimit | null,
  getIdentifier: (...args: Parameters<T>) => string
): Promise<T> {
  return (async (...args: Parameters<T>) => {
    const identifier = getIdentifier(...args)
    const { success, limit, remaining, reset } = await checkRateLimit(limiter, identifier)

    if (!success) {
      const resetDate = new Date(reset!)
      const waitTime = Math.ceil((reset! - Date.now()) / 1000)
      
      throw new Error(
        `Rate limit exceeded. Please try again in ${waitTime} seconds. ` +
        `(Limit: ${limit}, Remaining: ${remaining}, Reset: ${resetDate.toLocaleTimeString()})`
      )
    }

    return action(...args)
  }) as T
}