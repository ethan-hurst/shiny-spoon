// PRP-015: Sync Engine Server Actions
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { SyncEngine } from '@/lib/sync/sync-engine'
import { SyncJobManager } from '@/lib/sync/job-manager'
import { 
  syncJobConfigSchema,
  syncScheduleSchema,
  ConflictResolutionStrategy,
  SyncEntityType,
} from '@/types/sync-engine.types'
import type { 
  SyncJob, 
  SyncJobConfig, 
  SyncSchedule,
  SyncConflict,
  SyncStatistics,
} from '@/types/sync-engine.types'

// Validation schemas
const createSyncJobSchema = z.object({
  integration_id: z.string().uuid(),
  entity_types: z.array(z.nativeEnum(SyncEntityType)).min(1),
  sync_mode: z.enum(['full', 'incremental']).default('incremental'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
})

const updateScheduleSchema = z.object({
  integration_id: z.string().uuid(),
  enabled: z.boolean(),
  frequency: z.enum(['every_5_min', 'every_15_min', 'every_30_min', 'hourly', 'daily', 'weekly']),
  entity_types: z.array(z.nativeEnum(SyncEntityType)).min(1),
  active_hours: z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }).optional(),
})

const resolveConflictSchema = z.object({
  conflict_id: z.string().uuid(),
  resolution_strategy: z.nativeEnum(ConflictResolutionStrategy),
  resolved_value: z.any(),
})

/**
 * Create a manual sync job
 */
export async function createManualSyncJob(formData: FormData) {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Parse and validate input
  const rawData = {
    integration_id: formData.get('integration_id'),
    entity_types: formData.getAll('entity_types'),
    sync_mode: formData.get('sync_mode'),
    priority: formData.get('priority'),
  }

  const parsed = createSyncJobSchema.parse(rawData)

  // Verify integration belongs to user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('id')
    .eq('id', parsed.integration_id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!integration) {
    throw new Error('Integration not found or access denied')
  }

  // Create sync job configuration
  const jobConfig: SyncJobConfig = {
    integration_id: parsed.integration_id,
    job_type: 'manual',
    entity_types: parsed.entity_types,
    sync_mode: parsed.sync_mode,
    priority: parsed.priority,
    batch_size: 100,
  }

  // Initialize sync engine and create job
  const syncEngine = new SyncEngine()
  try {
    const job = await syncEngine.createSyncJob(jobConfig)
    
    // Revalidate sync dashboard
    revalidatePath('/sync')
    revalidatePath(`/integrations/${parsed.integration_id}`)
    
    return { success: true, job }
  } finally {
    await syncEngine.shutdown()
  }
}

/**
 * Cancel a running sync job
 */
export async function cancelSyncJob(formData: FormData) {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const jobId = formData.get('job_id') as string
  if (!jobId) {
    throw new Error('Job ID is required')
  }

  // Verify job belongs to user's organization
  const { data: job } = await supabase
    .from('sync_jobs')
    .select('id, organization_id')
    .eq('id', jobId)
    .single()

  if (!job) {
    throw new Error('Job not found')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile || job.organization_id !== profile.organization_id) {
    throw new Error('Access denied')
  }

  // Cancel the job
  const syncEngine = new SyncEngine()
  try {
    await syncEngine.cancelJob(jobId)
    
    // Revalidate pages
    revalidatePath('/sync')
    
    return { success: true }
  } finally {
    await syncEngine.shutdown()
  }
}

/**
 * Retry a failed sync job
 */
export async function retrySyncJob(formData: FormData) {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const originalJobId = formData.get('job_id') as string
  if (!originalJobId) {
    throw new Error('Job ID is required')
  }

  // Verify job belongs to user's organization
  const { data: originalJob } = await supabase
    .from('sync_jobs')
    .select('*, integrations(organization_id)')
    .eq('id', originalJobId)
    .single()

  if (!originalJob) {
    throw new Error('Job not found')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile || originalJob.integrations.organization_id !== profile.organization_id) {
    throw new Error('Access denied')
  }

  // Create retry job
  const syncEngine = new SyncEngine()
  const jobManager = new SyncJobManager(syncEngine)
  
  try {
    const retryJob = await jobManager.retryJob(originalJobId)
    
    // Revalidate pages
    revalidatePath('/sync')
    revalidatePath(`/integrations/${originalJob.integration_id}`)
    
    return { success: true, job: retryJob }
  } finally {
    await syncEngine.shutdown()
  }
}

/**
 * Update sync schedule for an integration
 */
export async function updateSyncSchedule(formData: FormData) {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Parse and validate input
  const rawData = {
    integration_id: formData.get('integration_id'),
    enabled: formData.get('enabled') === 'true',
    frequency: formData.get('frequency'),
    entity_types: formData.getAll('entity_types'),
    active_hours: formData.get('active_hours_enabled') === 'true' ? {
      start: formData.get('active_hours_start') as string,
      end: formData.get('active_hours_end') as string,
    } : undefined,
  }

  const parsed = updateScheduleSchema.parse(rawData)

  // Verify integration belongs to user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('id')
    .eq('id', parsed.integration_id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!integration) {
    throw new Error('Integration not found or access denied')
  }

  // Upsert schedule
  const { error } = await supabase
    .from('sync_schedules')
    .upsert({
      integration_id: parsed.integration_id,
      ...parsed,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'integration_id',
    })

  if (error) {
    throw new Error(`Failed to update schedule: ${error.message}`)
  }

  // Revalidate pages
  revalidatePath('/sync')
  revalidatePath(`/integrations/${parsed.integration_id}`)
  
  return { success: true }
}

/**
 * Delete sync schedule for an integration
 */
export async function deleteSyncSchedule(formData: FormData) {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const integrationId = formData.get('integration_id') as string
  if (!integrationId) {
    throw new Error('Integration ID is required')
  }

  // Verify integration belongs to user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('id')
    .eq('id', integrationId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!integration) {
    throw new Error('Integration not found or access denied')
  }

  // Delete schedule
  const { error } = await supabase
    .from('sync_schedules')
    .delete()
    .eq('integration_id', integrationId)

  if (error) {
    throw new Error(`Failed to delete schedule: ${error.message}`)
  }

  // Revalidate pages
  revalidatePath('/sync')
  revalidatePath(`/integrations/${integrationId}`)
  
  return { success: true }
}

/**
 * Resolve a sync conflict
 */
export async function resolveSyncConflict(formData: FormData) {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Parse and validate input
  const rawData = {
    conflict_id: formData.get('conflict_id'),
    resolution_strategy: formData.get('resolution_strategy'),
    resolved_value: JSON.parse(formData.get('resolved_value') as string),
  }

  const parsed = resolveConflictSchema.parse(rawData)

  // Verify conflict belongs to user's organization
  const { data: conflict } = await supabase
    .from('sync_conflicts')
    .select(`
      id,
      sync_jobs (
        organization_id
      )
    `)
    .eq('id', parsed.conflict_id)
    .single()

  if (!conflict || !conflict.sync_jobs) {
    throw new Error('Conflict not found')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile || conflict.sync_jobs.organization_id !== profile.organization_id) {
    throw new Error('Access denied')
  }

  // Resolve conflict
  const { error } = await supabase
    .from('sync_conflicts')
    .update({
      resolution_strategy: parsed.resolution_strategy,
      resolved_value: parsed.resolved_value,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', parsed.conflict_id)

  if (error) {
    throw new Error(`Failed to resolve conflict: ${error.message}`)
  }

  // Revalidate pages
  revalidatePath('/sync')
  revalidatePath('/sync/conflicts')
  
  return { success: true }
}

/**
 * Get sync statistics for an integration
 */
export async function getSyncStatistics(
  integrationId: string,
  period: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<SyncStatistics> {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Verify integration belongs to user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('id')
    .eq('id', integrationId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!integration) {
    throw new Error('Integration not found or access denied')
  }

  // Get statistics
  const { data: stats, error } = await supabase.rpc('get_sync_statistics', {
    p_integration_id: integrationId,
    p_period: period,
  })

  if (error) {
    throw new Error(`Failed to get statistics: ${error.message}`)
  }

  // Get entity-specific breakdown
  const entityTypes: SyncEntityType[] = ['products', 'inventory', 'pricing', 'customers', 'orders']
  const byEntityType: Record<SyncEntityType, { count: number; records: number; errors: number }> = {} as any

  for (const entityType of entityTypes) {
    const { data: entityStats } = await supabase
      .from('sync_jobs')
      .select('result')
      .eq('integration_id', integrationId)
      .eq('status', 'completed')
      .contains('config', { entity_types: [entityType] })
      .gte('created_at', getDateForPeriod(period))

    const entityResult = {
      count: entityStats?.length || 0,
      records: 0,
      errors: 0,
    }

    if (entityStats) {
      for (const job of entityStats) {
        if (job.result?.entity_results?.[entityType]) {
          entityResult.records += job.result.entity_results[entityType].processed || 0
          entityResult.errors += job.result.entity_results[entityType].errors?.length || 0
        }
      }
    }

    byEntityType[entityType] = entityResult
  }

  return {
    integration_id: integrationId,
    period,
    total_syncs: stats?.total_syncs || 0,
    successful_syncs: stats?.successful_syncs || 0,
    failed_syncs: stats?.failed_syncs || 0,
    average_duration_ms: stats?.average_duration_ms || 0,
    total_records_synced: stats?.total_records_synced || 0,
    total_conflicts: stats?.total_conflicts || 0,
    total_errors: stats?.total_errors || 0,
    by_entity_type: byEntityType,
  }
}

/**
 * Get date for period calculation
 */
function getDateForPeriod(period: string): string {
  const now = new Date()
  
  switch (period) {
    case 'hour':
      now.setHours(now.getHours() - 1)
      break
    case 'day':
      now.setDate(now.getDate() - 1)
      break
    case 'week':
      now.setDate(now.getDate() - 7)
      break
    case 'month':
      now.setMonth(now.getMonth() - 1)
      break
  }
  
  return now.toISOString()
}