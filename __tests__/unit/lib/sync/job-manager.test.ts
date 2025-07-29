import { SyncJobManager, JobManagerConfig } from '@/lib/sync/job-manager'
import { SyncEngine } from '@/lib/sync/sync-engine'
import { createClient } from '@/lib/supabase/server'
import { calculateNextRun } from '@/lib/sync/utils/schedule-helpers'
import type { SyncJob, SyncJobConfig, SyncSchedule } from '@/types/sync-engine.types'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/sync/sync-engine')
jest.mock('@/lib/sync/utils/schedule-helpers')

// Mock setTimeout/clearTimeout for testing
jest.useFakeTimers()

describe('SyncJobManager', () => {
  let syncJobManager: SyncJobManager
  let mockSyncEngine: jest.Mocked<SyncEngine>
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockJobManagerConfig: Partial<JobManagerConfig> = {
    worker_id: 'test-worker',
    poll_interval_ms: 1000,
    max_concurrent_jobs: 2,
    lock_duration_seconds: 60,
    enable_auto_retry: true,
    enable_scheduling: true
  }

  const mockSyncJob: SyncJob = {
    id: 'job-123',
    integration_id: 'integration-123',
    status: 'pending',
    type: 'manual',
    config: {
      integration_id: 'integration-123',
      job_type: 'manual',
      entity_types: ['products'],
      sync_mode: 'incremental',
      batch_size: 100,
      priority: 'normal'
    },
    created_at: '2024-01-15T10:00:00Z',
    started_at: null,
    completed_at: null,
    error: null,
    summary: null
  }

  const mockSyncSchedule: SyncSchedule = {
    id: 'schedule-123',
    organization_id: 'org-123',
    integration_id: 'integration-123',
    name: 'Product Sync',
    frequency: 'hourly',
    enabled: true,
    entity_types: ['products'],
    sync_mode: 'incremental',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z',
    last_run_at: null,
    next_run_at: null,
    active_hours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC'
    }
  }

  const mockJobResult = {
    success: true,
    summary: {
      total_processed: 100,
      created: 25,
      updated: 50,
      deleted: 0,
      errors: 0
    },
    metrics: {
      duration_ms: 5000,
      rate_per_second: 20
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    
    mockSyncEngine = new SyncEngine({} as any) as jest.Mocked<SyncEngine>
    mockSyncEngine.executeJob = jest.fn().mockResolvedValue(mockJobResult)
    mockSyncEngine.createSyncJob = jest.fn().mockResolvedValue(mockSyncJob)
    mockSyncEngine.cancelJob = jest.fn().mockResolvedValue(undefined)
    mockSyncEngine.shutdown = jest.fn().mockResolvedValue(undefined)
    
    mockSupabase = createMockSupabase()
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    
    ;(calculateNextRun as jest.Mock).mockReturnValue(new Date('2024-01-15T11:00:00Z'))
    
    syncJobManager = new SyncJobManager(mockSyncEngine, mockJobManagerConfig)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const manager = new SyncJobManager(mockSyncEngine)
      const stats = manager.getStatistics()
      
      expect(stats).toMatchObject({
        is_running: false,
        active_jobs: 0,
        max_jobs: 3
      })
    })

    it('should merge custom config with defaults', () => {
      const customConfig = { max_concurrent_jobs: 5 }
      const manager = new SyncJobManager(mockSyncEngine, customConfig)
      
      const stats = manager.getStatistics()
      expect(stats.max_jobs).toBe(5)
    })
  })

  describe('start', () => {
    it('should start the job manager', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await syncJobManager.start()
      
      const stats = await syncJobManager.getStatistics()
      expect(stats.is_running).toBe(true)
    })

    it('should not start if already running', async () => {
      await syncJobManager.start()
      
      // Try to start again
      await syncJobManager.start()
      
      const stats = await syncJobManager.getStatistics()
      expect(stats.is_running).toBe(true)
    })

    it('should begin polling for jobs', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await syncJobManager.start()
      
      // Advance timer to trigger polling
      jest.advanceTimersByTime(1000)
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_next_sync_job', {
        p_worker_id: 'test-worker',
        p_lock_duration_seconds: 60
      })
    })
  })

  describe('stop', () => {
    it('should stop gracefully with no active jobs', async () => {
      await syncJobManager.start()
      await syncJobManager.stop()
      
      const stats = await syncJobManager.getStatistics()
      expect(stats.is_running).toBe(false)
      expect(mockSyncEngine.shutdown).toHaveBeenCalled()
    })

    it('should wait for active jobs to complete', async () => {
      await syncJobManager.start()
      
      // Mock active job
      ;(syncJobManager as any).activeJobs.add('job-123')
      
      // Start stop process
      const stopPromise = syncJobManager.stop({ gracefulShutdownMs: 100, forceKillAfterMs: 200 })
      
      // Simulate job completion after 50ms
      setTimeout(() => {
        ;(syncJobManager as any).activeJobs.delete('job-123')
      }, 50)
      
      jest.advanceTimersByTime(50)
      await stopPromise
      
      expect(mockSyncEngine.shutdown).toHaveBeenCalled()
    })

    it('should force kill jobs after timeout', async () => {
      await syncJobManager.start()
      
      // Mock active job that won't complete
      ;(syncJobManager as any).activeJobs.add('job-123')
      
      const stopPromise = syncJobManager.stop({ gracefulShutdownMs: 100, forceKillAfterMs: 200 })
      
      // Advance past force kill timeout
      jest.advanceTimersByTime(200)
      await stopPromise
      
      expect(mockSyncEngine.cancelJob).toHaveBeenCalledWith('job-123')
    })

    it('should handle job cancellation errors', async () => {
      await syncJobManager.start()
      
      // Mock active job
      ;(syncJobManager as any).activeJobs.add('job-123')
      mockSyncEngine.cancelJob.mockRejectedValue(new Error('Cancel failed'))
      
      const stopPromise = syncJobManager.stop({ gracefulShutdownMs: 100, forceKillAfterMs: 200 })
      
      jest.advanceTimersByTime(200)
      await stopPromise
      
      expect(mockSyncEngine.cancelJob).toHaveBeenCalledWith('job-123')
    })
  })

  describe('claimNextJob', () => {
    it('should claim a job successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'job-123', error: null })
      
      const jobId = await (syncJobManager as any).claimNextJob()
      
      expect(jobId).toBe('job-123')
      expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_next_sync_job', {
        p_worker_id: 'test-worker',
        p_lock_duration_seconds: 60
      })
    })

    it('should return null when no jobs available', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      const jobId = await (syncJobManager as any).claimNextJob()
      
      expect(jobId).toBeNull()
    })

    it('should handle claim errors', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })
      
      const jobId = await (syncJobManager as any).claimNextJob()
      
      expect(jobId).toBeNull()
    })
  })

  describe('processJob', () => {
    it('should process a job successfully', async () => {
      await (syncJobManager as any).processJob('job-123')
      
      expect(mockSyncEngine.executeJob).toHaveBeenCalledWith('job-123')
      const stats = await syncJobManager.getStatistics()
      expect(stats.active_jobs).toBe(0) // Should be removed after completion
    })

    it('should handle job execution errors', async () => {
      const error = new Error('Job failed')
      mockSyncEngine.executeJob.mockRejectedValue(error)
      
      // Mock retry logic
      const mockQueueItem = { attempts: 1, max_attempts: 3 }
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'sync_queue') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockQueueItem,
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await (syncJobManager as any).processJob('job-123')
      
      expect(mockSyncEngine.executeJob).toHaveBeenCalledWith('job-123')
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_sync_job', {
        p_job_id: 'job-123',
        p_retry_delay_seconds: expect.any(Number)
      })
    })

    it('should track active jobs correctly', async () => {
      let stats = await syncJobManager.getStatistics()
      expect(stats.active_jobs).toBe(0)
      
      // Start processing job (don't await to check active state)
      const jobPromise = (syncJobManager as any).processJob('job-123')
      
      // Check that job is tracked as active
      stats = await syncJobManager.getStatistics()
      expect(stats.active_jobs).toBe(1)
      
      // Wait for completion
      await jobPromise
      
      // Check that job is no longer active
      stats = await syncJobManager.getStatistics()
      expect(stats.active_jobs).toBe(0)
    })
  })

  describe('handleJobRetry', () => {
    it('should retry job with exponential backoff', async () => {
      const mockQueueItem = { attempts: 2, max_attempts: 5 }
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockQueueItem,
              error: null
            })
          })
        })
      } as any)
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await (syncJobManager as any).handleJobRetry('job-123', new Error('Test error'))
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_sync_job', {
        p_job_id: 'job-123',
        p_retry_delay_seconds: 120 // 2^(2-1) * 60 = 120 seconds
      })
    })

    it('should mark job as failed when max attempts exceeded', async () => {
      const mockQueueItem = { attempts: 5, max_attempts: 5 }
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'sync_queue') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockQueueItem,
                  error: null
                })
              })
            }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        if (table === 'sync_jobs') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          } as any
        }
        return {} as any
      })
      
      await (syncJobManager as any).handleJobRetry('job-123', new Error('Test error'))
      
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_queue')
    })

    it('should handle missing queue item', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any)
      
      // Should not throw or crash
      await (syncJobManager as any).handleJobRetry('job-123', new Error('Test error'))
    })

    it('should cap retry delay at maximum', async () => {
      const mockQueueItem = { attempts: 10, max_attempts: 15 }
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockQueueItem,
              error: null
            })
          })
        })
      } as any)
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await (syncJobManager as any).handleJobRetry('job-123', new Error('Test error'))
      
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_sync_job', {
        p_job_id: 'job-123',
        p_retry_delay_seconds: 3600 // Capped at 1 hour
      })
    })
  })

  describe('checkScheduledJobs', () => {
    it('should process scheduled jobs', async () => {
      const mockSchedules = [mockSyncSchedule]
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockSchedules,
                error: null
              })
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      } as any)
      
      jest.spyOn(syncJobManager as any, 'shouldRunSchedule').mockReturnValue(true)
      
      await (syncJobManager as any).checkScheduledJobs()
      
      expect(mockSyncEngine.createSyncJob).toHaveBeenCalledWith({
        integration_id: 'integration-123',
        job_type: 'scheduled',
        entity_types: ['products'],
        sync_mode: 'incremental',
        batch_size: 100,
        priority: 'normal'
      })
    })

    it('should skip schedules that should not run', async () => {
      const mockSchedules = [mockSyncSchedule]
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockSchedules,
                error: null
              })
            })
          })
        })
      } as any)
      
      jest.spyOn(syncJobManager as any, 'shouldRunSchedule').mockReturnValue(false)
      
      await (syncJobManager as any).checkScheduledJobs()
      
      expect(mockSyncEngine.createSyncJob).not.toHaveBeenCalled()
    })

    it('should handle empty schedules', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      } as any)
      
      await (syncJobManager as any).checkScheduledJobs()
      
      expect(mockSyncEngine.createSyncJob).not.toHaveBeenCalled()
    })

    it('should handle schedule processing errors', async () => {
      const mockSchedules = [mockSyncSchedule]
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockSchedules,
                error: null
              })
            })
          })
        })
      } as any)
      
      jest.spyOn(syncJobManager as any, 'shouldRunSchedule').mockImplementation(() => {
        throw new Error('Schedule error')
      })
      
      // Should not throw
      await (syncJobManager as any).checkScheduledJobs()
    })
  })

  describe('shouldRunSchedule', () => {
    beforeEach(() => {
      // Mock current time to 2024-01-15T10:00:00Z (10:00 AM UTC)
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    })

    it('should run schedule within active hours', () => {
      const schedule = {
        ...mockSyncSchedule,
        active_hours: {
          start: '09:00',
          end: '17:00',
          timezone: 'UTC'
        },
        last_run_at: null
      }
      
      const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
      expect(shouldRun).toBe(true)
    })

    it('should not run schedule outside active hours', () => {
      const schedule = {
        ...mockSyncSchedule,
        active_hours: {
          start: '14:00',
          end: '18:00',
          timezone: 'UTC'
        },
        last_run_at: null
      }
      
      const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
      expect(shouldRun).toBe(false)
    })

    it('should handle overnight active hours', () => {
      // Test when current time is 22:00 (10 PM)
      jest.setSystemTime(new Date('2024-01-15T22:00:00Z'))
      
      const schedule = {
        ...mockSyncSchedule,
        active_hours: {
          start: '20:00',
          end: '06:00', // Next day
          timezone: 'UTC'
        },
        last_run_at: null
      }
      
      const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
      expect(shouldRun).toBe(true)
    })

    it('should not run during inactive hours in overnight schedule', () => {
      // Test when current time is 12:00 (noon)
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
      
      const schedule = {
        ...mockSyncSchedule,
        active_hours: {
          start: '20:00',
          end: '06:00', // Next day
          timezone: 'UTC'
        },
        last_run_at: null
      }
      
      const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
      expect(shouldRun).toBe(false)
    })

    it('should respect frequency timing for hourly schedule', () => {
      const schedule = {
        ...mockSyncSchedule,
        frequency: 'hourly',
        last_run_at: '2024-01-15T09:30:00Z' // 30 minutes ago
      }
      
      const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
      expect(shouldRun).toBe(false) // Not enough time passed
    })

    it('should run hourly schedule after sufficient time', () => {
      const schedule = {
        ...mockSyncSchedule,
        frequency: 'hourly',
        last_run_at: '2024-01-15T08:30:00Z' // 1.5 hours ago
      }
      
      const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
      expect(shouldRun).toBe(true)
    })

    it('should handle different frequency types', () => {
      const testCases = [
        { frequency: 'every_5_min', lastRun: '2024-01-15T09:54:00Z', expected: true },
        { frequency: 'every_5_min', lastRun: '2024-01-15T09:58:00Z', expected: false },
        { frequency: 'every_15_min', lastRun: '2024-01-15T09:44:00Z', expected: true },
        { frequency: 'every_30_min', lastRun: '2024-01-15T09:29:00Z', expected: true },
        { frequency: 'daily', lastRun: '2024-01-14T10:00:00Z', expected: true },
        { frequency: 'weekly', lastRun: '2024-01-08T10:00:00Z', expected: true }
      ]
      
      for (const { frequency, lastRun, expected } of testCases) {
        const schedule = {
          ...mockSyncSchedule,
          frequency: frequency as any,
          last_run_at: lastRun
        }
        
        const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
        expect(shouldRun).toBe(expected)
      }
    })

    it('should run schedule with no last run time', () => {
      const schedule = {
        ...mockSyncSchedule,
        last_run_at: null
      }
      
      const shouldRun = (syncJobManager as any).shouldRunSchedule(schedule)
      expect(shouldRun).toBe(true)
    })
  })

  describe('cleanupStaleLocks', () => {
    it('should clean up stale locks', async () => {
      const mockStaleJobs = [
        { job_id: 'job-1' },
        { job_id: 'job-2' }
      ]
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockStaleJobs,
                error: null
              })
            })
          })
        })
      } as any)
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
      
      await (syncJobManager as any).cleanupStaleLocks()
      
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_sync_job', {
        p_job_id: 'job-1',
        p_retry_delay_seconds: 0
      })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_sync_job', {
        p_job_id: 'job-2',
        p_retry_delay_seconds: 0
      })
    })

    it('should handle no stale locks', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      } as any)
      
      await (syncJobManager as any).cleanupStaleLocks()
      
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })
  })

  describe('triggerManualSync', () => {
    it('should create manual sync job', async () => {
      const job = await syncJobManager.triggerManualSync(
        'integration-123',
        ['products', 'inventory'],
        { sync_mode: 'full', priority: 'high' }
      )
      
      expect(mockSyncEngine.createSyncJob).toHaveBeenCalledWith({
        integration_id: 'integration-123',
        job_type: 'manual',
        entity_types: ['products', 'inventory'],
        sync_mode: 'full',
        priority: 'high',
        batch_size: 100
      })
      
      expect(job).toEqual(mockSyncJob)
    })

    it('should use default options', async () => {
      await syncJobManager.triggerManualSync('integration-123', ['products'])
      
      expect(mockSyncEngine.createSyncJob).toHaveBeenCalledWith({
        integration_id: 'integration-123',
        job_type: 'manual',
        entity_types: ['products'],
        sync_mode: 'incremental',
        priority: 'normal',
        batch_size: 100
      })
    })
  })

  describe('retryJob', () => {
    it('should create retry job from original', async () => {
      const originalJob = {
        id: 'original-123',
        config: {
          integration_id: 'integration-123',
          job_type: 'manual',
          entity_types: ['products'],
          sync_mode: 'incremental',
          priority: 'normal',
          batch_size: 100
        }
      }
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: originalJob,
              error: null
            })
          })
        })
      } as any)
      
      const retryJob = await syncJobManager.retryJob('original-123')
      
      expect(mockSyncEngine.createSyncJob).toHaveBeenCalledWith({
        ...originalJob.config,
        job_type: 'retry',
        retry_config: {
          max_attempts: 1,
          backoff_multiplier: 1,
          initial_delay_ms: 0
        }
      })
      
      expect(retryJob).toEqual(mockSyncJob)
    })

    it('should throw error if original job not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      } as any)
      
      await expect(syncJobManager.retryJob('nonexistent')).rejects.toThrow('Original job not found')
    })
  })

  describe('getStatistics', () => {
    it('should return current statistics', async () => {
      const stats = await syncJobManager.getStatistics()
      
      expect(stats).toEqual({
        worker_id: 'test-worker',
        is_running: false,
        active_jobs: 0,
        max_jobs: 2,
        uptime_seconds: 0
      })
    })

    it('should reflect running state', async () => {
      await syncJobManager.start()
      
      const stats = await syncJobManager.getStatistics()
      expect(stats.is_running).toBe(true)
    })
  })

  describe('polling integration', () => {
    it('should not exceed max concurrent jobs', async () => {
      await syncJobManager.start()
      
      // Mock claiming jobs successfully
      mockSupabase.rpc.mockResolvedValue({ data: 'job-123', error: null })
      
      // Add max concurrent jobs manually
      ;(syncJobManager as any).activeJobs.add('job-1')
      ;(syncJobManager as any).activeJobs.add('job-2')
      
      // Trigger polling
      jest.advanceTimersByTime(1000)
      
      // Should not claim new job since at max capacity
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('should handle polling errors gracefully', async () => {
      await syncJobManager.start()
      
      // Mock error in claimNextJob
      mockSupabase.rpc.mockRejectedValue(new Error('Database error'))
      
      // Should not crash
      jest.advanceTimersByTime(1000)
      
      // Should continue polling
      expect(setTimeout).toHaveBeenCalled()
    })

    it('should skip scheduling when disabled', async () => {
      const configWithoutScheduling = { ...mockJobManagerConfig, enable_scheduling: false }
      const manager = new SyncJobManager(mockSyncEngine, configWithoutScheduling)
      
      await manager.start()
      
      jest.spyOn(manager as any, 'checkScheduledJobs')
      
      jest.advanceTimersByTime(1000)
      
      expect((manager as any).checkScheduledJobs).not.toHaveBeenCalled()
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    rpc: jest.fn(),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(),
          or: jest.fn(),
          not: jest.fn(),
          lt: jest.fn(),
          limit: jest.fn()
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn()
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn()
        })
      })
    })
  }
}