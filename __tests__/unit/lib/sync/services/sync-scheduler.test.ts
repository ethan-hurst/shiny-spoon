import { SyncScheduler } from '@/lib/sync/services/sync-scheduler'
import { createBrowserClient } from '@/lib/supabase/client'
import { SyncInterval, SyncStatus } from '@/lib/sync/types'

jest.mock('@/lib/supabase/client')

describe('SyncScheduler', () => {
  let scheduler: SyncScheduler
  let mockSupabase: any

  // Create a mock query builder that can be chained
  const createMockQueryBuilder = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 'schedule-123' },
      error: null
    })
  })

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()

    // Create query builder methods that can be accessed directly for testing
    const queryBuilder = createMockQueryBuilder()
    
    mockSupabase = {
      from: jest.fn().mockImplementation((table) => {
        // Configure specific table behaviors
        if (table === 'sync_schedules') {
          queryBuilder.insert.mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockImplementation(() => mockSupabase.single())
            })
          })
          queryBuilder.select.mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockImplementation(() => mockSupabase.single())
          })
          queryBuilder.update.mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockImplementation(() => mockSupabase.single())
          })
        }
        
        if (table === 'sync_logs') {
          queryBuilder.insert.mockResolvedValue({
            data: null,
            error: null
          })
        }
        
        if (table === 'sync_configs') {
          queryBuilder.select.mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockImplementation(() => mockSupabase.single())
          })
          queryBuilder.update.mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockImplementation(() => mockSupabase.single())
          })
        }
        
        return queryBuilder
      }),
      // Expose query builder methods for direct access in tests
      select: queryBuilder.select,
      insert: queryBuilder.insert,
      update: queryBuilder.update,
      delete: queryBuilder.delete,
      eq: queryBuilder.eq,
      gte: queryBuilder.gte,
      lte: queryBuilder.lte,
      order: queryBuilder.order,
      limit: queryBuilder.limit,
      single: jest.fn().mockResolvedValue({
        data: { id: 'schedule-123' },
        error: null
      }),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
      }
    }
    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabase)
    scheduler = new SyncScheduler()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('scheduleSync', () => {
    it('should schedule a sync successfully', async () => {
      const syncConfig = {
        id: 'sync-123',
        integration_id: 'int-123',
        sync_type: 'inventory',
        interval: SyncInterval.EVERY_HOUR,
        active: true
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'schedule-123' },
        error: null
      })

      const result = await scheduler.scheduleSync(syncConfig)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('schedule-123')
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_schedules')
    })

    it('should handle scheduling errors', async () => {
      const syncConfig = {
        id: 'sync-123',
        integration_id: 'int-123',
        sync_type: 'inventory',
        interval: SyncInterval.EVERY_HOUR,
        active: true
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Failed to schedule')
      })

      const result = await scheduler.scheduleSync(syncConfig)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to schedule')
    })
  })

  describe('getNextSyncTime', () => {
    it('should calculate next sync time for hourly interval', () => {
      const lastSync = new Date('2024-01-01T10:00:00Z')
      const interval = SyncInterval.EVERY_HOUR

      const nextSync = scheduler.getNextSyncTime(lastSync, interval)

      expect(nextSync).toEqual(new Date('2024-01-01T11:00:00Z'))
    })

    it('should calculate next sync time for daily interval', () => {
      const lastSync = new Date('2024-01-01T10:00:00Z')
      const interval = SyncInterval.DAILY

      const nextSync = scheduler.getNextSyncTime(lastSync, interval)

      expect(nextSync).toEqual(new Date('2024-01-02T10:00:00Z'))
    })

    it('should calculate next sync time for weekly interval', () => {
      const lastSync = new Date('2024-01-01T10:00:00Z')
      const interval = SyncInterval.WEEKLY

      const nextSync = scheduler.getNextSyncTime(lastSync, interval)

      expect(nextSync).toEqual(new Date('2024-01-08T10:00:00Z'))
    })

    it('should calculate next sync time for custom interval', () => {
      const lastSync = new Date('2024-01-01T10:00:00Z')
      const interval = SyncInterval.CUSTOM
      const customMinutes = 90

      const nextSync = scheduler.getNextSyncTime(lastSync, interval, customMinutes)

      expect(nextSync).toEqual(new Date('2024-01-01T11:30:00Z'))
    })
  })

  describe('processPendingSyncs', () => {
    it('should process pending syncs successfully', async () => {
      const now = new Date()
      const pendingSyncs = [
        {
          id: 'schedule-123',
          sync_config_id: 'sync-123',
          integration_id: 'int-123',
          scheduled_at: new Date(now.getTime() - 60000).toISOString(), // 1 minute ago
          status: 'scheduled'
        },
        {
          id: 'schedule-124',
          sync_config_id: 'sync-124',
          integration_id: 'int-124',
          scheduled_at: new Date(now.getTime() - 30000).toISOString(), // 30 seconds ago
          status: 'scheduled'
        }
      ]

      // Mock the initial query to return pending syncs
      const queryBuilder = createMockQueryBuilder()
      queryBuilder.limit.mockResolvedValueOnce({
        data: pendingSyncs,
        error: null
      })

      // Mock successful sync execution
      mockSupabase.single.mockResolvedValue({
        data: { status: 'completed' },
        error: null
      })

      // Override the from mock for this test
      mockSupabase.from.mockImplementationOnce((table) => {
        if (table === 'sync_schedules') {
          return queryBuilder
        }
        return createMockQueryBuilder()
      })

      const result = await scheduler.processPendingSyncs()

      expect(result.success).toBe(true)
      expect(result.data?.processed).toBe(2)
      expect(result.data?.failed).toBe(0)
    })

    it('should handle sync execution failures', async () => {
      const pendingSyncs = [
        {
          id: 'schedule-125',
          sync_config_id: 'sync-125',
          integration_id: 'int-125',
          scheduled_at: new Date().toISOString(),
          status: 'scheduled'
        }
      ]

      // Mock the initial query to return pending syncs
      mockSupabase.limit.mockResolvedValueOnce({
        data: pendingSyncs,
        error: null
      })

      // Mock sync execution failure by making sync_logs insert throw an error
      let syncLogsCallCount = 0
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'sync_logs') {
          syncLogsCallCount++
          if (syncLogsCallCount === 1) {
            return {
              insert: jest.fn().mockRejectedValue(new Error('Sync failed'))
            }
          }
        }
        const queryBuilder = createMockQueryBuilder()
        if (table === 'sync_schedules') {
          queryBuilder.limit.mockResolvedValueOnce({
            data: pendingSyncs,
            error: null
          })
        }
        return queryBuilder
      })

      const result = await scheduler.processPendingSyncs()



      expect(result.success).toBe(true)
      expect(result.data?.processed).toBe(0)
      expect(result.data?.failed).toBe(1)
    })
  })

  describe('cancelScheduledSync', () => {
    it('should cancel scheduled sync successfully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'schedule-123' },
        error: null
      })

      const result = await scheduler.cancelScheduledSync('schedule-123')

      expect(result.success).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'cancelled',
        cancelled_at: expect.any(String)
      })
    })

    it('should handle cancellation errors', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found')
      })

      const result = await scheduler.cancelScheduledSync('schedule-999')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not found')
    })
  })

  describe('getScheduledSyncs', () => {
    it('should get scheduled syncs for date range', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      const scheduledSyncs = [
        {
          id: 'schedule-126',
          scheduled_at: '2024-01-15T10:00:00Z',
          status: 'scheduled'
        },
        {
          id: 'schedule-127',
          scheduled_at: '2024-01-20T14:00:00Z',
          status: 'scheduled'
        }
      ]

      // Mock the chained call to return scheduled syncs
      const queryBuilder = createMockQueryBuilder()
      queryBuilder.order.mockResolvedValueOnce({
        data: scheduledSyncs,
        error: null
      })

      // Override the from mock for this test
      mockSupabase.from.mockImplementationOnce((table) => {
        if (table === 'sync_schedules') {
          return queryBuilder
        }
        return createMockQueryBuilder()
      })

      const result = await scheduler.getScheduledSyncs(startDate, endDate)

      expect(result.success).toBe(true)
      expect(result.data?.length).toBe(2)
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_schedules')
    })
  })

  describe('updateSyncInterval', () => {
    it('should update sync interval successfully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          interval: SyncInterval.EVERY_HOUR,
          last_sync: new Date().toISOString()
        },
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'sync-123', interval: SyncInterval.DAILY },
        error: null
      })

      const result = await scheduler.updateSyncInterval(
        'sync-123',
        SyncInterval.DAILY
      )

      expect(result.success).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        interval: SyncInterval.DAILY,
        updated_at: expect.any(String)
      })
    })
  })

  describe('pauseSync', () => {
    it('should pause sync successfully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'sync-123', active: false },
        error: null
      })

      const result = await scheduler.pauseSync('sync-123')

      expect(result.success).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        active: false,
        paused_at: expect.any(String)
      })
    })
  })

  describe('resumeSync', () => {
    it('should resume sync successfully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'sync-123', active: true },
        error: null
      })

      const result = await scheduler.resumeSync('sync-123')

      expect(result.success).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        active: true,
        resumed_at: expect.any(String)
      })
    })
  })
})