/**
 * createRouteHandler - Secure API route handler wrapper
 * Provides automatic auth, rate limiting, error handling, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/utils/supabase/server'
import { ratelimit } from '@/lib/utils/ratelimit'

export interface RouteHandlerOptions {
  auth?: boolean
  rateLimit?: {
    identifier?: (req: NextRequest) => string
    requests?: number
    window?: string
  }
  schema?: {
    body?: z.ZodSchema
    query?: z.ZodSchema
    params?: z.ZodSchema
  }
  requiredPermissions?: string[]
  monitoring?: boolean
}

export interface RouteContext {
  request: NextRequest
  params?: any
  user?: {
    id: string
    email: string
    organizationId: string
    role?: string
  }
  body?: any
  query?: any
}

export type RouteHandler = (context: RouteContext) => Promise<NextResponse>

/**
 * Create a secure route handler with built-in features
 */
export function createRouteHandler(
  handler: RouteHandler,
  options: RouteHandlerOptions = {}
): (request: NextRequest, props?: any) => Promise<NextResponse> {
  const {
    auth = true,
    rateLimit,
    schema,
    requiredPermissions = [],
    monitoring = true
  } = options

  return async (request: NextRequest, props?: any) => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    
    try {
      // 1. Rate limiting
      if (rateLimit) {
        const identifier = rateLimit.identifier
          ? rateLimit.identifier(request)
          : request.headers.get('x-forwarded-for') || 'anonymous'
          
        const { success, limit, reset, remaining } = await ratelimit.limit(identifier)
        
        if (!success) {
          return NextResponse.json(
            { 
              error: 'Too many requests',
              requestId,
              retryAfter: new Date(reset).toISOString()
            },
            { 
              status: 429,
              headers: {
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': new Date(reset).toISOString(),
                'X-Request-Id': requestId
              }
            }
          )
        }
      }

      // 2. Authentication
      let user = null
      if (auth) {
        const supabase = await createClient()
        const { data: { user: authUser }, error } = await supabase.auth.getUser()
        
        if (error || !authUser) {
          return NextResponse.json(
            { 
              error: 'Unauthorized',
              requestId,
              message: 'Please authenticate to access this resource'
            },
            { 
              status: 401,
              headers: {
                'X-Request-Id': requestId
              }
            }
          )
        }

        // Get user profile with organization
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('organization_id, role')
          .eq('id', authUser.id)
          .single()

        if (!profile?.organization_id) {
          return NextResponse.json(
            { 
              error: 'No organization',
              requestId,
              message: 'User must belong to an organization'
            },
            { 
              status: 403,
              headers: {
                'X-Request-Id': requestId
              }
            }
          )
        }

        user = {
          id: authUser.id,
          email: authUser.email!,
          organizationId: profile.organization_id,
          role: profile.role
        }

        // 3. Permission checking
        if (requiredPermissions.length > 0) {
          // Check if user has required permissions
          // This is a simplified check - implement proper RBAC as needed
          const hasPermission = requiredPermissions.every(permission => {
            // Example: 'admin' role has all permissions
            if (user!.role === 'admin') return true
            // Add more sophisticated permission checking here
            return false
          })

          if (!hasPermission) {
            return NextResponse.json(
              { 
                error: 'Forbidden',
                requestId,
                message: 'Insufficient permissions'
              },
              { 
                status: 403,
                headers: {
                  'X-Request-Id': requestId
                }
              }
            )
          }
        }
      }

      // 4. Input validation
      let body = null
      let query = null
      const params = props?.params

      // Parse and validate body
      if (schema?.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const rawBody = await request.json()
          body = schema.body.parse(rawBody)
        } catch (error) {
          if (error instanceof z.ZodError) {
            return NextResponse.json(
              { 
                error: 'Validation failed',
                requestId,
                issues: error.issues
              },
              { 
                status: 400,
                headers: {
                  'X-Request-Id': requestId
                }
              }
            )
          }
          throw error
        }
      }

      // Parse and validate query params
      if (schema?.query) {
        try {
          const searchParams = Object.fromEntries(request.nextUrl.searchParams)
          query = schema.query.parse(searchParams)
        } catch (error) {
          if (error instanceof z.ZodError) {
            return NextResponse.json(
              { 
                error: 'Invalid query parameters',
                requestId,
                issues: error.issues
              },
              { 
                status: 400,
                headers: {
                  'X-Request-Id': requestId
                }
              }
            )
          }
          throw error
        }
      }

      // Validate URL params
      if (schema?.params && params) {
        try {
          params = schema.params.parse(params)
        } catch (error) {
          if (error instanceof z.ZodError) {
            return NextResponse.json(
              { 
                error: 'Invalid URL parameters',
                requestId,
                issues: error.issues
              },
              { 
                status: 400,
                headers: {
                  'X-Request-Id': requestId
                }
              }
            )
          }
          throw error
        }
      }

      // 5. Execute handler
      const context: RouteContext = {
        request,
        params,
        user,
        body,
        query
      }

      const response = await handler(context)

      // 6. Add standard headers
      response.headers.set('X-Request-Id', requestId)
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

      // 7. Log success metrics
      if (monitoring) {
        console.log('[API]', {
          requestId,
          method: request.method,
          path: request.nextUrl.pathname,
          status: response.status,
          duration: Date.now() - startTime,
          userId: user?.id,
          organizationId: user?.organizationId
        })
      }

      return response

    } catch (error) {
      // Error handling
      console.error('[API Error]', {
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      })

      // Check if error is already a NextResponse
      if (error instanceof NextResponse) {
        return error
      }

      // Return generic error response
      return NextResponse.json(
        { 
          error: 'Internal server error',
          requestId,
          message: process.env.NODE_ENV === 'development' 
            ? (error instanceof Error ? error.message : 'Unknown error')
            : 'An unexpected error occurred'
        },
        { 
          status: 500,
          headers: {
            'X-Request-Id': requestId
          }
        }
      )
    }
  }
}

/**
 * Create handlers for all HTTP methods
 */
export function createRouteHandlers(
  handlers: {
    GET?: RouteHandler
    POST?: RouteHandler
    PUT?: RouteHandler
    PATCH?: RouteHandler
    DELETE?: RouteHandler
  },
  options: RouteHandlerOptions = {}
) {
  const wrappedHandlers: any = {}

  if (handlers.GET) {
    wrappedHandlers.GET = createRouteHandler(handlers.GET, options)
  }
  if (handlers.POST) {
    wrappedHandlers.POST = createRouteHandler(handlers.POST, options)
  }
  if (handlers.PUT) {
    wrappedHandlers.PUT = createRouteHandler(handlers.PUT, options)
  }
  if (handlers.PATCH) {
    wrappedHandlers.PATCH = createRouteHandler(handlers.PATCH, options)
  }
  if (handlers.DELETE) {
    wrappedHandlers.DELETE = createRouteHandler(handlers.DELETE, options)
  }

  return wrappedHandlers
}

/**
 * Helper to create public route handlers (no auth)
 */
export function createPublicRouteHandler(
  handler: RouteHandler,
  options: Omit<RouteHandlerOptions, 'auth'> = {}
) {
  return createRouteHandler(handler, { ...options, auth: false })
}

/**
 * Helper to create admin-only route handlers
 */
export function createAdminRouteHandler(
  handler: RouteHandler,
  options: Omit<RouteHandlerOptions, 'auth' | 'requiredPermissions'> = {}
) {
  return createRouteHandler(handler, { 
    ...options, 
    auth: true,
    requiredPermissions: ['admin']
  })
}