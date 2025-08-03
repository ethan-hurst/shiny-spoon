// PRP-015: Cron API Route for Cleanup Tasks
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vercel Cron job secret for authentication
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Compares two strings in constant time to prevent timing attacks.
 *
 * Returns true only if both strings are identical in length and content.
 *
 * @param a - The first string to compare
 * @param b - The second string to compare
 * @returns True if the strings are equal; otherwise, false
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Handles a cron-triggered GET request to perform cleanup operations on various database tables.
 *
 * Authenticates the request using a bearer token, then deletes old sync jobs, releases stale locks, removes old notifications and metrics, cleans up orphaned queue items, and resets sync state for stale integrations. Returns a JSON response summarizing the cleanup results and retention period.
 *
 * @returns A JSON response indicating success status, details of cleanup actions performed, and the retention period used. Returns a 401 response if unauthorized, or a 500 response if an unexpected error occurs.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const expectedHeader = `Bearer ${CRON_SECRET}`

    if (!authHeader || !constantTimeEqual(authHeader, expectedHeader)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting cleanup job')

    const supabase = await createClient()
    const results = {
      old_jobs_deleted: 0,
      stale_locks_released: 0,
      old_notifications_deleted: 0,
      old_metrics_deleted: 0,
      organizations_processed: 0,
      errors: [] as string[],
    }

    // Get retention period from environment or default to 30 days
    const rawRetentionDays = parseInt(process.env.SYNC_RETENTION_DAYS || '30')
    const retentionDays =
      isNaN(rawRetentionDays) || rawRetentionDays < 1 || rawRetentionDays > 365
        ? 30 // Default to 30 days if invalid
        : rawRetentionDays

    if (rawRetentionDays !== retentionDays) {
      console.warn(
        `[CRON] Invalid SYNC_RETENTION_DAYS value: ${process.env.SYNC_RETENTION_DAYS}, using ${retentionDays}`
      )
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    const cutoffDateStr = cutoffDate.toISOString()

    // Get all organizations for cleanup
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id')
      .eq('active', true)

    if (!organizations || organizations.length === 0) {
      console.log('[CRON] No active organizations found')
      return NextResponse.json({
        success: true,
        results,
        retention_days: retentionDays,
      })
    }

    // Process cleanup for each organization
    for (const org of organizations) {
      console.log(`[CRON] Processing cleanup for organization: ${org.id}`)
      results.organizations_processed++

      // 1. Clean up old sync jobs for this organization
      try {
        const { count: deletedJobs } = await supabase
          .from('sync_jobs')
          .delete()
          .eq('organization_id', org.id)
          .lt('created_at', cutoffDateStr)
          .in('status', ['completed', 'failed', 'cancelled'])
          .select('id', { count: 'exact', head: true })

        results.old_jobs_deleted += deletedJobs || 0
        console.log(
          `[CRON] Deleted ${deletedJobs || 0} old sync jobs for org ${org.id}`
        )
      } catch (error) {
        console.error(
          `[CRON] Error deleting old jobs for org ${org.id}:`,
          error
        )
        results.errors.push(
          `Failed to delete old jobs for org ${org.id}: ${error}`
        )
      }

      // 2. Release stale locks in sync queue for this organization
      try {
        // Find stale locks (locked for more than 1 hour)
        const staleLockTime = new Date(
          Date.now() - 60 * 60 * 1000
        ).toISOString()

        const { data: staleLocks } = await supabase
          .from('sync_queue')
          .select('job_id')
          .eq('organization_id', org.id)
          .not('locked_by', 'is', null)
          .lt('locked_at', staleLockTime)

        if (staleLocks && staleLocks.length > 0) {
          for (const { job_id } of staleLocks) {
            await supabase.rpc('release_sync_job', {
              p_job_id: job_id,
              p_retry_delay_seconds: 0,
            })
          }
          results.stale_locks_released += staleLocks.length
          console.log(
            `[CRON] Released ${staleLocks.length} stale locks for org ${org.id}`
          )
        }
      } catch (error) {
        console.error(
          `[CRON] Error releasing stale locks for org ${org.id}:`,
          error
        )
        results.errors.push(
          `Failed to release stale locks for org ${org.id}: ${error}`
        )
      }

      // 3. Clean up old notifications for this organization
      try {
        const { count: deletedNotifications } = await supabase
          .from('sync_notifications')
          .delete()
          .eq('organization_id', org.id)
          .lt('created_at', cutoffDateStr)
          .not('sent_at', 'is', null) // Only delete sent notifications
          .select('id', { count: 'exact', head: true })

        results.old_notifications_deleted += deletedNotifications || 0
        console.log(
          `[CRON] Deleted ${deletedNotifications || 0} old notifications for org ${org.id}`
        )
      } catch (error) {
        console.error(
          `[CRON] Error deleting old notifications for org ${org.id}:`,
          error
        )
        results.errors.push(
          `Failed to delete old notifications for org ${org.id}: ${error}`
        )
      }

      // 4. Clean up old performance metrics for this organization
      try {
        // Keep metrics for a shorter period (7 days)
        const metricsRetentionDays = 7
        const metricsCutoffDate = new Date()
        metricsCutoffDate.setDate(
          metricsCutoffDate.getDate() - metricsRetentionDays
        )

        const { count: deletedMetrics } = await supabase
          .from('sync_metrics')
          .delete()
          .eq('organization_id', org.id)
          .lt('created_at', metricsCutoffDate.toISOString())
          .select('id', { count: 'exact', head: true })

        results.old_metrics_deleted += deletedMetrics || 0
        console.log(
          `[CRON] Deleted ${deletedMetrics || 0} old metrics for org ${org.id}`
        )
      } catch (error) {
        console.error(
          `[CRON] Error deleting old metrics for org ${org.id}:`,
          error
        )
        results.errors.push(
          `Failed to delete old metrics for org ${org.id}: ${error}`
        )
      }

      // 5. Clean up orphaned queue items for this organization
      try {
        // First get all sync jobs for this organization
        const { data: syncJobs } = await supabase
          .from('sync_jobs')
          .select('id')
          .eq('organization_id', org.id)

        const syncJobIds = syncJobs?.map((job) => job.id) || []

        // Get orphaned queue items (those without corresponding sync job)
        const { data: allQueueItems } = await supabase
          .from('sync_queue')
          .select('job_id')
          .eq('organization_id', org.id)

        const orphanedItems =
          allQueueItems?.filter((item) => !syncJobIds.includes(item.job_id)) ||
          []

        if (orphanedItems.length > 0) {
          // Delete orphaned items
          const { error: deleteError } = await supabase
            .from('sync_queue')
            .delete()
            .eq('organization_id', org.id)
            .in(
              'job_id',
              orphanedItems.map((item) => item.job_id)
            )

          if (deleteError) {
            throw deleteError
          }
          console.log(
            `[CRON] Cleaned up ${orphanedItems.length} orphaned queue items for org ${org.id}`
          )
        }
      } catch (error) {
        console.error(
          `[CRON] Error cleaning orphaned queue items for org ${org.id}:`,
          error
        )
        results.errors.push(
          `Failed to clean orphaned queue items for org ${org.id}: ${error}`
        )
      }

      // 6. Update sync state versions for stale integrations in this organization
      try {
        // Reset sync state for integrations that haven't synced in 90 days
        const staleIntegrationDate = new Date()
        staleIntegrationDate.setDate(staleIntegrationDate.getDate() - 90)

        // Get integration IDs for this organization
        const { data: integrations } = await supabase
          .from('integrations')
          .select('id')
          .eq('organization_id', org.id)

        if (integrations && integrations.length > 0) {
          await supabase
            .from('sync_state')
            .update({
              sync_version: 0,
              last_cursor: null,
              metadata: {},
            })
            .in(
              'integration_id',
              integrations.map((i) => i.id)
            )
            .lt('last_sync_at', staleIntegrationDate.toISOString())

          console.log(
            `[CRON] Reset stale integration sync states for org ${org.id}`
          )
        }
      } catch (error) {
        console.error(
          `[CRON] Error resetting stale sync states for org ${org.id}:`,
          error
        )
        results.errors.push(
          `Failed to reset stale sync states for org ${org.id}: ${error}`
        )
      }
    } // End of organization loop

    console.log('[CRON] Cleanup job completed', results)

    return NextResponse.json({
      success: results.errors.length === 0,
      results,
      retention_days: retentionDays,
    })
  } catch (error) {
    console.error('[CRON] Unexpected error in cleanup job:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
