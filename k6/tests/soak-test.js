import { sleep } from 'k6'
import { Rate, Trend, Gauge, Counter } from 'k6/metrics'
import http from 'k6/http'
import { 
  browseProducts, 
  searchProducts, 
  createOrder, 
  generateReport,
  performBulkOperation,
  loginUser 
} from '../lib/scenarios.js'
import { BASE_URL, getAuthHeaders, weightedRandom, randomSleep } from '../config/base.js'

// Soak test specific metrics
const errorRate = new Rate('errors')
const memoryUsage = new Trend('memory_usage_mb')
const cpuUsage = new Trend('cpu_usage_percent')
const connectionLeaks = new Counter('connection_leaks')
const responseTimeOverTime = new Trend('response_time_progression')
const degradationRate = new Gauge('performance_degradation')

// Baseline metrics for comparison
let baselineResponseTime = null
let baselineMemory = null
let performanceCheckpoints = []

export const options = {
  stages: [
    { duration: '5m', target: 400 },     // Ramp up to cruising altitude
    { duration: '4h', target: 400 },     // Stay at 400 users for 4 hours
    { duration: '5m', target: 0 },       // Ramp down
  ],
  thresholds: {
    errors: ['rate<0.01'],                          // Less than 1% errors
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // Consistent performance
    memory_usage_mb: ['max<2048'],                   // Memory shouldn't exceed 2GB
    connection_leaks: ['count<100'],                 // Minimal connection leaks
  },
  // Extended timeout for long operations
  httpDebug: 'summary',
}

export function setup() {
  console.log('Starting soak test - 4+ hour endurance test...')
  console.log('This test will monitor for memory leaks and performance degradation.')
  
  // Create a diverse set of users
  const tokens = {}
  const userTypes = ['regular', 'power', 'admin']
  
  for (const type of userTypes) {
    tokens[type] = []
    for (let i = 0; i < 10; i++) {
      const token = loginUser(`soak-${type}-${i}@example.com`)
      if (token) tokens[type].push(token)
    }
  }
  
  // Take initial baseline measurements
  const metricsResponse = http.get(`${BASE_URL}/api/metrics`, {
    headers: getAuthHeaders(tokens.admin[0]),
  })
  
  if (metricsResponse.status === 200) {
    const metrics = JSON.parse(metricsResponse.body)
    baselineMemory = metrics.resources?.memory?.heap_size_mb || 0
    console.log(`Baseline memory: ${baselineMemory}MB`)
  }
  
  return { 
    tokens,
    startTime: Date.now(),
    checkpointInterval: 10 * 60 * 1000, // 10 minutes
    lastCheckpoint: Date.now(),
    sessionData: new Map(), // Track long-lived sessions
  }
}

export default function(data) {
  const elapsed = Date.now() - data.startTime
  const currentVU = __VU
  
  // Select user type based on realistic distribution
  const userType = weightedRandom([
    { weight: 0.7, type: 'regular' },
    { weight: 0.2, type: 'power' },
    { weight: 0.1, type: 'admin' },
  ]).type
  
  const tokens = data.tokens[userType]
  const token = tokens[Math.floor(Math.random() * tokens.length)]
  
  // Simulate realistic session behavior
  const sessionId = `${userType}-${currentVU}`
  let session = data.sessionData.get(sessionId)
  
  if (!session) {
    // New session
    session = {
      startTime: Date.now(),
      requestCount: 0,
      errors: 0,
    }
    data.sessionData.set(sessionId, session)
  }
  
  session.requestCount++
  
  // Long-running user scenarios
  const scenarios = getLongRunningScenarios(userType, elapsed)
  const scenario = weightedRandom(scenarios)
  
  const startTime = Date.now()
  
  try {
    const response = scenario.fn(token)
    const duration = Date.now() - startTime
    
    // Track response time progression
    responseTimeOverTime.add(duration, { 
      hour: Math.floor(elapsed / 3600000),
      scenario: scenario.name,
    })
    
    if (response.status >= 400) {
      errorRate.add(1)
      session.errors++
    } else {
      errorRate.add(0)
    }
    
    // Check for connection leaks (timeouts, connection resets)
    if (response.error && response.error.includes('connection')) {
      connectionLeaks.add(1)
    }
    
  } catch (error) {
    errorRate.add(1)
    session.errors++
    
    if (error.message && error.message.includes('connection')) {
      connectionLeaks.add(1)
    }
  }
  
  // Periodic system metrics collection
  if (Date.now() - data.lastCheckpoint > data.checkpointInterval) {
    collectSystemMetrics(token, elapsed, data)
    data.lastCheckpoint = Date.now()
  }
  
  // Session cleanup (simulate logout after extended use)
  if (session.requestCount > 1000 || session.errors > 10) {
    data.sessionData.delete(sessionId)
  }
  
  // Variable think time based on user type
  const thinkTimes = {
    regular: [2, 5],
    power: [1, 3],
    admin: [5, 10],
  }
  
  sleep(randomSleep(...thinkTimes[userType]))
}

function getLongRunningScenarios(userType, elapsed) {
  const hour = Math.floor(elapsed / 3600000)
  
  // Base scenarios available to all
  const scenarios = [
    { weight: 0.3, fn: browseProducts, name: 'browse' },
    { weight: 0.2, fn: searchProducts, name: 'search' },
  ]
  
  // Add scenarios based on user type and time
  if (userType !== 'admin') {
    scenarios.push({ weight: 0.2, fn: createOrder, name: 'order' })
  }
  
  // Increase report generation over time (simulating daily reports)
  if (hour > 0) {
    scenarios.push({ 
      weight: 0.1 + (hour * 0.05), 
      fn: generateReport, 
      name: 'report' 
    })
  }
  
  // Admin and power users do bulk operations
  if (userType === 'admin' || userType === 'power') {
    scenarios.push({ weight: 0.1, fn: performBulkOperation, name: 'bulk' })
  }
  
  // Add stress scenarios in later hours
  if (hour >= 2) {
    scenarios.push({ 
      weight: 0.1, 
      fn: (token) => stressMemoryOperation(token), 
      name: 'memory_stress' 
    })
  }
  
  return scenarios
}

function stressMemoryOperation(token) {
  // Simulate operations that might cause memory leaks
  const responses = []
  
  // Fetch large dataset
  for (let i = 0; i < 5; i++) {
    responses.push(http.get(
      `${BASE_URL}/api/products?limit=100&include=all`,
      { 
        headers: getAuthHeaders(token),
        tags: { name: 'memory-stress' },
      }
    ))
  }
  
  // Return last response
  return responses[responses.length - 1]
}

function collectSystemMetrics(token, elapsed, data) {
  const metricsResponse = http.get(`${BASE_URL}/api/metrics`, {
    headers: getAuthHeaders(token),
    tags: { name: 'metrics-collection' },
  })
  
  if (metricsResponse.status === 200) {
    const metrics = JSON.parse(metricsResponse.body)
    
    // Track memory usage
    const currentMemory = metrics.resources?.memory?.heap_size_mb || 0
    memoryUsage.add(currentMemory)
    
    // Track CPU usage
    const currentCPU = metrics.resources?.cpu?.avg_utilization || 0
    cpuUsage.add(currentCPU * 100)
    
    // Calculate performance degradation
    if (baselineResponseTime && performanceCheckpoints.length > 0) {
      const recentAvg = performanceCheckpoints.slice(-5).reduce((a, b) => a + b, 0) / 5
      const degradation = (recentAvg - baselineResponseTime) / baselineResponseTime
      degradationRate.add(degradation)
    }
    
    // Store checkpoint
    performanceCheckpoints.push(metrics.database?.query_performance?.simple_select?.p95 || 0)
    
    // Set baseline after warmup
    if (!baselineResponseTime && performanceCheckpoints.length === 1) {
      baselineResponseTime = performanceCheckpoints[0]
    }
    
    // Log significant changes
    if (currentMemory > baselineMemory * 1.5) {
      console.log(`Memory increased by ${((currentMemory / baselineMemory - 1) * 100).toFixed(1)}% at ${(elapsed / 3600000).toFixed(1)}h`)
    }
  }
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60
  
  console.log('\n=== Soak Test Summary ===')
  console.log(`Test duration: ${duration.toFixed(2)} minutes`)
  console.log(`Active sessions remaining: ${data.sessionData.size}`)
  
  // Calculate memory leak indicator
  if (baselineMemory && performanceCheckpoints.length > 0) {
    const finalMemory = performanceCheckpoints[performanceCheckpoints.length - 1]
    const memoryIncrease = ((finalMemory / baselineMemory - 1) * 100).toFixed(1)
    console.log(`Memory increase: ${memoryIncrease}%`)
    
    if (parseFloat(memoryIncrease) > 20) {
      console.log('⚠️  WARNING: Potential memory leak detected!')
    }
  }
  
  console.log('\n=======================')
}