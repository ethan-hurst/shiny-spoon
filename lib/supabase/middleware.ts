import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Try to get the session first
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  // Only log auth errors for non-static routes
  if (sessionError && !request.nextUrl.pathname.startsWith('/_next/')) {
    console.error('[Middleware] Session error:', sessionError.message)
  }

  const user = session?.user

  const protectedPaths = [
    '/',
    '/inventory',
    '/pricing',
    '/settings',
    '/sync',
    '/api/protected',
    '/setup',
  ]

  const isProtectedPath =
    request.nextUrl.pathname === '/' ||
    protectedPaths.some(
      (path) => path !== '/' && request.nextUrl.pathname.startsWith(path)
    )

  // Only log for non-static routes
  if (!request.nextUrl.pathname.startsWith('/_next/')) {
    console.log('[Middleware] Path:', request.nextUrl.pathname, 'Protected:', isProtectedPath, 'User:', !!user)
  }

  if (!user && isProtectedPath) {
    console.log('[Middleware] Redirecting to login - no user for protected path')
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const authPaths = ['/login', '/signup', '/reset-password']
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Allow access to test endpoints
  if (request.nextUrl.pathname.startsWith('/api/test-') || 
      request.nextUrl.pathname.startsWith('/api/debug-')) {
    return response
  }

  if (user && isAuthPath) {
    // Only redirect if not already going to home
    const redirectUrl = request.nextUrl.searchParams.get('redirectTo') || '/'
    if (redirectUrl !== request.nextUrl.pathname) {
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }
  }

  return response
}
