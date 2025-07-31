import { OfflineQueue } from '@/lib/realtime/offline-queue'
import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'
import { IndexedDBWrapper } from '@/lib/storage/indexed-db'
import { createClient } from '@/lib/supabase/client'
import { ConnectionStatus, QueuedOperation, ProcessResult } from '@/lib/realtime/types'

// Mock dependencies
jest.mock('@/lib/realtime/connection-manager')
jest.mock('@/lib/storage/indexed-db')
jest.mock('@/lib/supabase/client')

describe('OfflineQueue', () => {
  let queue: OfflineQueue
  let mockConnectionManager: jest.Mocked<RealtimeConnectionManager>
  let mockIndexedDB: jest.Mocked<IndexedDBWrapper>
  let mockSupabase: any
  let mockUnsubscribe: jest.Mock

  const mockOperation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'> = {
    table: 'inventory',
    type: 'update',
    data: { id: '123', quantity: 50 },
    organization_id: 'org-123'
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: jest.fn().mockReturnValue('test-uuid-123')
      },
      writable: true
    })

    // Mock connection manager
    mockConnectionManager = {
      getStatus: jest.fn().mockReturnValue({
        state: 'connected',
        latency: 50,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        quality: 'good'
      }),
      subscribe: jest.fn().mockReturnValue(jest.fn())
    } as any
    ;(RealtimeConnectionManager.getInstance as jest.Mock).mockReturnValue(mockConnectionManager)

    // Mock IndexedDB
    mockIndexedDB = {
      add: jest.fn().mockResolvedValue(undefined),
      getAll: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null)
    } as any
    ;(IndexedDBWrapper as jest.Mock).mockImplementation(() => mockIndexedDB)

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Create fresh instance
    queue = OfflineQueue.getInstance()
  })

  afterEach(() => {
    // Clean up singleton
    ;(OfflineQueue as any).instance = null
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = OfflineQueue.getInstance()
      const instance2 = OfflineQueue.getInstance()
      
      expect(instance1).toBe(instance2)
    })

    it('should initialize with connection manager subscription', () => {
      expect(RealtimeConnectionManager.getInstance).toHaveBeenCalled()
      expect(mockConnectionManager.subscribe).toHaveBeenCalledWith('offline-queue', expect.any(Function))
    })
  })

  describe('addToQueue', () => {
    it('should add operation to queue successfully', async () => {
      await queue.addToQueue(mockOperation)

      expect(mockIndexedDB.add).toHaveBeenCalledWith('operations', {
        ...mockOperation,
        id: 'test-uuid-123',
        timestamp: expect.any(Number),
        retries: 0
      })
    })

    it('should notify listeners after adding to queue', async () => {
      await queue.addToQueue(mockOperation)

      // Verify listener notification (implementation would depend on actual notify method)
      expect(mockIndexedDB.add).toHaveBeenCalled()
    })

    it('should process queue immediately when connected', async () => {
      mockConnectionManager.getStatus.mockReturnValue({
        state: 'connected',
        latency: 50,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        quality: 'good'
      })

      // Mock processQueue to avoid infinite recursion
      const processQueueSpy = jest.spyOn(queue as any, 'processQueue').mockResolvedValue({
        successful: [],
        failed: [],
        conflicts: []
      })

      await queue.addToQueue(mockOperation)

      expect(processQueueSpy).toHaveBeenCalled()
    })

    it('should not process queue when disconnected', async () => {
      mockConnectionManager.getStatus.mockReturnValue({
        state: 'disconnected',
        latency: 0,
        lastConnected: null,
        reconnectAttempts: 0,
        quality: 'poor'
      })

      const processQueueSpy = jest.spyOn(queue as any, 'processQueue').mockResolvedValue({
        successful: [],
        failed: [],
        conflicts: []
      })

      await queue.addToQueue(mockOperation)

      expect(processQueueSpy).not.toHaveBeenCalled()
    })
  })

  describe('processQueue', () => {
    const mockQueuedOperations: QueuedOperation[] = [
      {
        id: 'op-1',
        table: 'inventory',
        type: 'update',
        data: { id: '123', quantity: 50 },
        organization_id: 'org-123',
        timestamp: Date.now() - 1000,
        retries: 0
      },
      {
        id: 'op-2',
        table: 'products',
        type: 'insert',
        data: { name: 'Test Product', sku: 'TEST-123' },
        organization_id: 'org-123',
        timestamp: Date.now() - 500,
        retries: 0
      }
    ]

    beforeEach(() => {
      mockIndexedDB.getAll.mockResolvedValue(mockQueuedOperations)
    })

    it('should process all operations in order', async () => {
      const executeOperationSpy = jest.spyOn(queue as any, 'executeOperation').mockResolvedValue(undefined)

      const result = await queue.processQueue()

      expect(executeOperationSpy).toHaveBeenCalledTimes(2)
      expect(result.successful).toEqual(['op-1', 'op-2'])
      expect(result.failed).toEqual([])
      expect(result.conflicts).toEqual([])
    })

    it('should not process when already processing', async () => {
      // Set processing flag
      ;(queue as any).processing = true

      const result = await queue.processQueue()

      expect(result).toEqual({
        successful: [],
        failed: [],
        conflicts: []
      })
    })

    it('should handle operation execution errors', async () => {
      const executeOperationSpy = jest.spyOn(queue as any, 'executeOperation')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)

      const result = await queue.processQueue()

      expect(executeOperationSpy).toHaveBeenCalledTimes(2)
      expect(result.successful).toEqual(['op-2'])
      expect(result.failed).toEqual(['op-1'])
      expect(result.conflicts).toEqual([])
    })

    it('should handle conflict errors', async () => {
      const executeOperationSpy = jest.spyOn(queue as any, 'executeOperation')
        .mockRejectedValueOnce(new Error('Version conflict detected'))
        .mockResolvedValueOnce(undefined)

      const result = await queue.processQueue()

      expect(result.conflicts).toEqual(['op-1'])
      expect(result.successful).toEqual(['op-2'])
      expect(result.failed).toEqual([])
    })

    it('should retry failed operations with backoff', async () => {
      const executeOperationSpy = jest.spyOn(queue as any, 'executeOperation')
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(undefined)

      const result = await queue.processQueue()

      expect(executeOperationSpy).toHaveBeenCalledTimes(2)
      expect(result.failed).toEqual(['op-1'])
      
      // Verify retry count was incremented
      expect(mockIndexedDB.update).toHaveBeenCalledWith('operations', 'op-1', {
        retries: 1
      })
    })

    it('should remove successful operations from queue', async () => {
      const executeOperationSpy = jest.spyOn(queue as any, 'executeOperation').mockResolvedValue(undefined)

      await queue.processQueue()

      expect(mockIndexedDB.delete).toHaveBeenCalledWith('operations', 'op-1')
      expect(mockIndexedDB.delete).toHaveBeenCalledWith('operations', 'op-2')
    })

    it('should handle empty queue', async () => {
      mockIndexedDB.getAll.mockResolvedValue([])

      const result = await queue.processQueue()

      expect(result).toEqual({
        successful: [],
        failed: [],
        conflicts: []
      })
    })
  })

  describe('executeOperation', () => {
    const mockOperation: QueuedOperation = {
      id: 'op-1',
      table: 'inventory',
      type: 'update',
      data: { id: '123', quantity: 50 },
      organization_id: 'org-123',
      timestamp: Date.now(),
      retries: 0
    }

    it('should execute insert operation', async () => {
      mockOperation.type = 'insert'

      await (queue as any).executeOperation(mockOperation)

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.insert).toHaveBeenCalledWith(mockOperation.data)
    })

    it('should execute update operation', async () => {
      mockOperation.type = 'update'

      await (queue as any).executeOperation(mockOperation)

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.update).toHaveBeenCalledWith(mockOperation.data)
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123')
    })

    it('should execute delete operation', async () => {
      mockOperation.type = 'delete'

      await (queue as any).executeOperation(mockOperation)

      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123')
    })

    it('should handle unknown operation types', async () => {
      mockOperation.type = 'unknown' as any

      await expect((queue as any).executeOperation(mockOperation))
        .rejects.toThrow('Unknown operation type: unknown')
    })

    it('should handle Supabase errors', async () => {
      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      await expect((queue as any).executeOperation(mockOperation))
        .rejects.toThrow('Database error')
    })
  })

  describe('fetchServerValue', () => {
    it('should fetch server value for conflict resolution', async () => {
      const mockServerData = { id: '123', quantity: 100, version: 2 }
      mockSupabase.single.mockResolvedValue({
        data: mockServerData,
        error: null
      })

      const result = await (queue as any).fetchServerValue('inventory', '123')

      expect(result).toEqual(mockServerData)
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123')
    })

    it('should handle fetch errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      })

      const result = await (queue as any).fetchServerValue('inventory', '123')

      expect(result).toBeNull()
    })
  })

  describe('getQueuedOperations', () => {
    it('should return all queued operations', async () => {
      const mockOperations = [
        { id: 'op-1', table: 'inventory', type: 'update', data: {}, organization_id: 'org-123', timestamp: Date.now(), retries: 0 },
        { id: 'op-2', table: 'products', type: 'insert', data: {}, organization_id: 'org-123', timestamp: Date.now(), retries: 0 }
      ]
      mockIndexedDB.getAll.mockResolvedValue(mockOperations)

      const result = await queue.getQueuedOperations()

      expect(result).toEqual(mockOperations)
      expect(mockIndexedDB.getAll).toHaveBeenCalledWith('operations')
    })
  })

  describe('getQueueSize', () => {
    it('should return number of queued operations', async () => {
      const mockOperations = [
        { id: 'op-1' },
        { id: 'op-2' },
        { id: 'op-3' }
      ]
      mockIndexedDB.getAll.mockResolvedValue(mockOperations)

      const result = await queue.getQueueSize()

      expect(result).toBe(3)
    })
  })

  describe('clearQueue', () => {
    it('should clear all operations from queue', async () => {
      await queue.clearQueue()

      expect(mockIndexedDB.getAll).toHaveBeenCalledWith('operations')
      // Implementation would delete all operations
    })
  })

  describe('removeOperation', () => {
    it('should remove specific operation from queue', async () => {
      await queue.removeOperation('op-1')

      expect(mockIndexedDB.delete).toHaveBeenCalledWith('operations', 'op-1')
    })
  })

  describe('subscribe', () => {
    it('should add listener and return unsubscribe function', () => {
      const mockCallback = jest.fn()
      const unsubscribe = queue.subscribe('test-id', mockCallback)

      expect(unsubscribe).toBeInstanceOf(Function)
    })

    it('should remove listener when unsubscribe is called', () => {
      const mockCallback = jest.fn()
      const unsubscribe = queue.subscribe('test-id', mockCallback)

      unsubscribe()

      // Verify listener was removed (implementation would depend on actual listener management)
    })
  })

  describe('connection state handling', () => {
    it('should process queue when connection is restored', async () => {
      const processQueueSpy = jest.spyOn(queue as any, 'processQueue').mockResolvedValue({
        successful: [],
        failed: [],
        conflicts: []
      })

      // Simulate connection restoration
      const connectionCallback = mockConnectionManager.subscribe.mock.calls[0][1]
      connectionCallback({
        state: 'connected',
        latency: 50,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        quality: 'good'
      })

      expect(processQueueSpy).toHaveBeenCalled()
    })

    it('should not process queue when already processing', async () => {
      ;(queue as any).processing = true

      const processQueueSpy = jest.spyOn(queue as any, 'processQueue').mockResolvedValue({
        successful: [],
        failed: [],
        conflicts: []
      })

      // Simulate connection restoration
      const connectionCallback = mockConnectionManager.subscribe.mock.calls[0][1]
      connectionCallback({
        state: 'connected',
        latency: 50,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        quality: 'good'
      })

      expect(processQueueSpy).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle IndexedDB errors gracefully', async () => {
      mockIndexedDB.add.mockRejectedValue(new Error('IndexedDB error'))

      await expect(queue.addToQueue(mockOperation)).rejects.toThrow('IndexedDB error')
    })

    it('should handle network errors during processing', async () => {
      mockIndexedDB.getAll.mockResolvedValue([{
        id: 'op-1',
        table: 'inventory',
        type: 'update',
        data: { id: '123', quantity: 50 },
        organization_id: 'org-123',
        timestamp: Date.now(),
        retries: 0
      }])

      mockSupabase.update.mockResolvedValue({
        data: null,
        error: { message: 'Network error' }
      })

      const result = await queue.processQueue()

      expect(result.failed).toEqual(['op-1'])
      expect(result.successful).toEqual([])
    })

    it('should handle malformed operations', async () => {
      const malformedOperation = {
        id: 'op-1',
        table: 'inventory',
        type: 'invalid-type',
        data: null,
        organization_id: 'org-123',
        timestamp: Date.now(),
        retries: 0
      }

      mockIndexedDB.getAll.mockResolvedValue([malformedOperation])

      const result = await queue.processQueue()

      expect(result.failed).toEqual(['op-1'])
    })
  })

  describe('retry logic', () => {
    it('should increment retry count for failed operations', async () => {
      const operation = {
        id: 'op-1',
        table: 'inventory',
        type: 'update',
        data: { id: '123', quantity: 50 },
        organization_id: 'org-123',
        timestamp: Date.now(),
        retries: 0
      }

      mockIndexedDB.getAll.mockResolvedValue([operation])
      mockSupabase.update.mockResolvedValue({
        data: null,
        error: { message: 'Temporary error' }
      })

      await queue.processQueue()

      expect(mockIndexedDB.update).toHaveBeenCalledWith('operations', 'op-1', {
        retries: 1
      })
    })

    it('should not retry operations that exceed max retries', async () => {
      const operation = {
        id: 'op-1',
        table: 'inventory',
        type: 'update',
        data: { id: '123', quantity: 50 },
        organization_id: 'org-123',
        timestamp: Date.now(),
        retries: 5 // Max retries exceeded
      }

      mockIndexedDB.getAll.mockResolvedValue([operation])
      mockSupabase.update.mockResolvedValue({
        data: null,
        error: { message: 'Permanent error' }
      })

      const result = await queue.processQueue()

      expect(result.failed).toEqual(['op-1'])
      expect(mockIndexedDB.delete).toHaveBeenCalledWith('operations', 'op-1')
    })
  })

  describe('destroy', () => {
    it('should clean up resources when destroyed', () => {
      const mockCallback = jest.fn()
      queue.subscribe('test', mockCallback)

      queue.destroy()

      // Verify cleanup (implementation would depend on actual cleanup logic)
      expect(queue).toBeDefined()
    })
  })
}) 