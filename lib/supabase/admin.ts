// Admin client for Supabase
// WARNING: This client uses the service role key and bypasses RLS
// Only use this in secure server-side contexts (API routes, server actions)
// NEVER expose this to the client or use in client components

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Ensure we're in a server environment
if (typeof window !== 'undefined') {
  throw new Error('Supabase admin client cannot be used in the browser!')
}

// Create admin client function
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Supabase admin environment variables not set. Admin features will be unavailable.')
    // Return a mock client during build time
    return {
      auth: {
        admin: {
          createUser: async () => ({ data: null, error: new Error('Admin client not configured') }),
          deleteUser: async () => ({ data: null, error: new Error('Admin client not configured') }),
        },
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: [], error: null }),
        update: () => Promise.resolve({ data: [], error: null }),
        delete: () => Promise.resolve({ data: [], error: null }),
      }),
    } as any
  }

  return createClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Create admin client instance
export const supabaseAdmin = createAdminClient()

// Helper functions for common admin operations

/**
 * Creates a new user with email/password and assigns to organization
 * Used for inviting users to organizations
 */
export async function createUserWithOrganization(
  email: string,
  password: string,
  organizationId: string,
  metadata?: {
    full_name?: string
    role?: 'owner' | 'admin' | 'member'
  }
) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      organization_id: organizationId,
      ...metadata,
    },
  })

  if (error) throw error
  return data
}

/**
 * Deletes a user and all associated data
 * Used for GDPR compliance and account removal
 */
export async function deleteUserCompletely(userId: string) {
  // User profile will be cascade deleted due to foreign key
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) throw error
  return { success: true }
}

/**
 * Updates user organization assignment
 * Used when transferring users between organizations
 */
export async function updateUserOrganization(
  userId: string,
  newOrganizationId: string
) {
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ organization_id: newOrganizationId })
    .eq('user_id', userId)

  if (error) throw error
  return { success: true }
}

/**
 * Performs admin-level data operations that bypass RLS
 * Use with extreme caution
 */
export async function adminQuery<T = any>(
  table: keyof Database['public']['Tables'],
  operation: 'select' | 'insert' | 'update' | 'delete',
  options?: any
): Promise<T> {
  const query = supabaseAdmin.from(table)[operation](options)

  const { data, error } = await query

  if (error) throw error
  return data as T
}
