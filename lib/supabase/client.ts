import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/supabase/types/database'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set.')
  }

  // This creates a new client for every call, ensuring no stale data.
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Export with the expected name for compatibility
export { createClient as createBrowserClient }
