import { initWebVitals, measureCustomMetric, measureComponentRender } from '@/lib/performance/metrics'
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals'

// Mock web-vitals
jest.mock('web-vitals', () => ({
  onCLS: jest.fn(),
  onFID: jest.fn(),
  onLCP: jest.fn(),
  onFCP: jest.fn(),
  onTTFB: jest.fn(),
}))

// Mock navigator.sendBeacon
global.navigator.sendBeacon = jest.fn().mockReturnValue(true)

// Mock fetch
global.fetch = jest.fn()

// Mock performance API
global.performance = {
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(),
  now: jest.fn().mockReturnValue(1000),
} as any

describe('Performance Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment
    process.env.NODE_ENV = 'test'
  })

  describe('initWebVitals', () => {
    it('should register all web vitals handlers', () => {
      initWebVitals()

      expect(onCLS).toHaveBeenCalled()
      expect(onFID).toHaveBeenCalled()
      expect(onLCP).toHaveBeenCalled()
      expect(onFCP).toHaveBeenCalled()
      expect(onTTFB).toHaveBeenCalled()
    })

    it('should send metrics to analytics endpoint', () => {
      initWebVitals()

      // Get the callback passed to onLCP
      const sendToAnalytics = (onLCP as jest.Mock).mock.calls[0][0]

      const mockMetric = {
        name: 'LCP',
        value: 2500,
        delta: 100,
        id: 'test-id',
        entries: [],
        navigationType: 'navigate',
      }

      sendToAnalytics(mockMetric)

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/analytics/vitals',
        expect.stringContaining('"name":"LCP"')
      )
    })

    it('should calculate correct rating for metrics', () => {
      initWebVitals()

      const sendToAnalytics = (onLCP as jest.Mock).mock.calls[0][0]

      // Good LCP (< 2500ms)
      sendToAnalytics({
        name: 'LCP',
        value: 2000,
        delta: 0,
        id: 'test-1',
        entries: [],
        navigationType: 'navigate',
      })

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/analytics/vitals',
        expect.stringContaining('"rating":"good"')
      )

      jest.clearAllMocks()

      // Poor LCP (> 4000ms)
      sendToAnalytics({
        name: 'LCP',
        value: 5000,
        delta: 0,
        id: 'test-2',
        entries: [],
        navigationType: 'navigate',
      })

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/analytics/vitals',
        expect.stringContaining('"rating":"poor"')
      )
    })

    it('should fallback to fetch when sendBeacon is not available', async () => {
      // Remove sendBeacon
      delete (global.navigator as any).sendBeacon
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

      initWebVitals()

      const sendToAnalytics = (onCLS as jest.Mock).mock.calls[0][0]

      sendToAnalytics({
        name: 'CLS',
        value: 0.05,
        delta: 0.01,
        id: 'test-cls',
        entries: [],
        navigationType: 'navigate',
      })

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(fetch).toHaveBeenCalledWith('/api/analytics/vitals', {
        method: 'POST',
        body: expect.stringContaining('"name":"CLS"'),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      })

      // Restore sendBeacon
      global.navigator.sendBeacon = jest.fn().mockReturnValue(true)
    })
  })

  describe('measureCustomMetric', () => {
    it('should measure custom performance metric', () => {
      const mockMeasure = {
        duration: 150,
      }

      ;(performance.getEntriesByName as jest.Mock).mockReturnValue([mockMeasure])

      performance.mark('custom-start')
      measureCustomMetric('custom-metric', 'custom-start', 'custom-end')

      expect(performance.mark).toHaveBeenCalledWith('custom-end')
      expect(performance.measure).toHaveBeenCalledWith(
        'custom-metric',
        'custom-start',
        'custom-end'
      )
      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/analytics/vitals',
        expect.stringContaining('"name":"custom-metric"')
      )
    })

    it('should handle performance API errors gracefully', () => {
      ;(performance.mark as jest.Mock).mockImplementation(() => {
        throw new Error('Performance API not available')
      })

      // Should not throw
      expect(() => {
        measureCustomMetric('error-metric', 'start', 'end')
      }).not.toThrow()
    })
  })

  describe('measureComponentRender', () => {
    it('should measure component render time', () => {
      jest.useFakeTimers()

      const cleanup = measureComponentRender('TestComponent')

      // Simulate 200ms render time
      ;(performance.now as jest.Mock).mockReturnValue(1200)

      cleanup()

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/analytics/vitals',
        expect.stringContaining('"name":"TestComponent-render"')
      )
      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        '/api/analytics/vitals',
        expect.stringContaining('"value":200')
      )

      jest.useRealTimers()
    })

    it('should not send metrics for fast renders', () => {
      const cleanup = measureComponentRender('FastComponent')

      // Simulate 50ms render time (below threshold)
      ;(performance.now as jest.Mock).mockReturnValue(1050)

      cleanup()

      expect(navigator.sendBeacon).not.toHaveBeenCalled()
    })

    it('should log in development mode', () => {
      process.env.NODE_ENV = 'development'
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const cleanup = measureComponentRender('DevComponent')

      ;(performance.now as jest.Mock).mockReturnValue(1075)

      cleanup()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Performance] DevComponent render time: 75.00ms'
      )

      consoleSpy.mockRestore()
    })
  })
})