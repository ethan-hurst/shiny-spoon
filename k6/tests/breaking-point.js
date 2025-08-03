import { sleep } from 'k6'
import { Rate, Trend, Counter, Gauge } from 'k6/metrics'
import { 
  browseProducts, 
  searchProducts, 
  createOrder, 
  performBulkOperation,
  loginUser 
} from '../lib/scenarios.js'
import { weightedRandom } from '../config/base.js'

// Metrics to track breaking point
const errorRate = new Rate('error_rate')
const responseTime = new Trend('response_time_trend')
const activeVUs = new Gauge('active_vus')
const failureTypes = new Counter('failure_types')
const timeToFirstError = new Gauge('time_to_first_error')
const maxSuccessfulVUs = new Gauge('max_successful_vus')

let firstErrorTime = null
let maxVUsWithoutErrors = 0

export const options = {
  stages: [
    // Aggressive ramp up to find breaking point quickly
    { duration: '1m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '2m', target: 3000 },
    { duration: '2m', target: 4000 },
    { duration: '2m', target: 5000 },
    { duration: '1m', target: 0 },     // Quick ramp down
  ],
  thresholds: {
    // Very relaxed thresholds - we expect failures
    http_req_failed: ['rate<0.5'], // Allow up to 50% failure
    // Don't set response time thresholds - we want to see degradation
  },
  noConnectionReuse: true, // Force new connections to stress the system
  userAgent: 'BreakingPointTest/1.0',
}

export function setup() {
  console.log('Starting breaking point test...')
  console.log('This test will intentionally push the system to failure.')
  
  // Create a pool of tokens for the test
  const tokens = []
  for (let i = 0; i < 20; i++) {
    const token = loginUser(`breaking-test-${i}@example.com`)
    if (token) {
      tokens.push(token)
    }
  }
  
  if (tokens.length === 0) {
    throw new Error('Failed to create any test users')
  }
  
  return { 
    tokens, 
    startTime: Date.now(),
    errorCounts: {},
  }
}

export default function(data) {
  const currentVUs = __VU
  activeVUs.add(currentVUs)
  
  // Use a random token
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)]
  
  // High-intensity operations to stress the system
  const operations = [
    { weight: 0.2, fn: () => browseProducts(token), name: 'browse' },
    { weight: 0.2, fn: () => searchProducts(token), name: 'search' },
    { weight: 0.4, fn: () => createOrder(token), name: 'order' },
    { weight: 0.2, fn: () => performBulkOperation(token), name: 'bulk' },
  ]
  
  const operation = weightedRandom(operations)
  const startTime = Date.now()
  
  try {
    const response = operation.fn()
    const duration = Date.now() - startTime
    
    responseTime.add(duration)
    
    if (response.status >= 400) {
      errorRate.add(1)
      
      // Track first error time
      if (!firstErrorTime) {
        firstErrorTime = Date.now() - data.startTime
        timeToFirstError.add(firstErrorTime)
        console.log(`First error occurred at ${firstErrorTime}ms with ${currentVUs} VUs`)
      }
      
      // Categorize failures
      let failureType = 'unknown'
      if (response.status === 429) {
        failureType = 'rate_limit'
      } else if (response.status === 503) {
        failureType = 'service_unavailable'
      } else if (response.status === 504) {
        failureType = 'gateway_timeout'
      } else if (response.status >= 500) {
        failureType = 'server_error'
      } else if (response.status === 408) {
        failureType = 'request_timeout'
      }
      
      failureTypes.add(1, { type: failureType, operation: operation.name })
      
      // Log significant errors
      if (!data.errorCounts[failureType]) {
        data.errorCounts[failureType] = 0
        console.log(`New error type detected: ${failureType} at ${currentVUs} VUs`)
      }
      data.errorCounts[failureType]++
      
    } else {
      errorRate.add(0)
      
      // Track max successful VUs
      if (currentVUs > maxVUsWithoutErrors && !firstErrorTime) {
        maxVUsWithoutErrors = currentVUs
        maxSuccessfulVUs.add(maxVUsWithoutErrors)
      }
    }
    
  } catch (error) {
    errorRate.add(1)
    failureTypes.add(1, { type: 'exception', operation: operation.name })
    
    if (!firstErrorTime) {
      firstErrorTime = Date.now() - data.startTime
      timeToFirstError.add(firstErrorTime)
      console.log(`First exception at ${firstErrorTime}ms: ${error.message}`)
    }
  }
  
  // Minimal think time to maximize load
  sleep(Math.random() * 0.5)
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000
  
  console.log('\n=== Breaking Point Test Summary ===')
  console.log(`Test duration: ${duration.toFixed(2)} seconds`)
  console.log(`Time to first error: ${firstErrorTime ? firstErrorTime + 'ms' : 'No errors detected'}`)
  console.log(`Max VUs without errors: ${maxVUsWithoutErrors}`)
  console.log('\nError distribution:')
  
  for (const [type, count] of Object.entries(data.errorCounts)) {
    console.log(`  ${type}: ${count}`)
  }
  
  console.log('\n=================================')
}