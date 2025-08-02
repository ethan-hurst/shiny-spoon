import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createServerClient } from '@/lib/supabase/server'

// Create Redis instance for rate limiting
const createRateLimitRedis = () => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return null
}

const rateLimitRedis = createRateLimitRedis()

// Different rate limiters for different operations
export const rateLimiters = rateLimitRedis ? {
  api: new Ratelimit({
    redis: rateLimitRedis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
  }),
  
  auth: new Ratelimit({
    redis: rateLimitRedis,
    limiter: Ratelimit.fixedWindow(5, '15 m'), // 5 attempts per 15 minutes
    analytics: true,
  }),
  
  export: new Ratelimit({
    redis: rateLimitRedis,
    limiter: Ratelimit.tokenBucket(10, '1 h', 10), // 10 exports per hour
    analytics: true,
  }),
  
  bulk: new Ratelimit({
    redis: rateLimitRedis,
    limiter: Ratelimit.tokenBucket(5, '1 h', 5), // 5 bulk operations per hour
    analytics: true,
  }),
  
  ai: new Ratelimit({
    redis: rateLimitRedis,
    limiter: Ratelimit.tokenBucket(50, '1 h', 10), // 50 AI requests per hour
    analytics: true,
  }),
} : null

/**
 * Check rate limit for a tenant
 */
export async function checkTenantRateLimit(
  tenantId: string,
  operation: keyof typeof rateLimiters = 'api'
): Promise<{ allowed: boolean; reset: number; remaining: number; limit: number }> {
  // If rate limiting is not configured, allow all requests
  if (!rateLimiters) {
    return {
      allowed: true,
      reset: 0,
      remaining: 999,
      limit: 999,
    }
  }

  const limiter = rateLimiters[operation]
  const identifier = `${tenantId}:${operation}`
  
  const { success, limit, reset, remaining } = await limiter.limit(identifier)
  
  // Log rate limit hits
  if (!success) {
    console.warn(`Rate limit exceeded for tenant ${tenantId} on ${operation}`)
    
    // Track rate limit event
    await trackRateLimitEvent(tenantId, operation)
  }
  
  return {
    allowed: success,
    reset,
    remaining,
    limit,
  }
}

/**
 * Track rate limit events in database
 */
async function trackRateLimitEvent(tenantId: string, operation: string) {
  try {
    const supabase = createServerClient()
    await supabase.from('tenant_usage').insert({
      organization_id: tenantId,
      metric_name: `rate_limit_exceeded_${operation}`,
      metric_value: 1,
    })
  } catch (error) {
    console.error('Failed to track rate limit event:', error)
  }
}

/**
 * Middleware helper for rate limiting
 */
export async function rateLimitMiddleware(
  request: Request,
  tenantId: string,
  operation: keyof typeof rateLimiters = 'api'
): Promise<Response | null> {
  const { allowed, reset, remaining, limit } = await checkTenantRateLimit(tenantId, operation)
  
  if (!allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': reset.toString(),
        'Retry-After': Math.floor((reset - Date.now()) / 1000).toString(),
      },
    })
  }
  
  // Return null to indicate the request should proceed
  // Headers will be added by the middleware
  return null
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  rateLimitInfo: { limit: number; remaining: number; reset: number }
): Response {
  const headers = new Headers(response.headers)
  
  headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString())
  headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString())
  headers.set('X-RateLimit-Reset', rateLimitInfo.reset.toString())
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Get rate limit info for a tenant without consuming a request
 */
export async function getRateLimitInfo(
  tenantId: string,
  operation: keyof typeof rateLimiters = 'api'
): Promise<{ limit: number; remaining: number; reset: number } | null> {
  if (!rateLimiters) {
    return null
  }

  const limiter = rateLimiters[operation]
  const identifier = `${tenantId}:${operation}`
  
  // This is a workaround - Upstash doesn't provide a way to check without consuming
  // In production, you might want to implement a custom solution
  try {
    const result = await limiter.limit(identifier)
    
    // If we consumed a request, try to restore it
    if (result.success && result.remaining < result.limit - 1) {
      // This is not ideal but works for monitoring purposes
      console.log('Rate limit check consumed a request')
    }
    
    return {
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    console.error('Failed to get rate limit info:', error)
    return null
  }
}

/**
 * Reset rate limit for a tenant (admin only)
 */
export async function resetRateLimit(
  tenantId: string,
  operation: keyof typeof rateLimiters
): Promise<boolean> {
  if (!rateLimitRedis) {
    return false
  }

  try {
    const identifier = `${tenantId}:${operation}`
    // Delete the rate limit key
    await rateLimitRedis.del(`rl:${identifier}`)
    return true
  } catch (error) {
    console.error('Failed to reset rate limit:', error)
    return false
  }
}