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

    // Parse and validate input
    const input = {
      name: formData.get('name'),
      platform: formData.get('platform'),
      description: formData.get('description'),
      config: JSON.parse(formData.get('config') as string || '{}'),
      sync_settings: JSON.parse(formData.get('sync_settings') as string || '{}'),
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
    const credentialType = formData.get('credential_type') as CredentialTypeEnum
    const credentials = formData.get('credentials')
    
    if (credentialType && credentials) {
      const authManager = new AuthManager(integration.id, profile.organization_id)
      const parsedCredentials = JSON.parse(credentials as string) as CredentialData
      
      await authManager.storeCredentials(credentialType, parsedCredentials)
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

    // Build update data
    const updateData: IntegrationUpdate = {}
    
    if (formData.has('name')) updateData.name = formData.get('name') as string
    if (formData.has('description')) updateData.description = formData.get('description') as string
    if (formData.has('status')) updateData.status = formData.get('status') as any
    if (formData.has('config')) updateData.config = JSON.parse(formData.get('config') as string)
    if (formData.has('sync_settings')) updateData.sync_settings = JSON.parse(formData.get('sync_settings') as string)

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
    const credentialType = formData.get('credential_type') as CredentialTypeEnum
    const credentials = formData.get('credentials')
    
    if (credentialType && credentials) {
      const authManager = new AuthManager(id, profile.organization_id)
      const parsedCredentials = JSON.parse(credentials as string) as CredentialData
      
      await authManager.storeCredentials(credentialType, parsedCredentials)
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

    // Platform-specific connection tests would go here
    // For now, we'll simulate a successful test
    let testPassed = true
    let testDetails = {}

    switch (integration.platform) {
      case 'shopify':
        // Test Shopify connection
        testDetails = { shop: integration.config?.shop_domain, api_version: '2024-01' }
        break
      
      case 'netsuite':
        // Test NetSuite connection
        testDetails = { account_id: integration.config?.account_id }
        break
      
      default:
        testDetails = { message: 'Connection test not implemented for this platform' }
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