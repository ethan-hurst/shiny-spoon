import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { 
  ApiContext, 
  ApiErrorCode, 
  ApiKey, 
  ApiScope, 
  ApiTier, 
  RateLimit 
} from '@/lib/api/types'
import { 
  apiError, 
  setRequestIdHeader, 
  setRateLimitHeaders 
} from '@/lib/api/utils/response'

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
 * Extract API key from request
 */
function extractApiKey(req: NextRequest): string | null {
  // Check Authorization header first (Bearer token)
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // Check X-API-Key header
  const apiKeyHeader = req.headers.get('x-api-key')
  if (apiKeyHeader) {
    return apiKeyHeader
  }
  
  // Check query parameter as fallback
  const apiKeyQuery = req.nextUrl.searchParams.get('api_key')
  if (apiKeyQuery) {
    return apiKeyQuery
  }
  
  return null
}

/**
 * Get client IP address from request
 */
function getClientIp(req: NextRequest): string {
  // Check various headers for IP address
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Fallback to localhost
  return '127.0.0.1'
}

/**
 * Hash API key for secure storage
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Validate API key and check if it's valid
 */
async function validateApiKey(key: string): Promise<ApiKey | null> {
  const supabase = createClient()
  
  // Get API key from database
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', hashApiKey(key))
    .eq('active', true)
    .single()
  
  if (error || !data) {
    return null
  }
  
  // Check if key has expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null
  }
  
  // Update last used timestamp
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
  
  // Transform database record to ApiKey type
  return {
    id: data.id,
    key: key, // Return the actual key, not the hash
    name: data.name,
    tenantId: data.tenant_id,
    scopes: data.scopes || [],
    tier: data.tier,
    rateLimit: data.rate_limit,
    ipWhitelist: data.ip_whitelist,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at)
  }
}

/**
 * Check if API key has required scopes
 */
function hasRequiredScopes(apiKey: ApiKey, requiredScopes: ApiScope[]): boolean {
  // Admin scope has access to everything
  if (apiKey.scopes.includes(ApiScope.ADMIN_ALL)) {
    return true
  }
  
  // Check if API key has all required scopes
  return requiredScopes.every(scope => apiKey.scopes.includes(scope))
}

/**
 * Check if IP is whitelisted
 */
function isIpWhitelisted(apiKey: ApiKey, clientIp: string): boolean {
  // If no whitelist is configured, allow all IPs
  if (!apiKey.ipWhitelist || apiKey.ipWhitelist.length === 0) {
    return true
  }
  
  // Check if client IP is in whitelist
  return apiKey.ipWhitelist.includes(clientIp)
}

/**
 * API middleware configuration
 */
export interface ApiMiddlewareConfig {
  requiredScopes?: ApiScope[]
  rateLimit?: Partial<RateLimit>
  skipAuth?: boolean
}

/**
 * API middleware for Next.js App Router
 */
export async function withApiMiddleware(
  request: NextRequest,
  handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>,
  config: ApiMiddlewareConfig = {}
): Promise<NextResponse> {
  try {
    // Generate request ID
    const requestId = uuidv4()
    
    let apiKey: ApiKey | null = null
    let context: ApiContext | null = null
    
    // Skip auth if configured
    if (!config.skipAuth) {
      // Extract API key
      const apiKeyValue = extractApiKey(request)
      if (!apiKeyValue) {
        return apiError(401, ApiErrorCode.AUTHENTICATION_FAILED, 'API key is required')
      }
      
      // Validate API key
      apiKey = await validateApiKey(apiKeyValue)
      if (!apiKey) {
        return apiError(401, ApiErrorCode.INVALID_API_KEY, 'Invalid or expired API key')
      }
      
      // Get client IP
      const clientIp = getClientIp(request)
      
      // Check IP whitelist
      if (!isIpWhitelisted(apiKey, clientIp)) {
        return apiError(403, ApiErrorCode.PERMISSION_DENIED, 'IP address not whitelisted')
      }
      
      // Check required scopes
      if (config.requiredScopes && !hasRequiredScopes(apiKey, config.requiredScopes)) {
        return apiError(403, ApiErrorCode.INSUFFICIENT_SCOPE, 'Insufficient permissions')
      }
      
      // Create API context
      context = {
        tenantId: apiKey.tenantId,
        apiKey,
        requestId,
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') || undefined,
        scopes: apiKey.scopes
      }
      
      // Apply rate limiting
      if (apiKey) {
        const rateLimit = config.rateLimit 
          ? { ...DEFAULT_RATE_LIMITS[apiKey.tier], ...config.rateLimit }
          : apiKey.rateLimit || DEFAULT_RATE_LIMITS[apiKey.tier]
        
        const limiter = getRateLimiter(rateLimit.requests, rateLimit.window)
        const identifier = `${apiKey.id}:${request.nextUrl.pathname}`
        
        const { success, limit, reset, remaining } = await limiter.limit(identifier)
        
        if (!success) {
          const retryAfter = Math.ceil((reset - Date.now()) / 1000)
          const response = apiError(
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
          
          setRateLimitHeaders(response, limit, remaining, new Date(reset), retryAfter)
          return response
        }
        
        // Check concurrent request limit if specified
        if (rateLimit.concurrent) {
          const concurrentKey = `concurrent:${apiKey.id}`
          const currentConcurrent = await redis.incr(concurrentKey)
          
          // Set expiry for concurrent counter
          if (currentConcurrent === 1) {
            await redis.expire(concurrentKey, 60) // 1 minute expiry
          }
          
          if (currentConcurrent > rateLimit.concurrent) {
            await redis.decr(concurrentKey)
            return apiError(
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
          // Note: This is handled differently in App Router
          setTimeout(async () => {
            await redis.decr(concurrentKey)
          }, 0)
        }
      }
    } else {
      // Create minimal context for unauthenticated requests
      context = {
        tenantId: '',
        apiKey: null as any,
        requestId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent') || undefined,
        scopes: []
      }
    }
    
    // Call the handler with context
    const response = await handler(request, context)
    
    // Add request ID header
    setRequestIdHeader(response, requestId)
    
    // Add rate limit headers if applicable
    if (apiKey && !config.skipAuth) {
      const rateLimit = config.rateLimit 
        ? { ...DEFAULT_RATE_LIMITS[apiKey.tier], ...config.rateLimit }
        : apiKey.rateLimit || DEFAULT_RATE_LIMITS[apiKey.tier]
      
      const limiter = getRateLimiter(rateLimit.requests, rateLimit.window)
      const identifier = `${apiKey.id}:${request.nextUrl.pathname}`
      
      // Get current rate limit status
      const { limit, remaining, reset } = await limiter.limit(identifier)
      setRateLimitHeaders(response, limit, remaining, new Date(reset))
    }
    
    return response
  } catch (error) {
    console.error('API middleware error:', error)
    return apiError(500, ApiErrorCode.INTERNAL_ERROR, 'Internal server error')
  }
}

/**
 * Log API usage statistics
 */
export async function logApiUsage(
  context: ApiContext,
  request: NextRequest,
  response: NextResponse,
  responseTime: number
): Promise<void> {
  try {
    const supabase = createClient()
    
    // Get request and response sizes
    const requestSize = request.headers.get('content-length')
    const responseSize = response.headers.get('content-length')
    
    // Log usage statistics
    await supabase.from('api_usage_stats').insert({
      api_key_id: context.apiKey.id,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      status_code: response.status,
      response_time: Math.round(responseTime),
      request_size: requestSize ? parseInt(requestSize) : null,
      response_size: responseSize ? parseInt(responseSize) : null
    })
  } catch (error) {
    console.error('Failed to log API usage:', error)
  }
}