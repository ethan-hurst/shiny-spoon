import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import config from './config'

export default async function middleware(req: NextRequest) {
  // If auth is disabled, pass through
  if (!config.auth.enabled) {
    return NextResponse.next()
  }

  // Use Supabase auth
  return await updateSession(req)
}

export const middlewareConfig = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
