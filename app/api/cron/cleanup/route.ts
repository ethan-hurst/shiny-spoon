// PRP-015: Cron API Route for Cleanup Tasks
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vercel Cron job secret for authentication
const CRON_SECRET = process.env.CRON_SECRET

// Constant-time string comparison to prevent timing attacks
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
      errors: [] as string[],
    }

    // Get retention period from environment or default to 30 days
    const rawRetentionDays = parseInt(process.env.SYNC_RETENTION_DAYS || '30')
    const retentionDays = isNaN(rawRetentionDays) || rawRetentionDays < 1 || rawRetentionDays > 365
      ? 30 // Default to 30 days if invalid
      : rawRetentionDays
      
    if (rawRetentionDays !== retentionDays) {
      console.warn(`[CRON] Invalid SYNC_RETENTION_DAYS value: ${process.env.SYNC_RETENTION_DAYS}, using ${retentionDays}`)
    }
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    const cutoffDateStr = cutoffDate.toISOString()

    // 1. Clean up old sync jobs
    try {
      const { count: deletedJobs } = await supabase
        .from('sync_jobs')
        .delete()
        .lt('created_at', cutoffDateStr)
        .in('status', ['completed', 'failed', 'cancelled'])
        .select('id', { count: 'exact', head: true })

      results.old_jobs_deleted = deletedJobs || 0
      console.log(`[CRON] Deleted ${results.old_jobs_deleted} old sync jobs`)
    } catch (error) {
      console.error('[CRON] Error deleting old jobs:', error)
      results.errors.push(`Failed to delete old jobs: ${error}`)
    }

    // 2. Release stale locks in sync queue
    try {
      // Find stale locks (locked for more than 1 hour)
      const staleLockTime = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      const { data: staleLocks } = await supabase
        .from('sync_queue')
        .select('job_id')
        .not('locked_by', 'is', null)
        .lt('locked_at', staleLockTime)

      if (staleLocks && staleLocks.length > 0) {
        for (const { job_id } of staleLocks) {
          await supabase.rpc('release_sync_job', {
            p_job_id: job_id,
            p_retry_delay_seconds: 0,
          })
        }
        results.stale_locks_released = staleLocks.length
        console.log(`[CRON] Released ${results.stale_locks_released} stale locks`)
      }
    } catch (error) {
      console.error('[CRON] Error releasing stale locks:', error)
      results.errors.push(`Failed to release stale locks: ${error}`)
    }

    // 3. Clean up old notifications
    try {
      const { count: deletedNotifications } = await supabase
        .from('sync_notifications')
        .delete()
        .lt('created_at', cutoffDateStr)
        .not('sent_at', 'is', null) // Only delete sent notifications
        .select('id', { count: 'exact', head: true })

      results.old_notifications_deleted = deletedNotifications || 0
      console.log(`[CRON] Deleted ${results.old_notifications_deleted} old notifications`)
    } catch (error) {
      console.error('[CRON] Error deleting old notifications:', error)
      results.errors.push(`Failed to delete old notifications: ${error}`)
    }

    // 4. Clean up old performance metrics
    try {
      // Keep metrics for a shorter period (7 days)
      const metricsRetentionDays = 7
      const metricsCutoffDate = new Date()
      metricsCutoffDate.setDate(metricsCutoffDate.getDate() - metricsRetentionDays)
      
      const { count: deletedMetrics } = await supabase
        .from('sync_metrics')
        .delete()
        .lt('created_at', metricsCutoffDate.toISOString())
        .select('id', { count: 'exact', head: true })

      results.old_metrics_deleted = deletedMetrics || 0
      console.log(`[CRON] Deleted ${results.old_metrics_deleted} old metrics`)
    } catch (error) {
      console.error('[CRON] Error deleting old metrics:', error)
      results.errors.push(`Failed to delete old metrics: ${error}`)
    }

    // 5. Clean up orphaned queue items
    try {
      // First get orphaned queue items
      const { data: orphanedItems } = await supabase
        .from('sync_queue')
        .select('job_id')
        .filter('job_id', 'not.in', '(SELECT id FROM sync_jobs)')
      
      if (orphanedItems && orphanedItems.length > 0) {
        // Delete orphaned items
        const { error: deleteError } = await supabase
          .from('sync_queue')
          .delete()
          .in('job_id', orphanedItems.map(item => item.job_id))
        
        if (deleteError) {
          throw deleteError
        }
        console.log(`[CRON] Cleaned up ${orphanedItems.length} orphaned queue items`)
      } else {
        console.log('[CRON] No orphaned queue items found')
      }
    } catch (error) {
      console.error('[CRON] Error cleaning orphaned queue items:', error)
      results.errors.push(`Failed to clean orphaned queue items: ${error}`)
    }

    // 6. Update sync state versions for stale integrations
    try {
      // Reset sync state for integrations that haven't synced in 90 days
      const staleIntegrationDate = new Date()
      staleIntegrationDate.setDate(staleIntegrationDate.getDate() - 90)
      
      await supabase
        .from('sync_state')
        .update({
          sync_version: 0,
          last_cursor: null,
          metadata: {},
        })
        .lt('last_sync_at', staleIntegrationDate.toISOString())

      console.log('[CRON] Reset stale integration sync states')
    } catch (error) {
      console.error('[CRON] Error resetting stale sync states:', error)
      results.errors.push(`Failed to reset stale sync states: ${error}`)
    }

    console.log('[CRON] Cleanup job completed', results)

    return NextResponse.json({
      success: results.errors.length === 0,
      results,
      retention_days: retentionDays,
    })

  } catch (error) {
    console.error('[CRON] Unexpected error in cleanup job:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}