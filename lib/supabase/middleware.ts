// Supabase middleware for Next.js
// Handles auth session refresh and protected routes

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/supabase/types/database'

/**
 * Middleware to manage Supabase authentication session and route access in a Next.js application.
 *
 * Refreshes the user's session if needed, redirects unauthenticated users away from protected routes to the login page, and redirects authenticated users away from authentication pages to the dashboard. Updates cookies as necessary to maintain session state.
 *
 * @returns A NextResponse object that may include updated cookies or a redirect, depending on authentication status and route.
 */
export async function updateSession(request: NextRequest) {
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set. Auth features disabled.')
    // Return unmodified response if Supabase is not configured
    return NextResponse.next({
      request,
    })
  }

  // Create response to modify
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Create Supabase client with cookie handling
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async getAll() {
        return request.cookies.getAll()
      },
      async setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh session if expired - handle potential errors
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // Handle authentication errors
  if (error) {
    console.error('Supabase auth error in middleware:', error)
    // For auth errors, treat as unauthenticated
  }

  // Protected routes that require authentication
  const protectedPaths = [
    '/dashboard',
    '/inventory',
    '/pricing',
    '/settings',
    '/sync',
    '/api/protected',
  ]

  // Check if current path is protected
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect to login if accessing protected route without auth
  if (!user && isProtectedPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to dashboard if accessing auth pages while logged in
  const authPaths = ['/login', '/signup', '/reset-password']
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (user && isAuthPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

/**
 * Determines whether the authenticated user has at least the specified role.
 *
 * Checks the user's role from the `user_profiles` table and compares it to the required role using a predefined hierarchy (owner > admin > member).
 *
 * @param request - The incoming Next.js request containing authentication cookies
 * @param requiredRole - The minimum role required for access ('owner', 'admin', or 'member')
 * @returns `true` if the user is authenticated and their role meets or exceeds the required role; otherwise, `false`
 */
export async function checkUserRole(
  request: NextRequest,
  requiredRole: 'owner' | 'admin' | 'member'
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set. Role check failed.')
    return false
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Read-only operation
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !profile.role) return false

  // Role hierarchy: owner > admin > member
  const roleHierarchy = { owner: 3, admin: 2, member: 1 }
  const userRoleLevel =
    roleHierarchy[profile.role as keyof typeof roleHierarchy] || 0
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0

  return userRoleLevel >= requiredRoleLevel
}
