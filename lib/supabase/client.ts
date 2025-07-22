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

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set. Some features will be unavailable.')
    // Return a mock client during build time
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: [], error: null }),
        update: () => ({ data: [], error: null }),
        delete: () => ({ data: [], error: null }),
      }),
    } as any
  }

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)

  return client
}

// Export with the expected name for compatibility
export { createClient as createBrowserClient }
