import { NextRequest, NextResponse } from 'next/server'
import { sentryService } from './sentry-service'

export interface PerformanceMetrics {
  route: string
  method: string
  responseTime: number
  statusCode: number
  userAgent?: string
  ip?: string
  userId?: string
  organizationId?: string
}

export function withPerformanceMonitoring(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const url = new URL(request.url)
    const route = url.pathname
    const method = request.method
    
    // Extract user info from headers or cookies
    const userAgent = request.headers.get('user-agent')
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    // Get user context if available
    const authHeader = request.headers.get('authorization')
    let userId: string | undefined
    let organizationId: string | undefined
    
    if (authHeader) {
      try {
        // Extract user info from JWT or other auth mechanism
        // This is a simplified example - adjust based on your auth setup
        const token = authHeader.replace('Bearer ', '')
        // You might want to decode the JWT here to get user info
      } catch (error) {
        // Ignore auth parsing errors
      }
    }
    
    // Start Sentry transaction
    const transaction = sentryService.monitorApiRoute(route, method, {
      userId,
      organizationId,
      ip,
      userAgent,
    })
    
    try {
      // Add breadcrumb for request start
      sentryService.addBreadcrumb(
        `API Request: ${method} ${route}`,
        'api',
        'info',
        { method, route, userAgent }
      )
      
      // Execute the handler
      const response = await handler(request)
      
      // Calculate response time
      const responseTime = Date.now() - startTime
      
      // Record performance metrics
      const metrics: PerformanceMetrics = {
        route,
        method,
        responseTime,
        statusCode: response.status,
        userAgent,
        ip,
        userId,
        organizationId,
      }
      
      // Log slow requests
      if (responseTime > 5000) { // 5 seconds
        sentryService.captureMessage(
          `Slow API request: ${method} ${route} took ${responseTime}ms`,
          'warning',
          { ...metrics, action: 'slow_request' }
        )
      }
      
      // Log errors
      if (response.status >= 400) {
        sentryService.captureMessage(
          `API Error: ${method} ${route} returned ${response.status}`,
          'error',
          { ...metrics, action: 'api_error' }
        )
      }
      
      // Add response breadcrumb
      sentryService.addBreadcrumb(
        `API Response: ${method} ${route} - ${response.status}`,
        'api',
        'info',
        { statusCode: response.status, responseTime }
      )
      
      // Set transaction status
      transaction.setStatus(response.status < 400 ? 'ok' : 'internal_error')
      
      // Add custom headers for monitoring
      const responseWithHeaders = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...response.headers,
          'X-Response-Time': `${responseTime}ms`,
          'X-Request-ID': transaction.spanId || 'unknown',
        },
      })
      
      return responseWithHeaders
    } catch (error) {
      // Calculate response time even for errors
      const responseTime = Date.now() - startTime
      
      // Record error metrics
      const metrics: PerformanceMetrics = {
        route,
        method,
        responseTime,
        statusCode: 500,
        userAgent,
        ip,
        userId,
        organizationId,
      }
      
      // Capture the error
      sentryService.captureException(error as Error, {
        ...metrics,
        action: 'api_error',
      })
      
      // Set transaction status
      transaction.setStatus('internal_error')
      
      // Return error response
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      )
    } finally {
      // Finish the transaction
      transaction.finish()
    }
  }
}

// Helper function to wrap API routes with performance monitoring
export function monitorApiRoute(
  route: string,
  method: string,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withPerformanceMonitoring(handler)
}