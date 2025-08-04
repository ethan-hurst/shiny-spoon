'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/supabase/types/database'

export async function signInWithEmail(email: string, password: string) {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Sign-in error:', error)
    return { error: error.message }
  }

  if (!data.user || !data.session) {
    return { error: 'Sign-in failed' }
  }

  // The browser client will automatically handle cookies
  return { success: true, user: data.user }
}