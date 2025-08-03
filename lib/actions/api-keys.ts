'use server'

import { createClient } from '@/lib/supabase/server'
import { ApiKey, ApiScope, ApiTier } from '@/lib/api/types'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  const prefix = 'sk_'
  const randomBytes = crypto.randomBytes(32)
  const key = randomBytes.toString('base64')
    .replace(/[+/]/g, '')
    .replace(/=/g, '')
    .substring(0, 32)
  return prefix + key
}

/**
 * Hash API key for secure storage
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Create a new API key
 */
export async function createApiKey(data: {
  name: string
  tier: ApiTier
  scopes: ApiScope[]
  ipWhitelist?: string[]
  expiresAt?: Date
}): Promise<{ key: string; apiKey: ApiKey }> {
  const supabase = createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized')
  }
  
  // Get tenant ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.tenant_id) {
    throw new Error('No tenant found')
  }
  
  // Generate API key
  const key = generateApiKey()
  const keyHash = hashApiKey(key)
  
  // Create API key record
  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .insert({
      tenant_id: profile.tenant_id,
      key_hash: keyHash,
      name: data.name,
      tier: data.tier,
      scopes: data.scopes,
      ip_whitelist: data.ipWhitelist || [],
      expires_at: data.expiresAt?.toISOString(),
      created_by: user.id,
      rate_limit: {
        requests: data.tier === ApiTier.BASIC ? 100 : data.tier === ApiTier.PRO ? 1000 : 10000,
        window: 3600
      }
    })
    .select()
    .single()
  
  if (error || !apiKey) {
    throw new Error('Failed to create API key')
  }
  
  revalidatePath('/settings/api')
  
  return {
    key,
    apiKey: {
      ...apiKey,
      key,
      tenantId: apiKey.tenant_id,
      createdAt: new Date(apiKey.created_at),
      updatedAt: new Date(apiKey.updated_at),
      expiresAt: apiKey.expires_at ? new Date(apiKey.expires_at) : undefined,
      lastUsedAt: apiKey.last_used_at ? new Date(apiKey.last_used_at) : undefined
    }
  }
}

/**
 * Get all API keys for the current tenant
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  const supabase = createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized')
  }
  
  // Get tenant ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.tenant_id) {
    throw new Error('No tenant found')
  }
  
  // Get API keys
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
  
  if (error) {
    throw new Error('Failed to fetch API keys')
  }
  
  return (apiKeys || []).map(key => ({
    id: key.id,
    key: `${key.key_hash.substring(0, 8)}...`,
    name: key.name,
    tenantId: key.tenant_id,
    scopes: key.scopes || [],
    tier: key.tier,
    rateLimit: key.rate_limit,
    ipWhitelist: key.ip_whitelist || [],
    createdAt: new Date(key.created_at),
    updatedAt: new Date(key.updated_at),
    expiresAt: key.expires_at ? new Date(key.expires_at) : undefined,
    lastUsedAt: key.last_used_at ? new Date(key.last_used_at) : undefined
  }))
}

/**
 * Delete an API key
 */
export async function deleteApiKey(id: string): Promise<void> {
  const supabase = createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized')
  }
  
  // Get tenant ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.tenant_id) {
    throw new Error('No tenant found')
  }
  
  // Delete API key
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
  
  if (error) {
    throw new Error('Failed to delete API key')
  }
  
  revalidatePath('/settings/api')
}

/**
 * Regenerate an API key
 */
export async function regenerateApiKey(id: string): Promise<{ key: string }> {
  const supabase = createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized')
  }
  
  // Get tenant ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.tenant_id) {
    throw new Error('No tenant found')
  }
  
  // Generate new key
  const key = generateApiKey()
  const keyHash = hashApiKey(key)
  
  // Update API key
  const { error } = await supabase
    .from('api_keys')
    .update({
      key_hash: keyHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
  
  if (error) {
    throw new Error('Failed to regenerate API key')
  }
  
  revalidatePath('/settings/api')
  
  return { key }
}

/**
 * Get API usage statistics
 */
export async function getApiUsageStats(
  apiKeyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTime: number
  endpoints: Record<string, { count: number; avgResponseTime: number }>
}> {
  const supabase = createClient()
  
  // Get usage stats using the SQL function
  const { data, error } = await supabase
    .rpc('calculate_api_usage', {
      p_api_key_id: apiKeyId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString()
    })
    .single()
  
  if (error || !data) {
    console.error('Failed to fetch API usage stats:', error)
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      endpoints: {}
    }
  }
  
  return {
    totalRequests: data.total_requests || 0,
    successfulRequests: data.successful_requests || 0,
    failedRequests: data.failed_requests || 0,
    avgResponseTime: data.avg_response_time || 0,
    endpoints: data.endpoints || {}
  }
}