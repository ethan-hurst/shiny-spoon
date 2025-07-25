// Browser client for Supabase
// This client is safe to use in browser/client components

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/supabase/types/database'
// import type { SupabaseClient } from '@supabase/supabase-js' // Not currently used

// Create a singleton instance
let client: ReturnType<typeof createBrowserClient<Database>> | undefined

// Mock client interface for when environment variables are missing
interface MockSupabaseClient {
  auth: {
    getUser: () => Promise<{ data: { user: null }, error: null }>
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      data: { subscription: { unsubscribe: () => void } }
    }
    signOut: () => Promise<{ error: null }>
    signInWithPassword: (credentials: any) => Promise<{ data: { user: null, session: null }, error: Error }>
  }
  from: (table: string) => {
    select: (columns?: string) => Promise<{ data: any[], error: null }>
    insert: (values: any) => Promise<{ data: any[], error: null }>
    update: (values: any) => Promise<{ data: any[], error: null }>
    delete: () => Promise<{ data: any[], error: null }>
    eq: (column: string, value: any) => any
    single: () => Promise<{ data: null, error: Error }>
  }
  channel: (name: string) => {
    on: (event: string, config: any, callback: Function) => any
    subscribe: () => any
  }
  removeChannel: (channel: any) => void
}

/**
 * Returns a singleton Supabase client for browser usage, or a mock client if required environment variables are missing.
 *
 * If the necessary Supabase environment variables are not set, a mock client is returned that allows the application to run but does not provide real authentication or database functionality.
 * @returns The Supabase client instance or a mock client if configuration is incomplete
 */
export function createClient() {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not set. Some features will be unavailable.')
    // Return a properly typed mock client during build time
    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: (_callback: (event: string, session: any) => void) => ({ 
          data: { subscription: { unsubscribe: () => {} } } 
        }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async (_credentials: any) => ({ 
          data: { user: null, session: null }, 
          error: new Error('Mock client - authentication not available') 
        }),
      },
      from: (_table: string) => {
        const mockQueryBuilder = {
          select: async (_columns?: string) => ({ data: [], error: null }),
          insert: async (_values: any) => ({ data: [], error: null }),
          update: async (_values: any) => ({ data: [], error: null }),
          delete: async () => ({ data: [], error: null }),
          eq: (_column: string, _value: any) => mockQueryBuilder,
          single: async () => ({ data: null, error: new Error('Mock client - no data available') }),
        }
        return mockQueryBuilder
      },
      channel: (_name: string) => ({
        on: (_event: string, _config: any, _callback: Function) => ({}),
        subscribe: () => ({}),
      }),
      removeChannel: (_channel: any) => {},
    }
    return mockClient as any
  }

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)

  return client
}

// Export with the expected name for compatibility
export { createClient as createBrowserClient }
