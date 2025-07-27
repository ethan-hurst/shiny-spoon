/* eslint-env jest */
/* global jest, describe, it, expect, beforeEach */
// Comprehensive unit tests for SyncEngine

import { EventEmitter } from 'events'
import { createClient } from '@/lib/supabase/server'
import { SyncEngine } from '@/lib/sync/sync-engine'
import type { SyncJobConfig } from '@/types/sync-engine.types'

// Mock all external dependencies
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/integrations/base-connector')
jest.mock('@/lib/integrations/netsuite/connector')
jest.mock('@/lib/integrations/shopify/connector')

describe('SyncEngine', () => {
  let mockSupabase: any
  let syncEngine: SyncEngine

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      })),
      rpc: jest.fn(),
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    syncEngine = new SyncEngine()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const engine = new SyncEngine()

      expect(engine['config']).toMatchObject({
        max_concurrent_jobs: 5,
        job_timeout_ms: 300000,
        enable_conflict_detection: true,
        enable_performance_tracking: true,
        enable_notifications: true,
        retention_days: 30,
        debug_mode: false,
      })
    })

    it('should merge provided configuration with defaults', () => {
      const customConfig = {
        max_concurrent_jobs: 10,
        debug_mode: true,
      }

      const engine = new SyncEngine(customConfig)

      expect(engine['config']).toMatchObject({
        max_concurrent_jobs: 10,
        job_timeout_ms: 300000,
        debug_mode: true,
      })
    })

    it('should extend EventEmitter', () => {
      expect(syncEngine).toBeInstanceOf(EventEmitter)
    })

    it('should initialize empty maps and performance tracker', () => {
      expect(syncEngine['activeJobs'].size).toBe(0)
      expect(syncEngine['connectorCache'].size).toBe(0)
      expect(syncEngine['performanceTracker']).toBeDefined()
    })
  })

  describe('createSyncJob', () => {
    const mockConfig: SyncJobConfig = {
      integration_id: 'test-integration',
      job_type: 'incremental',
      entity_types: ['customers', 'orders'],
      sync_mode: 'incremental',
      batch_size: 100,
      priority: 'medium',
    }

    it('should create a sync job successfully', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      mockSupabase.from.mockImplementation((table: string) => {
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        }

        if (table === 'user_profiles') {
          mockChain.single.mockResolvedValue({
            data: { organization_id: 'org-123' },
          })
        } else if (table === 'integrations') {
          mockChain.single.mockResolvedValue({
            data: { id: 'test-integration', organization_id: 'org-123' },
          })
        } else if (table === 'sync_jobs') {
          mockChain.single.mockResolvedValue({
            data: { id: 'job-123', ...mockConfig },
            error: null,
          })
        } else if (table === 'sync_queue') {
          mockChain.insert.mockResolvedValue({ error: null })
        }

        return mockChain
      })

      const result = await syncEngine.createSyncJob(mockConfig)

      expect(result.id).toBe('job-123')
      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
      expect(mockSupabase.from).toHaveBeenCalledWith('integrations')
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_queue')
    })

    it('should throw error when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      await expect(syncEngine.createSyncJob(mockConfig)).rejects.toThrow(
        'User not authenticated'
      )
    })

    it('should throw error when user profile not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      mockSupabase.from.mockImplementation((table: string) => {
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        }

        if (table === 'user_profiles') {
          mockChain.single.mockResolvedValue({ data: null })
        }

        return mockChain
      })

      await expect(syncEngine.createSyncJob(mockConfig)).rejects.toThrow(
        'User profile not found'
      )
    })

    it('should throw error when integration not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      mockSupabase.from.mockImplementation((table: string) => {
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        }

        if (table === 'user_profiles') {
          mockChain.single.mockResolvedValue({
            data: { organization_id: 'org-123' },
          })
        } else if (table === 'integrations') {
          mockChain.single.mockResolvedValue({ data: null })
        }

        return mockChain
      })

      await expect(syncEngine.createSyncJob(mockConfig)).rejects.toThrow(
        'Integration not found or access denied'
      )
    })

    it('should handle rollback when queue insertion fails (fix-53)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      mockSupabase.from.mockImplementation((table: string) => {
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        }

        if (table === 'user_profiles') {
          mockChain.single.mockResolvedValue({
            data: { organization_id: 'org-123' },
          })
        } else if (table === 'integrations') {
          mockChain.single.mockResolvedValue({
            data: { id: 'test-integration', organization_id: 'org-123' },
          })
        } else if (table === 'sync_jobs') {
          mockChain.single.mockResolvedValue({
            data: { id: 'job-123', ...mockConfig },
            error: null,
          })
          // Mock successful delete for rollback
          mockChain.delete.mockReturnThis()
          mockChain.eq.mockResolvedValue({ error: null })
        } else if (table === 'sync_queue') {
          mockChain.insert.mockResolvedValue({
            error: { message: 'Queue insertion failed' },
          })
        }

        return mockChain
      })

      await expect(syncEngine.createSyncJob(mockConfig)).rejects.toThrow(
        'Failed to queue sync job: Queue insertion failed'
      )
    })

    it('should handle rollback failure gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      mockSupabase.from.mockImplementation((table: string) => {
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        }

        if (table === 'user_profiles') {
          mockChain.single.mockResolvedValue({
            data: { organization_id: 'org-123' },
          })
        } else if (table === 'integrations') {
          mockChain.single.mockResolvedValue({
            data: { id: 'test-integration', organization_id: 'org-123' },
          })
        } else if (table === 'sync_jobs') {
          mockChain.single.mockResolvedValue({
            data: { id: 'job-123', ...mockConfig },
            error: null,
          })
          // Mock failed rollback
          mockChain.delete.mockReturnThis()
          mockChain.eq.mockResolvedValue({
            error: { message: 'Rollback failed' },
          })
        } else if (table === 'sync_queue') {
          mockChain.insert.mockResolvedValue({
            error: { message: 'Queue insertion failed' },
          })
        }

        return mockChain
      })

      await expect(syncEngine.createSyncJob(mockConfig)).rejects.toThrow(
        'Failed to queue sync job: Queue insertion failed'
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to rollback job creation',
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should handle rollback exception gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      mockSupabase.from.mockImplementation((table: string) => {
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          delete: jest.fn(() => {
            throw new Error('Rollback exception')
          }),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        }

        if (table === 'user_profiles') {
          mockChain.single.mockResolvedValue({
            data: { organization_id: 'org-123' },
          })
        } else if (table === 'integrations') {
          mockChain.single.mockResolvedValue({
            data: { id: 'test-integration', organization_id: 'org-123' },
          })
        } else if (table === 'sync_jobs') {
          mockChain.single.mockResolvedValue({
            data: { id: 'job-123', ...mockConfig },
            error: null,
          })
        } else if (table === 'sync_queue') {
          mockChain.insert.mockResolvedValue({
            error: { message: 'Queue insertion failed' },
          })
        }

        return mockChain
      })

      await expect(syncEngine.createSyncJob(mockConfig)).rejects.toThrow(
        'Failed to queue sync job: Queue insertion failed'
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        'Exception during rollback',
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should set correct priority values', async () => {
      const testCases = [
        { priority: 'high', expected: 80 },
        { priority: 'medium', expected: 50 },
        { priority: 'low', expected: 20 },
      ]

      for (const testCase of testCases) {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        })

        let insertedPriority: number
        mockSupabase.from.mockImplementation((table: string) => {
          const mockChain = {
            select: jest.fn().mockReturnThis(),
            insert: jest.fn((data: any) => {
              if (table === 'sync_queue') {
                insertedPriority = data.priority
              }
              return mockChain
            }),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
          }

          if (table === 'user_profiles') {
            mockChain.single.mockResolvedValue({
              data: { organization_id: 'org-123' },
            })
          } else if (table === 'integrations') {
            mockChain.single.mockResolvedValue({
              data: { id: 'test-integration', organization_id: 'org-123' },
            })
          } else if (table === 'sync_jobs') {
            mockChain.single.mockResolvedValue({
              data: { id: 'job-123', ...mockConfig },
              error: null,
            })
          } else if (table === 'sync_queue') {
            mockChain.insert.mockResolvedValue({ error: null })
          }

          return mockChain
        })

        await syncEngine.createSyncJob({
          ...mockConfig,
          priority: testCase.priority as any,
        })

        expect(insertedPriority!).toBe(testCase.expected)
      }
    })

    it('should emit job:created event', async () => {
      const createdSpy = jest.fn()
      syncEngine.on('job:created', createdSpy)

      // Setup successful mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      })

      mockSupabase.from.mockImplementation((table: string) => {
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        }

        if (table === 'user_profiles') {
          mockChain.single.mockResolvedValue({
            data: { organization_id: 'org-123' },
          })
        } else if (table === 'integrations') {
          mockChain.single.mockResolvedValue({
            data: { id: 'test-integration', organization_id: 'org-123' },
          })
        } else if (table === 'sync_jobs') {
          mockChain.single.mockResolvedValue({
            data: { id: 'job-123', ...mockConfig },
            error: null,
          })
        } else if (table === 'sync_queue') {
          mockChain.insert.mockResolvedValue({ error: null })
        }

        return mockChain
      })

      await syncEngine.createSyncJob(mockConfig)

      expect(createdSpy).toHaveBeenCalledWith({ id: 'job-123', ...mockConfig })
    })
  })

  // ... rest of the file unchanged ...
})