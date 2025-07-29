import { OfflineQueue } from '@/lib/realtime/offline-queue'
import { IndexedDBWrapper } from '@/lib/storage/indexed-db'
import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'
import { createClient } from '@/lib/supabase/client'
import type { QueuedOperation, ProcessResult } from '@/lib/realtime/types'

jest.mock('@/lib/storage/indexed-db')
jest.mock('@/lib/realtime/connection-manager')
jest.mock('@/lib/supabase/client')

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substring(7))
} as any

describe('OfflineQueue', () => {
  let queue: OfflineQueue
  let mockDb: jest.Mocked<IndexedDBWrapper>
  let mockConnectionManager: jest.Mocked<RealtimeConnectionManager>
  let mockSupabase: any
  let connectionCallback: (status: any) => void

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset singleton
    ;(OfflineQueue as any).instance = null
    
    // Mock IndexedDBWrapper
    mockDb = {
      add: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      close: jest.fn()
    } as any
    
    ;(IndexedDBWrapper as jest.MockedClass<typeof IndexedDBWrapper>).mockImplementation(() => mockDb)
    
    // Mock RealtimeConnectionManager
    mockConnectionManager = {
      getInstance: jest.fn(),
      subscribe: jest.fn((id, callback) => {
        connectionCallback = callback
        return jest.fn() // unsubscribe function
      }),
      getStatus: jest.fn().mockReturnValue({ state: 'connected' })
    } as any
    
    ;(RealtimeConnectionManager.getInstance as jest.Mock).mockReturnValue(mockConnectionManager)
    
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null })
        })),
        insert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: { id: 'test-id', name: 'Server Value' }, 
              error: null 
            })
          }))
        }))
      }))
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    
    queue = OfflineQueue.getInstance()
  })

  afterEach(() => {
    queue.destroy()
  })

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = OfflineQueue.getInstance()
      const instance2 = OfflineQueue.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('queue operations', () => {
    it('should add operation to queue', async () => {
      const operation = {
        type: 'UPDATE' as const,
        table: 'products',
        data: { id: 'prod-123', name: 'Updated Product' }
      }
      
      await queue.addToQueue(operation)
      
      expect(mockDb.add).toHaveBeenCalledWith('operations', expect.objectContaining({
        ...operation,
        id: expect.any(String),
        timestamp: expect.any(Number),
        retries: 0
      }))
    })

    it('should get all queued operations', async () => {
      const operations: QueuedOperation[] = [
        {
          id: 'op-1',
          type: 'UPDATE',
          table: 'products',
          data: { id: 'prod-1' },
          timestamp: Date.now(),
          retries: 0
        },
        {
          id: 'op-2',
          type: 'INSERT',
          table: 'inventory',
          data: { sku: 'SKU-001', quantity: 100 },
          timestamp: Date.now() + 1000,
          retries: 1
        }
      ]
      
      mockDb.getAll.mockResolvedValueOnce(operations)
      
      const result = await queue.getQueuedOperations()
      
      expect(result).toEqual(operations)
    })

    it('should get queue size', async () => {
      mockDb.count.mockResolvedValueOnce(5)
      
      const size = await queue.getQueueSize()
      
      expect(size).toBe(5)
      expect(mockDb.count).toHaveBeenCalledWith('operations')
    })

    it('should clear queue', async () => {
      const callback = jest.fn()
      queue.subscribe('test', callback)
      
      await queue.clearQueue()
      
      expect(mockDb.clear).toHaveBeenCalledWith('operations')
      expect(callback).toHaveBeenCalledWith(0) // Queue empty notification
    })

    it('should remove specific operation', async () => {
      await queue.removeOperation('op-123')
      
      expect(mockDb.delete).toHaveBeenCalledWith('operations', 'op-123')
    })
  })

  describe('processing queue', () => {
    it('should process operations in order', async () => {
      const operations: QueuedOperation[] = [
        {
          id: 'op-1',
          type: 'UPDATE',
          table: 'products',
          data: { id: 'prod-1', name: 'Product 1' },
          timestamp: 1000,
          retries: 0
        },
        {
          id: 'op-2',
          type: 'INSERT',
          table: 'inventory',
          data: { sku: 'SKU-001', quantity: 100 },
          timestamp: 2000,
          retries: 0
        },
        {
          id: 'op-3',
          type: 'DELETE',
          table: 'products',
          data: { id: 'prod-2' },
          timestamp: 3000,
          retries: 0
        }
      ]
      
      mockDb.getAll.mockResolvedValueOnce(operations)
      
      const result = await queue.processQueue()
      
      expect(result.successful).toEqual(['op-1', 'op-2', 'op-3'])
      expect(result.failed).toEqual([])
      expect(result.conflicts).toEqual([])
      
      // Verify operations were executed in order
      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      
      // Verify operations were deleted after success
      expect(mockDb.delete).toHaveBeenCalledWith('operations', 'op-1')
      expect(mockDb.delete).toHaveBeenCalledWith('operations', 'op-2')
      expect(mockDb.delete).toHaveBeenCalledWith('operations', 'op-3')
    })

    it('should handle failed operations with retry', async () => {
      const operation: QueuedOperation = {
        id: 'op-1',
        type: 'UPDATE',
        table: 'products',
        data: { id: 'prod-1' },
        timestamp: Date.now(),
        retries: 0
      }
      
      mockDb.getAll.mockResolvedValueOnce([operation])
      
      // Mock failure
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: new Error('Network error') })
        }))
      })
      
      const result = await queue.processQueue()
      
      expect(result.successful).toEqual([])
      expect(result.failed).toEqual([])
      
      // Operation should be updated with retry count
      expect(mockDb.put).toHaveBeenCalledWith('operations', expect.objectContaining({
        ...operation,
        retries: 1,
        error: 'Network error'
      }))
    })

    it('should remove operations after max retries', async () => {
      const operation: QueuedOperation = {
        id: 'op-1',
        type: 'UPDATE',
        table: 'products',
        data: { id: 'prod-1' },
        timestamp: Date.now(),
        retries: 2 // Already retried twice
      }
      
      mockDb.getAll.mockResolvedValueOnce([operation])
      
      // Mock failure
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: new Error('Persistent error') })
        }))
      })
      
      const result = await queue.processQueue()
      
      expect(result.failed).toEqual([{ id: 'op-1', error: 'Persistent error' }])
      expect(mockDb.delete).toHaveBeenCalledWith('operations', 'op-1')
      expect(mockDb.put).not.toHaveBeenCalled()
    })

    it('should detect and handle conflicts', async () => {
      const operation: QueuedOperation = {
        id: 'op-1',
        type: 'UPDATE',
        table: 'products',
        data: { id: 'prod-1', name: 'Local Update', version: 1 },
        timestamp: Date.now(),
        retries: 0
      }
      
      mockDb.getAll.mockResolvedValueOnce([operation])
      
      // Mock conflict error
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ 
            error: new Error('version conflict detected') 
          })
        }))
      })
      
      const result = await queue.processQueue()
      
      expect(result.conflicts).toEqual([{
        id: 'op-1',
        localValue: operation.data,
        serverValue: { id: 'test-id', name: 'Server Value' }
      }])
      
      // Verify server value was fetched
      expect(mockSupabase.from).toHaveBeenCalledWith('products')
    })

    it('should prevent concurrent processing', async () => {
      mockDb.getAll.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 100))
      )
      
      const result1Promise = queue.processQueue()
      const result2Promise = queue.processQueue()
      
      const [result1, result2] = await Promise.all([result1Promise, result2Promise])
      
      // One should process, other should return empty
      expect(mockDb.getAll).toHaveBeenCalledTimes(1)
      expect(result1.successful.length + result2.successful.length).toBe(0)
    })
  })

  describe('automatic processing', () => {
    it('should process queue when connection becomes available', async () => {
      const operation = {
        type: 'UPDATE' as const,
        table: 'products',
        data: { id: 'prod-123' }
      }
      
      // Start disconnected
      mockConnectionManager.getStatus.mockReturnValue({ state: 'disconnected' })
      
      await queue.addToQueue(operation)
      
      // Queue should not be processed
      expect(mockDb.getAll).not.toHaveBeenCalled()
      
      // Simulate connection
      connectionCallback({ state: 'connected' })
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Queue should be processed
      expect(mockDb.getAll).toHaveBeenCalled()
    })

    it('should try to process immediately if connected', async () => {
      mockConnectionManager.getStatus.mockReturnValue({ state: 'connected' })
      mockDb.getAll.mockResolvedValue([])
      
      await queue.addToQueue({
        type: 'UPDATE',
        table: 'products',
        data: { id: 'prod-123' }
      })
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(mockDb.getAll).toHaveBeenCalled()
    })
  })

  describe('subscriptions', () => {
    it('should notify subscribers of queue changes', async () => {
      const callback = jest.fn()
      const unsubscribe = queue.subscribe('test-subscriber', callback)
      
      // Should receive initial count
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(callback).toHaveBeenCalledWith(0)
      
      // Add operation
      mockDb.count.mockResolvedValueOnce(1)
      await queue.addToQueue({
        type: 'UPDATE',
        table: 'products',
        data: { id: 'prod-123' }
      })
      
      expect(callback).toHaveBeenCalledWith(1)
      
      // Unsubscribe
      callback.mockClear()
      unsubscribe()
      
      // Should not receive further updates
      await queue.clearQueue()
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('operation types', () => {
    it('should handle UPDATE operations', async () => {
      const operation: QueuedOperation = {
        id: 'op-1',
        type: 'UPDATE',
        table: 'products',
        data: { id: 'prod-1', name: 'Updated' },
        timestamp: Date.now(),
        retries: 0
      }
      
      mockDb.getAll.mockResolvedValueOnce([operation])
      
      await queue.processQueue()
      
      const fromCall = mockSupabase.from.mock.calls[0]
      expect(fromCall[0]).toBe('products')
      
      const updateMock = mockSupabase.from('products').update
      expect(updateMock).toHaveBeenCalledWith(operation.data)
    })

    it('should handle INSERT operations', async () => {
      const operation: QueuedOperation = {
        id: 'op-1',
        type: 'INSERT',
        table: 'inventory',
        data: { sku: 'NEW-SKU', quantity: 50 },
        timestamp: Date.now(),
        retries: 0
      }
      
      mockDb.getAll.mockResolvedValueOnce([operation])
      
      await queue.processQueue()
      
      const fromCall = mockSupabase.from.mock.calls[0]
      expect(fromCall[0]).toBe('inventory')
      
      const insertMock = mockSupabase.from('inventory').insert
      expect(insertMock).toHaveBeenCalledWith(operation.data)
    })

    it('should handle DELETE operations', async () => {
      const operation: QueuedOperation = {
        id: 'op-1',
        type: 'DELETE',
        table: 'products',
        data: { id: 'prod-1' },
        timestamp: Date.now(),
        retries: 0
      }
      
      mockDb.getAll.mockResolvedValueOnce([operation])
      
      await queue.processQueue()
      
      const fromCall = mockSupabase.from.mock.calls[0]
      expect(fromCall[0]).toBe('products')
      
      const deleteMock = mockSupabase.from('products').delete
      expect(deleteMock).toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should properly cleanup on destroy', () => {
      const callback = jest.fn()
      queue.subscribe('test', callback)
      
      queue.destroy()
      
      expect(mockDb.close).toHaveBeenCalled()
      expect((OfflineQueue as any).instance).toBeNull()
    })
  })
})