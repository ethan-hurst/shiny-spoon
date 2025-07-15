import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Handle errors from Supabase
  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${error}&description=${encodeURIComponent(error_description || '')}`, requestUrl.origin)
    )
  }

  if (code) {
    const supabase = createClient()
    
    try {
      // Exchange code for session
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (sessionError) {
        console.error('Session exchange error:', sessionError)
        return NextResponse.redirect(
          new URL('/login?error=session_error', requestUrl.origin)
        )
      }

      // Get the user to verify authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('User fetch error:', userError)
        return NextResponse.redirect(
          new URL('/login?error=user_error', requestUrl.origin)
        )
      }

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError)
        // Profile should exist from trigger, but handle edge case
        return NextResponse.redirect(
          new URL('/login?error=profile_error', requestUrl.origin)
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