import { sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { 
  browseProducts, 
  searchProducts, 
  createOrder, 
  generateReport,
  performBulkOperation,
  loginUser 
} from '../lib/scenarios.js'
import { baseConfig, weightedRandom, randomSleep } from '../config/base.js'

// Custom metrics
const errorRate = new Rate('errors')
const orderSuccessRate = new Rate('order_success')
const searchLatency = new Trend('search_latency')
const reportGenerationTime = new Trend('report_generation_time')

export const options = {
  ...baseConfig,
  stages: [
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Ramp up to 100 users
    { duration: '20m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 200 },  // Spike to 200 users
    { duration: '10m', target: 200 }, // Stay at 200 users
    { duration: '10m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    ...baseConfig.thresholds,
    errors: ['rate<0.05'],                    // Custom error rate below 5%
    order_success: ['rate>0.95'],             // 95% of orders should succeed
    search_latency: ['p(95)<1000'],           // 95% of searches under 1s
    report_generation_time: ['p(95)<10000'],  // 95% of reports under 10s
  },
}

export function setup() {
  console.log('Setting up load test...')
  
  // Login users for different tiers
  const tokens = {
    free: loginUser('free-tier@example.com'),
    starter: loginUser('starter-tier@example.com'),
    professional: loginUser('professional-tier@example.com'),
    enterprise: loginUser('enterprise-tier@example.com'),
  }
  
  // Verify all tokens
  for (const [tier, token] of Object.entries(tokens)) {
    if (!token) {
      throw new Error(`Failed to authenticate ${tier} user`)
    }
  }
  
  return { tokens }
}

export default function(data) {
  // Select tier based on realistic distribution
  const tierDistribution = [
    { weight: 0.5, tier: 'free' },
    { weight: 0.3, tier: 'starter' },
    { weight: 0.15, tier: 'professional' },
    { weight: 0.05, tier: 'enterprise' },
  ]
  
  const { tier } = weightedRandom(tierDistribution)
  const token = data.tokens[tier]
  
  // Define user behavior patterns
  const behaviors = {
    casual_browser: {
      weight: 0.4,
      actions: [
        { weight: 0.7, fn: () => browseProducts(token) },
        { weight: 0.3, fn: () => searchProducts(token) },
      ],
      thinkTime: [2, 5],
    },
    active_shopper: {
      weight: 0.3,
      actions: [
        { weight: 0.3, fn: () => browseProducts(token) },
        { weight: 0.4, fn: () => searchProducts(token) },
        { weight: 0.3, fn: () => createOrder(token) },
      ],
      thinkTime: [1, 3],
    },
    power_user: {
      weight: 0.2,
      actions: [
        { weight: 0.2, fn: () => browseProducts(token) },
        { weight: 0.2, fn: () => searchProducts(token) },
        { weight: 0.3, fn: () => createOrder(token) },
        { weight: 0.2, fn: () => generateReport(token) },
        { weight: 0.1, fn: () => performBulkOperation(token) },
      ],
      thinkTime: [0.5, 2],
    },
    report_user: {
      weight: 0.1,
      actions: [
        { weight: 0.3, fn: () => browseProducts(token) },
        { weight: 0.7, fn: () => generateReport(token) },
      ],
      thinkTime: [5, 10],
    },
  }
  
  // Select behavior pattern
  const behaviorList = Object.entries(behaviors).map(([name, config]) => ({
    name,
    ...config,
  }))
  
  const behavior = weightedRandom(behaviorList)
  const action = weightedRandom(behavior.actions)
  
  try {
    const response = action.fn()
    
    // Track metrics
    if (response.status >= 400) {
      errorRate.add(1)
    } else {
      errorRate.add(0)
    }
    
    // Track specific metrics
    if (response.url && response.url.includes('/search')) {
      searchLatency.add(response.timings.duration)
    }
    
    if (response.url && response.url.includes('/reports')) {
      reportGenerationTime.add(response.timings.duration)
    }
    
    if (response.url && response.url.includes('/orders') && response.request.method === 'POST') {
      orderSuccessRate.add(response.status === 201 ? 1 : 0)
    }
    
  } catch (error) {
    console.error(`Error in ${behavior.name} behavior:`, error)
    errorRate.add(1)
  }
  
  // Think time between actions
  sleep(randomSleep(...behavior.thinkTime))
}

export function teardown(data) {
  console.log('Load test completed')
  
  // Could add cleanup logic here if needed
}