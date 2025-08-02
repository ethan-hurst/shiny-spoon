import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { checkTenantRateLimit, addRateLimitHeaders } from '@/lib/rate-limit/distributed-limiter'
import { runWithTenant } from '@/lib/queue/distributed-queue'

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/api/health',
  '/api/cron',
]

// Define routes that should skip rate limiting
const rateLimitExemptRoutes = [
  '/api/health',
  '/api/metrics',
  '/api/cron',
]

// Define rate limit operations by route pattern
const routeRateLimitMap: Record<string, string> = {
  '/api/auth': 'auth',
  '/api/export': 'export',
  '/api/bulk': 'bulk',
  '/api/ai': 'ai',
  '/api': 'api', // Default for all other API routes
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Skip middleware for static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return res
  }

  // Create Supabase client
  const supabase = createMiddlewareClient({ req, res })

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (!isPublicRoute) {
    // Verify authentication
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      // Redirect to login for web pages, return 401 for API routes
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Get user's organization
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .single()

    if (!userProfile?.organization_id) {
      // User doesn't belong to an organization
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }

    // Set tenant context in headers for server components
    res.headers.set('x-tenant-id', userProfile.organization_id)
    res.headers.set('x-user-role', userProfile.role || 'member')

    // Apply rate limiting for API routes
    if (pathname.startsWith('/api') && !rateLimitExemptRoutes.includes(pathname)) {
      // Determine rate limit operation
      const operation = Object.entries(routeRateLimitMap).find(([route]) => 
        pathname.startsWith(route)
      )?.[1] || 'api'

      // Check rate limit
      const rateLimitResult = await checkTenantRateLimit(
        userProfile.organization_id,
        operation as any
      )

      if (!rateLimitResult.allowed) {
        return new Response('Too Many Requests', {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.floor((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        })
      }

      // Add rate limit headers to successful responses
      res.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
      res.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      res.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())
    }

    // Track API usage for tenant
    if (pathname.startsWith('/api')) {
      // Fire and forget - don't block the request
      trackApiUsage(userProfile.organization_id, pathname).catch(console.error)
    }
  }

  return res
}

// Track API usage asynchronously
async function trackApiUsage(organizationId: string, path: string) {
  try {
    const supabase = createMiddlewareClient({ req: new NextRequest(new URL('http://localhost')), res: NextResponse.next() })
    
    // Extract API category from path
    const category = path.split('/')[2] || 'general'
    
    await supabase.from('tenant_usage').insert({
      organization_id: organizationId,
      metric_name: `api_call_${category}`,
      metric_value: 1,
    })
  } catch (error) {
    // Silently fail - don't impact the request
    console.error('Failed to track API usage:', error)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
