import { DataSyncService } from '@/lib/sync/services/data-sync-service'
import { SyncType, SyncStatus, SyncOperation } from '@/lib/sync/types'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis(),
}

jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: jest.fn(() => mockSupabase),
}))

describe('DataSyncService', () => {
  let dataSyncService: DataSyncService

  beforeEach(() => {
    dataSyncService = new DataSyncService()
    jest.clearAllMocks()
  })

  // Mock the private fetchExternalInventory method
  const mockFetchExternalInventory = jest.fn()
  beforeEach(() => {
    // @ts-ignore - accessing private method for testing
    dataSyncService['fetchExternalInventory'] = mockFetchExternalInventory
  })

  describe('syncData', () => {
    it('should sync inventory data successfully', async () => {
      // Mock integration data
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'integration-123',
          organization_id: 'org-123',
          platform: 'shopify',
          credentials: {},
          sync_settings: {}
        },
        error: null
      })

      // Mock external inventory data
      const mockExternalData = [
        {
          sku: 'SKU-001',
          quantity: 100,
          warehouse_id: 'wh-001',
          updated_at: new Date().toISOString()
        },
        {
          sku: 'SKU-002',
          quantity: 50,
          warehouse_id: 'wh-001',
          updated_at: new Date().toISOString()
        }
      ]

      // Mock the fetchExternalInventory method
      mockFetchExternalInventory.mockResolvedValue(mockExternalData)

      // Mock upsert responses
      mockSupabase.upsert.mockResolvedValue({
        data: null,
        error: null
      })

      const operation: SyncOperation = {
        syncType: SyncType.INVENTORY,
        integrationId: 'integration-123',
        options: {
          batch_size: 100,
          conflict_resolution: 'external_wins'
        }
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(2)
      expect(result.data?.records_failed).toBe(0)
      expect(result.data?.status).toBe(SyncStatus.COMPLETED)
    })

    it('should handle integration not found error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      })

      const operation: SyncOperation = {
        syncType: SyncType.INVENTORY,
        integrationId: 'invalid-integration',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Integration not found')
    })

    it('should handle sync errors gracefully', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'))

      const operation: SyncOperation = {
        syncType: SyncType.INVENTORY,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should sync pricing data successfully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'integration-123',
          organization_id: 'org-123',
          platform: 'shopify',
          credentials: {},
          sync_settings: {}
        },
        error: null
      })

      const operation: SyncOperation = {
        syncType: SyncType.PRICING,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(0)
      expect(result.data?.status).toBe(SyncStatus.COMPLETED)
    })

    it('should sync products data successfully', async () => {
      const operation: SyncOperation = {
        syncType: SyncType.PRODUCTS,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(0)
      expect(result.data?.status).toBe(SyncStatus.COMPLETED)
    })

    it('should sync orders data successfully', async () => {
      const operation: SyncOperation = {
        syncType: SyncType.ORDERS,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(0)
      expect(result.data?.status).toBe(SyncStatus.COMPLETED)
    })

    it('should sync customers data successfully', async () => {
      const operation: SyncOperation = {
        syncType: SyncType.CUSTOMERS,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(0)
      expect(result.data?.status).toBe(SyncStatus.COMPLETED)
    })

    it('should throw error for unsupported sync type', async () => {
      const operation: SyncOperation = {
        syncType: 'UNSUPPORTED' as SyncType,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unsupported sync type: UNSUPPORTED')
    })
  })

  describe('getProgress', () => {
    it('should return sync progress successfully', async () => {
      const mockSyncLog = {
        id: 'sync-123',
        progress: 75,
        status: SyncStatus.IN_PROGRESS,
        records_synced: 150,
        records_failed: 2
      }

      mockSupabase.single.mockResolvedValue({
        data: mockSyncLog,
        error: null
      })

      const result = await dataSyncService.getProgress('sync-123')

      expect(result.success).toBe(true)
      expect(result.data?.progress).toBe(75)
      expect(result.data?.status).toBe(SyncStatus.IN_PROGRESS)
      expect(result.data?.records_synced).toBe(150)
      expect(result.data?.records_failed).toBe(2)
    })

    it('should handle sync log not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await dataSyncService.getProgress('invalid-sync-id')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Sync log not found')
    })

    it('should handle database errors', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database error'))

      // The method doesn't have error handling, so we expect it to throw
      await expect(dataSyncService.getProgress('sync-123')).rejects.toThrow('Database error')
    })
  })

  describe('inventory sync with partial failures', () => {
    it('should handle partial sync failures', async () => {
      // Mock integration data
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'integration-123',
          organization_id: 'org-123',
          platform: 'shopify',
          credentials: {},
          sync_settings: {}
        },
        error: null
      })

      // Mock external inventory data
      const mockExternalData = [
        {
          sku: 'SKU-001',
          quantity: 100,
          warehouse_id: 'wh-001',
          updated_at: new Date().toISOString()
        },
        {
          sku: 'SKU-002',
          quantity: 50,
          warehouse_id: 'wh-001',
          updated_at: new Date().toISOString()
        },
        {
          sku: 'SKU-003',
          quantity: 75,
          warehouse_id: 'wh-001',
          updated_at: new Date().toISOString()
        }
      ]

      // Mock the fetchExternalInventory method
      mockFetchExternalInventory.mockResolvedValue(mockExternalData)

      // Mock upsert to fail for some items
      mockSupabase.upsert
        .mockResolvedValueOnce({ data: null, error: null }) // Success
        .mockRejectedValueOnce(new Error('Database error')) // Failure
        .mockResolvedValueOnce({ data: null, error: null }) // Success

      const operation: SyncOperation = {
        syncType: SyncType.INVENTORY,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(2)
      expect(result.data?.records_failed).toBe(1)
      expect(result.data?.status).toBe(SyncStatus.COMPLETED_WITH_ERRORS)
    })
  })

  describe('error handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockSupabase.single.mockRejectedValue('String error')

      const operation: SyncOperation = {
        syncType: SyncType.INVENTORY,
        integrationId: 'integration-123',
        options: {}
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error occurred')
    })
  })
})