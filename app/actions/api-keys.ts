'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import crypto from 'crypto'
import { 
  SUBSCRIPTION_LIMITS, 
  DEFAULT_PLAN, 
  isLimitExceeded,
  type SubscriptionPlan 
} from '@/lib/constants/subscription-limits'
import type { 
  ApiKey, 
  ApiKeyResponse, 
  CustomerBilling, 
  UserProfile,
  ApiKeyPermission
} from '@/types/api-keys.types'
import { API_KEY_CONFIG } from '@/lib/constants/api-keys'

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  permissions: z.array(z.enum(['read', 'write', 'delete'] as const)).min(1, 'At least one permission is required'),
  expiresAt: z.string().datetime().optional(),
})

const updateApiKeySchema = z.object({
  id: z.string().uuid('Invalid API key ID'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional(),
  permissions: z.array(z.enum(['read', 'write', 'delete'] as const)).min(1, 'At least one permission is required').optional(),
  isActive: z.boolean().optional(),
})

const revokeApiKeySchema = z.object({
  keyId: z.string().uuid('Invalid API key ID'),
})

const regenerateApiKeySchema = z.object({
  keyId: z.string().uuid('Invalid API key ID'),
})

/**
 * Generates a secure API key and its hash for storage.
 *
 * @returns An object containing the plain API key (`key`) and its hashed value (`hash`).
 */
function generateApiKey(): { key: string; hash: string } {
  // Generate a random key with prefix
  const prefix = API_KEY_CONFIG.PREFIX.LIVE
  const randomBytes = crypto.randomBytes(API_KEY_CONFIG.KEY_LENGTH).toString('base64url')
  const key = `${prefix}${randomBytes}`
  
  // Hash the key for storage
  const hash = crypto.createHash(API_KEY_CONFIG.HASH_ALGORITHM).update(key).digest('hex')
  
  return { key, hash }
}

/**
 * Retrieves the user profile for the specified user ID, ensuring the user is associated with an organization.
 *
 * @param userId - The unique identifier of the user whose profile is being fetched.
 * @returns The user's profile data.
 * @throws If the profile cannot be fetched or if the user is not associated with any organization.
 */
async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<UserProfile> {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      throw new Error('Failed to fetch user profile')
    }

    if (!profile?.organization_id) {
      throw new Error('No organization found for user')
    }

    return profile as UserProfile
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An unexpected error occurred while fetching user profile')
  }
}

/**
 * Retrieves the billing information for a given organization.
 *
 * Returns the organization's billing record if it exists, or null if no billing record is found. Throws an error if the query fails for other reasons.
 *
 * @param organizationId - The unique identifier of the organization whose billing information is requested
 * @returns The organization's billing information, or null if no billing record exists
 */
async function getCustomerBilling(
  supabase: Awaited<ReturnType<typeof createClient>>, 
  organizationId: string
): Promise<CustomerBilling | null> {
  try {
    const { data: billing, error } = await supabase
      .from('customer_billing')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    if (error) {
      // If no billing record exists, return null (will use default plan)
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching customer billing:', error)
      throw new Error('Failed to fetch billing information')
    }

    return billing as CustomerBilling
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An unexpected error occurred while fetching billing information')
  }
}

/**
 * Creates a new API key for the authenticated user's organization, enforcing subscription-based limits and input validation.
 *
 * Validates the provided form data, checks the organization's current API key count against its subscription plan limit, generates a secure API key, stores its hash in the database, and returns the new key (shown only once).
 *
 * @param formData - The form data containing API key creation details
 * @returns An object with the new API key's ID, the plain key (displayed once), and a message
 */
export async function createApiKey(formData: FormData): Promise<ApiKeyResponse> {
  try {
    const supabase = await createClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized: Please log in to continue')
    }

    // Get user profile
    const profile = await getUserProfile(supabase, user.id)

    // Parse and validate input
    const validationResult = createApiKeySchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      permissions: formData.getAll('permissions'),
      expiresAt: formData.get('expiresAt') || undefined,
    })

    if (!validationResult.success) {
      throw new Error(validationResult.error.errors[0]?.message || 'Validation error')
    }

    const parsed = validationResult.data

    // Check API key limits based on subscription
    const { data: existingKeys, error: countError } = await supabase
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)

    if (countError) {
      console.error('Error counting API keys:', countError)
      throw new Error('Failed to check API key limits')
    }

    const keyCount = existingKeys?.count || 0
    
    // Get subscription plan
    const billing = await getCustomerBilling(supabase, profile.organization_id)
    const subscriptionPlan = (billing?.subscription_plan || DEFAULT_PLAN) as SubscriptionPlan
    
    // Check limits
    const limit = SUBSCRIPTION_LIMITS[subscriptionPlan]?.apiKeys || SUBSCRIPTION_LIMITS[DEFAULT_PLAN].apiKeys
    if (isLimitExceeded(limit, keyCount)) {
      throw new Error(`API key limit reached (${keyCount}/${limit}). Upgrade your plan to create more keys.`)
    }

    // Generate API key
    const { key, hash } = generateApiKey()

    // Store hashed key in database
    const adminSupabase = supabaseAdmin
    const { data, error } = await adminSupabase
      .from('api_keys')
      .insert({
        organization_id: profile.organization_id,
        name: parsed.name,
        description: parsed.description,
        key_hash: hash,
        key_prefix: key.substring(0, API_KEY_CONFIG.PREFIX_DISPLAY_LENGTH), // Store prefix for identification
        permissions: parsed.permissions as ApiKeyPermission[],
        expires_at: parsed.expiresAt,
        created_by: user.id,
        last_used_at: null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating API key:', error)
      throw new Error('Failed to create API key')
    }

    // Return the full key (only shown once)
    return { 
      id: data.id,
      key,
      message: 'Store this key securely. It will not be shown again.'
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An unexpected error occurred while creating API key')
  }
}

/**
 * Updates an existing API key's metadata and permissions for the authenticated user's organization.
 *
 * Validates the provided form data, ensures user authentication, and applies updates to the specified API key record. Throws an error if validation fails, the user is unauthorized, or the update operation encounters an issue.
 */
export async function updateApiKey(formData: FormData): Promise<void> {
  try {
    const supabase = await createClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized: Please log in to continue')
    }

    // Get user profile
    const profile = await getUserProfile(supabase, user.id)

    // Parse and validate input
    const validationResult = updateApiKeySchema.safeParse({
      id: formData.get('id'),
      name: formData.get('name') || undefined,
      description: formData.get('description') || undefined,
      permissions: formData.has('permissions') ? formData.getAll('permissions') : undefined,
      isActive: formData.has('isActive') ? formData.get('isActive') === 'true' : undefined,
    })

    if (!validationResult.success) {
      throw new Error(validationResult.error.errors[0]?.message || 'Validation error')
    }

    const parsed = validationResult.data

    // Build update object
    const updateData: Partial<ApiKey> = {
      updated_at: new Date().toISOString(),
    }

    if (parsed.name !== undefined) updateData.name = parsed.name
    if (parsed.description !== undefined) updateData.description = parsed.description
    if (parsed.permissions !== undefined) updateData.permissions = parsed.permissions as ApiKeyPermission[]
    if (parsed.isActive !== undefined) updateData.is_active = parsed.isActive

    // Update the API key
    const { error } = await supabase
      .from('api_keys')
      .update(updateData)
      .eq('id', parsed.id)
      .eq('organization_id', profile.organization_id)

    if (error) {
      console.error('Error updating API key:', error)
      throw new Error('Failed to update API key')
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An unexpected error occurred while updating API key')
  }
}

/**
 * Revokes an API key by marking it as inactive and recording revocation details.
 *
 * Validates the key ID, authenticates the user, verifies organizational ownership, and performs a soft delete by updating the API key's status.
 *
 * @param keyId - The unique identifier of the API key to revoke
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  try {
    // Validate input
    const validationResult = revokeApiKeySchema.safeParse({ keyId })
    if (!validationResult.success) {
      throw new Error(validationResult.error.errors[0]?.message || 'Validation error')
    }

    const supabase = await createClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized: Please log in to continue')
    }

    // Get user profile
    const profile = await getUserProfile(supabase, user.id)

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

    if (error) {
      console.error('Error revoking API key:', error)
      throw new Error('Failed to revoke API key')
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An unexpected error occurred while revoking API key')
  }
}

/**
 * Regenerates an API key by revoking the existing key and creating a new one with the same settings.
 *
 * @param keyId - The unique identifier of the API key to regenerate
 * @returns An object containing the new API key ID, the plain key (shown once), and a message
 */
export async function regenerateApiKey(keyId: string): Promise<ApiKeyResponse> {
  try {
    // Validate input
    const validationResult = regenerateApiKeySchema.safeParse({ keyId })
    if (!validationResult.success) {
      throw new Error(validationResult.error.errors[0]?.message || 'Validation error')
    }

    const supabase = await createClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized: Please log in to continue')
    }

    // Get user profile
    const profile = await getUserProfile(supabase, user.id)

    // Get existing key details
    const { data: existingKey, error: fetchError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (fetchError || !existingKey) {
      console.error('Error fetching API key:', fetchError)
      throw new Error('API key not found')
    }

    const typedExistingKey = existingKey as ApiKey

    // Revoke the old key
    await revokeApiKey(keyId)

    // Create a new key with the same settings
    const { key, hash } = generateApiKey()

    const adminSupabase = supabaseAdmin
    const { data, error } = await adminSupabase
      .from('api_keys')
      .insert({
        organization_id: profile.organization_id,
        name: typedExistingKey.name,
        description: typedExistingKey.description,
        key_hash: hash,
        key_prefix: key.substring(0, API_KEY_CONFIG.PREFIX_DISPLAY_LENGTH),
        permissions: typedExistingKey.permissions,
        expires_at: typedExistingKey.expires_at,
        created_by: user.id,
        regenerated_from: keyId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating new API key:', error)
      throw new Error('Failed to regenerate API key')
    }

    return { 
      id: data.id,
      key,
      message: 'New key generated. Store it securely. It will not be shown again.'
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An unexpected error occurred while regenerating API key')
  }
}