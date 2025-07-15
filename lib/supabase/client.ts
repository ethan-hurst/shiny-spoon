// Browser client for Supabase
// This client is safe to use in browser/client components

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

// Create a singleton instance
let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}

// Export a default client instance for convenience
export const supabase = createClient()