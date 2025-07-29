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

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = RealtimeConnectionManager.getInstance()
      const instance2 = RealtimeConnectionManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })
    
    it('should accept config on first getInstance', () => {
      // Reset singleton
      ;(RealtimeConnectionManager as any).instance = null
      
      const config: Partial<RealtimeConfig> = {
        reconnectDelay: 2000,
        maxReconnectAttempts: 10
      }
      
      const instance = RealtimeConnectionManager.getInstance(config)
      expect(instance).toBeDefined()
    })
  })

  describe('connection status', () => {
    it('should start in disconnected state', () => {
      const status = manager.getStatus()
      expect(status.state).toBe('disconnected')
      expect(status.reconnectAttempts).toBe(0)
      expect(status.quality).toBe('poor')
    })

    it('should handle connection attempt', () => {
      manager.connect()
      
      const connectingStatus = manager.getStatus()
      expect(connectingStatus.state).toBe('connecting')
      
      // Fast-forward connection
      jest.advanceTimersByTime(1000)
      
      const connectedStatus = manager.getStatus()
      expect(connectedStatus.state).toBe('connected')
      expect(connectedStatus.lastConnected).toBeDefined()
    })

    it('should not attempt connection when already connected', () => {
      manager.connect()
      jest.advanceTimersByTime(1000)
      
      const status1 = manager.getStatus()
      manager.connect() // Try to connect again
      
      const status2 = manager.getStatus()
      expect(status1).toEqual(status2)
    })
  })

  describe('online/offline handling', () => {
    it('should respond to online event', () => {
      // Get the online handler that was registered
      const onlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1]
      
      expect(onlineHandler).toBeDefined()
      
      // Set to disconnected state
      ;(navigator as any).onLine = false
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1]
      offlineHandler()
      
      expect(manager.getStatus().state).toBe('disconnected')
      
      // Trigger online event
      ;(navigator as any).onLine = true
      onlineHandler()
      
      expect(manager.getStatus().state).toBe('connecting')
    })

    it('should handle offline event', () => {
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1]
      
      // Connect first
      manager.connect()
      jest.advanceTimersByTime(1000)
      expect(manager.getStatus().state).toBe('connected')
      
      // Go offline
      ;(navigator as any).onLine = false
      offlineHandler()
      
      expect(manager.getStatus().state).toBe('disconnected')
    })
  })

  describe('latency monitoring', () => {
    it('should measure latency periodically', async () => {
      // Fast-forward to trigger ping monitoring
      jest.advanceTimersByTime(5000)
      
      expect(global.fetch).toHaveBeenCalledWith('/api/health', { method: 'HEAD' })
      
      // Check latency was recorded
      const metrics = manager.getConnectionQuality()
      expect(metrics.latency.length).toBeGreaterThan(0)
    })

    it('should calculate connection quality based on latency', async () => {
      // Mock varying latencies
      const latencies = [50, 60, 55, 65, 70]
      
      for (const latency of latencies) {
        ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
          new Promise(resolve => setTimeout(() => resolve({ ok: true }), latency))
        )
        jest.advanceTimersByTime(5000)
      }
      
      const status = manager.getStatus()
      expect(status.quality).toBe('excellent') // Average ~60ms
    })

    it('should handle failed health checks', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
      
      jest.advanceTimersByTime(5000)
      
      const status = manager.getStatus()
      expect(status.state).toBe('error')
      expect(status.error).toBe('Network error')
    })
  })

  describe('reconnection logic', () => {
    it('should attempt reconnection with exponential backoff', () => {
      ;(navigator as any).onLine = false
      
      manager.connect()
      jest.advanceTimersByTime(1000)
      
      // Should be in error state (offline)
      expect(manager.getStatus().state).toBe('connecting')
      
      // Simulate going back online
      ;(navigator as any).onLine = true
      
      // First reconnect attempt after 1 second
      jest.advanceTimersByTime(1000)
      expect(manager.getStatus().reconnectAttempts).toBe(1)
      
      // Fail again
      ;(navigator as any).onLine = false
      jest.advanceTimersByTime(1000)
      
      // Second attempt after 2 seconds (exponential backoff)
      ;(navigator as any).onLine = true
      jest.advanceTimersByTime(2000)
      expect(manager.getStatus().reconnectAttempts).toBe(2)
    })

    it('should stop reconnecting after max attempts', () => {
      ;(navigator as any).onLine = false
      
      // Attempt to connect and fail multiple times
      for (let i = 0; i < 6; i++) {
        manager.connect()
        jest.advanceTimersByTime(30000) // Max delay
      }
      
      const status = manager.getStatus()
      expect(status.state).toBe('error')
      expect(status.error).toBe('Max reconnection attempts reached')
    })
  })

  describe('status subscriptions', () => {
    it('should notify subscribers of status changes', () => {
      const callback = jest.fn()
      
      const unsubscribe = manager.subscribe('test-subscriber', callback)
      
      // Should receive initial status
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'disconnected'
        })
      )
      
      // Connect and verify notification
      callback.mockClear()
      manager.connect()
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'connecting'
        })
      )
      
      // Complete connection
      jest.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'connected'
        })
      )
      
      // Unsubscribe
      unsubscribe()
      callback.mockClear()
      
      // Should not receive further updates
      ;(navigator as any).onLine = false
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1]
      offlineHandler()
      
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('channel management', () => {
    it('should register and unregister channels', () => {
      const mockChannel = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      } as any
      
      manager.registerChannel('test-channel', mockChannel)
      
      // Channel should be tracked
      // Note: We can't directly check channels Map as it's private
      // but we can verify through recommendations
      
      manager.unregisterChannel('test-channel')
      
      // Channel should be removed
      const recommendations = manager.getRecommendations()
      expect(recommendations).not.toContain(
        expect.stringContaining('Many active subscriptions')
      )
    })

    it('should recommend consolidation for many channels', () => {
      // Register many channels
      for (let i = 0; i < 15; i++) {
        manager.registerChannel(`channel-${i}`, {} as any)
      }
      
      const recommendations = manager.getRecommendations()
      expect(recommendations).toContain(
        'Many active subscriptions. Consider consolidating channels for better performance.'
      )
    })
  })

  describe('health monitoring', () => {
    it('should calculate health score', () => {
      // Initial health score (disconnected)
      const initialScore = manager.getHealthScore()
      expect(initialScore).toBeLessThan(50)
      
      // Connect and improve health
      manager.connect()
      jest.advanceTimersByTime(1000)
      
      // Add some good latency measurements
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(5000)
      }
      
      const improvedScore = manager.getHealthScore()
      expect(improvedScore).toBeGreaterThan(initialScore)
    })

    it('should provide performance recommendations', () => {
      // High latency scenario
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 600))
      )
      
      jest.advanceTimersByTime(5000)
      
      const recommendations = manager.getRecommendations()
      expect(recommendations).toContain(
        'High latency detected. Consider checking your network connection.'
      )
    })

    it('should detect connection instability', async () => {
      // Simulate unstable connection with varying latencies
      const latencies = [50, 500, 60, 600, 70, 700]
      
      for (const latency of latencies) {
        ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
          new Promise(resolve => setTimeout(() => resolve({ ok: true }), latency))
        )
        jest.advanceTimersByTime(5000)
      }
      
      const recommendations = manager.getRecommendations()
      expect(recommendations).toContain(
        'Connection instability detected. This may affect real-time updates.'
      )
    })
  })

  describe('cleanup', () => {
    it('should properly cleanup resources on destroy', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
      
      // Create some active timers
      manager.connect()
      ;(navigator as any).onLine = false
      jest.advanceTimersByTime(1000)
      
      // Destroy manager
      manager.destroy()
      
      // Verify cleanup
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function))
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
      
      // Verify singleton is reset
      expect((RealtimeConnectionManager as any).instance).toBeNull()
    })
  })
})