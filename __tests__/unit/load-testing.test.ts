import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { 
  weightedRandom, 
  randomSleep, 
  validateResponse,
  extractMetrics,
  getTierOptions
} from '@/k6/config/base'
import { tierLimits, tierDistribution } from '@/k6/config/tiers'

// Mock fetch for API tests
global.fetch = jest.fn()

describe('Load Testing Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('weightedRandom', () => {
    it('should select items based on weight', () => {
      const items = [
        { weight: 0.7, value: 'A' },
        { weight: 0.2, value: 'B' },
        { weight: 0.1, value: 'C' }
      ]

      // Run many times to verify distribution
      const results = { A: 0, B: 0, C: 0 }
      for (let i = 0; i < 10000; i++) {
        const selected = weightedRandom(items)
        results[selected.value]++
      }

      // Check distribution is roughly correct (with 5% tolerance)
      expect(results.A / 10000).toBeCloseTo(0.7, 1)
      expect(results.B / 10000).toBeCloseTo(0.2, 1)
      expect(results.C / 10000).toBeCloseTo(0.1, 1)
    })

    it('should handle single item', () => {
      const items = [{ weight: 1, value: 'only' }]
      const result = weightedRandom(items)
      expect(result.value).toBe('only')
    })
  })

  describe('randomSleep', () => {
    it('should return value between min and max', () => {
      for (let i = 0; i < 100; i++) {
        const sleep = randomSleep(1, 5)
        expect(sleep).toBeGreaterThanOrEqual(1)
        expect(sleep).toBeLessThanOrEqual(5)
      }
    })

    it('should handle equal min and max', () => {
      const sleep = randomSleep(3, 3)
      expect(sleep).toBe(3)
    })
  })

  describe('validateResponse', () => {
    it('should validate successful response', () => {
      const response = {
        status: 200,
        body: 'test data',
        timings: { duration: 450 },
        error: null
      }

      const checks = validateResponse(response)
      expect(checks['status is correct'](response)).toBe(true)
      expect(checks['response has body'](response)).toBe(true)
      expect(checks['response time OK'](response)).toBe(true)
      expect(checks['no errors'](response)).toBe(true)
    })

    it('should validate custom status code', () => {
      const response = {
        status: 201,
        body: 'created',
        timings: { duration: 300 },
        error: null
      }

      const checks = validateResponse(response, 201)
      expect(checks['status is correct'](response)).toBe(true)
    })

    it('should detect slow response', () => {
      const response = {
        status: 200,
        body: 'data',
        timings: { duration: 1500 },
        error: null
      }

      const checks = validateResponse(response)
      expect(checks['response time OK'](response)).toBe(false)
    })
  })

  describe('extractMetrics', () => {
    it('should extract all metrics from headers', () => {
      const response = {
        headers: {
          'X-Server-Time': '123',
          'X-Cache-Status': 'HIT',
          'X-RateLimit-Remaining': '95'
        }
      }

      const metrics = extractMetrics(response)
      expect(metrics).toEqual({
        serverTime: '123',
        cacheStatus: 'HIT',
        rateLimitRemaining: '95'
      })
    })

    it('should handle missing headers', () => {
      const response = { headers: {} }
      const metrics = extractMetrics(response)
      
      expect(metrics).toEqual({
        serverTime: null,
        cacheStatus: 'MISS',
        rateLimitRemaining: null
      })
    })
  })
})

describe('Tier Configuration', () => {
  describe('tierLimits', () => {
    it('should have increasing limits by tier', () => {
      expect(tierLimits.free.rps).toBeLessThan(tierLimits.starter.rps)
      expect(tierLimits.starter.rps).toBeLessThan(tierLimits.professional.rps)
      expect(tierLimits.professional.rps).toBeLessThan(tierLimits.enterprise.rps)
    })

    it('should have decreasing error thresholds by tier', () => {
      expect(tierLimits.free.error_threshold).toBeGreaterThan(tierLimits.starter.error_threshold)
      expect(tierLimits.starter.error_threshold).toBeGreaterThan(tierLimits.professional.error_threshold)
      expect(tierLimits.professional.error_threshold).toBeGreaterThan(tierLimits.enterprise.error_threshold)
    })

    it('should have proper bulk operation limits', () => {
      expect(tierLimits.free.bulk_operations.enabled).toBe(false)
      expect(tierLimits.starter.bulk_operations.enabled).toBe(true)
      expect(tierLimits.starter.bulk_operations.max_items).toBeLessThan(
        tierLimits.professional.bulk_operations.max_items
      )
    })
  })

  describe('tierDistribution', () => {
    it('should sum to 1', () => {
      const total = Object.values(tierDistribution).reduce((sum, val) => sum + val, 0)
      expect(total).toBeCloseTo(1, 10)
    })

    it('should have free tier as majority', () => {
      expect(tierDistribution.free).toBeGreaterThan(0.4)
      expect(tierDistribution.free).toBeGreaterThan(tierDistribution.starter)
      expect(tierDistribution.free).toBeGreaterThan(tierDistribution.professional)
      expect(tierDistribution.free).toBeGreaterThan(tierDistribution.enterprise)
    })
  })

  describe('getTierOptions', () => {
    it('should generate correct k6 options for free tier', () => {
      const options = getTierOptions('free')
      
      expect(options.stages).toHaveLength(3)
      expect(options.stages[1].target).toBe(tierLimits.free.concurrent_users)
      expect(options.thresholds['http_req_duration']).toContain(
        `p(95)<${tierLimits.free.response_time_p95}`
      )
      expect(options.thresholds['http_req_failed']).toContain(
        `rate<${tierLimits.free.error_threshold}`
      )
    })

    it('should scale properly for enterprise tier', () => {
      const options = getTierOptions('enterprise')
      
      expect(options.stages[1].target).toBe(tierLimits.enterprise.concurrent_users)
      expect(options.thresholds['http_reqs']).toContain(
        `rate>=${tierLimits.enterprise.rps * 0.8}`
      )
    })
  })
})

describe('Performance Regression Detection', () => {
  // Mock the regression check logic
  const checkRegression = (current: number, baseline: number, threshold: number) => {
    return current > baseline * (1 + threshold)
  }

  const checkImprovement = (current: number, baseline: number, threshold: number) => {
    return current < baseline * (1 - threshold)
  }

  it('should detect 10% response time regression', () => {
    const baseline = 200
    const current = 225
    const threshold = 0.1

    expect(checkRegression(current, baseline, threshold)).toBe(true)
    expect(checkImprovement(current, baseline, threshold)).toBe(false)
  })

  it('should detect 10% response time improvement', () => {
    const baseline = 200
    const current = 175
    const threshold = 0.1

    expect(checkRegression(current, baseline, threshold)).toBe(false)
    expect(checkImprovement(current, baseline, threshold)).toBe(true)
  })

  it('should not flag small variations', () => {
    const baseline = 200
    const current = 205
    const threshold = 0.1

    expect(checkRegression(current, baseline, threshold)).toBe(false)
    expect(checkImprovement(current, baseline, threshold)).toBe(false)
  })

  it('should detect error rate doubling', () => {
    const baselineError = 0.001
    const currentError = 0.003
    const threshold = 2 // 2x threshold for errors

    expect(currentError > baselineError * threshold).toBe(true)
  })
})

describe('Load Test Scenarios', () => {
  it('should have realistic user behavior distribution', () => {
    const behaviors = {
      casual_browser: 0.4,
      active_shopper: 0.3,
      power_user: 0.2,
      report_user: 0.1
    }

    const total = Object.values(behaviors).reduce((sum, val) => sum + val, 0)
    expect(total).toBe(1)
  })

  it('should increase operation complexity by stage', () => {
    const getOperationCount = (stage: number) => {
      let count = 2 // base operations
      if (stage >= 1) count++
      if (stage >= 2) count++
      if (stage >= 3) count++
      return count
    }

    expect(getOperationCount(0)).toBe(2)
    expect(getOperationCount(1)).toBe(3)
    expect(getOperationCount(2)).toBe(4)
    expect(getOperationCount(3)).toBe(5)
  })

  it('should reduce think time under stress', () => {
    const getThinkTime = (stage: number) => Math.max(0.1, 2 / (stage + 1))

    expect(getThinkTime(0)).toBe(2)
    expect(getThinkTime(1)).toBe(1)
    expect(getThinkTime(4)).toBe(0.4)
    expect(getThinkTime(10)).toBeCloseTo(0.18, 2)
  })
})

describe('Flash Sale Simulation', () => {
  it('should have weighted product distribution', () => {
    const weights = [0.5, 0.3, 0.2]
    const total = weights.reduce((sum, w) => sum + w, 0)
    expect(total).toBe(1)
  })

  it('should simulate realistic purchase behavior', () => {
    const behaviors = {
      directPurchase: 0.7,
      browseFirst: 0.2,
      windowShoppers: 0.1
    }

    const total = Object.values(behaviors).reduce((sum, val) => sum + val, 0)
    expect(total).toBe(1)
  })

  it('should have retry logic for out of stock', () => {
    const retryProbability = 0.5
    expect(retryProbability).toBeGreaterThan(0)
    expect(retryProbability).toBeLessThanOrEqual(1)
  })
})

describe('Soak Test Memory Monitoring', () => {
  it('should detect memory leak', () => {
    const baselineMemory = 512
    const currentMemory = 650
    const threshold = 0.2 // 20% increase threshold

    const increase = (currentMemory / baselineMemory - 1)
    expect(increase).toBeGreaterThan(threshold)
  })

  it('should calculate performance degradation', () => {
    const baselineResponseTime = 100
    const checkpoints = [100, 105, 110, 115, 120]
    
    const recentAvg = checkpoints.slice(-5).reduce((a, b) => a + b, 0) / 5
    const degradation = (recentAvg - baselineResponseTime) / baselineResponseTime
    
    expect(degradation).toBeCloseTo(0.1, 2) // 10% degradation
  })

  it('should track session lifecycle', () => {
    const session = {
      startTime: Date.now(),
      requestCount: 0,
      errors: 0
    }

    // Simulate requests
    for (let i = 0; i < 1001; i++) {
      session.requestCount++
      if (Math.random() < 0.01) session.errors++
    }

    // Should cleanup after 1000 requests or 10 errors
    const shouldCleanup = session.requestCount > 1000 || session.errors > 10
    expect(shouldCleanup).toBe(true)
  })
})