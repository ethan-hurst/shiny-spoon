'use server'

import { z } from 'zod'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { AccessControl } from '@/lib/security/access-control'
import { APIKeyManager } from '@/lib/security/api-key-manager'
import { SecurityMonitor } from '@/lib/security/security-monitor'
import { createClient } from '@/lib/supabase/server'

// Schemas for validation
const createAPIKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required'),
  expiresAt: z.string().optional(),
  rateLimit: z.number().min(1).max(10000).optional(),
  ipWhitelist: z.array(z.string()).optional(),
})

const createIPRuleSchema = z.object({
  ipAddress: z.string().min(1, 'IP address is required'),
  description: z.string().min(1, 'Description is required'),
  expiresAt: z.string().optional(),
})

const securityPolicySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['ip_whitelist', 'rate_limit', 'geo_block', 'user_agent_block']),
  rules: z.record(z.any()),
  priority: z.number().min(0).max(100),
})

/**
 * Generate a new API key
 */
export async function generateAPIKey(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(rateLimiters.api, user.id)
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    // Validate input
    const validatedData = createAPIKeySchema.parse({
      name: formData.get('name'),
      permissions: formData.getAll('permissions'),
      expiresAt: formData.get('expiresAt') || undefined,
      rateLimit: formData.get('rateLimit')
        ? parseInt(formData.get('rateLimit') as string)
        : undefined,
      ipWhitelist: formData.getAll('ipWhitelist'),
    })

    const apiKeyManager = new APIKeyManager(supabase)
    const result = await apiKeyManager.generateAPIKey(
      profile.organization_id,
      validatedData.name,
      validatedData.permissions,
      {
        expiresAt: validatedData.expiresAt
          ? new Date(validatedData.expiresAt)
          : undefined,
        rateLimit: validatedData.rateLimit,
        ipWhitelist: validatedData.ipWhitelist,
        createdBy: user.id,
      }
    )

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to generate API key:', error)
    return { error: 'Failed to generate API key' }
  }
}

/**
 * Rotate an API key
 */
export async function rotateAPIKey(keyId: string) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(rateLimiters.api, user.id)
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const apiKeyManager = new APIKeyManager(supabase)
    const result = await apiKeyManager.rotateAPIKey(
      keyId,
      profile.organization_id
    )

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to rotate API key:', error)
    return { error: 'Failed to rotate API key' }
  }
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(keyId: string) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const apiKeyManager = new APIKeyManager(supabase)
    await apiKeyManager.revokeAPIKey(keyId, profile.organization_id)

    return { success: true }
  } catch (error) {
    console.error('Failed to revoke API key:', error)
    return { error: 'Failed to revoke API key' }
  }
}

/**
 * List API keys for organization
 */
export async function listAPIKeys() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const apiKeyManager = new APIKeyManager(supabase)
    const apiKeys = await apiKeyManager.listAPIKeys(profile.organization_id)

    return { success: true, data: apiKeys }
  } catch (error) {
    console.error('Failed to list API keys:', error)
    return { error: 'Failed to list API keys' }
  }
}

/**
 * Get API key usage statistics
 */
export async function getAPIKeyUsage(keyId: string, days: number = 30) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    const apiKeyManager = new APIKeyManager(supabase)
    const usage = await apiKeyManager.getAPIKeyUsage(keyId, days)

    return { success: true, data: usage }
  } catch (error) {
    console.error('Failed to get API key usage:', error)
    return { error: 'Failed to get API key usage' }
  }
}

/**
 * Add IP to whitelist
 */
export async function addIPToWhitelist(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(rateLimiters.api, user.id)
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    // Validate input
    const validatedData = createIPRuleSchema.parse({
      ipAddress: formData.get('ipAddress'),
      description: formData.get('description'),
      expiresAt: formData.get('expiresAt') || undefined,
    })

    const accessControl = new AccessControl(supabase)
    const rule = await accessControl.addIPToWhitelist(
      profile.organization_id,
      validatedData.ipAddress,
      validatedData.description,
      user.id,
      validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined
    )

    return { success: true, data: rule }
  } catch (error) {
    console.error('Failed to add IP to whitelist:', error)
    return { error: 'Failed to add IP to whitelist' }
  }
}

/**
 * Remove IP from whitelist
 */
export async function removeIPFromWhitelist(ruleId: string) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const accessControl = new AccessControl(supabase)
    await accessControl.removeIPFromWhitelist(ruleId, profile.organization_id)

    return { success: true }
  } catch (error) {
    console.error('Failed to remove IP from whitelist:', error)
    return { error: 'Failed to remove IP from whitelist' }
  }
}

/**
 * Get IP whitelist for organization
 */
export async function getIPWhitelist() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const accessControl = new AccessControl(supabase)
    const rules = await accessControl.getIPWhitelist(profile.organization_id)

    return { success: true, data: rules }
  } catch (error) {
    console.error('Failed to get IP whitelist:', error)
    return { error: 'Failed to get IP whitelist' }
  }
}

/**
 * Get security metrics
 */
export async function getSecurityMetrics() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const securityMonitor = new SecurityMonitor(supabase)
    const metrics = await securityMonitor.getSecurityMetrics(
      profile.organization_id
    )

    return { success: true, data: metrics }
  } catch (error) {
    console.error('Failed to get security metrics:', error)
    return { error: 'Failed to get security metrics' }
  }
}

/**
 * Get active security alerts
 */
export async function getActiveSecurityAlerts() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const securityMonitor = new SecurityMonitor(supabase)
    const alerts = await securityMonitor.getActiveAlerts(
      profile.organization_id
    )

    return { success: true, data: alerts }
  } catch (error) {
    console.error('Failed to get security alerts:', error)
    return { error: 'Failed to get security alerts' }
  }
}

/**
 * Acknowledge security alert
 */
export async function acknowledgeSecurityAlert(alertId: string) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const securityMonitor = new SecurityMonitor(supabase)
    await securityMonitor.acknowledgeAlert(alertId, profile.organization_id)

    return { success: true }
  } catch (error) {
    console.error('Failed to acknowledge security alert:', error)
    return { error: 'Failed to acknowledge security alert' }
  }
}

/**
 * Resolve security alert
 */
export async function resolveSecurityAlert(alertId: string) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const securityMonitor = new SecurityMonitor(supabase)
    await securityMonitor.resolveAlert(alertId, profile.organization_id)

    return { success: true }
  } catch (error) {
    console.error('Failed to resolve security alert:', error)
    return { error: 'Failed to resolve security alert' }
  }
}

/**
 * Create security policy
 */
export async function createSecurityPolicy(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(rateLimiters.api, user.id)
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    // Validate input
    const validatedData = securityPolicySchema.parse({
      name: formData.get('name'),
      type: formData.get('type'),
      rules: JSON.parse(formData.get('rules') as string),
      priority: parseInt(formData.get('priority') as string),
    })

    const accessControl = new AccessControl(supabase)
    const policy = await accessControl.createSecurityPolicy(
      profile.organization_id,
      validatedData
    )

    return { success: true, data: policy }
  } catch (error) {
    console.error('Failed to create security policy:', error)
    return { error: 'Failed to create security policy' }
  }
}

/**
 * Get security policies
 */
export async function getSecurityPolicies() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return { error: 'Organization not found' }
    }

    const accessControl = new AccessControl(supabase)
    const policies = await accessControl.getSecurityPolicies(
      profile.organization_id
    )

    return { success: true, data: policies }
  } catch (error) {
    console.error('Failed to get security policies:', error)
    return { error: 'Failed to get security policies' }
  }
}
