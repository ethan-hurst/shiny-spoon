import { NextResponse } from 'next/server'
import { ApiResponse, ApiError, ApiErrorCode, ApiMeta } from '@/lib/api/types'

/**
 * Send a successful API response
 */
export function apiSuccess<T>(
  data: T,
  meta?: ApiMeta,
  statusCode: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta
  }
  
  return NextResponse.json(response, { status: statusCode })
}

/**
 * Send an error API response
 */
export function apiError(
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, any>
): NextResponse {
  const error: ApiError = {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  }
  
  const response: ApiResponse = {
    success: false,
    error
  }
  
  return NextResponse.json(response, { status: statusCode })
}

/**
 * Send a paginated API response
 */
export function apiPaginated<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): NextResponse {
  const meta: ApiMeta = {
    page,
    limit,
    total,
    hasMore: page * limit < total
  }
  
  return apiSuccess(data, meta)
}

/**
 * Send a cursor-based paginated API response
 */
export function apiCursorPaginated<T>(
  data: T[],
  nextCursor?: string,
  prevCursor?: string
): NextResponse {
  const meta: ApiMeta = {
    nextCursor,
    prevCursor,
    hasMore: !!nextCursor
  }
  
  return apiSuccess(data, meta)
}

/**
 * Handle common API errors
 */
export function handleApiError(
  error: any,
  defaultMessage: string = 'An error occurred'
): NextResponse {
  console.error('API Error:', error)
  
  // Handle known error types
  if (error.code === 'PGRST116') {
    return apiError(
      404,
      ApiErrorCode.RESOURCE_NOT_FOUND,
      'Resource not found'
    )
  }
  
  if (error.code === '23505') {
    return apiError(
      400,
      ApiErrorCode.VALIDATION_ERROR,
      'Duplicate entry',
      { field: error.detail }
    )
  }
  
  if (error.code === '23503') {
    return apiError(
      400,
      ApiErrorCode.VALIDATION_ERROR,
      'Invalid reference',
      { field: error.detail }
    )
  }
  
  if (error.code === '22P02') {
    return apiError(
      400,
      ApiErrorCode.INVALID_REQUEST,
      'Invalid input format'
    )
  }
  
  // Default error response
  return apiError(
    500,
    ApiErrorCode.INTERNAL_ERROR,
    defaultMessage,
    process.env.NODE_ENV === 'development' ? { error: error.message } : undefined
  )
}

/**
 * Parse pagination parameters with defaults
 */
export function parsePaginationParams(
  page?: string | string[],
  limit?: string | string[]
): { page: number; limit: number; offset: number } {
  const pageNum = Math.max(1, parseInt(Array.isArray(page) ? page[0] : page || '1'))
  const limitNum = Math.min(100, Math.max(1, parseInt(Array.isArray(limit) ? limit[0] : limit || '20')))
  const offset = (pageNum - 1) * limitNum
  
  return { page: pageNum, limit: limitNum, offset }
}

/**
 * Parse sort parameters
 */
export function parseSortParams(
  sort?: string | string[],
  order?: string | string[],
  allowedFields: string[] = []
): { sortField: string | null; sortOrder: 'asc' | 'desc' } {
  const sortField = Array.isArray(sort) ? sort[0] : sort
  const sortOrder = (Array.isArray(order) ? order[0] : order) === 'desc' ? 'desc' : 'asc'
  
  // Validate sort field if allowed fields are specified
  if (sortField && allowedFields.length > 0 && !allowedFields.includes(sortField)) {
    return { sortField: null, sortOrder: 'asc' }
  }
  
  return { sortField: sortField || null, sortOrder }
}

/**
 * Parse filter parameters
 */
export function parseFilterParams(
  filters?: Record<string, string | string[]>
): Record<string, any> {
  if (!filters) return {}
  
  const parsed: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(filters)) {
    // Handle array values
    if (Array.isArray(value)) {
      parsed[key] = value
    } else if (value === 'true' || value === 'false') {
      // Handle boolean values
      parsed[key] = value === 'true'
    } else if (value && !isNaN(Number(value))) {
      // Handle numeric values
      parsed[key] = Number(value)
    } else {
      // Keep as string
      parsed[key] = value
    }
  }
  
  return parsed
}

/**
 * Create CORS headers
 */
export function setCorsHeaders(
  response: NextResponse,
  allowedOrigins: string[] = ['*'],
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: string[] = ['Content-Type', 'Authorization', 'X-API-Key']
): void {
  const headers = response.headers
  
  headers.set('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : allowedOrigins.join(', '))
  headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '))
  headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  headers.set('Access-Control-Max-Age', '86400') // 24 hours
  headers.set('Access-Control-Allow-Credentials', 'true')
}

/**
 * Set cache headers
 */
export function setCacheHeaders(
  response: NextResponse,
  maxAge: number = 0,
  sMaxAge: number = 0,
  staleWhileRevalidate: number = 0
): void {
  const directives: string[] = []
  
  if (maxAge === 0) {
    directives.push('no-cache', 'no-store', 'must-revalidate')
  } else {
    directives.push(`max-age=${maxAge}`)
    
    if (sMaxAge > 0) {
      directives.push(`s-maxage=${sMaxAge}`)
    }
    
    if (staleWhileRevalidate > 0) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
    }
  }
  
  response.headers.set('Cache-Control', directives.join(', '))
}

/**
 * Add request ID header
 */
export function setRequestIdHeader(response: NextResponse, requestId: string): void {
  response.headers.set('X-Request-ID', requestId)
}

/**
 * Add rate limit headers
 */
export function setRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  reset: Date,
  retryAfter?: number
): void {
  response.headers.set('X-RateLimit-Limit', limit.toString())
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', reset.toISOString())
  
  if (retryAfter !== undefined) {
    response.headers.set('X-RateLimit-Retry-After', retryAfter.toString())
    response.headers.set('Retry-After', retryAfter.toString())
  }
}