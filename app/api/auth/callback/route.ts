import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Handle errors from Supabase
  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(
      new URL(
        `/login?error=${error}&description=${encodeURIComponent(error_description || '')}`,
        requestUrl.origin
      )
    )
  }

  if (code) {
    const supabase = createClient()

    try {
      // Exchange code for session
      const { error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code)

      if (sessionError) {
        console.error('Session exchange error:', sessionError)
        return NextResponse.redirect(
          new URL('/login?error=session_error', requestUrl.origin)
        )
      }

      // Successful authentication, redirect to next URL
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    } catch (error) {
      console.error('Unexpected error in auth callback:', error)
      return NextResponse.redirect(
        new URL('/login?error=unexpected_error', requestUrl.origin)
      )
    }
  }

  // No code provided
  return NextResponse.redirect(
    new URL('/login?error=no_code', requestUrl.origin)
  )
}
