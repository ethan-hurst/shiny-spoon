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
 * Executes the provided asynchronous callback with a SyncEngine instance, ensuring the engine is properly shut down after use.
 *
 * @returns The result of the callback function.
 */
async function withSyncEngine<T>(
  callback: (engine: SyncEngine) => Promise<T>
): Promise<T> {
  const syncEngine = new SyncEngine()
  try {
    return await callback(syncEngine)
  } finally {
    await syncEngine.shutdown()
  }
}

/**
 * Creates a manual sync job for a specified integration after validating user authentication and organization access.
 *
 * Validates input data, ensures the integration belongs to the user's organization, and creates a manual sync job with the specified configuration. Triggers revalidation of relevant UI pages upon success.
 *
 * @param formData - The form data containing sync job parameters
 * @returns An object with a success flag and the created sync job
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

  // Use the helper function
  return withSyncEngine(async (syncEngine) => {
    const job = await syncEngine.createSyncJob(jobConfig)
    
    // Revalidate sync dashboard
    revalidatePath('/sync')
    revalidatePath(`/integrations/${parsed.integration_id}`)
    
    return { success: true, job }
  })
}

/**
 * Cancels a running sync job after verifying user authentication and organization ownership.
 *
 * Throws an error if the user is unauthorized, the job does not exist, or the user does not have access to the job.
 *
 * @returns An object indicating whether the cancellation was successful.
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
  return withSyncEngine(async (syncEngine) => {
    await syncEngine.cancelJob(jobId)
    
    // Revalidate pages
    revalidatePath('/sync')
    
    return { success: true }
  })
}

/**
 * Retries a failed sync job after verifying user authentication and job ownership.
 *
 * Validates that the requesting user belongs to the same organization as the original job, then creates a retry job using the Sync Engine. Revalidates relevant sync and integration pages upon success.
 *
 * @param formData - Form data containing the `job_id` of the job to retry
 * @returns An object with a success flag and the newly created retry job
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
  return withSyncEngine(async (syncEngine) => {
    const jobManager = new SyncJobManager(syncEngine)
    
    try {
      const retryJob = await jobManager.retryJob(originalJobId)
      
      // Revalidate pages
      revalidatePath('/sync')
      revalidatePath(`/integrations/${originalJob.integration_id}`)
      
      return { success: true, job: retryJob }
    } finally {
      // JobManager doesn't have a cleanup method in current implementation
      // If it had one, we would call it here: await jobManager.stop()
    }
  })
}

/**
 * Updates the synchronization schedule for a specified integration after validating user authorization and input data.
 *
 * Throws an error if the user is unauthorized, the integration does not belong to the user's organization, or the update fails.
 *
 * @returns An object indicating whether the update was successful.
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
 * Deletes the sync schedule for a specified integration after verifying user authentication and organization ownership.
 *
 * @returns An object indicating successful deletion.
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
 * Resolves a synchronization conflict by applying the specified resolution strategy and value.
 *
 * Validates user authentication and organization access, parses and applies the conflict resolution, and updates the conflict record. Revalidates relevant sync pages upon success.
 *
 * @returns An object indicating whether the conflict was successfully resolved
 */
export async function resolveSyncConflict(formData: FormData) {
  const supabase = await createClient()
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Parse and validate input
  const resolvedValueStr = formData.get('resolved_value') as string
  let resolvedValue: any
  
  try {
    resolvedValue = JSON.parse(resolvedValueStr)
  } catch (error) {
    throw new Error('Invalid resolved value format')
  }
  
  const rawData = {
    conflict_id: formData.get('conflict_id'),
    resolution_strategy: formData.get('resolution_strategy'),
    resolved_value: resolvedValue,
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
 * Retrieves aggregated synchronization statistics for a specific integration over a given time period.
 *
 * Authenticates the user, verifies access to the integration, and returns overall and per-entity sync metrics such as counts, processed records, errors, and conflicts.
 *
 * @param integrationId - The unique identifier of the integration to retrieve statistics for
 * @param period - The time period for aggregation ('hour', 'day', 'week', or 'month'). Defaults to 'day'.
 * @returns An object containing total and per-entity sync statistics for the specified integration and period
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

  // Get entity-specific breakdown with aggregated query
  const entityTypes: SyncEntityType[] = ['products', 'inventory', 'pricing', 'customers', 'orders']
  const byEntityType: Record<SyncEntityType, { count: number; records: number; errors: number }> = {} as any

  // Initialize all entity types
  for (const entityType of entityTypes) {
    byEntityType[entityType] = { count: 0, records: 0, errors: 0 }
  }

  // Get all completed jobs for the period
  const { data: allJobs } = await supabase
    .from('sync_jobs')
    .select('config, result')
    .eq('integration_id', integrationId)
    .eq('status', 'completed')
    .gte('created_at', getDateForPeriod(period))

  // Process jobs to aggregate by entity type
  if (allJobs) {
    for (const job of allJobs) {
      const jobEntityTypes = job.config?.entity_types || []
      
      for (const entityType of jobEntityTypes) {
        if (entityTypes.includes(entityType)) {
          byEntityType[entityType].count += 1
          
          if (job.result?.entity_results?.[entityType]) {
            byEntityType[entityType].records += job.result.entity_results[entityType].processed || 0
            byEntityType[entityType].errors += job.result.entity_results[entityType].errors?.length || 0
          }
        }
      }
    }
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
 * Returns the ISO timestamp representing the start of the specified period relative to the current time.
 *
 * @param period - The time period to subtract from the current date ('hour', 'day', 'week', or 'month')
 * @returns An ISO string of the calculated date and time
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