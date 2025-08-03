import { sleep } from 'k6'
import { Rate } from 'k6/metrics'
import { 
  browseProducts, 
  searchProducts, 
  createOrder, 
  generateReport,
  loginUser 
} from '../lib/scenarios.js'
import { weightedRandom, randomSleep } from '../config/base.js'

const errorRate = new Rate('errors')

export const options = {
  vus: 5,              // 5 virtual users
  duration: '2m',      // Run for 2 minutes
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
}

export function setup() {
  console.log('Setting up smoke test...')
  
  // Login as a test user
  const token = loginUser('test@example.com')
  
  if (!token) {
    throw new Error('Failed to authenticate test user')
  }
  
  return { token }
}

export default function(data) {
  const scenarios = [
    { weight: 0.4, fn: () => browseProducts(data.token) },
    { weight: 0.3, fn: () => searchProducts(data.token) },
    { weight: 0.2, fn: () => createOrder(data.token) },
    { weight: 0.1, fn: () => generateReport(data.token) },
  ]
  
  const scenario = weightedRandom(scenarios)
  
  try {
    const response = scenario.fn()
    
    if (response.status >= 400) {
      errorRate.add(1)
    } else {
      errorRate.add(0)
    }
  } catch (error) {
    console.error('Scenario error:', error)
    errorRate.add(1)
  }
  
  sleep(randomSleep(0.5, 2))
}

export function teardown(data) {
  console.log('Smoke test completed')
}