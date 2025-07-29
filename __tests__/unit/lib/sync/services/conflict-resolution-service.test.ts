import { ConflictResolutionService } from '@/lib/sync/services/conflict-resolution-service'
import { createBrowserClient } from '@/lib/supabase/client'
import { ConflictResolution, ConflictType, SyncConflict } from '@/lib/sync/types'

// Mock dependencies
jest.mock('@/lib/supabase/client')

describe('ConflictResolutionService', () => {
  let conflictService: ConflictResolutionService
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockLocalData = {
    id: 'product-123',
    name: 'Local Product Name',
    quantity: 100,
    price: 29.99,
    status: 'active',
    updated_at: '2024-01-15T10:00:00Z'
  }

  const mockExternalData = {
    id: 'product-123',
    name: 'External Product Name',
    quantity: 95,
    price: 32.99,
    status: 'active',
    updated_at: '2024-01-15T10:30:00Z'
  }

  const mockConflict: SyncConflict = {
    id: 'conflict-123',
    type: ConflictType.DATA_MISMATCH,
    field: 'quantity',
    local_value: 100,
    external_value: 95,
    description: 'quantity values differ between local and external systems'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = createMockSupabase()
    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabase)
    
    conflictService = new ConflictResolutionService()
    
    // Mock Date.now() for consistent conflict IDs
    jest.spyOn(Date, 'now').mockReturnValue(1705312800000) // 2024-01-15T10:00:00Z
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('detectConflicts', () => {
    it('should detect timestamp conflicts', async () => {
      const localData = { ...mockLocalData, updated_at: '2024-01-15T10:00:00Z' }
      const externalData = { ...mockExternalData, updated_at: '2024-01-15T10:30:00Z' }

      const conflicts = await conflictService.detectConflicts(localData, externalData)

      expect(conflicts).toHaveLength(4) // updated_at + quantity + price + name
      
      const timestampConflict = conflicts.find(c => c.field === 'updated_at')
      expect(timestampConflict).toEqual({
        id: 'conflict-1705312800000',
        type: ConflictType.UPDATE_CONFLICT,
        field: 'updated_at',
        local_value: '2024-01-15T10:00:00Z',
        external_value: '2024-01-15T10:30:00Z',
        description: 'Both records have been updated recently'
      })
    })

    it('should not detect timestamp conflicts for minor differences', async () => {
      const localData = { ...mockLocalData, updated_at: '2024-01-15T10:00:00.500Z' }
      const externalData = { ...mockExternalData, updated_at: '2024-01-15T10:00:00.800Z' }

      const conflicts = await conflictService.detectConflicts(localData, externalData)

      // Should only have data field conflicts, not timestamp
      const timestampConflict = conflicts.find(c => c.field === 'updated_at')
      expect(timestampConflict).toBeUndefined()
    })

    it('should detect data field conflicts', async () => {
      const conflicts = await conflictService.detectConflicts(mockLocalData, mockExternalData)

      expect(conflicts).toHaveLength(4) // updated_at + quantity + price + name

      const quantityConflict = conflicts.find(c => c.field === 'quantity')
      expect(quantityConflict).toEqual({
        id: 'conflict-1705312800000-quantity',
        type: ConflictType.DATA_MISMATCH,
        field: 'quantity',
        local_value: 100,
        external_value: 95,
        description: 'quantity values differ between local and external systems'
      })

      const priceConflict = conflicts.find(c => c.field === 'price')
      expect(priceConflict).toEqual({
        id: 'conflict-1705312800000-price',
        type: ConflictType.DATA_MISMATCH,
        field: 'price',
        local_value: 29.99,
        external_value: 32.99,
        description: 'price values differ between local and external systems'
      })

      const nameConflict = conflicts.find(c => c.field === 'name')
      expect(nameConflict).toEqual({
        id: 'conflict-1705312800000-name',
        type: ConflictType.DATA_MISMATCH,
        field: 'name',
        local_value: 'Local Product Name',
        external_value: 'External Product Name',
        description: 'name values differ between local and external systems'
      })
    })

    it('should not detect conflicts when values are identical', async () => {
      const identicalData = { ...mockLocalData }
      
      const conflicts = await conflictService.detectConflicts(identicalData, identicalData)

      expect(conflicts).toHaveLength(0)
    })

    it('should ignore fields not in comparison list', async () => {
      const localData = { ...mockLocalData, description: 'Local description' }
      const externalData = { ...mockExternalData, description: 'External description' }

      const conflicts = await conflictService.detectConflicts(localData, externalData)

      // Should not include 'description' field conflict
      const descriptionConflict = conflicts.find(c => c.field === 'description')
      expect(descriptionConflict).toBeUndefined()
    })

    it('should handle missing fields gracefully', async () => {
      const localData = { id: 'product-123', name: 'Product' }
      const externalData = { id: 'product-123', price: 29.99 }

      const conflicts = await conflictService.detectConflicts(localData, externalData)

      // Should only detect conflicts for fields that exist in both objects
      expect(conflicts).toHaveLength(0)
    })

    it('should handle missing timestamp fields', async () => {
      const localData = { ...mockLocalData }
      const externalData = { ...mockExternalData }
      delete localData.updated_at
      delete externalData.updated_at

      const conflicts = await conflictService.detectConflicts(localData, externalData)

      // Should only have data field conflicts, no timestamp conflict
      const timestampConflict = conflicts.find(c => c.field === 'updated_at')
      expect(timestampConflict).toBeUndefined()
    })
  })

  describe('resolveConflicts', () => {
    it('should resolve conflicts with LOCAL_WINS strategy', async () => {
      const conflicts = [mockConflict]
      
      const result = await conflictService.resolveConflicts(conflicts, ConflictResolution.LOCAL_WINS)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(0)
    })

    it('should resolve conflicts with EXTERNAL_WINS strategy', async () => {
      const conflicts = [mockConflict]
      
      const result = await conflictService.resolveConflicts(conflicts, ConflictResolution.EXTERNAL_WINS)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(0)
    })

    it('should resolve conflicts with MERGE strategy', async () => {
      const quantityConflict = {
        ...mockConflict,
        field: 'quantity',
        local_value: 100,
        external_value: 95
      }
      
      const result = await conflictService.resolveConflicts([quantityConflict], ConflictResolution.MERGE)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(0)
    })

    it('should handle MANUAL resolution requirement', async () => {
      const conflicts = [mockConflict]
      
      const result = await conflictService.resolveConflicts(conflicts, ConflictResolution.MANUAL)

      expect(result.success).toBe(false)
      expect(result.data.resolved).toBe(0)
      expect(result.data.failed).toBe(1)
      expect(result.data.conflicts[0].error).toBe('Manual resolution required')
    })

    it('should handle multiple conflicts with mixed results', async () => {
      const conflicts = [
        mockConflict,
        {
          ...mockConflict,
          id: 'conflict-456',
          field: 'invalid_field'
        }
      ]

      // Mock applyResolution to succeed for first, fail for second
      const originalApplyResolution = (conflictService as any).applyResolution
      jest.spyOn(conflictService as any, 'applyResolution')
        .mockImplementationOnce(() => Promise.resolve({ quantity: 100 }))
        .mockImplementationOnce(() => Promise.reject(new Error('Invalid field')))

      const result = await conflictService.resolveConflicts(conflicts, ConflictResolution.LOCAL_WINS)

      expect(result.success).toBe(false)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(1)
    })

    it('should handle empty conflicts array', async () => {
      const result = await conflictService.resolveConflicts([], ConflictResolution.LOCAL_WINS)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(0)
      expect(result.data.failed).toBe(0)
    })
  })

  describe('applyResolution', () => {
    it('should apply LOCAL_WINS resolution', async () => {
      const result = await (conflictService as any).applyResolution(mockConflict, ConflictResolution.LOCAL_WINS)

      expect(result).toEqual({ quantity: 100 })
    })

    it('should apply EXTERNAL_WINS resolution', async () => {
      const result = await (conflictService as any).applyResolution(mockConflict, ConflictResolution.EXTERNAL_WINS)

      expect(result).toEqual({ quantity: 95 })
    })

    it('should apply MERGE resolution for numeric fields', async () => {
      const quantityConflict = {
        ...mockConflict,
        field: 'quantity',
        local_value: 100,
        external_value: 95
      }

      const result = await (conflictService as any).applyResolution(quantityConflict, ConflictResolution.MERGE)

      expect(result).toEqual({ quantity: 100 }) // Math.max(100, 95)
    })

    it('should apply MERGE resolution for price fields', async () => {
      const priceConflict = {
        ...mockConflict,
        field: 'price',
        local_value: 29.99,
        external_value: 32.99
      }

      const result = await (conflictService as any).applyResolution(priceConflict, ConflictResolution.MERGE)

      expect(result).toEqual({ price: 32.99 }) // Math.max(29.99, 32.99)
    })

    it('should apply MERGE resolution for non-numeric fields', async () => {
      const nameConflict = {
        ...mockConflict,
        field: 'name',
        local_value: 'Local Name',
        external_value: 'External Name'
      }

      const result = await (conflictService as any).applyResolution(nameConflict, ConflictResolution.MERGE)

      expect(result).toEqual({ name: 'External Name' }) // Prefers external for non-numeric
    })

    it('should throw error for MANUAL resolution', async () => {
      await expect(
        (conflictService as any).applyResolution(mockConflict, ConflictResolution.MANUAL)
      ).rejects.toThrow('Manual resolution required')
    })

    it('should throw error for unknown resolution strategy', async () => {
      await expect(
        (conflictService as any).applyResolution(mockConflict, 'UNKNOWN_STRATEGY')
      ).rejects.toThrow('Unknown resolution strategy: UNKNOWN_STRATEGY')
    })
  })

  describe('mergeValues', () => {
    it('should merge numeric quantity values using max', () => {
      const quantityConflict = {
        ...mockConflict,
        field: 'quantity',
        local_value: 100,
        external_value: 95
      }

      const result = (conflictService as any).mergeValues(quantityConflict)

      expect(result).toEqual({ quantity: 100 })
    })

    it('should merge numeric price values using max', () => {
      const priceConflict = {
        ...mockConflict,
        field: 'price',
        local_value: 29.99,
        external_value: 32.99
      }

      const result = (conflictService as any).mergeValues(priceConflict)

      expect(result).toEqual({ price: 32.99 })
    })

    it('should handle string numeric values', () => {
      const quantityConflict = {
        ...mockConflict,
        field: 'quantity',
        local_value: '100',
        external_value: '95'
      }

      const result = (conflictService as any).mergeValues(quantityConflict)

      expect(result).toEqual({ quantity: 100 })
    })

    it('should merge non-numeric fields by preferring external value', () => {
      const nameConflict = {
        ...mockConflict,
        field: 'name',
        local_value: 'Local Name',
        external_value: 'External Name'
      }

      const result = (conflictService as any).mergeValues(nameConflict)

      expect(result).toEqual({ name: 'External Name' })
    })

    it('should handle edge cases with NaN values', () => {
      const quantityConflict = {
        ...mockConflict,
        field: 'quantity',
        local_value: 'not_a_number',
        external_value: 95
      }

      const result = (conflictService as any).mergeValues(quantityConflict)

      // Math.max(NaN, 95) should be 95
      expect(result).toEqual({ quantity: 95 })
    })
  })

  describe('getConflictHistory', () => {
    it('should retrieve conflict history successfully', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          sync_log_id: 'sync-123',
          conflict_type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'conflict-2',
          sync_log_id: 'sync-123',
          conflict_type: ConflictType.UPDATE_CONFLICT,
          field: 'updated_at',
          created_at: '2024-01-15T09:00:00Z'
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockConflicts,
              error: null
            })
          })
        })
      } as any)

      const conflicts = await conflictService.getConflictHistory('sync-123')

      expect(conflicts).toEqual(mockConflicts)
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_conflicts')
    })

    it('should handle empty conflict history', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any)

      const conflicts = await conflictService.getConflictHistory('sync-123')

      expect(conflicts).toEqual([])
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      } as any)

      await expect(conflictService.getConflictHistory('sync-123')).rejects.toThrow('Database connection failed')
    })

    it('should order conflicts by created_at descending', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockImplementation((field: string, options: any) => {
              expect(field).toBe('created_at')
              expect(options.ascending).toBe(false)
              return Promise.resolve({ data: [], error: null })
            })
          })
        })
      } as any)

      await conflictService.getConflictHistory('sync-123')
    })
  })

  describe('saveConflictResolution', () => {
    it('should save conflict resolution successfully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await conflictService.saveConflictResolution(
        'sync-123',
        mockConflict,
        'local_wins',
        { quantity: 100 }
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('sync_conflicts')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        sync_log_id: 'sync-123',
        conflict_type: ConflictType.DATA_MISMATCH,
        field: 'quantity',
        local_value: 100,
        external_value: 95,
        resolution_action: 'local_wins',
        resolved_value: { quantity: 100 },
        created_at: expect.any(String)
      })
    })

    it('should handle complex resolved values', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      const complexResolvedValue = {
        quantity: 100,
        metadata: { merged: true, timestamp: '2024-01-15T10:00:00Z' }
      }

      await conflictService.saveConflictResolution(
        'sync-123',
        mockConflict,
        'merge',
        complexResolvedValue
      )

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          resolved_value: complexResolvedValue,
          resolution_action: 'merge'
        })
      )
    })

    it('should use current timestamp for created_at', async () => {
      const mockDate = new Date('2024-01-15T12:00:00Z')
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-15T12:00:00Z')

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await conflictService.saveConflictResolution(
        'sync-123',
        mockConflict,
        'external_wins',
        { quantity: 95 }
      )

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: '2024-01-15T12:00:00Z'
        })
      )
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn()
        })
      }),
      insert: jest.fn()
    })
  }
}