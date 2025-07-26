// PRP-015: Cron API Route for Health Checks
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SyncEngine } from '@/lib/sync/sync-engine'
import type { SyncHealthStatus } from '@/types/sync-engine.types'

// Vercel Cron job secret for authentication
const CRON_SECRET = process.env.CRON_SECRET

// Thresholds for health status
const HEALTH_THRESHOLDS = {
  SUCCESS_RATE_CRITICAL: 0.5, // Below 50% is critical
  SUCCESS_RATE_WARNING: 0.8,  // Below 80% is warning
  QUEUE_DEPTH_WARNING: 50,    // More than 50 pending jobs is warning
  QUEUE_DEPTH_CRITICAL: 100,  // More than 100 pending jobs is critical
  JOB_AGE_WARNING_MS: 30 * 60 * 1000, // 30 minutes
  JOB_AGE_CRITICAL_MS: 60 * 60 * 1000, // 1 hour
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting health check')

    const supabase = await createClient()
    const healthStatuses: SyncHealthStatus[] = []
    const issues: string[] = []

    // Get all active integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('id, name, platform, organization_id')
      .eq('enabled', true)

    if (integrationsError) {
      console.error('[CRON] Error fetching integrations:', integrationsError)
      return NextResponse.json({ 
        error: 'Failed to fetch integrations',
        details: integrationsError 
      }, { status: 500 })
    }

    if (!integrations || integrations.length === 0) {
      console.log('[CRON] No active integrations found')
      return NextResponse.json({ 
        message: 'No active integrations to check',
        health_statuses: []
      })
    }

    // Check health for each integration
    for (const integration of integrations) {
      try {
        const healthStatus = await checkIntegrationHealth(supabase, integration.id)
        healthStatuses.push(healthStatus)

        // Collect issues
        if (healthStatus.issues && healthStatus.issues.length > 0) {
          issues.push(
            ...healthStatus.issues.map(issue => 
              `[${integration.name}] ${issue}`
            )
          )
        }

        // Create notifications for critical issues
        if (healthStatus.status === 'unhealthy') {
          await createHealthNotification(
            supabase,
            integration.organization_id,
            integration.id,
            healthStatus
          )
        }

      } catch (error) {
        console.error(`[CRON] Error checking health for integration ${integration.id}:`, error)
        healthStatuses.push({
          integration_id: integration.id,
          status: 'unhealthy',
          last_check_at: new Date().toISOString(),
          metrics: {
            success_rate: 0,
            average_duration_ms: 0,
            error_rate: 1,
            queue_depth: 0,
          },
          issues: [`Health check failed: ${error}`],
        })
      }
    }

    // Check overall system health
    const systemHealth = await checkSystemHealth(supabase)
    
    // Initialize sync engine to check its health
    let engineHealth = null
    try {
      const syncEngine = new SyncEngine()
      engineHealth = await syncEngine.getHealthStatus()
      await syncEngine.shutdown()
    } catch (error) {
      console.error('[CRON] Error checking sync engine health:', error)
      issues.push(`Sync engine health check failed: ${error}`)
    }

    // Determine overall status
    const unhealthyCount = healthStatuses.filter(h => h.status === 'unhealthy').length
    const degradedCount = healthStatuses.filter(h => h.status === 'degraded').length
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (unhealthyCount > 0 || systemHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy'
    } else if (degradedCount > 0 || systemHealth.status === 'degraded') {
      overallStatus = 'degraded'
    }

    console.log(`[CRON] Health check completed. Status: ${overallStatus}`)

    return NextResponse.json({
      success: true,
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      integration_health: healthStatuses,
      system_health: systemHealth,
      engine_health: engineHealth,
      issues: issues,
      summary: {
        total_integrations: integrations.length,
        healthy: healthStatuses.filter(h => h.status === 'healthy').length,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
      },
    })

  } catch (error) {
    console.error('[CRON] Unexpected error in health check:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Check health status for a specific integration
 */
async function checkIntegrationHealth(
  supabase: any,
  integrationId: string
): Promise<SyncHealthStatus> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  // Get sync statistics for the last 24 hours
  const { data: stats } = await supabase.rpc('get_sync_statistics', {
    p_integration_id: integrationId,
    p_period: 'day',
  })

  // Get queue depth
  const { count: queueDepth } = await supabase
    .from('sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', supabase.from('sync_jobs').select('id').eq('integration_id', integrationId))

  // Get oldest pending job
  const { data: oldestPendingJob } = await supabase
    .from('sync_jobs')
    .select('created_at')
    .eq('integration_id', integrationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  let oldestJobAgeMs: number | undefined
  if (oldestPendingJob) {
    oldestJobAgeMs = now.getTime() - new Date(oldestPendingJob.created_at).getTime()
  }

  // Calculate metrics
  const totalSyncs = stats?.total_syncs || 0
  const successfulSyncs = stats?.successful_syncs || 0
  const failedSyncs = stats?.failed_syncs || 0
  const successRate = totalSyncs > 0 ? successfulSyncs / totalSyncs : 1
  const errorRate = totalSyncs > 0 ? failedSyncs / totalSyncs : 0
  const averageDurationMs = stats?.average_duration_ms || 0

  // Determine health status and issues
  const issues: string[] = []
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

  // Check success rate
  if (successRate < HEALTH_THRESHOLDS.SUCCESS_RATE_CRITICAL) {
    status = 'unhealthy'
    issues.push(`Critical: Success rate is ${(successRate * 100).toFixed(1)}%`)
  } else if (successRate < HEALTH_THRESHOLDS.SUCCESS_RATE_WARNING) {
    status = 'degraded'
    issues.push(`Warning: Success rate is ${(successRate * 100).toFixed(1)}%`)
  }

  // Check queue depth
  if (queueDepth && queueDepth > HEALTH_THRESHOLDS.QUEUE_DEPTH_CRITICAL) {
    status = 'unhealthy'
    issues.push(`Critical: ${queueDepth} jobs in queue`)
  } else if (queueDepth && queueDepth > HEALTH_THRESHOLDS.QUEUE_DEPTH_WARNING) {
    if (status === 'healthy') status = 'degraded'
    issues.push(`Warning: ${queueDepth} jobs in queue`)
  }

  // Check oldest job age
  if (oldestJobAgeMs && oldestJobAgeMs > HEALTH_THRESHOLDS.JOB_AGE_CRITICAL_MS) {
    status = 'unhealthy'
    issues.push(`Critical: Oldest pending job is ${Math.round(oldestJobAgeMs / 60000)} minutes old`)
  } else if (oldestJobAgeMs && oldestJobAgeMs > HEALTH_THRESHOLDS.JOB_AGE_WARNING_MS) {
    if (status === 'healthy') status = 'degraded'
    issues.push(`Warning: Oldest pending job is ${Math.round(oldestJobAgeMs / 60000)} minutes old`)
  }

  // Check if no syncs have run recently
  if (totalSyncs === 0) {
    issues.push('No sync jobs in the last 24 hours')
  }

  return {
    integration_id: integrationId,
    status,
    last_check_at: now.toISOString(),
    metrics: {
      success_rate: successRate,
      average_duration_ms: averageDurationMs,
      error_rate: errorRate,
      queue_depth: queueDepth || 0,
      oldest_pending_job_age_ms: oldestJobAgeMs,
    },
    issues: issues.length > 0 ? issues : undefined,
  }
}

/**
 * Check overall system health
 */
async function checkSystemHealth(supabase: any): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  metrics: Record<string, any>
  issues: string[]
}> {
  const issues: string[] = []
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  // Check total queue depth across all integrations
  const { count: totalQueueDepth } = await supabase
    .from('sync_queue')
    .select('id', { count: 'exact', head: true })

  if (totalQueueDepth && totalQueueDepth > 200) {
    status = 'unhealthy'
    issues.push(`Critical: Total queue depth is ${totalQueueDepth}`)
  } else if (totalQueueDepth && totalQueueDepth > 100) {
    status = 'degraded'
    issues.push(`Warning: Total queue depth is ${totalQueueDepth}`)
  }

  // Check for stuck jobs (running for more than 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const { count: stuckJobs } = await supabase
    .from('sync_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'running')
    .lt('started_at', twoHoursAgo.toISOString())

  if (stuckJobs && stuckJobs > 0) {
    status = 'unhealthy'
    issues.push(`Critical: ${stuckJobs} jobs have been running for over 2 hours`)
  }

  // Check database connection (by running a simple query)
  try {
    await supabase.from('sync_jobs').select('id').limit(1)
  } catch (error) {
    status = 'unhealthy'
    issues.push('Critical: Database connection failed')
  }

  return {
    status,
    metrics: {
      total_queue_depth: totalQueueDepth || 0,
      stuck_jobs: stuckJobs || 0,
    },
    issues,
  }
}

/**
 * Create a notification for critical health issues
 */
async function createHealthNotification(
  supabase: any,
  organizationId: string,
  integrationId: string,
  healthStatus: SyncHealthStatus
): Promise<void> {
  try {
    // Check if we've already sent a notification recently (within 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const { data: recentNotification } = await supabase
      .from('sync_notifications')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('event_type', 'performance_degradation')
      .gt('created_at', sixHoursAgo.toISOString())
      .limit(1)

    if (recentNotification && recentNotification.length > 0) {
      // Don't spam notifications
      return
    }

    // Create notification
    await supabase.from('sync_notifications').insert({
      organization_id: organizationId,
      event_type: 'performance_degradation',
      channel: 'email',
      recipient: 'admin', // This would be resolved to actual email
      payload: {
        integration_id: integrationId,
        health_status: healthStatus,
        issues: healthStatus.issues,
        metrics: healthStatus.metrics,
      },
    })

  } catch (error) {
    console.error('[CRON] Error creating health notification:', error)
    // Don't fail the health check if notification fails
  }
}