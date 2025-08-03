import { sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { 
  browseProducts, 
  searchProducts, 
  createOrder, 
  generateReport,
  performBulkOperation,
  loginUser 
} from '../lib/scenarios.js'
import { weightedRandom, randomSleep } from '../config/base.js'

// Custom metrics for stress monitoring
const errorRate = new Rate('errors')
const successRate = new Rate('success_rate')
const failuresByType = new Counter('failures_by_type')
const responseTimeByStage = new Trend('response_time_by_stage')

export const options = {
  stages: [
    // Gradual ramp up to find breaking point
    { duration: '2m', target: 100 },    // Warm up
    { duration: '5m', target: 100 },    // Baseline
    { duration: '2m', target: 200 },    // 2x load
    { duration: '5m', target: 200 },    
    { duration: '2m', target: 300 },    // 3x load
    { duration: '5m', target: 300 },    
    { duration: '2m', target: 400 },    // 4x load
    { duration: '5m', target: 400 },    
    { duration: '2m', target: 500 },    // 5x load
    { duration: '5m', target: 500 },    
    { duration: '10m', target: 0 },     // Recovery
  ],
  thresholds: {
    // Relaxed thresholds for stress testing
    http_req_duration: ['p(95)<2000'], // Allow up to 2s
    http_req_failed: ['rate<0.2'],     // Allow up to 20% errors
    errors: ['rate<0.2'],              
  },
}

export function setup() {
  console.log('Starting stress test - finding system breaking point...')
  
  // Create test users for different load levels
  const tokens = {}
  const tiers = ['free', 'starter', 'professional']
  
  for (const tier of tiers) {
    // Create multiple users per tier for load distribution
    tokens[tier] = []
    for (let i = 0; i < 5; i++) {
      const token = loginUser(`stress-${tier}-${i}@example.com`)
      if (token) {
        tokens[tier].push(token)
      }
    }
  }
  
  return { tokens, startTime: Date.now() }
}

export default function(data) {
  const currentStage = getCurrentStage()
  const tier = selectTierByStage(currentStage)
  const tokens = data.tokens[tier]
  
  if (!tokens || tokens.length === 0) {
    console.error(`No tokens available for tier: ${tier}`)
    return
  }
  
  // Select a random token from the tier
  const token = tokens[Math.floor(Math.random() * tokens.length)]
  
  // Increase operation intensity based on stage
  const operations = getOperationsByStage(currentStage)
  const operation = weightedRandom(operations)
  
  const startTime = Date.now()
  
  try {
    const response = operation.fn(token)
    const duration = Date.now() - startTime
    
    // Track metrics
    responseTimeByStage.add(duration, { stage: currentStage })
    
    if (response.status >= 400) {
      errorRate.add(1)
      successRate.add(0)
      failuresByType.add(1, { 
        type: response.status === 429 ? 'rate_limit' : 
              response.status >= 500 ? 'server_error' : 
              'client_error',
        stage: currentStage
      })
      
      // Log errors at higher stages
      if (currentStage >= 3) {
        console.log(`Error at stage ${currentStage}: ${response.status} - ${response.url}`)
      }
    } else {
      errorRate.add(0)
      successRate.add(1)
    }
    
  } catch (error) {
    console.error(`Operation failed at stage ${currentStage}:`, error.message)
    errorRate.add(1)
    successRate.add(0)
    failuresByType.add(1, { type: 'exception', stage: currentStage })
  }
  
  // Reduce think time as load increases
  const thinkTime = Math.max(0.1, 2 / (currentStage + 1))
  sleep(randomSleep(thinkTime / 2, thinkTime))
}

function getCurrentStage() {
  const elapsed = (__VU - 1) * 1000 // Rough approximation
  const stageThresholds = [
    0,      // Stage 0: 0-2m (100 users)
    420,    // Stage 1: 7-9m (200 users)
    840,    // Stage 2: 14-16m (300 users)
    1260,   // Stage 3: 21-23m (400 users)
    1680,   // Stage 4: 28-30m (500 users)
  ]
  
  for (let i = stageThresholds.length - 1; i >= 0; i--) {
    if (elapsed >= stageThresholds[i]) {
      return i
    }
  }
  
  return 0
}

function selectTierByStage(stage) {
  // Use higher tiers at higher stages
  if (stage >= 4) return 'professional'
  if (stage >= 2) return 'starter'
  return 'free'
}

function getOperationsByStage(stage) {
  // Increase complexity of operations as load increases
  const baseOperations = [
    { weight: 0.3, fn: browseProducts },
    { weight: 0.2, fn: searchProducts },
  ]
  
  if (stage >= 1) {
    baseOperations.push({ weight: 0.2, fn: createOrder })
  }
  
  if (stage >= 2) {
    baseOperations.push({ weight: 0.2, fn: generateReport })
  }
  
  if (stage >= 3) {
    baseOperations.push({ weight: 0.1, fn: performBulkOperation })
  }
  
  // Normalize weights
  const totalWeight = baseOperations.reduce((sum, op) => sum + op.weight, 0)
  return baseOperations.map(op => ({
    ...op,
    weight: op.weight / totalWeight
  }))
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60
  console.log(`Stress test completed after ${duration.toFixed(2)} minutes`)
  
  // Summary would be in the k6 output
}