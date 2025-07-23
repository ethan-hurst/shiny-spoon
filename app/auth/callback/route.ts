import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Validate redirect URL to prevent open redirect vulnerabilities
  const validateRedirectUrl = (url: string, origin: string): string => {
    try {
      const redirectUrl = new URL(url, origin)
      // Only allow same-origin redirects
      if (redirectUrl.origin !== origin) {
        return '/dashboard' // Default safe redirect
      }
      return redirectUrl.pathname + redirectUrl.search
    } catch {
      return '/dashboard' // Default safe redirect for invalid URLs
    }
  }

  // Get and immediately validate the next parameter
  const rawNext = requestUrl.searchParams.get('next') || '/dashboard'
  const validatedRedirectUrl = validateRedirectUrl(rawNext, requestUrl.origin)

  if (code) {
    const supabase = await createClient()

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful authentication, redirect to validated URL
      return NextResponse.redirect(
        new URL(validatedRedirectUrl, requestUrl.origin)
      )
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_error', requestUrl.origin)
  )
}
