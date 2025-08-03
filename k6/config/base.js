export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const baseConfig = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],      // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],         // Error rate must be below 10%
    http_req_receiving: ['p(95)<100'],     // 95% of response time receiving below 100ms
    http_req_sending: ['p(95)<100'],       // 95% of request sending below 100ms
    http_req_waiting: ['p(95)<400'],       // 95% of waiting time below 400ms
    iterations: ['rate>10'],               // Must maintain at least 10 iterations/s
  },
}

// Common headers for authenticated requests
export function getAuthHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// Helper function for weighted random selection
export function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const item of items) {
    random -= item.weight
    if (random <= 0) {
      return item
    }
  }
  
  return items[items.length - 1]
}

// Helper function for random sleep between requests
export function randomSleep(min = 1, max = 5) {
  return Math.random() * (max - min) + min
}

// Performance metric tags for different operations
export const tags = {
  browse: { name: 'browse-products' },
  search: { name: 'search-products' },
  order: { name: 'create-order' },
  report: { name: 'generate-report' },
  bulk: { name: 'bulk-operation' },
}

// Response validation helpers
export function validateResponse(response, expectedStatus = 200) {
  return {
    'status is correct': (r) => r.status === expectedStatus,
    'response has body': (r) => r.body && r.body.length > 0,
    'response time OK': (r) => r.timings.duration < 1000,
    'no errors': (r) => !r.error,
  }
}

// Extract metrics from response for custom tracking
export function extractMetrics(response) {
  const headers = response.headers
  return {
    serverTime: headers['X-Server-Time'] || null,
    cacheStatus: headers['X-Cache-Status'] || 'MISS',
    rateLimitRemaining: headers['X-RateLimit-Remaining'] || null,
  }
}