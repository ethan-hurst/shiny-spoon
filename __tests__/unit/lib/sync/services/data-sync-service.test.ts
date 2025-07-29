import { DataSyncService } from '@/lib/sync/services/data-sync-service'
import { createBrowserClient } from '@/lib/supabase/client'
import { SyncType, SyncStatus, SyncOperation } from '@/lib/sync/types'

// Mock dependencies
jest.mock('@/lib/supabase/client')

describe('DataSyncService', () => {
  let dataSyncService: DataSyncService
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockIntegration = {
    id: 'integration-123',
    organization_id: 'org-123',
    platform: 'netsuite',
    status: 'active',
    config: {
      api_url: 'https://api.netsuite.com',
      credentials: { token: 'test-token' }
    }
  }

  const mockSyncOperation: SyncOperation = {
    id: 'sync-123',
    syncType: SyncType.INVENTORY,
    integrationId: 'integration-123',
    options: {
      batchSize: 100,
      includeDeleted: false
    }
  }

  const mockInventoryData = [
    {
      sku: 'ITEM-001',
      quantity: 100,
      warehouse_id: 'warehouse-1'
    },
    {
      sku: 'ITEM-002',
      quantity: 50,
      warehouse_id: 'warehouse-1'
    },
    {
      sku: 'ITEM-003',
      quantity: 75,
      warehouse_id: 'warehouse-2'
    }
  ]

  const mockSyncLog = {
    id: 'sync-123',
    status: SyncStatus.IN_PROGRESS,
    progress: 50,
    records_synced: 10,
    records_failed: 2
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = createMockSupabase()
    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabase)
    
    dataSyncService = new DataSyncService()
  })

  describe('syncData', () => {
    it('should route to syncInventory for INVENTORY type', async () => {
      const inventoryOperation = { ...mockSyncOperation, syncType: SyncType.INVENTORY }
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockIntegration,
              error: null
            })
          })
        })
      } as any)

      jest.spyOn(dataSyncService as any, 'fetchExternalInventory').mockResolvedValue([])
      
      const result = await dataSyncService.syncData(inventoryOperation)

      expect(result.success).toBe(true)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })

    it('should route to syncPricing for PRICING type', async () => {
      const pricingOperation = { ...mockSyncOperation, syncType: SyncType.PRICING }
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockIntegration,
              error: null
            })
          })
        })
      } as any)
      
      const result = await dataSyncService.syncData(pricingOperation)

      expect(result.success).toBe(true)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })

    it('should route to syncProducts for PRODUCTS type', async () => {
      const productsOperation = { ...mockSyncOperation, syncType: SyncType.PRODUCTS }
      
      const result = await dataSyncService.syncData(productsOperation)

      expect(result.success).toBe(true)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })

    it('should route to syncOrders for ORDERS type', async () => {
      const ordersOperation = { ...mockSyncOperation, syncType: SyncType.ORDERS }
      
      const result = await dataSyncService.syncData(ordersOperation)

      expect(result.success).toBe(true)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })

    it('should route to syncCustomers for CUSTOMERS type', async () => {
      const customersOperation = { ...mockSyncOperation, syncType: SyncType.CUSTOMERS }
      
      const result = await dataSyncService.syncData(customersOperation)

      expect(result.success).toBe(true)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })

    it('should handle unsupported sync type', async () => {
      const unsupportedOperation = { ...mockSyncOperation, syncType: 'UNSUPPORTED' as any }
      
      const result = await dataSyncService.syncData(unsupportedOperation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unsupported sync type: UNSUPPORTED')
    })

    it('should handle exceptions gracefully', async () => {
      const inventoryOperation = { ...mockSyncOperation, syncType: SyncType.INVENTORY }
      
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })
      
      const result = await dataSyncService.syncData(inventoryOperation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should handle non-Error exceptions', async () => {
      const inventoryOperation = { ...mockSyncOperation, syncType: SyncType.INVENTORY }
      
      mockSupabase.from.mockImplementation(() => {
        throw 'String error'
      })
      
      const result = await dataSyncService.syncData(inventoryOperation)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error occurred')
    })
  })

  describe('syncInventory', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockIntegration,
              error: null
            })
          })
        })
      } as any)
    })

    it('should sync inventory data successfully', async () => {
      jest.spyOn(dataSyncService as any, 'fetchExternalInventory').mockResolvedValue(mockInventoryData)
      jest.spyOn(dataSyncService as any, 'processInventoryData').mockResolvedValue({
        synced: 3,
        failed: 0
      })

      const result = await (dataSyncService as any).syncInventory('integration-123', {})

      expect(result.success).toBe(true)
      expect(result.data.records_synced).toBe(3)
      expect(result.data.records_failed).toBe(0)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })

    it('should handle sync with errors', async () => {
      jest.spyOn(dataSyncService as any, 'fetchExternalInventory').mockResolvedValue(mockInventoryData)
      jest.spyOn(dataSyncService as any, 'processInventoryData').mockResolvedValue({
        synced: 2,
        failed: 1
      })

      const result = await (dataSyncService as any).syncInventory('integration-123', {})

      expect(result.success).toBe(true)
      expect(result.data.records_synced).toBe(2)
      expect(result.data.records_failed).toBe(1)
      expect(result.data.status).toBe(SyncStatus.COMPLETED_WITH_ERRORS)
    })

    it('should throw error when integration not found', async () => {
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

      await expect(
        (dataSyncService as any).syncInventory('nonexistent-integration', {})
      ).rejects.toThrow('Integration not found')
    })

    it('should handle database errors when fetching integration', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      } as any)

      await expect(
        (dataSyncService as any).syncInventory('integration-123', {})
      ).rejects.toThrow('Integration not found')
    })
  })

  describe('syncPricing', () => {
    it('should sync pricing data successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockIntegration,
              error: null
            })
          })
        })
      } as any)

      const result = await (dataSyncService as any).syncPricing('integration-123', {})

      expect(result.success).toBe(true)
      expect(result.data.records_synced).toBe(0)
      expect(result.data.records_failed).toBe(0)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })

    it('should throw error when integration not found', async () => {
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

      await expect(
        (dataSyncService as any).syncPricing('nonexistent-integration', {})
      ).rejects.toThrow('Integration not found')
    })
  })

  describe('syncProducts', () => {
    it('should return successful result with zero records', async () => {
      const result = await (dataSyncService as any).syncProducts('integration-123', {})

      expect(result.success).toBe(true)
      expect(result.data.records_synced).toBe(0)
      expect(result.data.records_failed).toBe(0)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })
  })

  describe('syncOrders', () => {
    it('should return successful result with zero records', async () => {
      const result = await (dataSyncService as any).syncOrders('integration-123', {})

      expect(result.success).toBe(true)
      expect(result.data.records_synced).toBe(0)
      expect(result.data.records_failed).toBe(0)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })
  })

  describe('syncCustomers', () => {
    it('should return successful result with zero records', async () => {
      const result = await (dataSyncService as any).syncCustomers('integration-123', {})

      expect(result.success).toBe(true)
      expect(result.data.records_synced).toBe(0)
      expect(result.data.records_failed).toBe(0)
      expect(result.data.status).toBe(SyncStatus.COMPLETED)
    })
  })

  describe('fetchExternalInventory', () => {
    it('should return empty array for mock implementation', async () => {
      const result = await (dataSyncService as any).fetchExternalInventory(mockIntegration)

      expect(result).toEqual([])
    })
  })

  describe('processInventoryData', () => {
    it('should process inventory data successfully', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      const result = await (dataSyncService as any).processInventoryData(
        mockInventoryData,
        'org-123'
      )

      expect(result.synced).toBe(3)
      expect(result.failed).toBe(0)
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
    })

    it('should handle upsert operations with correct data structure', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      await (dataSyncService as any).processInventoryData(mockInventoryData, 'org-123')

      expect(mockUpsert).toHaveBeenCalledTimes(3)
      expect(mockUpsert).toHaveBeenCalledWith({
        organization_id: 'org-123',
        sku: 'ITEM-001',
        quantity: 100,
        warehouse_id: 'warehouse-1',
        updated_at: expect.any(String)
      })
    })

    it('should handle database errors during upsert', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockRejectedValue(new Error('Database error'))
      } as any)

      const result = await (dataSyncService as any).processInventoryData(
        mockInventoryData,
        'org-123'
      )

      expect(result.synced).toBe(0)
      expect(result.failed).toBe(3)
    })

    it('should handle mixed success and failure scenarios', async () => {
      const mockUpsert = jest.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // First item succeeds
        .mockRejectedValueOnce(new Error('Database error')) // Second item fails
        .mockResolvedValueOnce({ data: null, error: null }) // Third item succeeds

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      const result = await (dataSyncService as any).processInventoryData(
        mockInventoryData,
        'org-123'
      )

      expect(result.synced).toBe(2)
      expect(result.failed).toBe(1)
    })

    it('should handle empty inventory data', async () => {
      const result = await (dataSyncService as any).processInventoryData([], 'org-123')

      expect(result.synced).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('should use current timestamp for updated_at', async () => {
      const mockDate = '2024-01-15T10:00:00Z'
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate)

      const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      await (dataSyncService as any).processInventoryData([mockInventoryData[0]], 'org-123')

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: mockDate
        })
      )
    })
  })

  describe('getProgress', () => {
    it('should return sync progress successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSyncLog,
              error: null
            })
          })
        })
      } as any)

      const result = await dataSyncService.getProgress('sync-123')

      expect(result.success).toBe(true)
      expect(result.data.progress).toBe(50)
      expect(result.data.status).toBe(SyncStatus.IN_PROGRESS)
      expect(result.data.records_synced).toBe(10)
      expect(result.data.records_failed).toBe(2)
    })

    it('should handle missing sync log', async () => {
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

      const result = await dataSyncService.getProgress('nonexistent-sync')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Sync log not found')
    })

    it('should handle sync log with missing optional fields', async () => {
      const minimalSyncLog = {
        id: 'sync-123',
        status: SyncStatus.PENDING
        // progress, records_synced, records_failed are missing
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: minimalSyncLog,
              error: null
            })
          })
        })
      } as any)

      const result = await dataSyncService.getProgress('sync-123')

      expect(result.success).toBe(true)
      expect(result.data.progress).toBe(0)
      expect(result.data.status).toBe(SyncStatus.PENDING)
      expect(result.data.records_synced).toBe(0)
      expect(result.data.records_failed).toBe(0)
    })

    it('should query correct table and fields', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockSyncLog,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      } as any)

      await dataSyncService.getProgress('sync-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('sync_logs')
      expect(mockSelect).toHaveBeenCalledWith('*')
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      } as any)

      const result = await dataSyncService.getProgress('sync-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Sync log not found')
    })
  })

  describe('integration tests', () => {
    it('should handle complete inventory sync workflow', async () => {
      // Mock integration fetch
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'integrations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockIntegration,
                  error: null
                })
              })
            })
          } as any
        }
        if (table === 'inventory') {
          return {
            upsert: jest.fn()
              .mockResolvedValueOnce({ data: null, error: null })
              .mockResolvedValueOnce({ data: null, error: null })
              .mockRejectedValueOnce(new Error('Constraint violation'))
          } as any
        }
        return {} as any
      })

      // Mock external data fetch
      jest.spyOn(dataSyncService as any, 'fetchExternalInventory').mockResolvedValue(mockInventoryData)

      const operation: SyncOperation = {
        syncType: SyncType.INVENTORY,
        integrationId: 'integration-123',
        options: { batchSize: 100 }
      }

      const result = await dataSyncService.syncData(operation)

      expect(result.success).toBe(true)
      expect(result.data.records_synced).toBe(2)
      expect(result.data.records_failed).toBe(1)
      expect(result.data.status).toBe(SyncStatus.COMPLETED_WITH_ERRORS)
    })

    it('should handle multiple sync type operations', async () => {
      const operations = [
        { ...mockSyncOperation, syncType: SyncType.PRODUCTS },
        { ...mockSyncOperation, syncType: SyncType.ORDERS },
        { ...mockSyncOperation, syncType: SyncType.CUSTOMERS }
      ]

      const results = await Promise.all(
        operations.map(op => dataSyncService.syncData(op))
      )

      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.data.status).toBe(SyncStatus.COMPLETED)
      })
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn()
        })
      }),
      upsert: jest.fn()
    })
  }
}