import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import config from './config'

let clerkMiddleware: (arg0: (auth: any, req: any) => any) => {
    (arg0: any): any
    new (): any
  },
  createRouteMatcher

if (config.auth.enabled && config.auth.provider === 'clerk') {
  try {
    ;({ clerkMiddleware, createRouteMatcher } = require('@clerk/nextjs/server'))
  } catch (error) {
    console.warn('Clerk modules not available. Auth will be disabled.')
    config.auth.enabled = false
  }
}

const isProtectedRoute =
  config.auth.enabled && config.auth.provider === 'clerk'
    ? createRouteMatcher(['/dashboard(.*)'])
    : () => false

export default async function middleware(req: NextRequest) {
  // If auth is disabled, pass through
  if (!config.auth.enabled) {
    return NextResponse.next()
  }

  // Use Supabase auth by default
  if (!config.auth.provider || config.auth.provider === 'supabase') {
    return await updateSession(req)
  }

  // Fall back to Clerk if configured
  if (config.auth.provider === 'clerk' && clerkMiddleware) {
    return clerkMiddleware(async (auth, req) => {
      const resolvedAuth = await auth()

      if (!resolvedAuth.userId && isProtectedRoute(req)) {
        return resolvedAuth.redirectToSignIn()
      } else {
        return NextResponse.next()
      }
    })(req)
  }

  return NextResponse.next()
}

export const middlewareConfig = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
