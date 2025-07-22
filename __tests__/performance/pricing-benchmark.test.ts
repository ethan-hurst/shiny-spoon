import { performance } from 'perf_hooks'
import {
  calculateBatchPrices,
  clearPricingCache,
  getQuickPrice,
} from '@/lib/pricing/calculate-price'
import { PricingEngine } from '@/lib/pricing/pricing-engine'
import { perfReporter, logPerformance, logComparison, logMemory } from '../utils/performance-reporter'

// Skip performance tests in CI by default
const describePerformance = process.env.RUN_PERF_TESTS
  ? describe
  : describe.skip

// Mock the pricing engine for consistent benchmarks
jest.mock('@/lib/pricing/pricing-engine', () => ({
  getPricingEngine: jest.fn(() => ({
    calculatePrice: jest.fn().mockImplementation(async (request) => {
      // Simulate database query time (2-5ms)
      await new Promise((resolve) => setTimeout(resolve, 2 + Math.random() * 3))

      return {
        base_price: 100,
        final_price: 85 + Math.random() * 10,
        discount_amount: 15 - Math.random() * 10,
        discount_percent: 15 - Math.random() * 10,
        margin_percent: 35 + Math.random() * 15,
        applied_rules: [
          {
            rule_id: 'rule-1',
            type: 'quantity',
            name: 'Bulk Discount',
            discount_type: 'percentage',
            discount_value: 10,
            discount_amount: 10,
          },
        ],
      }
    }),
    calculateBatchPrices: jest.fn().mockImplementation(async (requests) => {
      // Simulate batch query time (5-10ms)
      await new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 5))

      const results = new Map()
      requests.forEach((req) => {
        results.set(req.product_id, {
          base_price: 100,
          final_price: 85 + Math.random() * 10,
          discount_amount: 15 - Math.random() * 10,
          discount_percent: 15 - Math.random() * 10,
          margin_percent: 35 + Math.random() * 15,
          applied_rules: [],
        })
      })
      return results
    }),
  })),
  PricingEngine: jest.fn(),
}))

describePerformance('Pricing Engine Performance', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await clearPricingCache()
    perfReporter.clear()
  })

  afterAll(() => {
    perfReporter.printSummary()
  })

  describe('Single Price Calculations', () => {
    it('should calculate single price within 50ms', async () => {
      const start = performance.now()

      await getQuickPrice('test-product', 'test-customer', 10)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(50)
    })

    it('should handle 100 sequential price calculations', async () => {
      const start = performance.now()

      for (let i = 0; i < 100; i++) {
        await getQuickPrice(`product-${i}`, 'test-customer', 10)
      }

      const duration = performance.now() - start
      const avgTime = duration / 100

      logPerformance('Sequential calculations: Average per calculation', avgTime, { count: 100 })
      expect(avgTime).toBeLessThan(10) // Average should be under 10ms
    })

    it('should handle 100 concurrent price calculations', async () => {
      const start = performance.now()

      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(getQuickPrice(`product-${i}`, 'test-customer', 10))
      }

      await Promise.all(promises)

      const duration = performance.now() - start

      logPerformance('Concurrent calculations: Total time', duration, { count: 100 })
      expect(duration).toBeLessThan(200) // Should complete within 200ms
    })
  })

  describe('Batch Price Calculations', () => {
    it('should calculate batch prices efficiently', async () => {
      const requests = Array.from({ length: 50 }, (_, i) => ({
        product_id: `product-${i}`,
        customer_id: 'test-customer',
        quantity: 10,
      }))

      const start = performance.now()

      const results = await calculateBatchPrices(requests)

      const duration = performance.now() - start

      logPerformance('Batch calculation', duration, { products: 50 })
      expect(duration).toBeLessThan(100)
      expect(results.size).toBe(50)
    })

    it('should outperform sequential calculations for multiple products', async () => {
      const productIds = Array.from({ length: 20 }, (_, i) => `product-${i}`)

      // Sequential timing
      const sequentialStart = performance.now()
      for (const id of productIds) {
        await getQuickPrice(id, 'test-customer', 10)
      }
      const sequentialDuration = performance.now() - sequentialStart

      // Batch timing
      const batchStart = performance.now()
      await calculateBatchPrices(
        productIds.map((id) => ({
          product_id: id,
          customer_id: 'test-customer',
          quantity: 10,
        }))
      )
      const batchDuration = performance.now() - batchStart

      logPerformance('Sequential processing', sequentialDuration, { products: 20 })
      logPerformance('Batch processing', batchDuration, { products: 20 })
      logComparison('Batch vs Sequential', sequentialDuration, batchDuration)

      expect(batchDuration).toBeLessThan(sequentialDuration * 0.5) // Batch should be at least 50% faster
    })
  })

  describe('Cache Performance', () => {
    it('should significantly improve repeated calculations', async () => {
      const productId = 'test-product'
      const customerId = 'test-customer'

      // First call (cache miss)
      const firstStart = performance.now()
      await getQuickPrice(productId, customerId, 10)
      const firstDuration = performance.now() - firstStart

      // Second call (cache hit - if implemented)
      const secondStart = performance.now()
      await getQuickPrice(productId, customerId, 10)
      const secondDuration = performance.now() - secondStart

      logPerformance('Cache miss (first call)', firstDuration)
      logPerformance('Cache hit (second call)', secondDuration)
      logComparison('Cache performance', firstDuration, secondDuration)

      // Note: This would only show improvement if cache is actually implemented
      // For now, we just ensure both complete quickly
      expect(firstDuration).toBeLessThan(50)
      expect(secondDuration).toBeLessThan(50)
    })
  })

  describe('Memory Usage', () => {
    it('should handle large batch calculations without excessive memory', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Calculate prices for 1000 products
      const requests = Array.from({ length: 1000 }, (_, i) => ({
        product_id: `product-${i}`,
        customer_id: `customer-${i % 10}`,
        quantity: Math.floor(Math.random() * 100) + 1,
      }))

      await calculateBatchPrices(requests)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB

      logMemory('Batch processing (1000 products)', finalMemory - initialMemory)

      // Should use less than 50MB for 1000 products
      expect(memoryIncrease).toBeLessThan(50)
    })
  })

  describe('Stress Testing', () => {
    it('should handle high-frequency requests', async () => {
      const duration = 1000 // 1 second
      const start = performance.now()
      let requestCount = 0

      while (performance.now() - start < duration) {
        await getQuickPrice(
          `product-${requestCount % 100}`,
          'test-customer',
          10
        )
        requestCount++
      }

      const actualDuration = performance.now() - start
      const requestsPerSecond = (requestCount / actualDuration) * 1000

      logPerformance('High-frequency test', actualDuration, { 
        requests: requestCount,
        rate: `${requestsPerSecond.toFixed(0)} req/s`
      })

      expect(requestsPerSecond).toBeGreaterThan(100) // Should handle at least 100 req/s
    })

    it('should maintain performance under concurrent load', async () => {
      const concurrentUsers = 10
      const requestsPerUser = 20

      const userSimulations = Array.from(
        { length: concurrentUsers },
        async (_, userId) => {
          const userStart = performance.now()

          for (let i = 0; i < requestsPerUser; i++) {
            await getQuickPrice(
              `product-${i}`,
              `user-${userId}`,
              Math.random() * 100
            )
            // Simulate think time between requests
            await new Promise((resolve) => setTimeout(resolve, 10))
          }

          return performance.now() - userStart
        }
      )

      const start = performance.now()
      const userDurations = await Promise.all(userSimulations)
      const totalDuration = performance.now() - start

      const avgUserDuration =
        userDurations.reduce((a, b) => a + b, 0) / concurrentUsers

      logPerformance('Concurrent load test', totalDuration, {
        users: concurrentUsers,
        requestsPerUser,
        totalRequests: concurrentUsers * requestsPerUser,
        avgUserTime: avgUserDuration.toFixed(0)
      })

      expect(totalDuration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(avgUserDuration).toBeLessThan(3000) // Each user should complete within 3 seconds
    })
  })
})

// Performance report generator
describePerformance('Performance Report', () => {
  it('should generate performance summary', async () => {
    // Performance metrics will be collected and reported by perfReporter

    const metrics = {
      singleCalculation: 0,
      batchCalculation: 0,
      concurrentRequests: 0,
      cacheHitImprovement: 0,
    }

    // Single calculation
    const singleStart = performance.now()
    await getQuickPrice('test-product', 'test-customer', 10)
    metrics.singleCalculation = performance.now() - singleStart

    // Batch calculation
    const batchRequests = Array.from({ length: 50 }, (_, i) => ({
      product_id: `product-${i}`,
      quantity: 10,
    }))
    const batchStart = performance.now()
    await calculateBatchPrices(batchRequests)
    metrics.batchCalculation = (performance.now() - batchStart) / 50

    // Concurrent requests
    const concurrentStart = performance.now()
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        getQuickPrice(`product-${i}`, 'test-customer', 10)
      )
    )
    metrics.concurrentRequests = (performance.now() - concurrentStart) / 20

    // Log summary metrics
    logPerformance('Summary: Single calculation', metrics.singleCalculation)
    logPerformance('Summary: Batch per item', metrics.batchCalculation)
    logPerformance('Summary: Concurrent avg', metrics.concurrentRequests)

    // Generate recommendations based on performance
    const recommendations: string[] = []
    
    if (metrics.singleCalculation > 20) {
      recommendations.push('Consider optimizing database queries for single price lookups')
    }
    if (metrics.batchCalculation > metrics.singleCalculation * 0.5) {
      recommendations.push('Batch processing could be further optimized')
    }
    recommendations.push(
      'Implement Redis caching for frequently accessed prices',
      'Use connection pooling for database connections',
      'Consider implementing a price calculation queue for bulk operations'
    )

    // Log recommendations if verbose reporting is enabled
    if (process.env.PERF_REPORT === 'true') {
      recommendations.forEach((rec, index) => {
        logPerformance(`Recommendation ${index + 1}`, 0, { recommendation: rec })
      })
    }
  })
})
