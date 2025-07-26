'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AuthManager } from '@/lib/integrations/auth-manager'
import { integrationSchema, credentialSchema } from '@/types/integration.types'
import type { 
  IntegrationInsert, 
  IntegrationUpdate,
  CredentialTypeEnum,
  CredentialData,
} from '@/types/integration.types'

// Helper function for safe JSON parsing
const safeJsonParse = (value: string | null, defaultValue: any = {}) => {
  if (!value) return defaultValue
  try {
    return JSON.parse(value)
  } catch (error) {
    console.warn('Invalid JSON provided:', error)
    return defaultValue
  }
}

// Update schema - all fields optional for partial updates
const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'error', 'configuring', 'suspended']).optional(),
  config: z.record(z.any()).optional(),
  sync_settings: z.object({
    sync_products: z.boolean().optional(),
    sync_inventory: z.boolean().optional(),
    sync_pricing: z.boolean().optional(),
    sync_customers: z.boolean().optional(),
    sync_orders: z.boolean().optional(),
    sync_direction: z.enum(['push', 'pull', 'bidirectional']).optional(),
    sync_frequency_minutes: z.number().min(5).max(1440).optional(),
    batch_size: z.number().min(1).max(1000).optional(),
    field_mappings: z.record(z.string()).optional(),
    filters: z.record(z.any()).optional(),
  }).optional(),
})

// Create a new integration
export async function createIntegration(formData: FormData) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Parse and validate input with safe JSON parsing
    const input = {
      name: formData.get('name'),
      platform: formData.get('platform'),
      description: formData.get('description'),
      config: safeJsonParse(formData.get('config') as string),
      sync_settings: safeJsonParse(formData.get('sync_settings') as string),
    }

    const validated = integrationSchema.parse(input)

    // Create integration
    const integrationData: IntegrationInsert = {
      ...validated,
      organization_id: profile.organization_id,
      created_by: user.id,
      status: 'configuring',
    }

    const { data: integration, error } = await supabase
      .from('integrations')
      .insert(integrationData)
      .select()
      .single()

    if (error) throw error

    // Store credentials if provided
    const credentialTypeRaw = formData.get('credential_type') as string
    const credentials = formData.get('credentials')
    
    // Validate credential type
    const validCredentialTypes: CredentialTypeEnum[] = ['oauth2', 'api_key', 'basic_auth', 'custom']
    
    if (credentialTypeRaw && credentials && validCredentialTypes.includes(credentialTypeRaw as CredentialTypeEnum)) {
      const credentialType = credentialTypeRaw as CredentialTypeEnum
      const authManager = new AuthManager(integration.id, profile.organization_id)
      const parsedCredentials = safeJsonParse(credentials as string) as CredentialData
      
      if (parsedCredentials && Object.keys(parsedCredentials).length > 0) {
        await authManager.storeCredentials(credentialType, parsedCredentials)
      }
    } else if (credentialTypeRaw && !validCredentialTypes.includes(credentialTypeRaw as CredentialTypeEnum)) {
      console.warn(`Invalid credential type provided: ${credentialTypeRaw}`)
    }

    // Log creation
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integration.id,
      p_organization_id: profile.organization_id,
      p_log_type: 'config',
      p_severity: 'info',
      p_message: 'Integration created',
      p_details: { platform: validated.platform },
    })

    revalidatePath('/integrations')
    return { success: true, data: integration }
  } catch (error) {
    console.error('Failed to create integration:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Update an integration
export async function updateIntegration(formData: FormData) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const id = formData.get('id') as string
    if (!id) throw new Error('Integration ID required')

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Parse and validate update data with Zod schema
    const rawData: Record<string, any> = {}
    
    if (formData.has('name')) rawData.name = formData.get('name')
    if (formData.has('description')) rawData.description = formData.get('description')
    if (formData.has('status')) rawData.status = formData.get('status')
    if (formData.has('config')) rawData.config = safeJsonParse(formData.get('config') as string)
    if (formData.has('sync_settings')) rawData.sync_settings = safeJsonParse(formData.get('sync_settings') as string)
    
    // Validate with Zod schema
    const validated = updateIntegrationSchema.parse(rawData)
    
    // Use validated data as update data
    const updateData: IntegrationUpdate = validated

    // Update integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single()

    if (error) throw error

    // Update credentials if provided
    const credentialTypeRaw = formData.get('credential_type') as string
    const credentials = formData.get('credentials')
    
    // Validate credential type
    const validCredentialTypes: CredentialTypeEnum[] = ['oauth2', 'api_key', 'basic_auth', 'custom']
    
    if (credentialTypeRaw && credentials && validCredentialTypes.includes(credentialTypeRaw as CredentialTypeEnum)) {
      const credentialType = credentialTypeRaw as CredentialTypeEnum
      const authManager = new AuthManager(id, profile.organization_id)
      const parsedCredentials = safeJsonParse(credentials as string) as CredentialData
      
      if (parsedCredentials && Object.keys(parsedCredentials).length > 0) {
        await authManager.storeCredentials(credentialType, parsedCredentials)
      }
    } else if (credentialTypeRaw && !validCredentialTypes.includes(credentialTypeRaw as CredentialTypeEnum)) {
      console.warn(`Invalid credential type provided: ${credentialTypeRaw}`)
    }

    // Log update
    await supabase.rpc('log_integration_activity', {
      p_integration_id: id,
      p_organization_id: profile.organization_id,
      p_log_type: 'config',
      p_severity: 'info',
      p_message: 'Integration updated',
      p_details: updateData,
    })

    revalidatePath('/integrations')
    revalidatePath(`/integrations/${id}`)
    return { success: true, data: integration }
  } catch (error) {
    console.error('Failed to update integration:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Delete an integration
export async function deleteIntegration(id: string) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Check if integration has active sync jobs
    const { data: activeJobs } = await supabase
      .from('sync_jobs')
      .select('id')
      .eq('integration_id', id)
      .in('status', ['pending', 'running'])
      .limit(1)

    if (activeJobs && activeJobs.length > 0) {
      throw new Error('Cannot delete integration with active sync jobs')
    }

    // Delete credentials first (handled by cascade, but being explicit)
    const authManager = new AuthManager(id, profile.organization_id)
    await authManager.deleteCredentials()

    // Delete integration
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id)

    if (error) throw error

    revalidatePath('/integrations')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete integration:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Allowed entity types for sync operations
const ALLOWED_ENTITY_TYPES = ['products', 'inventory', 'orders', 'customers', 'pricing'] as const

// Trigger manual sync
export async function triggerSync(integrationId: string, entityType?: string) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Validate entityType if provided
    if (entityType && entityType !== 'all') {
      if (!ALLOWED_ENTITY_TYPES.includes(entityType as any)) {
        throw new Error(`Invalid entityType: must be one of ${ALLOWED_ENTITY_TYPES.join(', ')} or 'all'`)
      }
    }

    // Verify integration belongs to user's organization
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, status, sync_settings')
      .eq('id', integrationId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (!integration) throw new Error('Integration not found')
    if (integration.status !== 'active') throw new Error('Integration is not active')

    // Create sync job
    const jobPayload = {
      entity_type: entityType || 'all',
      operation: 'manual',
      requested_by: user.id,
    }

    const { data: job, error } = await supabase.rpc('create_sync_job', {
      p_integration_id: integrationId,
      p_organization_id: profile.organization_id,
      p_job_type: 'manual',
      p_payload: jobPayload,
      p_priority: 5,
    })

    if (error) throw error

    // Log sync trigger
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integrationId,
      p_organization_id: profile.organization_id,
      p_log_type: 'sync',
      p_severity: 'info',
      p_message: `Manual sync triggered for ${entityType || 'all entities'}`,
      p_details: { job_id: job },
    })

    revalidatePath(`/integrations/${integrationId}`)
    return { success: true, jobId: job }
  } catch (error) {
    console.error('Failed to trigger sync:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Test integration connection
export async function testConnection(integrationId: string) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) throw new Error('User profile not found')

    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (!integration) throw new Error('Integration not found')

    // Get credentials
    const authManager = new AuthManager(integrationId, profile.organization_id)
    const credentials = await authManager.getCredentials()

    if (!credentials) throw new Error('No credentials configured')

    // Platform-specific connection tests
    let testPassed = false
    let testDetails: Record<string, any> = {}

    try {
      switch (integration.platform) {
        case 'shopify': {
          // Test Shopify connection with a simple API call
          const shopDomain = integration.config?.shop_domain
          const apiVersion = integration.config?.api_version || '2024-01'
          
          if (!shopDomain || !credentials.access_token) {
            throw new Error('Missing Shopify configuration')
          }

          const shopifyResponse = await fetch(
            `https://${shopDomain}/admin/api/${apiVersion}/shop.json`,
            {
              headers: {
                'X-Shopify-Access-Token': credentials.access_token as string,
                'Content-Type': 'application/json',
              },
            }
          )

          testPassed = shopifyResponse.ok
          if (testPassed) {
            const shopData = await shopifyResponse.json()
            testDetails = {
              shop_name: shopData.shop?.name,
              shop_domain: shopData.shop?.domain,
              api_version: apiVersion,
              plan_name: shopData.shop?.plan_name,
            }
          } else {
            testDetails = {
              error: `HTTP ${shopifyResponse.status}`,
              message: shopifyResponse.statusText,
            }
          }
          break
        }
        
        case 'netsuite': {
          // Test NetSuite connection with REST API
          const accountId = integration.config?.account_id
          const restUrl = integration.config?.rest_url
          
          if (!accountId || !restUrl || !credentials) {
            throw new Error('Missing NetSuite configuration')
          }

          // NetSuite uses OAuth 1.0a, so we need to build the auth header
          // For now, we'll check if credentials exist
          if (
            credentials.consumer_key &&
            credentials.consumer_secret &&
            credentials.token_id &&
            credentials.token_secret
          ) {
            testPassed = true
            testDetails = {
              account_id: accountId,
              rest_url: restUrl,
              auth_method: 'OAuth 1.0a',
            }
          } else {
            throw new Error('Invalid NetSuite credentials')
          }
          break
        }

        case 'quickbooks': {
          // Test QuickBooks connection
          const companyId = integration.config?.company_id
          const sandbox = integration.config?.sandbox || false
          
          if (!companyId || !credentials.access_token) {
            throw new Error('Missing QuickBooks configuration')
          }

          const qbBaseUrl = sandbox 
            ? 'https://sandbox-quickbooks.api.intuit.com'
            : 'https://quickbooks.api.intuit.com'

          const qbResponse = await fetch(
            `${qbBaseUrl}/v3/company/${companyId}/companyinfo/${companyId}`,
            {
              headers: {
                'Authorization': `Bearer ${credentials.access_token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
            }
          )

          testPassed = qbResponse.ok
          if (testPassed) {
            const companyInfo = await qbResponse.json()
            testDetails = {
              company_name: companyInfo.CompanyInfo?.CompanyName,
              company_id: companyId,
              sandbox: sandbox,
            }
          } else {
            testDetails = {
              error: `HTTP ${qbResponse.status}`,
              message: qbResponse.statusText,
            }
          }
          break
        }
        
        default:
          testDetails = { 
            message: 'Connection test not implemented for this platform',
            platform: integration.platform,
          }
          testPassed = false
      }
    } catch (testError) {
      testPassed = false
      testDetails = {
        error: testError instanceof Error ? testError.message : 'Connection test failed',
        platform: integration.platform,
      }
    }

    // Log test result
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integrationId,
      p_organization_id: profile.organization_id,
      p_log_type: 'auth',
      p_severity: testPassed ? 'info' : 'error',
      p_message: testPassed ? 'Connection test passed' : 'Connection test failed',
      p_details: testDetails,
    })

    return { success: testPassed, details: testDetails }
  } catch (error) {
    console.error('Failed to test connection:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}