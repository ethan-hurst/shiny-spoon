import { sleep } from 'k6'
import { Rate, Trend, Gauge } from 'k6/metrics'
import { 
  browseProducts, 
  searchProducts, 
  createOrder, 
  generateReport,
  loginUser 
} from '../lib/scenarios.js'
import { weightedRandom, randomSleep } from '../config/base.js'

// Metrics for spike analysis
const errorRate = new Rate('errors')
const spikeResponseTime = new Trend('spike_response_time')
const recoveryTime = new Gauge('recovery_time')
const peakErrorRate = new Gauge('peak_error_rate')
const timeToStabilize = new Gauge('time_to_stabilize')

let spikeStartTime = null
let stabilizationTime = null
let maxErrorRate = 0

export const options = {
  stages: [
    // Normal traffic
    { duration: '30s', target: 50 },    
    { duration: '2m', target: 50 },     
    
    // Sudden spike (10x increase)
    { duration: '10s', target: 500 },   
    { duration: '3m', target: 500 },    
    
    // Return to normal
    { duration: '10s', target: 50 },    
    { duration: '2m', target: 50 },     
    
    // Second spike (20x increase)
    { duration: '10s', target: 1000 },  
    { duration: '2m', target: 1000 },   
    
    // Gradual return
    { duration: '30s', target: 50 },    
    { duration: '2m', target: 50 },     
    
    { duration: '30s', target: 0 },     
  ],
  thresholds: {
    errors: ['rate<0.1'],                       // Overall error rate < 10%
    spike_response_time: ['p(95)<2000'],        // 95% under 2s during spikes
    http_req_duration: ['p(95)<1500'],          // General response time
  },
}

export function setup() {
  console.log('Starting spike test - simulating sudden traffic surges...')
  
  // Create user tokens
  const tokens = {
    regular: [],
    spike: [],
  }
  
  // Regular users
  for (let i = 0; i < 10; i++) {
    const token = loginUser(`regular-${i}@example.com`)
    if (token) tokens.regular.push(token)
  }
  
  // Spike users (simulating flash sale, viral content, etc.)
  for (let i = 0; i < 20; i++) {
    const token = loginUser(`spike-${i}@example.com`)
    if (token) tokens.spike.push(token)
  }
  
  return { 
    tokens, 
    startTime: Date.now(),
    metrics: {
      preSpike: { errors: 0, total: 0 },
      duringSpike: { errors: 0, total: 0 },
      postSpike: { errors: 0, total: 0 },
    }
  }
}

export default function(data) {
  const currentVUs = __VU
  const elapsed = (Date.now() - data.startTime) / 1000
  
  // Determine current phase
  const phase = getPhase(elapsed)
  const isSpike = phase.includes('spike')
  
  // Track spike timing
  if (isSpike && !spikeStartTime) {
    spikeStartTime = Date.now()
    console.log(`Spike started at ${elapsed.toFixed(1)}s with ${currentVUs} VUs`)
  } else if (!isSpike && spikeStartTime && !stabilizationTime) {
    stabilizationTime = Date.now() - spikeStartTime
    timeToStabilize.add(stabilizationTime)
    console.log(`System stabilized after ${(stabilizationTime / 1000).toFixed(1)}s`)
    spikeStartTime = null
  }
  
  // Select user type based on phase
  const tokens = isSpike ? data.tokens.spike : data.tokens.regular
  const token = tokens[Math.floor(Math.random() * tokens.length)]
  
  // Spike behavior - more aggressive during spikes
  const scenarios = isSpike ? [
    { weight: 0.3, fn: () => browseProducts(token) },
    { weight: 0.4, fn: () => searchProducts(token) },
    { weight: 0.3, fn: () => createOrder(token) },    // More orders during spike
  ] : [
    { weight: 0.5, fn: () => browseProducts(token) },
    { weight: 0.3, fn: () => searchProducts(token) },
    { weight: 0.1, fn: () => createOrder(token) },
    { weight: 0.1, fn: () => generateReport(token) },
  ]
  
  const scenario = weightedRandom(scenarios)
  const startTime = Date.now()
  
  try {
    const response = scenario.fn()
    const duration = Date.now() - startTime
    
    // Track spike-specific metrics
    if (isSpike) {
      spikeResponseTime.add(duration)
    }
    
    // Update phase metrics
    const metricKey = isSpike ? 'duringSpike' : 
                     spikeStartTime ? 'postSpike' : 'preSpike'
    data.metrics[metricKey].total++
    
    if (response.status >= 400) {
      errorRate.add(1)
      data.metrics[metricKey].errors++
      
      // Track peak error rate during spikes
      if (isSpike) {
        const currentErrorRate = data.metrics.duringSpike.errors / data.metrics.duringSpike.total
        if (currentErrorRate > maxErrorRate) {
          maxErrorRate = currentErrorRate
          peakErrorRate.add(maxErrorRate)
        }
      }
      
      // Log errors during critical phases
      if (isSpike || phase === 'recovery') {
        console.log(`Error during ${phase}: ${response.status} at ${elapsed.toFixed(1)}s`)
      }
    } else {
      errorRate.add(0)
    }
    
  } catch (error) {
    errorRate.add(1)
    console.error(`Exception during ${phase}:`, error.message)
  }
  
  // Shorter think time during spikes
  const thinkTime = isSpike ? [0.1, 0.5] : [0.5, 2]
  sleep(randomSleep(...thinkTime))
}

function getPhase(elapsed) {
  if (elapsed < 150) return 'normal'
  if (elapsed < 160) return 'spike1_ramp'
  if (elapsed < 340) return 'spike1'
  if (elapsed < 350) return 'recovery1'
  if (elapsed < 470) return 'normal2'
  if (elapsed < 480) return 'spike2_ramp'
  if (elapsed < 600) return 'spike2'
  if (elapsed < 630) return 'recovery2'
  return 'final'
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000
  
  console.log('\n=== Spike Test Summary ===')
  console.log(`Test duration: ${duration.toFixed(2)} seconds`)
  console.log(`Peak error rate during spikes: ${(maxErrorRate * 100).toFixed(2)}%`)
  
  console.log('\nError rates by phase:')
  for (const [phase, metrics] of Object.entries(data.metrics)) {
    if (metrics.total > 0) {
      const errorRate = (metrics.errors / metrics.total * 100).toFixed(2)
      console.log(`  ${phase}: ${errorRate}% (${metrics.errors}/${metrics.total})`)
    }
  }
  
  console.log('\n========================')
}