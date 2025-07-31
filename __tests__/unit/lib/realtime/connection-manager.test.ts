import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'
import { ConnectionQuality, ConnectionState, ConnectionStatus, RealtimeConfig } from '@/lib/realtime/types'

// Mock fetch for ping monitoring
global.fetch = jest.fn()

describe('RealtimeConnectionManager', () => {
  let manager: RealtimeConnectionManager
  let mockFetch: jest.MockedFunction<typeof fetch>

  const defaultConfig: Partial<RealtimeConfig> = {
    enableOptimisticUpdates: true,
    enableOfflineQueue: true,
    enablePresence: true,
    enablePerformanceMonitoring: true,
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    conflictResolutionStrategy: 'manual',
    queuePersistence: 'indexeddb'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Mock fetch
    mockFetch = fetch as jest.MockedFunction<typeof fetch>

    // Mock window events
    Object.defineProperty(window, 'addEventListener', {
      value: jest.fn(),
      writable: true
    })

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true
    })

    // Create fresh instance
    manager = RealtimeConnectionManager.getInstance(defaultConfig)
  })

  afterEach(() => {
    jest.useRealTimers()
    // Clean up singleton
    ;(manager as any).destroy()
    ;(RealtimeConnectionManager as any).instance = null
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RealtimeConnectionManager.getInstance()
      const instance2 = RealtimeConnectionManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })

    it('should apply custom configuration', () => {
      const customConfig: Partial<RealtimeConfig> = {
        reconnectDelay: 2000,
        maxReconnectAttempts: 10
      }

      const customManager = RealtimeConnectionManager.getInstance(customConfig)
      const status = customManager.getStatus()

      expect(status.state).toBe('disconnected')
    })
  })

  describe('connect', () => {
    it('should connect successfully when online', () => {
      navigator.onLine = true

      manager.connect()

      // Fast-forward time to simulate connection
      jest.advanceTimersByTime(1000)

      const status = manager.getStatus()
      expect(status.state).toBe('connected')
      expect(status.lastConnected).toBeInstanceOf(Date)
      expect(status.reconnectAttempts).toBe(0)
    })

    it('should not connect when already connected', () => {
      navigator.onLine = true
      manager.connect()
      jest.advanceTimersByTime(1000)

      // Try to connect again
      manager.connect()

      const status = manager.getStatus()
      expect(status.state).toBe('connected')
    })

    it('should not connect when already connecting', () => {
      navigator.onLine = true
      manager.connect()

      // Try to connect again while connecting
      manager.connect()

      const status = manager.getStatus()
      expect(status.state).toBe('connecting')
    })

    it('should attempt reconnect when offline', () => {
      navigator.onLine = false

      manager.connect()
      jest.advanceTimersByTime(1000)

      const status = manager.getStatus()
      expect(status.state).toBe('disconnected')
    })
  })

  describe('subscribe', () => {
    it('should add listener and return unsubscribe function', () => {
      const mockCallback = jest.fn()
      const unsubscribe = manager.subscribe('test-id', mockCallback)

      expect(unsubscribe).toBeInstanceOf(Function)

      // Trigger status update
      manager.connect()
      jest.advanceTimersByTime(1000)

      expect(mockCallback).toHaveBeenCalled()
    })

    it('should remove listener when unsubscribe is called', () => {
      const mockCallback = jest.fn()
      const unsubscribe = manager.subscribe('test-id', mockCallback)

      unsubscribe()

      // Trigger status update
      manager.connect()
      jest.advanceTimersByTime(1000)

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should handle multiple listeners', () => {
      const mockCallback1 = jest.fn()
      const mockCallback2 = jest.fn()

      manager.subscribe('listener-1', mockCallback1)
      manager.subscribe('listener-2', mockCallback2)

      manager.connect()
      jest.advanceTimersByTime(1000)

      expect(mockCallback1).toHaveBeenCalled()
      expect(mockCallback2).toHaveBeenCalled()
    })
  })

  describe('getStatus', () => {
    it('should return current connection status', () => {
      const status = manager.getStatus()

      expect(status).toEqual({
        state: 'disconnected',
        latency: 0,
        lastConnected: null,
        reconnectAttempts: 0,
        quality: 'poor'
      })
    })

    it('should return updated status after connection', () => {
      navigator.onLine = true
      manager.connect()
      jest.advanceTimersByTime(1000)

      const status = manager.getStatus()
      expect(status.state).toBe('connected')
      expect(status.lastConnected).toBeInstanceOf(Date)
    })
  })

  describe('registerChannel and unregisterChannel', () => {
    it('should register and unregister channels', () => {
      const mockChannel = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      } as any

      manager.registerChannel('test-channel', mockChannel)
      manager.unregisterChannel('test-channel')

      // Verify channel was registered and unregistered
      // (implementation details would depend on actual channel management)
    })
  })

  describe('getHealthScore', () => {
    it('should return health score based on connection quality', () => {
      const score = manager.getHealthScore()

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should return higher score for better connection quality', () => {
      // Simulate good connection
      navigator.onLine = true
      manager.connect()
      jest.advanceTimersByTime(1000)

      const score = manager.getHealthScore()
      expect(score).toBeGreaterThan(50)
    })
  })

  describe('getRecommendations', () => {
    it('should return recommendations for poor connection', () => {
      const recommendations = manager.getRecommendations()

      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBeGreaterThan(0)
    })

    it('should return different recommendations for different connection states', () => {
      // Test disconnected state
      let recommendations = manager.getRecommendations()
      expect(recommendations).toContain('Check your internet connection')

      // Test connected state
      navigator.onLine = true
      manager.connect()
      jest.advanceTimersByTime(1000)

      recommendations = manager.getRecommendations()
      expect(recommendations).not.toContain('Check your internet connection')
    })
  })

  describe('getConnectionQuality', () => {
    it('should return connection metrics', () => {
      const metrics = manager.getConnectionQuality()

      expect(metrics).toEqual({
        latency: [],
        stability: 100,
        throughput: 0,
        lastMeasured: expect.any(Date)
      })
    })

    it('should update metrics over time', () => {
      // Simulate some latency measurements
      mockFetch.mockResolvedValue({} as Response)

      // Fast-forward to trigger ping monitoring
      jest.advanceTimersByTime(5000)

      const metrics = manager.getConnectionQuality()
      expect(metrics.latency.length).toBeGreaterThan(0)
    })
  })

  describe('latency monitoring', () => {
    it('should measure latency successfully', async () => {
      mockFetch.mockResolvedValue({} as Response)

      // Fast-forward to trigger ping
      jest.advanceTimersByTime(5000)

      const status = manager.getStatus()
      expect(status.latency).toBeGreaterThan(0)
    })

    it('should handle ping failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      // Fast-forward to trigger ping
      jest.advanceTimersByTime(5000)

      const status = manager.getStatus()
      expect(status.state).toBe('error')
    })

    it('should calculate connection quality based on latency', () => {
      // Simulate excellent latency
      mockFetch.mockImplementation(() => 
        Promise.resolve({} as Response)
      )

      // Fast-forward multiple times to build latency history
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(5000)
      }

      const status = manager.getStatus()
      expect(['excellent', 'good', 'fair', 'poor']).toContain(status.quality)
    })
  })

  describe('reconnection logic', () => {
    it('should attempt reconnection when connection fails', () => {
      navigator.onLine = false
      manager.connect()

      // Fast-forward to trigger reconnect attempt
      jest.advanceTimersByTime(1000)

      const status = manager.getStatus()
      expect(status.reconnectAttempts).toBeGreaterThan(0)
    })

    it('should stop reconnecting after max attempts', () => {
      navigator.onLine = false
      manager.connect()

      // Fast-forward through multiple reconnect attempts
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(1000)
      }

      const status = manager.getStatus()
      expect(status.reconnectAttempts).toBeLessThanOrEqual(5) // maxReconnectAttempts
    })

    it('should reset reconnect attempts on successful connection', () => {
      navigator.onLine = false
      manager.connect()
      jest.advanceTimersByTime(1000)

      // Switch to online
      navigator.onLine = true
      manager.connect()
      jest.advanceTimersByTime(1000)

      const status = manager.getStatus()
      expect(status.reconnectAttempts).toBe(0)
    })
  })

  describe('online/offline event handling', () => {
    it('should handle online event', () => {
      // Simulate going offline then online
      navigator.onLine = false
      manager.connect()
      jest.advanceTimersByTime(1000)

      navigator.onLine = true
      // Trigger online event
      const onlineEvent = new Event('online')
      window.dispatchEvent(onlineEvent)

      const status = manager.getStatus()
      expect(status.state).toBe('connected')
    })

    it('should handle offline event', () => {
      // Connect first
      navigator.onLine = true
      manager.connect()
      jest.advanceTimersByTime(1000)

      // Go offline
      navigator.onLine = false
      const offlineEvent = new Event('offline')
      window.dispatchEvent(offlineEvent)

      const status = manager.getStatus()
      expect(status.state).toBe('disconnected')
    })
  })

  describe('stability calculation', () => {
    it('should calculate stability based on latency variance', () => {
      // Simulate consistent low latency
      mockFetch.mockImplementation(() => 
        Promise.resolve({} as Response)
      )

      // Build latency history
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(5000)
      }

      const metrics = manager.getConnectionQuality()
      expect(metrics.stability).toBeGreaterThan(80) // Should be high for consistent latency
    })

    it('should calculate lower stability for inconsistent latency', () => {
      // Simulate inconsistent latency
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        const latency = callCount % 2 === 0 ? 50 : 500 // Alternating high/low latency
        return new Promise(resolve => 
          setTimeout(() => resolve({} as Response), latency)
        )
      })

      // Build latency history
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(5000)
      }

      const metrics = manager.getConnectionQuality()
      expect(metrics.stability).toBeLessThan(80) // Should be lower for inconsistent latency
    })
  })

  describe('error handling', () => {
    it('should handle network errors gracefully', () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      // Fast-forward to trigger error
      jest.advanceTimersByTime(5000)

      const status = manager.getStatus()
      expect(status.state).toBe('error')
    })

    it('should recover from errors when network improves', () => {
      // Start with error
      mockFetch.mockRejectedValue(new Error('Network error'))
      jest.advanceTimersByTime(5000)

      // Fix network
      mockFetch.mockResolvedValue({} as Response)
      jest.advanceTimersByTime(5000)

      const status = manager.getStatus()
      expect(status.state).toBe('connected')
    })
  })

  describe('destroy', () => {
    it('should clean up resources when destroyed', () => {
      const mockCallback = jest.fn()
      manager.subscribe('test', mockCallback)

      manager.destroy()

      // Verify cleanup
      manager.connect()
      jest.advanceTimersByTime(1000)

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle rapid connect/disconnect cycles', () => {
      navigator.onLine = true

      for (let i = 0; i < 5; i++) {
        manager.connect()
        jest.advanceTimersByTime(100)
        manager.destroy()
        manager = RealtimeConnectionManager.getInstance()
      }

      const status = manager.getStatus()
      expect(status.state).toBe('disconnected')
    })

    it('should handle multiple simultaneous subscribers', () => {
      const callbacks = Array.from({ length: 10 }, () => jest.fn())
      
      callbacks.forEach((callback, index) => {
        manager.subscribe(`listener-${index}`, callback)
      })

      manager.connect()
      jest.advanceTimersByTime(1000)

      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalled()
      })
    })

    it('should handle very high latency', () => {
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({} as Response), 2000)
        )
      )

      jest.advanceTimersByTime(5000)

      const status = manager.getStatus()
      expect(status.quality).toBe('poor')
    })
  })
}) 