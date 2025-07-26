// PRP-015: Cron API Route for Scheduled Sync Execution
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SyncEngine } from '@/lib/sync/sync-engine'
import { SyncJobManager } from '@/lib/sync/job-manager'
import type { SyncJobConfig } from '@/types/sync-engine.types'

// Vercel Cron job secret for authentication
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(
  request: NextRequest,
  { params }: { params: { frequency: string } }
) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { frequency } = params
    const validFrequencies = [
      'every-5-min',
      'every-15-min', 
      'every-30-min',
      'hourly',
      'daily',
      'weekly'
    ]

    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
    }

    console.log(`[CRON] Starting ${frequency} sync job`)

    // Create admin client for system operations
    const supabase = await createClient()
    
    // Map URL frequency to database frequency
    const dbFrequency = frequency.replace('-', '_')
    
    // Find all enabled schedules for this frequency
    const { data: schedules, error: scheduleError } = await supabase
      .from('sync_schedules')
      .select(`
        *,
        integrations (
          id,
          platform,
          name,
          organization_id,
          sync_settings
        )
      `)
      .eq('enabled', true)
      .eq('frequency', dbFrequency)

    if (scheduleError) {
      console.error('[CRON] Error fetching schedules:', scheduleError)
      return NextResponse.json({ 
        error: 'Failed to fetch schedules',
        details: scheduleError 
      }, { status: 500 })
    }

    if (!schedules || schedules.length === 0) {
      console.log(`[CRON] No enabled schedules found for frequency: ${frequency}`)
      return NextResponse.json({ 
        message: 'No schedules to process',
        frequency 
      })
    }

    console.log(`[CRON] Found ${schedules.length} schedules to process`)

    // Initialize sync engine and job manager
    const syncEngine = new SyncEngine({
      max_concurrent_jobs: 10,
      enable_notifications: false, // Disable for cron jobs
    })

    const jobManager = new SyncJobManager(syncEngine, {
      worker_id: `cron-${frequency}-${Date.now()}`,
      enable_scheduling: false, // We're already in a scheduled context
    })

    const results = []

    // Process each schedule
    for (const schedule of schedules) {
      try {
        // Skip if integration is not available
        if (!schedule.integrations) {
          console.warn(`[CRON] Integration not found for schedule ${schedule.id}`)
          continue
        }

        // Check active hours if configured
        if (schedule.active_hours) {
          const now = new Date()
          const currentHour = now.getHours()
          const [startHour] = schedule.active_hours.start.split(':').map(Number)
          const [endHour] = schedule.active_hours.end.split(':').map(Number)
          
          if (currentHour < startHour || currentHour >= endHour) {
            console.log(`[CRON] Skipping schedule ${schedule.id} - outside active hours`)
            continue
          }
        }

        // Check if specific day/time constraints apply
        const now = new Date()
        if (schedule.frequency === 'weekly' && schedule.day_of_week !== undefined) {
          if (now.getDay() !== schedule.day_of_week) {
            console.log(`[CRON] Skipping weekly schedule ${schedule.id} - wrong day`)
            continue
          }
        }

        if (schedule.frequency === 'daily' && schedule.hour !== undefined) {
          if (now.getHours() !== schedule.hour) {
            console.log(`[CRON] Skipping daily schedule ${schedule.id} - wrong hour`)
            continue
          }
        }

        // Create sync job configuration
        const jobConfig: SyncJobConfig = {
          integration_id: schedule.integration_id,
          job_type: 'scheduled',
          entity_types: schedule.entity_types,
          sync_mode: 'incremental',
          batch_size: 100,
          priority: 'normal',
          scheduled_at: new Date().toISOString(),
        }

        // Create and queue the job
        const job = await syncEngine.createSyncJob(jobConfig)
        
        console.log(`[CRON] Created job ${job.id} for integration ${schedule.integrations.name}`)

        // Update schedule with last run time
        await supabase
          .from('sync_schedules')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: calculateNextRun(schedule.frequency, now).toISOString(),
          })
          .eq('id', schedule.id)

        results.push({
          schedule_id: schedule.id,
          integration_id: schedule.integration_id,
          job_id: job.id,
          status: 'queued',
        })

      } catch (error) {
        console.error(`[CRON] Error processing schedule ${schedule.id}:`, error)
        results.push({
          schedule_id: schedule.id,
          integration_id: schedule.integration_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'failed',
        })
      }
    }

    // Clean up
    await syncEngine.shutdown()

    console.log(`[CRON] Completed ${frequency} sync job processing`)

    return NextResponse.json({
      success: true,
      frequency,
      processed: results.length,
      results,
    })

  } catch (error) {
    console.error('[CRON] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Calculate next run time based on frequency
 */
function calculateNextRun(frequency: string, from: Date): Date {
  const next = new Date(from)
  
  switch (frequency) {
    case 'every_5_min':
      next.setMinutes(next.getMinutes() + 5)
      break
    case 'every_15_min':
      next.setMinutes(next.getMinutes() + 15)
      break
    case 'every_30_min':
      next.setMinutes(next.getMinutes() + 30)
      break
    case 'hourly':
      next.setHours(next.getHours() + 1)
      next.setMinutes(0)
      next.setSeconds(0)
      break
    case 'daily':
      next.setDate(next.getDate() + 1)
      next.setHours(0)
      next.setMinutes(0)
      next.setSeconds(0)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      next.setHours(0)
      next.setMinutes(0)
      next.setSeconds(0)
      break
  }
  
  return next
}