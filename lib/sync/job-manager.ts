// PRP-015: Sync Job Manager with Queue Processing
import { createClient } from '@/lib/supabase/server'
import { SyncEngine } from './sync-engine'
import type { 
  SyncJob, 
  SyncJobConfig, 
  SyncSchedule,
  QueueItem,
  SyncJobStatus,
  SyncJobType,
} from '@/types/sync-engine.types'

export interface JobManagerConfig {
  worker_id: string
  poll_interval_ms: number
  max_concurrent_jobs: number
  lock_duration_seconds: number
  enable_auto_retry: boolean
  enable_scheduling: boolean
}

const DEFAULT_CONFIG: JobManagerConfig = {
  worker_id: `worker-${Date.now()}`,
  poll_interval_ms: 5000, // 5 seconds
  max_concurrent_jobs: 3,
  lock_duration_seconds: 300, // 5 minutes
  enable_auto_retry: true,
  enable_scheduling: true,
}

export class SyncJobManager {
  private config: JobManagerConfig
  private syncEngine: SyncEngine
  private isRunning: boolean = false
  private pollTimer: NodeJS.Timeout | null = null
  private activeJobs: Set<string> = new Set()

  constructor(syncEngine: SyncEngine, config?: Partial<JobManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.syncEngine = syncEngine
  }

  /**
   * Start the job manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Job manager is already running')
      return
    }

    this.isRunning = true
    console.log(`Starting job manager with worker ID: ${this.config.worker_id}`)

    // Start polling for jobs
    await this.pollForJobs()
  }

  /**
   * Stop the job manager
   */
  async stop(): Promise<void> {
    this.isRunning = false
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }

    // Wait for active jobs to complete
    if (this.activeJobs.size > 0) {
      console.log(`Waiting for ${this.activeJobs.size} active jobs to complete...`)
      
      // Give jobs some time to complete
      await new Promise(resolve => setTimeout(resolve, 10000))
    }

    console.log('Job manager stopped')
  }

  /**
   * Poll for available jobs in the queue
   */
  private async pollForJobs(): Promise<void> {
    if (!this.isRunning) return

    try {
      // Check if we can accept more jobs
      if (this.activeJobs.size >= this.config.max_concurrent_jobs) {
        // Schedule next poll
        this.scheduleNextPoll()
        return
      }

      // Check for scheduled jobs if enabled
      if (this.config.enable_scheduling) {
        await this.checkScheduledJobs()
      }

      // Claim a job from the queue
      const jobId = await this.claimNextJob()
      
      if (jobId) {
        // Process the job asynchronously
        this.processJob(jobId).catch(error => {
          console.error(`Error processing job ${jobId}:`, error)
        })
      }

      // Clean up stale locks
      await this.cleanupStaleLocks()

    } catch (error) {
      console.error('Error polling for jobs:', error)
    }

    // Schedule next poll
    this.scheduleNextPoll()
  }

  /**
   * Schedule the next poll
   */
  private scheduleNextPoll(): void {
    if (this.isRunning) {
      this.pollTimer = setTimeout(() => {
        this.pollForJobs()
      }, this.config.poll_interval_ms)
    }
  }

  /**
   * Claim the next available job from the queue
   */
  private async claimNextJob(): Promise<string | null> {
    const supabase = await createClient()
    
    const { data, error } = await supabase.rpc('claim_next_sync_job', {
      p_worker_id: this.config.worker_id,
      p_lock_duration_seconds: this.config.lock_duration_seconds,
    })

    if (error) {
      console.error('Error claiming job:', error)
      return null
    }

    return data as string | null
  }

  /**
   * Process a claimed job
   */
  private async processJob(jobId: string): Promise<void> {
    this.activeJobs.add(jobId)
    console.log(`Processing job: ${jobId}`)

    try {
      // Execute the job using sync engine
      const result = await this.syncEngine.executeJob(jobId)
      
      console.log(`Job ${jobId} completed successfully`, {
        processed: result.summary.total_processed,
        created: result.summary.created,
        updated: result.summary.updated,
      })

    } catch (error) {
      console.error(`Job ${jobId} failed:`, error)
      
      // Handle retry if enabled
      if (this.config.enable_auto_retry) {
        await this.handleJobRetry(jobId, error)
      }
    } finally {
      this.activeJobs.delete(jobId)
    }
  }

  /**
   * Handle job retry logic
   */
  private async handleJobRetry(jobId: string, error: any): Promise<void> {
    const supabase = await createClient()
    
    // Get job and queue info
    const { data: queueItem } = await supabase
      .from('sync_queue')
      .select('attempts, max_attempts')
      .eq('job_id', jobId)
      .single()

    if (!queueItem) return

    // Check if we should retry
    if (queueItem.attempts < queueItem.max_attempts) {
      // Calculate retry delay with exponential backoff
      const retryDelay = Math.min(
        Math.pow(2, queueItem.attempts - 1) * 60, // exponential backoff in seconds
        3600 // max 1 hour
      )

      console.log(`Scheduling retry for job ${jobId} in ${retryDelay} seconds`)

      // Release the job for retry
      await supabase.rpc('release_sync_job', {
        p_job_id: jobId,
        p_retry_delay_seconds: retryDelay,
      })
    } else {
      console.log(`Job ${jobId} exceeded max retry attempts`)
      
      // Mark job as permanently failed
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          error: {
            message: error.message || 'Max retry attempts exceeded',
            final_error: true,
          },
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // Remove from queue
      await supabase
        .from('sync_queue')
        .delete()
        .eq('job_id', jobId)
    }
  }

  /**
   * Check for scheduled jobs that need to run
   */
  private async checkScheduledJobs(): Promise<void> {
    const supabase = await createClient()
    
    // Find schedules that need to run
    const { data: schedules } = await supabase
      .from('sync_schedules')
      .select('*')
      .eq('enabled', true)
      .or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`)
      .limit(5)

    if (!schedules || schedules.length === 0) return

    for (const schedule of schedules) {
      try {
        // Check if it's time to run based on schedule
        if (this.shouldRunSchedule(schedule)) {
          await this.createScheduledJob(schedule)
        }
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error)
      }
    }
  }

  /**
   * Check if a schedule should run now
   */
  private shouldRunSchedule(schedule: SyncSchedule & { last_run_at?: string }): boolean {
    const now = new Date()
    
    // Check active hours if configured
    if (schedule.active_hours) {
      const currentHour = now.getHours()
      const [startHour] = schedule.active_hours.start.split(':').map(Number)
      const [endHour] = schedule.active_hours.end.split(':').map(Number)
      
      if (currentHour < startHour || currentHour >= endHour) {
        return false
      }
    }

    // Check last run time
    if (schedule.last_run_at) {
      const lastRun = new Date(schedule.last_run_at)
      const timeSinceLastRun = now.getTime() - lastRun.getTime()
      
      switch (schedule.frequency) {
        case 'every_5_min':
          return timeSinceLastRun >= 5 * 60 * 1000
        case 'every_15_min':
          return timeSinceLastRun >= 15 * 60 * 1000
        case 'every_30_min':
          return timeSinceLastRun >= 30 * 60 * 1000
        case 'hourly':
          return timeSinceLastRun >= 60 * 60 * 1000
        case 'daily':
          return timeSinceLastRun >= 24 * 60 * 60 * 1000
        case 'weekly':
          return timeSinceLastRun >= 7 * 24 * 60 * 60 * 1000
      }
    }

    return true
  }

  /**
   * Create a job from a schedule
   */
  private async createScheduledJob(schedule: any): Promise<void> {
    const supabase = await createClient()
    
    // Create job configuration
    const jobConfig: SyncJobConfig = {
      integration_id: schedule.integration_id,
      job_type: 'scheduled',
      entity_types: schedule.entity_types,
      sync_mode: 'incremental',
      batch_size: 100,
      priority: 'normal',
    }

    // Create the job
    const job = await this.syncEngine.createSyncJob(jobConfig)
    
    console.log(`Created scheduled job ${job.id} for integration ${schedule.integration_id}`)

    // Update schedule with last run time and calculate next run
    const nextRun = this.calculateNextRun(schedule.frequency, new Date())
    
    await supabase
      .from('sync_schedules')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun.toISOString(),
      })
      .eq('id', schedule.id)
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(frequency: string, from: Date): Date {
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

  /**
   * Clean up stale locks in the queue
   */
  private async cleanupStaleLocks(): Promise<void> {
    const supabase = await createClient()
    
    // Find stale locks (locked for more than lock duration)
    const staleTime = new Date(
      Date.now() - this.config.lock_duration_seconds * 1000 * 2 // 2x lock duration
    ).toISOString()

    const { data: staleJobs } = await supabase
      .from('sync_queue')
      .select('job_id')
      .not('locked_by', 'is', null)
      .lt('locked_at', staleTime)
      .limit(10)

    if (!staleJobs || staleJobs.length === 0) return

    console.log(`Found ${staleJobs.length} stale locks to clean up`)

    // Release stale locks
    for (const { job_id } of staleJobs) {
      await supabase.rpc('release_sync_job', {
        p_job_id: job_id,
        p_retry_delay_seconds: 0,
      })
    }
  }

  /**
   * Get job manager statistics
   */
  async getStatistics(): Promise<{
    worker_id: string
    is_running: boolean
    active_jobs: number
    max_jobs: number
    uptime_seconds: number
  }> {
    return {
      worker_id: this.config.worker_id,
      is_running: this.isRunning,
      active_jobs: this.activeJobs.size,
      max_jobs: this.config.max_concurrent_jobs,
      uptime_seconds: 0, // Would need to track start time
    }
  }

  /**
   * Manually trigger a sync for an integration
   */
  async triggerManualSync(
    integrationId: string,
    entityTypes: string[],
    options?: {
      sync_mode?: 'full' | 'incremental'
      priority?: 'low' | 'normal' | 'high'
    }
  ): Promise<SyncJob> {
    const jobConfig: SyncJobConfig = {
      integration_id: integrationId,
      job_type: 'manual',
      entity_types: entityTypes as any,
      sync_mode: options?.sync_mode || 'incremental',
      priority: options?.priority || 'normal',
      batch_size: 100,
    }

    return await this.syncEngine.createSyncJob(jobConfig)
  }

  /**
   * Retry a failed job
   */
  async retryJob(originalJobId: string): Promise<SyncJob> {
    const supabase = await createClient()
    
    // Get original job details
    const { data: originalJob, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('id', originalJobId)
      .single()

    if (error || !originalJob) {
      throw new Error('Original job not found')
    }

    // Create retry job
    const retryConfig: SyncJobConfig = {
      ...originalJob.config,
      job_type: 'retry',
      retry_config: {
        max_attempts: 1,
        backoff_multiplier: 1,
        initial_delay_ms: 0,
      },
    }

    const retryJob = await this.syncEngine.createSyncJob(retryConfig)
    
    console.log(`Created retry job ${retryJob.id} for original job ${originalJobId}`)
    
    return retryJob
  }
}