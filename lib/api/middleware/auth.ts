import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ApiContext, ApiErrorCode, ApiKey, ApiScope } from '@/lib/api/types'
import { apiError } from '@/lib/api/utils/response'
import { v4 as uuidv4 } from 'uuid'

/**
 * Extract API key from request headers
 */
function extractApiKey(req: NextApiRequest): string | null {
  // Check Authorization header first (Bearer token)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key']
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader
  }
  
  // Check query parameter as fallback
  const apiKeyQuery = req.query.api_key
  if (apiKeyQuery && typeof apiKeyQuery === 'string') {
    return apiKeyQuery
  }
  
  return null
}

/**
 * Get client IP address from request
 */
function getClientIp(req: NextApiRequest): string {
  // Check various headers for IP address
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',')[0].trim()
  }
  
  const realIp = req.headers['x-real-ip']
  if (realIp && typeof realIp === 'string') {
    return realIp
  }
  
  return req.socket.remoteAddress || '127.0.0.1'
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
 * Hash API key for secure storage
 */
function hashApiKey(key: string): string {
  // In production, use a proper hashing algorithm like SHA-256
  // For now, we'll use a simple hash
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(key).digest('hex')
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
 * Authentication middleware
 */
export function withAuth(requiredScopes: ApiScope[] = []) {
  return async function authMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => void
  ) {
    try {
      // Generate request ID
      const requestId = uuidv4()
      
      // Extract API key
      const apiKeyValue = extractApiKey(req)
      if (!apiKeyValue) {
        return apiError(res, 401, ApiErrorCode.AUTHENTICATION_FAILED, 'API key is required')
      }
      
      // Validate API key
      const apiKey = await validateApiKey(apiKeyValue)
      if (!apiKey) {
        return apiError(res, 401, ApiErrorCode.INVALID_API_KEY, 'Invalid or expired API key')
      }
      
      // Get client IP
      const clientIp = getClientIp(req)
      
      // Check IP whitelist
      if (!isIpWhitelisted(apiKey, clientIp)) {
        return apiError(res, 403, ApiErrorCode.PERMISSION_DENIED, 'IP address not whitelisted')
      }
      
      // Check required scopes
      if (!hasRequiredScopes(apiKey, requiredScopes)) {
        return apiError(res, 403, ApiErrorCode.INSUFFICIENT_SCOPE, 'Insufficient permissions')
      }
      
      // Create API context
      const context: ApiContext = {
        tenantId: apiKey.tenantId,
        apiKey,
        requestId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        scopes: apiKey.scopes
      }
      
      // Attach context to request
      ;(req as any).apiContext = context
      
      // Set request ID header
      res.setHeader('X-Request-ID', requestId)
      
      // Continue to next middleware
      next()
    } catch (error) {
      console.error('Authentication error:', error)
      return apiError(res, 500, ApiErrorCode.INTERNAL_ERROR, 'Authentication failed')
    }
  }
}

/**
 * Get API context from request
 */
export function getApiContext(req: NextApiRequest): ApiContext | null {
  return (req as any).apiContext || null
}

/**
 * Check if request has specific scope
 */
export function hasScope(req: NextApiRequest, scope: ApiScope): boolean {
  const context = getApiContext(req)
  if (!context) return false
  
  return context.scopes.includes(scope) || context.scopes.includes(ApiScope.ADMIN_ALL)
}