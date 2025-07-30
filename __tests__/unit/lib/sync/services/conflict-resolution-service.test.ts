import { describe, expect, it, jest } from '@jest/globals'
import { ConflictResolutionService } from '@/lib/sync/services/conflict-resolution-service'
import { ConflictResolution, ConflictType } from '@/lib/sync/types'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService

  beforeEach(() => {
    service = new ConflictResolutionService()
  })

  describe('detectConflicts', () => {
    it('should detect timestamp conflicts', async () => {
      const localData = {
        id: 'item-1',
        quantity: 100,
        updated_at: '2024-01-01T10:00:00Z',
      }

      const externalData = {
        id: 'item-1',
        quantity: 100,
        updated_at: '2024-01-01T10:05:00Z', // 5 minutes later
      }

      const conflicts = await service.detectConflicts(localData, externalData)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe(ConflictType.UPDATE_CONFLICT)
      expect(conflicts[0].field).toBe('updated_at')
      expect(conflicts[0].local_value).toBe('2024-01-01T10:00:00Z')
      expect(conflicts[0].external_value).toBe('2024-01-01T10:05:00Z')
    })

    it('should detect data mismatch conflicts', async () => {
      const localData = {
        id: 'item-1',
        quantity: 100,
        price: 25.99,
        name: 'Widget A',
        status: 'active',
      }

      const externalData = {
        id: 'item-1',
        quantity: 95, // Different quantity
        price: 25.99,
        name: 'Widget A',
        status: 'active',
      }

      const conflicts = await service.detectConflicts(localData, externalData)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].type).toBe(ConflictType.DATA_MISMATCH)
      expect(conflicts[0].field).toBe('quantity')
      expect(conflicts[0].local_value).toBe(100)
      expect(conflicts[0].external_value).toBe(95)
    })

    it('should detect multiple conflicts', async () => {
      const localData = {
        id: 'item-1',
        quantity: 100,
        price: 25.99,
        name: 'Widget A',
        status: 'active',
        updated_at: '2024-01-01T10:00:00Z',
      }

      const externalData = {
        id: 'item-1',
        quantity: 95,
        price: 29.99, // Different price
        name: 'Widget B', // Different name
        status: 'inactive', // Different status
        updated_at: '2024-01-01T10:05:00Z', // Different timestamp
      }

      const conflicts = await service.detectConflicts(localData, externalData)

      expect(conflicts).toHaveLength(5) // timestamp + 4 field mismatches
      expect(conflicts.some(c => c.field === 'updated_at')).toBe(true)
      expect(conflicts.some(c => c.field === 'quantity')).toBe(true)
      expect(conflicts.some(c => c.field === 'price')).toBe(true)
      expect(conflicts.some(c => c.field === 'name')).toBe(true)
      expect(conflicts.some(c => c.field === 'status')).toBe(true)
    })

    it('should not detect conflicts for small timestamp differences', async () => {
      const localData = {
        id: 'item-1',
        quantity: 100,
        updated_at: '2024-01-01T10:00:00Z',
      }

      const externalData = {
        id: 'item-1',
        quantity: 100,
        updated_at: '2024-01-01T10:00:00.500Z', // 500ms difference
      }

      const conflicts = await service.detectConflicts(localData, externalData)

      expect(conflicts).toHaveLength(0)
    })

    it('should handle missing timestamp fields', async () => {
      const localData = {
        id: 'item-1',
        quantity: 100,
      }

      const externalData = {
        id: 'item-1',
        quantity: 95,
      }

      const conflicts = await service.detectConflicts(localData, externalData)

      expect(conflicts).toHaveLength(1) // Only quantity mismatch
      expect(conflicts[0].type).toBe(ConflictType.DATA_MISMATCH)
    })

    it('should handle missing field values', async () => {
      const localData = {
        id: 'item-1',
        quantity: 100,
        price: 25.99,
      }

      const externalData = {
        id: 'item-1',
        quantity: 100,
        // price field missing
      }

      const conflicts = await service.detectConflicts(localData, externalData)

      expect(conflicts).toHaveLength(0) // No conflicts when field is missing in one system
    })
  })

  describe('resolveConflicts', () => {
    it('should resolve conflicts with LOCAL_WINS strategy', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          local_value: 100,
          external_value: 95,
          description: 'Quantity values differ',
        },
      ]

      const result = await service.resolveConflicts(conflicts, ConflictResolution.LOCAL_WINS)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(0)
    })

    it('should resolve conflicts with EXTERNAL_WINS strategy', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          local_value: 100,
          external_value: 95,
          description: 'Quantity values differ',
        },
      ]

      const result = await service.resolveConflicts(conflicts, ConflictResolution.EXTERNAL_WINS)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(0)
    })

    it('should handle MERGE strategy', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          local_value: 100,
          external_value: 95,
          description: 'Quantity values differ',
        },
      ]

      const result = await service.resolveConflicts(conflicts, ConflictResolution.MERGE)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(0)
    })

    it('should handle MANUAL resolution strategy', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          local_value: 100,
          external_value: 95,
          description: 'Quantity values differ',
        },
      ]

      const result = await service.resolveConflicts(conflicts, ConflictResolution.MANUAL)

      expect(result.success).toBe(false)
      expect(result.data.resolved).toBe(0)
      expect(result.data.failed).toBe(1)
      expect(result.data.conflicts[0].error).toBe('Manual resolution required')
    })

    it('should handle multiple conflicts', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          local_value: 100,
          external_value: 95,
          description: 'Quantity values differ',
        },
        {
          id: 'conflict-2',
          type: ConflictType.DATA_MISMATCH,
          field: 'price',
          local_value: 25.99,
          external_value: 29.99,
          description: 'Price values differ',
        },
      ]

      const result = await service.resolveConflicts(conflicts, ConflictResolution.LOCAL_WINS)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(2)
      expect(result.data.failed).toBe(0)
    })

    it('should handle mixed success and failure', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          local_value: 100,
          external_value: 95,
          description: 'Quantity values differ',
        },
        {
          id: 'conflict-2',
          type: ConflictType.DATA_MISMATCH,
          field: 'price',
          local_value: 25.99,
          external_value: 29.99,
          description: 'Price values differ',
        },
      ]

      // Mock the applyResolution method to fail on the second conflict
      jest.spyOn(service as any, 'applyResolution').mockImplementation((conflict, resolution) => {
        if (conflict.field === 'price') {
          throw new Error('Price resolution failed')
        }
        return { [conflict.field]: conflict.local_value }
      })

      const result = await service.resolveConflicts(conflicts, ConflictResolution.LOCAL_WINS)

      expect(result.success).toBe(false)
      expect(result.data.resolved).toBe(1)
      expect(result.data.failed).toBe(1)
      expect(result.data.conflicts[0].error).toBe('Price resolution failed')
    })

    it('should handle empty conflicts array', async () => {
      const conflicts: any[] = []

      const result = await service.resolveConflicts(conflicts, ConflictResolution.LOCAL_WINS)

      expect(result.success).toBe(true)
      expect(result.data.resolved).toBe(0)
      expect(result.data.failed).toBe(0)
    })
  })

  describe('getConflictHistory', () => {
    it('should fetch conflict history', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          type: ConflictType.DATA_MISMATCH,
          field: 'quantity',
          local_value: 100,
          external_value: 95,
          description: 'Quantity values differ',
          resolved_at: '2024-01-01T10:00:00Z',
        },
      ]

      // Mock the service's supabase property directly
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockConflicts,
          error: null,
        }),
      }

      const mockSupabase = {
        from: jest.fn().mockReturnValue(mockQueryBuilder),
      }

      // Inject the mock directly into the service
      ;(service as any).supabase = mockSupabase

      const conflicts = await service.getConflictHistory('sync-123')

      expect(conflicts).toEqual(mockConflicts)
    })
  })

  describe('saveConflictResolution', () => {
    it('should save conflict resolution', async () => {
      const conflict = {
        id: 'conflict-1',
        type: ConflictType.DATA_MISMATCH,
        field: 'quantity',
        local_value: 100,
        external_value: 95,
        description: 'Quantity values differ',
      }

      const resolution = 'LOCAL_WINS'
      const resolvedValue = 100

      // Mock the Supabase insert
      const mockSupabase = require('@/lib/supabase/client').createBrowserClient()
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })

      await expect(
        service.saveConflictResolution('sync-123', conflict, resolution, resolvedValue)
      ).resolves.not.toThrow()
    })
  })
})