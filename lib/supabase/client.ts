// Browser client for Supabase
// This client is safe to use in browser/client components

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

// Create a singleton instance
let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  }

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)

  return client
}

// Export a default client instance for convenience
export const supabase = createClient()
