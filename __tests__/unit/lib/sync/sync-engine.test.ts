import { SyncEngine } from '@/lib/sync/sync-engine'
import { SyncJob, SyncResult, SyncStatus } from '@/types/sync.types'
import { createServerClient } from '@/lib/supabase/server'
import { InventorySyncService } from '@/lib/sync/services/inventory-sync-service'
import { PricingSyncService } from '@/lib/sync/services/pricing-sync-service'
import { OrderSyncService } from '@/lib/sync/services/order-sync-service'
import { CustomerSyncService } from '@/lib/sync/services/customer-sync-service'
import { ProductSyncService } from '@/lib/sync/services/product-sync-service'

jest.mock('@/lib/supabase/server')
jest.mock('@/lib/sync/services/inventory-sync-service')
jest.mock('@/lib/sync/services/pricing-sync-service')
jest.mock('@/lib/sync/services/order-sync-service')
jest.mock('@/lib/sync/services/customer-sync-service')
jest.mock('@/lib/sync/services/product-sync-service')

describe('SyncEngine', () => {
  let syncEngine: SyncEngine
  let mockSupabase: any
  let mockInventoryService: jest.Mocked<InventorySyncService>
  let mockPricingService: jest.Mocked<PricingSyncService>
  let mockOrderService: jest.Mocked<OrderSyncService>
  let mockCustomerService: jest.Mocked<CustomerSyncService>
  let mockProductService: jest.Mocked<ProductSyncService>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    }

    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock services
    mockInventoryService = new InventorySyncService() as jest.Mocked<InventorySyncService>
    mockPricingService = new PricingSyncService() as jest.Mocked<PricingSyncService>
    mockOrderService = new OrderSyncService() as jest.Mocked<OrderSyncService>
    mockCustomerService = new CustomerSyncService() as jest.Mocked<CustomerSyncService>
    mockProductService = new ProductSyncService() as jest.Mocked<ProductSyncService>

    syncEngine = new SyncEngine()
    ;(syncEngine as any).services = {
      inventory: mockInventoryService,
      pricing: mockPricingService,
      orders: mockOrderService,
      customers: mockCustomerService,
      products: mockProductService,
    }
  })

  describe('executeSync', () => {
    it('should execute a successful inventory sync', async () => {
      const syncJob: SyncJob = {
        id: 'sync-123',
        organization_id: 'org-123',
        sync_type: 'inventory',
        source_system: 'netsuite',
        target_system: 'shopify',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const syncResult: SyncResult = {
        success: true,
        records_processed: 100,
        records_created: 20,
        records_updated: 80,
        records_failed: 0,
        errors: [],
      }

      mockInventoryService.sync = jest.fn().mockResolvedValue(syncResult)

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...syncJob, id: 'sync-123' },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      const result = await syncEngine.executeSync(syncJob)

      expect(result).toEqual(syncResult)
      expect(mockInventoryService.sync).toHaveBeenCalledWith(
        syncJob,
        expect.any(Function)
      )
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
    })

    it('should handle sync failures gracefully', async () => {
      const syncJob: SyncJob = {
        id: 'sync-123',
        organization_id: 'org-123',
        sync_type: 'pricing',
        source_system: 'netsuite',
        target_system: 'shopify',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const syncError = new Error('API connection failed')
      mockPricingService.sync = jest.fn().mockRejectedValue(syncError)

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...syncJob, id: 'sync-123' },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      const result = await syncEngine.executeSync(syncJob)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('API connection failed')
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
    })

    it('should update sync progress during execution', async () => {
      const syncJob: SyncJob = {
        id: 'sync-123',
        organization_id: 'org-123',
        sync_type: 'products',
        source_system: 'netsuite',
        target_system: 'shopify',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      let progressCallback: ((progress: number) => void) | undefined

      mockProductService.sync = jest.fn().mockImplementation(async (job, onProgress) => {
        progressCallback = onProgress
        // Simulate progress updates
        onProgress(25)
        onProgress(50)
        onProgress(75)
        onProgress(100)
        return {
          success: true,
          records_processed: 50,
          records_created: 10,
          records_updated: 40,
          records_failed: 0,
          errors: [],
        }
      })

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...syncJob, id: 'sync-123' },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      await syncEngine.executeSync(syncJob)

      // Verify progress updates were made
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: expect.any(Number),
        })
      )
    })

    it('should validate sync job before execution', async () => {
      const invalidSyncJob: SyncJob = {
        id: '',
        organization_id: '',
        sync_type: 'invalid' as any,
        source_system: 'unknown' as any,
        target_system: 'unknown' as any,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await expect(syncEngine.executeSync(invalidSyncJob)).rejects.toThrow(
        'Invalid sync type: invalid'
      )
    })
  })

  describe('scheduleBatchSync', () => {
    it('should create multiple sync jobs for batch sync', async () => {
      const batchRequest = {
        organization_id: 'org-123',
        sync_types: ['inventory', 'pricing', 'products'] as const,
        source_system: 'netsuite' as const,
        target_system: 'shopify' as const,
      }

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: [
            { id: 'sync-1', sync_type: 'inventory' },
            { id: 'sync-2', sync_type: 'pricing' },
            { id: 'sync-3', sync_type: 'products' },
          ],
          error: null,
        }),
      })

      const jobs = await syncEngine.scheduleBatchSync(batchRequest)

      expect(jobs).toHaveLength(3)
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ sync_type: 'inventory' }),
          expect.objectContaining({ sync_type: 'pricing' }),
          expect.objectContaining({ sync_type: 'products' }),
        ])
      )
    })

    it('should handle batch sync creation errors', async () => {
      const batchRequest = {
        organization_id: 'org-123',
        sync_types: ['inventory'] as const,
        source_system: 'netsuite' as const,
        target_system: 'shopify' as const,
      }

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      })

      await expect(syncEngine.scheduleBatchSync(batchRequest)).rejects.toThrow(
        'Failed to create sync jobs: Database error'
      )
    })
  })

  describe('getSyncStatus', () => {
    it('should retrieve sync job status', async () => {
      const syncJobId = 'sync-123'
      const mockSyncJob = {
        id: syncJobId,
        organization_id: 'org-123',
        sync_type: 'inventory',
        status: 'in_progress',
        progress: 75,
        started_at: new Date().toISOString(),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSyncJob,
              error: null,
            }),
          }),
        }),
      })

      const status = await syncEngine.getSyncStatus(syncJobId)

      expect(status).toEqual(mockSyncJob)
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs')
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', syncJobId)
    })

    it('should handle non-existent sync jobs', async () => {
      const syncJobId = 'non-existent'

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      })

      await expect(syncEngine.getSyncStatus(syncJobId)).rejects.toThrow(
        'Sync job not found'
      )
    })
  })

  describe('cancelSync', () => {
    it('should cancel an in-progress sync job', async () => {
      const syncJobId = 'sync-123'

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: syncJobId, status: 'cancelled' },
            error: null,
          }),
        }),
      })

      const result = await syncEngine.cancelSync(syncJobId)

      expect(result).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'cancelled',
        completed_at: expect.any(String),
      })
    })

    it('should handle cancel errors', async () => {
      const syncJobId = 'sync-123'

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed' },
          }),
        }),
      })

      await expect(syncEngine.cancelSync(syncJobId)).rejects.toThrow(
        'Failed to cancel sync job: Update failed'
      )
    })
  })

  describe('retryFailedSync', () => {
    it('should retry a failed sync job', async () => {
      const originalJob = {
        id: 'sync-123',
        organization_id: 'org-123',
        sync_type: 'inventory',
        source_system: 'netsuite',
        target_system: 'shopify',
        status: 'failed',
        filters: { warehouse_id: 'wh-123' },
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: originalJob,
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...originalJob, id: 'sync-456', status: 'pending' },
              error: null,
            }),
          }),
        }),
      })

      const newJob = await syncEngine.retryFailedSync('sync-123')

      expect(newJob.id).toBe('sync-456')
      expect(newJob.status).toBe('pending')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: originalJob.organization_id,
          sync_type: originalJob.sync_type,
          source_system: originalJob.source_system,
          target_system: originalJob.target_system,
          filters: originalJob.filters,
          retry_of: originalJob.id,
        })
      )
    })

    it('should not retry non-failed jobs', async () => {
      const activeJob = {
        id: 'sync-123',
        status: 'in_progress',
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: activeJob,
              error: null,
            }),
          }),
        }),
      })

      await expect(syncEngine.retryFailedSync('sync-123')).rejects.toThrow(
        'Can only retry failed sync jobs'
      )
    })
  })

  describe('getConflicts', () => {
    it('should retrieve sync conflicts', async () => {
      const organizationId = 'org-123'
      const mockConflicts = [
        {
          id: 'conflict-1',
          sync_job_id: 'sync-123',
          record_type: 'inventory',
          record_id: 'prod-1',
          source_value: { quantity: 100 },
          target_value: { quantity: 95 },
          conflict_type: 'value_mismatch',
          resolved: false,
        },
        {
          id: 'conflict-2',
          sync_job_id: 'sync-124',
          record_type: 'pricing',
          record_id: 'prod-2',
          source_value: { price: 50 },
          target_value: { price: 55 },
          conflict_type: 'value_mismatch',
          resolved: false,
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockConflicts,
              error: null,
            }),
          }),
        }),
      })

      const conflicts = await syncEngine.getConflicts(organizationId)

      expect(conflicts).toEqual(mockConflicts)
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_conflicts')
      expect(mockSupabase.eq).toHaveBeenCalledWith('resolved', false)
    })
  })

  describe('resolveConflict', () => {
    it('should resolve a conflict by choosing source value', async () => {
      const conflictId = 'conflict-1'
      const resolution = 'use_source' as const

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: conflictId, resolved: true, resolution },
            error: null,
          }),
        }),
      })

      const result = await syncEngine.resolveConflict(conflictId, resolution)

      expect(result).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        resolved: true,
        resolution,
        resolved_at: expect.any(String),
        resolved_by: expect.any(String),
      })
    })

    it('should apply conflict resolution to target system', async () => {
      const conflictId = 'conflict-1'
      const resolution = 'use_source' as const
      const mockConflict = {
        id: conflictId,
        record_type: 'inventory',
        record_id: 'prod-1',
        source_value: { quantity: 100 },
        target_value: { quantity: 95 },
        target_system: 'shopify',
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockConflict,
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      })

      await syncEngine.resolveConflict(conflictId, resolution, true)

      expect(mockInventoryService.updateTargetRecord).toHaveBeenCalledWith(
        mockConflict.target_system,
        mockConflict.record_id,
        mockConflict.source_value
      )
    })
  })
})