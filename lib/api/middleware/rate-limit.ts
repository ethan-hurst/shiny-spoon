import { NextApiRequest, NextApiResponse } from 'next'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { ApiErrorCode, ApiTier, RateLimit } from '@/lib/api/types'
import { apiError } from '@/lib/api/utils/response'
import { getApiContext } from './auth'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Default rate limits by tier
const DEFAULT_RATE_LIMITS: Record<ApiTier, RateLimit> = {
  [ApiTier.BASIC]: {
    requests: 100,
    window: 3600, // 1 hour
    concurrent: 10
  },
  [ApiTier.PRO]: {
    requests: 1000,
    window: 3600, // 1 hour
    concurrent: 50
  },
  [ApiTier.ENTERPRISE]: {
    requests: 10000,
    window: 3600, // 1 hour
    concurrent: 100
  }
}

// Create rate limiter instances
const rateLimiters = new Map<string, Ratelimit>()

/**
 * Get or create rate limiter for specific configuration
 */
function getRateLimiter(requests: number, window: number): Ratelimit {
  const key = `${requests}-${window}`
  
  if (!rateLimiters.has(key)) {
    rateLimiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, `${window}s`),
        analytics: true,
        prefix: '@inventory-api',
      })
    )
  }
  
  return rateLimiters.get(key)!
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(customLimit?: Partial<RateLimit>) {
  return async function rateLimitMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => void
  ) {
    try {
      // Get API context
      const context = getApiContext(req)
      if (!context) {
        return apiError(res, 401, ApiErrorCode.AUTHENTICATION_FAILED, 'Authentication required')
      }
      
      // Determine rate limit configuration
      const rateLimit = customLimit 
        ? { ...DEFAULT_RATE_LIMITS[context.apiKey.tier], ...customLimit }
        : context.apiKey.rateLimit || DEFAULT_RATE_LIMITS[context.apiKey.tier]
      
      // Get rate limiter
      const limiter = getRateLimiter(rateLimit.requests, rateLimit.window)
      
      // Create identifier for rate limiting
      const identifier = `${context.apiKey.id}:${req.url}`
      
      // Check rate limit
      const { success, limit, reset, remaining } = await limiter.limit(identifier)
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString())
      res.setHeader('X-RateLimit-Remaining', remaining.toString())
      res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString())
      
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        res.setHeader('X-RateLimit-Retry-After', retryAfter.toString())
        res.setHeader('Retry-After', retryAfter.toString())
        
        return apiError(
          res,
          429,
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          'Rate limit exceeded',
          {
            limit,
            remaining,
            reset: new Date(reset).toISOString(),
            retryAfter
          }
        )
      }
      
      // Check concurrent request limit if specified
      if (rateLimit.concurrent) {
        const concurrentKey = `concurrent:${context.apiKey.id}`
        const currentConcurrent = await redis.incr(concurrentKey)
        
        // Set expiry for concurrent counter
        if (currentConcurrent === 1) {
          await redis.expire(concurrentKey, 60) // 1 minute expiry
        }
        
        if (currentConcurrent > rateLimit.concurrent) {
          await redis.decr(concurrentKey)
          return apiError(
            res,
            429,
            ApiErrorCode.RATE_LIMIT_EXCEEDED,
            'Concurrent request limit exceeded',
            {
              concurrent: currentConcurrent - 1,
              limit: rateLimit.concurrent
            }
          )
        }
        
        // Decrement concurrent counter when request completes
        res.on('finish', async () => {
          await redis.decr(concurrentKey)
        })
      }
      
      // Continue to next middleware
      next()
    } catch (error) {
      console.error('Rate limiting error:', error)
      // Don't fail the request if rate limiting fails
      next()
    }
  }
}

/**
 * Get current rate limit status for an API key
 */
export async function getRateLimitStatus(apiKeyId: string, endpoint: string): Promise<{
  limit: number
  remaining: number
  reset: Date
}> {
  const identifier = `${apiKeyId}:${endpoint}`
  
  // Get rate limit info from Redis
  const data = await redis.get(`@inventory-api:${identifier}`)
  
  if (!data) {
    return {
      limit: 0,
      remaining: 0,
      reset: new Date()
    }
  }
  
  return data as any
}

/**
 * Reset rate limit for an API key (admin function)
 */
export async function resetRateLimit(apiKeyId: string, endpoint?: string): Promise<void> {
  const pattern = endpoint 
    ? `@inventory-api:${apiKeyId}:${endpoint}*`
    : `@inventory-api:${apiKeyId}:*`
  
  // Delete rate limit keys
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
  
  // Reset concurrent counter
  await redis.del(`concurrent:${apiKeyId}`)
}

/**
 * Get rate limit analytics
 */
export async function getRateLimitAnalytics(apiKeyId: string, hours: number = 24): Promise<{
  totalRequests: number
  blockedRequests: number
  endpoints: Record<string, number>
}> {
  // This would integrate with Upstash analytics
  // For now, return mock data
  return {
    totalRequests: 0,
    blockedRequests: 0,
    endpoints: {}
  }
}