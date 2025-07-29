import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'
import type { ConnectionStatus, RealtimeConfig } from '@/lib/realtime/types'

// Mock fetch for health checks
global.fetch = jest.fn()

// Mock window events
const mockAddEventListener = jest.fn()
const mockRemoveEventListener = jest.fn()

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
  writable: true
})

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true
})

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

describe('RealtimeConnectionManager', () => {
  let manager: RealtimeConnectionManager
  
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Reset singleton
    ;(RealtimeConnectionManager as any).instance = null
    
    // Mock successful health check
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true
    })
    
    // Reset navigator.onLine
    ;(navigator as any).onLine = true
    
    manager = RealtimeConnectionManager.getInstance()
  })

  afterEach(() => {
    manager.destroy()
    jest.useRealTimers()
  })

  describe('connection lifecycle', () => {
    it('should subscribe to a channel successfully', async () => {
      const callback = jest.fn()
      
      await manager.subscribe('test-channel', 'INSERT', callback)
      
      expect(mockSupabase.channel).toHaveBeenCalledWith('test-channel')
      expect(mockChannels.get('test-channel')?.state).toBe('joined')
    })

    it('should handle multiple subscriptions to the same channel', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()
      
      await manager.subscribe('test-channel', 'INSERT', callback1)
      await manager.subscribe('test-channel', 'UPDATE', callback2)
      
      // Should only create one channel
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1)
      
      // Emit events
      const channel = mockChannels.get('test-channel')
      channel?.emit('INSERT', { new: { id: 1 } })
      channel?.emit('UPDATE', { new: { id: 1 }, old: { id: 1 } })
      
      expect(callback1).toHaveBeenCalledWith({ new: { id: 1 } })
      expect(callback2).toHaveBeenCalledWith({ new: { id: 1 }, old: { id: 1 } })
    })

    it('should unsubscribe from a channel', async () => {
      const callback = jest.fn()
      
      const unsubscribe = await manager.subscribe('test-channel', 'INSERT', callback)
      expect(mockChannels.has('test-channel')).toBe(true)
      
      await unsubscribe()
      
      // Channel should be removed when last subscriber leaves
      expect(mockSupabase.removeChannel).toHaveBeenCalled()
      expect(mockChannels.has('test-channel')).toBe(false)
    })

    it('should maintain channel when other subscribers exist', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()
      
      const unsub1 = await manager.subscribe('test-channel', 'INSERT', callback1)
      const unsub2 = await manager.subscribe('test-channel', 'UPDATE', callback2)
      
      // Unsubscribe first callback
      await unsub1()
      
      // Channel should still exist
      expect(mockSupabase.removeChannel).not.toHaveBeenCalled()
      expect(mockChannels.has('test-channel')).toBe(true)
      
      // Unsubscribe second callback
      await unsub2()
      
      // Now channel should be removed
      expect(mockSupabase.removeChannel).toHaveBeenCalled()
    })
  })

  describe('table subscriptions', () => {
    it('should subscribe to table changes with filters', async () => {
      const callback = jest.fn()
      
      await manager.subscribeToTable(
        'products',
        {
          event: 'UPDATE',
          filter: 'organization_id=eq.org-123'
        },
        callback
      )
      
      const channel = mockChannels.get('db-changes')
      expect(channel).toBeDefined()
      
      // Simulate Postgres change
      channel?.emit('postgres_changes', {
        eventType: 'UPDATE',
        schema: 'public',
        table: 'products',
        new: { id: 1, name: 'Updated Product' },
        old: { id: 1, name: 'Old Product' }
      })
      
      expect(callback).toHaveBeenCalledWith({
        eventType: 'UPDATE',
        schema: 'public',
        table: 'products',
        new: { id: 1, name: 'Updated Product' },
        old: { id: 1, name: 'Old Product' }
      })
    })

    it('should handle multiple table subscriptions', async () => {
      const productCallback = jest.fn()
      const inventoryCallback = jest.fn()
      
      await manager.subscribeToTable('products', { event: '*' }, productCallback)
      await manager.subscribeToTable('inventory', { event: '*' }, inventoryCallback)
      
      const channel = mockChannels.get('db-changes')
      
      // Emit product change
      channel?.emit('postgres_changes', {
        eventType: 'INSERT',
        table: 'products',
        new: { id: 1 }
      })
      
      // Emit inventory change
      channel?.emit('postgres_changes', {
        eventType: 'UPDATE',
        table: 'inventory',
        new: { id: 2 },
        old: { id: 2 }
      })
      
      expect(productCallback).toHaveBeenCalledTimes(1)
      expect(inventoryCallback).toHaveBeenCalledTimes(1)
    })
  })

  describe('presence tracking', () => {
    it('should track presence in a channel', async () => {
      const presenceCallback = jest.fn()
      
      await manager.trackPresence(
        'room-123',
        { user_id: 'user-1', status: 'online' },
        presenceCallback
      )
      
      const channel = mockChannels.get('presence:room-123')
      expect(channel).toBeDefined()
      
      // Simulate presence sync
      channel?.emit('presence', {
        event: 'sync',
        payload: [
          { user_id: 'user-1', status: 'online' },
          { user_id: 'user-2', status: 'online' }
        ]
      })
      
      expect(presenceCallback).toHaveBeenCalledWith({
        event: 'sync',
        payload: [
          { user_id: 'user-1', status: 'online' },
          { user_id: 'user-2', status: 'online' }
        ]
      })
    })

    it('should handle presence join and leave events', async () => {
      const presenceCallback = jest.fn()
      
      await manager.trackPresence(
        'room-123',
        { user_id: 'user-1', status: 'online' },
        presenceCallback
      )
      
      const channel = mockChannels.get('presence:room-123')
      
      // User joins
      channel?.emit('presence', {
        event: 'join',
        key: 'user-2',
        payload: { user_id: 'user-2', status: 'online' }
      })
      
      // User leaves
      channel?.emit('presence', {
        event: 'leave',
        key: 'user-2',
        payload: { user_id: 'user-2' }
      })
      
      expect(presenceCallback).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('should handle channel subscription errors', async () => {
      const errorChannel = new MockRealtimeChannel('error-channel')
      errorChannel.subscribe = jest.fn((callback) => {
        errorChannel.state = 'errored'
        callback?.('CHANNEL_ERROR')
        return errorChannel
      })
      
      ;(mockSupabase as any).channel = jest.fn(() => errorChannel)
      
      const callback = jest.fn()
      
      await expect(
        manager.subscribe('error-channel', 'INSERT', callback)
      ).rejects.toThrow('Failed to subscribe to channel')
    })

    it('should handle connection drops and reconnect', async () => {
      const callback = jest.fn()
      await manager.subscribe('test-channel', 'INSERT', callback)
      
      const channel = mockChannels.get('test-channel')
      
      // Simulate connection drop
      channel?.state = 'errored'
      channel?.emit('error', new Error('Connection lost'))
      
      // Should attempt to resubscribe
      setTimeout(() => {
        expect(channel?.subscribe).toHaveBeenCalled()
      }, 1100) // After reconnect delay
    })

    it('should handle cleanup errors gracefully', async () => {
      const callback = jest.fn()
      await manager.subscribe('test-channel', 'INSERT', callback)
      
      // Mock removeChannel to throw
      ;(mockSupabase as any).removeChannel = jest.fn(() => {
        throw new Error('Cleanup failed')
      })
      
      // Should not throw
      expect(() => manager.cleanup()).not.toThrow()
    })
  })

  describe('broadcast messaging', () => {
    it('should broadcast messages to a channel', async () => {
      const receiveCallback = jest.fn()
      
      await manager.broadcast(
        'chat-room',
        { type: 'message', text: 'Hello' },
        receiveCallback
      )
      
      const channel = mockChannels.get('broadcast:chat-room')
      expect(channel).toBeDefined()
      
      // Simulate receiving broadcast
      channel?.emit('broadcast', {
        event: 'message',
        payload: { type: 'message', text: 'Hello from another user' }
      })
      
      expect(receiveCallback).toHaveBeenCalledWith({
        type: 'message',
        text: 'Hello from another user'
      })
    })

    it('should handle broadcast errors', async () => {
      const channel = new MockRealtimeChannel('broadcast:error')
      channel.send = jest.fn(() => Promise.reject(new Error('Broadcast failed')))
      
      ;(mockSupabase as any).channel = jest.fn(() => channel)
      
      await expect(
        manager.broadcast('error', { message: 'test' })
      ).rejects.toThrow('Broadcast failed')
    })
  })

  describe('connection state management', () => {
    it('should track connection state across channels', () => {
      const states = manager.getConnectionStates()
      expect(states.size).toBe(0)
      
      // Add some channels
      manager.subscribe('channel-1', 'INSERT', jest.fn())
      manager.subscribe('channel-2', 'UPDATE', jest.fn())
      
      const updatedStates = manager.getConnectionStates()
      expect(updatedStates.size).toBe(2)
      expect(updatedStates.get('channel-1')).toBe('joined')
      expect(updatedStates.get('channel-2')).toBe('joined')
    })

    it('should emit connection state changes', async () => {
      const stateCallback = jest.fn()
      manager.on('connectionStateChange', stateCallback)
      
      await manager.subscribe('test-channel', 'INSERT', jest.fn())
      
      expect(stateCallback).toHaveBeenCalledWith({
        channel: 'test-channel',
        state: 'joining'
      })
      
      expect(stateCallback).toHaveBeenCalledWith({
        channel: 'test-channel',
        state: 'joined'
      })
    })
  })

  describe('performance and limits', () => {
    it('should enforce channel limits', async () => {
      // Set max channels to 5
      ;(manager as any).maxChannels = 5
      
      // Subscribe to max channels
      for (let i = 0; i < 5; i++) {
        await manager.subscribe(`channel-${i}`, 'INSERT', jest.fn())
      }
      
      // Attempt to exceed limit
      await expect(
        manager.subscribe('channel-6', 'INSERT', jest.fn())
      ).rejects.toThrow('Maximum number of channels reached')
    })

    it('should cleanup stale channels after timeout', async () => {
      jest.useFakeTimers()
      
      const callback = jest.fn()
      const unsub = await manager.subscribe('stale-channel', 'INSERT', callback)
      
      // Unsubscribe all callbacks
      await unsub()
      
      // Fast-forward past cleanup timeout
      jest.advanceTimersByTime(60000) // 1 minute
      
      expect(mockSupabase.removeChannel).toHaveBeenCalled()
      
      jest.useRealTimers()
    })
  })
})