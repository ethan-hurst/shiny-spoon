'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import crypto from 'crypto'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.enum(['read', 'write', 'delete'])).min(1),
  expiresAt: z.string().datetime().optional(),
})

const updateApiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.enum(['read', 'write', 'delete'])).optional(),
  isActive: z.boolean().optional(),
})

// Generate a secure API key
function generateApiKey(): { key: string; hash: string } {
  // Generate a random key with prefix
  const prefix = 'sk_live_'
  const randomBytes = crypto.randomBytes(32).toString('base64url')
  const key = `${prefix}${randomBytes}`
  
  // Hash the key for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  
  return { key, hash }
}

export async function createApiKey(formData: FormData) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Parse and validate input
  const parsed = createApiKeySchema.parse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    permissions: formData.getAll('permissions'),
    expiresAt: formData.get('expiresAt') || undefined,
  })

  // Check API key limits based on subscription
  const { data: existingKeys } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)

  const keyCount = existingKeys?.count || 0
  
  // Check subscription limits (example limits)
  const { data: billing } = await supabase
    .from('customer_billing')
    .select('subscription_plan')
    .eq('organization_id', profile.organization_id)
    .single()

  const limits: Record<string, number> = {
    starter: 3,
    growth: 10,
    scale: -1, // unlimited
  }

  const limit = limits[billing?.subscription_plan || 'starter'] || 3
  if (limit !== -1 && keyCount >= limit) {
    throw new Error(`API key limit reached. Upgrade your plan to create more keys.`)
  }

  // Generate API key
  const { key, hash } = generateApiKey()

  // Store hashed key in database
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('api_keys')
    .insert({
      organization_id: profile.organization_id,
      name: parsed.name,
      description: parsed.description,
      key_hash: hash,
      key_prefix: key.substring(0, 12), // Store prefix for identification
      permissions: parsed.permissions,
      expires_at: parsed.expiresAt,
      created_by: user.id,
      last_used_at: null,
    })
    .select()
    .single()

  if (error) throw error

  // Return the full key (only shown once)
  return { 
    id: data.id,
    key,
    message: 'Store this key securely. It will not be shown again.'
  }
}

export async function updateApiKey(formData: FormData) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  const parsed = updateApiKeySchema.parse({
    id: formData.get('id'),
    name: formData.get('name') || undefined,
    description: formData.get('description') || undefined,
    permissions: formData.has('permissions') ? formData.getAll('permissions') : undefined,
    isActive: formData.has('isActive') ? formData.get('isActive') === 'true' : undefined,
  })

  // Update the API key
  const { error } = await supabase
    .from('api_keys')
    .update({
      ...(parsed.name && { name: parsed.name }),
      ...(parsed.description !== undefined && { description: parsed.description }),
      ...(parsed.permissions && { permissions: parsed.permissions }),
      ...(parsed.isActive !== undefined && { is_active: parsed.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.id)
    .eq('organization_id', profile.organization_id)

  if (error) throw error
}

export async function revokeApiKey(keyId: string) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Soft delete by marking as revoked
  const { error } = await supabase
    .from('api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    })
    .eq('id', keyId)
    .eq('organization_id', profile.organization_id)

  if (error) throw error
}

export async function regenerateApiKey(keyId: string) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Get existing key details
  const { data: existingKey } = await supabase
    .from('api_keys')
    .select('*')
    .eq('id', keyId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!existingKey) throw new Error('API key not found')

  // Revoke the old key
  await revokeApiKey(keyId)

  // Create a new key with the same settings
  const { key, hash } = generateApiKey()

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('api_keys')
    .insert({
      organization_id: profile.organization_id,
      name: existingKey.name,
      description: existingKey.description,
      key_hash: hash,
      key_prefix: key.substring(0, 12),
      permissions: existingKey.permissions,
      expires_at: existingKey.expires_at,
      created_by: user.id,
      regenerated_from: keyId,
    })
    .select()
    .single()

  if (error) throw error

  return { 
    id: data.id,
    key,
    message: 'New key generated. Store it securely. It will not be shown again.'
  }
}