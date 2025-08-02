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

  // Order updates: 50 updates per minute per user
  orderUpdates: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '1 m'),
        analytics: true,
        prefix: 'rl:order:update',
      })
    : null,

  // Product operations: 30 per minute per user
  productOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        analytics: true,
        prefix: 'rl:product',
      })
    : null,

  // Inventory operations: 100 per minute per user
  inventoryOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        analytics: true,
        prefix: 'rl:inventory',
      })
    : null,

  // Pricing operations: 50 per minute per user
  pricingOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '1 m'),
        analytics: true,
        prefix: 'rl:pricing',
      })
    : null,

  // Customer operations: 20 per minute per user
  customerOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
        prefix: 'rl:customer',
      })
    : null,

  // Integration operations: 10 per minute per user
  integrationOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'rl:integration',
      })
    : null,

  // Sync operations: 5 per minute per user
  syncOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
        prefix: 'rl:sync',
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

  // Report generation: 10 per hour per user
  reports: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 h'),
        analytics: true,
        prefix: 'rl:reports',
      })
    : null,

  // Audit operations: 50 per minute per user
  auditOperations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '1 m'),
        analytics: true,
        prefix: 'rl:audit',
      })
    : null,

           // Monitoring operations: 30 per minute per user
         monitoringOperations: redis
           ? new Ratelimit({
               redis,
               limiter: Ratelimit.slidingWindow(30, '1 m'),
               analytics: true,
               prefix: 'rl:monitoring',
             })
           : null,

         // Analytics operations: 20 per minute per user
         analytics: redis
           ? new Ratelimit({
               redis,
               limiter: Ratelimit.slidingWindow(20, '1 m'),
               analytics: true,
               prefix: 'rl:analytics',
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

// Rate limit decorator for server actions
export function rateLimited<T extends (...args: any[]) => any>(
  limiter: Ratelimit | null,
  getIdentifier: (...args: Parameters<T>) => string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: Parameters<T>) {
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

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

// Helper to get user identifier for rate limiting
export function getUserIdentifier(userId?: string): string {
  return userId || 'anonymous'
}

// Helper to get IP identifier for rate limiting
export function getIPIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0]?.trim() || realIp || 'unknown'
}

// Rate limit middleware for API routes
export async function withAPIRateLimit(
  request: Request,
  limiter: Ratelimit | null,
  identifier?: string
): Promise<{ success: boolean; error?: string }> {
  const ip = identifier || getIPIdentifier(request)
  const { success, limit, remaining, reset } = await checkRateLimit(limiter, ip)

  if (!success) {
    const resetDate = new Date(reset!)
    const waitTime = Math.ceil((reset! - Date.now()) / 1000)
    
    return {
      success: false,
      error: `Rate limit exceeded. Please try again in ${waitTime} seconds. ` +
        `(Limit: ${limit}, Remaining: ${remaining}, Reset: ${resetDate.toLocaleTimeString()})`
    }
  }

  return { success: true }
}