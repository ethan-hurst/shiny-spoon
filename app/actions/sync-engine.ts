// PRP-015: Sync Engine Server Actions
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { SyncJobManager } from '@/lib/sync/job-manager'
import { SyncEngine } from '@/lib/sync/sync-engine'
import {
  ConflictResolutionStrategy,
  SyncEntityType,
  syncJobConfigSchema,
  syncScheduleSchema,
} from '@/types/sync-engine.types'
import type {
  SyncConflict,
  SyncJob,
  SyncJobConfig,
  SyncSchedule,
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
  frequency: z.enum([
    'every_5_min',
    'every_15_min',
    'every_30_min',
    'hourly',
    'daily',
    'weekly',
  ]),
  entity_types: z.array(z.nativeEnum(SyncEntityType)).min(1),
  active_hours: z
    .object({
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
    .optional(),
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  if (
    !profile ||
    originalJob.integrations.organization_id !== profile.organization_id
  ) {
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
      // Stop the job manager to release resources
      await jobManager.stop()
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Parse and validate input
  const rawData = {
    integration_id: formData.get('integration_id'),
    enabled: formData.get('enabled') === 'true',
    frequency: formData.get('frequency'),
    entity_types: formData.getAll('entity_types'),
    active_hours:
      formData.get('active_hours_enabled') === 'true'
        ? {
            start: formData.get('active_hours_start') as string,
            end: formData.get('active_hours_end') as string,
          }
        : undefined,
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

  // Check if schedule exists
  const { data: existingSchedule } = await supabase
    .from('sync_schedules')
    .select('created_by')
    .eq('integration_id', parsed.integration_id)
    .single()

  // Prepare upsert data
  const scheduleData: any = {
    integration_id: parsed.integration_id,
    ...parsed,
    updated_at: new Date().toISOString(),
  }

  // Only set created_by on insert
  if (!existingSchedule) {
    scheduleData.created_by = user.id
  }

  // Upsert schedule
  const { error } = await supabase.from('sync_schedules').upsert(scheduleData, {
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    .select(
      `
      id,
      sync_jobs (
        organization_id
      )
    `
    )
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

  if (
    !profile ||
    conflict.sync_jobs.organization_id !== profile.organization_id
  ) {
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const entityTypes: SyncEntityType[] = [
    'products',
    'inventory',
    'pricing',
    'customers',
    'orders',
  ]
  const byEntityType: Record<
    SyncEntityType,
    { count: number; records: number; errors: number }
  > = {} as any

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
            byEntityType[entityType].records +=
              job.result.entity_results[entityType].processed || 0
            byEntityType[entityType].errors +=
              job.result.entity_results[entityType].errors?.length || 0
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

export async function getSyncHealthData() {
  const supabase = await createClient()

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Get integrations for the organization
  const { data: integrations } = await supabase
    .from('integrations')
    .select('id, name, platform')
    .eq('organization_id', profile.organization_id)
    .eq('status', 'active')

  if (!integrations) {
    return {
      integration_health: [],
      system_health: {
        status: 'healthy' as const,
        metrics: {
          total_queue_depth: 0,
          stuck_jobs: 0,
        },
        issues: [],
      },
      engine_health: null,
    }
  }

  // Get health metrics for each integration
  const healthPromises = integrations.map(async (integration) => {
    // Get recent job statistics
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const { data: jobs } = await supabase
      .from('sync_jobs')
      .select('status, started_at, completed_at, error')
      .eq('integration_id', integration.id)
      .gte('created_at', oneHourAgo.toISOString())

    const totalJobs = jobs?.length || 0
    const successfulJobs =
      jobs?.filter((j) => j.status === 'completed').length || 0
    const failedJobs = jobs?.filter((j) => j.status === 'failed').length || 0
    const pendingJobs = jobs?.filter((j) => j.status === 'pending').length || 0

    // Calculate metrics
    const successRate = totalJobs > 0 ? successfulJobs / totalJobs : 1
    const errorRate = totalJobs > 0 ? failedJobs / totalJobs : 0

    // Calculate average duration from completed jobs
    const completedJobs =
      jobs?.filter(
        (j) => j.status === 'completed' && j.started_at && j.completed_at
      ) || []
    const averageDuration =
      completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => {
            const duration =
              new Date(job.completed_at!).getTime() -
              new Date(job.started_at!).getTime()
            return sum + duration
          }, 0) / completedJobs.length
        : 0

    // Get oldest pending job
    const { data: oldestPending } = await supabase
      .from('sync_jobs')
      .select('created_at')
      .eq('integration_id', integration.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const oldestPendingAge = oldestPending
      ? now.getTime() - new Date(oldestPending.created_at).getTime()
      : undefined

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    const issues: string[] = []

    if (errorRate > 0.5) {
      status = 'unhealthy'
      issues.push('High error rate detected')
    } else if (errorRate > 0.2) {
      status = 'degraded'
      issues.push('Elevated error rate')
    }

    if (pendingJobs > 10) {
      status = status === 'healthy' ? 'degraded' : status
      issues.push(`${pendingJobs} jobs queued`)
    }

    if (oldestPendingAge && oldestPendingAge > 3600000) {
      // 1 hour
      status = 'unhealthy'
      issues.push('Jobs stuck in queue')
    }

    return {
      integration_id: integration.id,
      status,
      last_check_at: now.toISOString(),
      metrics: {
        success_rate: successRate,
        average_duration_ms: averageDuration,
        error_rate: errorRate,
        queue_depth: pendingJobs,
        oldest_pending_job_age_ms: oldestPendingAge,
      },
      issues: issues.length > 0 ? issues : undefined,
      integration,
    }
  })

  const integrationHealth = await Promise.all(healthPromises)

  // Calculate system health
  const totalQueueDepth = integrationHealth.reduce(
    (sum, h) => sum + h.metrics.queue_depth,
    0
  )
  const stuckJobs = integrationHealth.filter(
    (h) =>
      h.metrics.oldest_pending_job_age_ms &&
      h.metrics.oldest_pending_job_age_ms > 3600000
  ).length

  const unhealthyIntegrations = integrationHealth.filter(
    (h) => h.status === 'unhealthy'
  ).length
  const degradedIntegrations = integrationHealth.filter(
    (h) => h.status === 'degraded'
  ).length

  let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  const systemIssues: string[] = []

  if (unhealthyIntegrations > 0) {
    systemStatus = 'unhealthy'
    systemIssues.push(`${unhealthyIntegrations} unhealthy integrations`)
  } else if (degradedIntegrations > integrations.length / 2) {
    systemStatus = 'degraded'
    systemIssues.push('Multiple integrations degraded')
  }

  if (totalQueueDepth > 100) {
    systemStatus = systemStatus === 'healthy' ? 'degraded' : systemStatus
    systemIssues.push('High queue depth')
  }

  // Get active jobs count for engine health
  const { count: activeJobsCount } = await supabase
    .from('sync_jobs')
    .select('*, integrations!inner(organization_id)', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'running')
    .eq('integrations.organization_id', profile.organization_id)

  return {
    integration_health: integrationHealth,
    system_health: {
      status: systemStatus,
      metrics: {
        total_queue_depth: totalQueueDepth,
        stuck_jobs: stuckJobs,
      },
      issues: systemIssues,
    },
    engine_health: {
      status: activeJobsCount && activeJobsCount > 10 ? 'degraded' : 'healthy',
      activeJobs: activeJobsCount || 0,
      maxJobs: 10,
      connectors: integrations.length,
      issues:
        activeJobsCount && activeJobsCount > 10
          ? ['High concurrent job count']
          : [],
    },
  }
}
