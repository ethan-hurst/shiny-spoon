import { createClient } from '@supabase/supabase-js'
import { Database } from '@/supabase/types/database'

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseConfigError'
  }
}

// Option 1: Throw early with clear error messages
export const createTypedClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new SupabaseConfigError(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.'
    )
  }

  if (!anonKey) {
    throw new SupabaseConfigError(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.'
    )
  }

  return createClient<Database>(url, anonKey)
}

// Option 2: Accept parameters with defaults
export const createTypedClientWithParams = (
  url?: string,
  anonKey?: string
) => {
  const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new SupabaseConfigError(
      'Supabase URL and anon key are required. Provide them as parameters or set environment variables.'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Option 3: Return null for graceful handling
export const createTypedClientSafe = (): ReturnType<typeof createClient<Database>> | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error(
      'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
    return null
  }

  return createClient<Database>(url, anonKey)
}