import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { redis } from '@/lib/cache/redis-client'
import { getQueueStats } from '@/lib/queue/distributed-queue'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: CheckResult
    cache: CheckResult
    queue: CheckResult
    storage: CheckResult
  }
  timestamp: string
  version: string
  uptime: number
}

interface CheckResult {
  status: 'ok' | 'error'
  latency?: number
  error?: string
  details?: any
}

/**
 * Health check endpoint for monitoring
 * GET /api/health
 */
export async function GET() {
  const startTime = process.hrtime()
  
  const health: HealthCheck = {
    status: 'healthy',
    checks: {
      database: { status: 'ok' },
      cache: { status: 'ok' },
      queue: { status: 'ok' },
      storage: { status: 'ok' },
    },
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
  }

  // Check database
  try {
    const start = Date.now()
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
      throw error
    }
    
    health.checks.database = {
      status: 'ok',
      latency: Date.now() - start,
    }
  } catch (error) {
    health.status = 'unhealthy'
    health.checks.database = {
      status: 'error',
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Check cache
  try {
    const start = Date.now()
    if (redis) {
      await redis.ping()
      health.checks.cache = {
        status: 'ok',
        latency: Date.now() - start,
      }
    } else {
      // Redis not configured - mark as degraded but not unhealthy
      health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
      health.checks.cache = {
        status: 'error',
        error: 'Cache not configured',
      }
    }
  } catch (error) {
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
    health.checks.cache = {
      status: 'error',
      error: 'Cache connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Check queue system
  try {
    const start = Date.now()
    const queueStats = await getQueueStats()
    
    if (queueStats) {
      health.checks.queue = {
        status: 'ok',
        latency: Date.now() - start,
        details: queueStats,
      }
    } else {
      // Queue not configured - mark as degraded
      health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
      health.checks.queue = {
        status: 'error',
        error: 'Queue system not configured',
      }
    }
  } catch (error) {
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
    health.checks.queue = {
      status: 'error',
      error: 'Queue system unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Check storage (Supabase Storage)
  try {
    const start = Date.now()
    const supabase = createServerClient()
    const { data, error } = await supabase.storage.listBuckets()
    
    if (error) throw error
    
    health.checks.storage = {
      status: 'ok',
      latency: Date.now() - start,
      details: {
        buckets: data?.length || 0,
      },
    }
  } catch (error) {
    // Storage errors are not critical
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
    health.checks.storage = {
      status: 'error',
      error: 'Storage service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Calculate total request time
  const [seconds, nanoseconds] = process.hrtime(startTime)
  const totalTime = seconds * 1000 + nanoseconds / 1000000 // Convert to milliseconds

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503

  return NextResponse.json(
    {
      ...health,
      responseTime: Math.round(totalTime),
    },
    { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}

/**
 * Readiness check - more strict than health
 * HEAD /api/health
 */
export async function HEAD() {
  try {
    // Quick checks only - fail fast
    const supabase = createServerClient()
    
    const checks = [
      // Database check
      supabase.from('organizations').select('id').limit(1).single(),
      // Redis check if configured
      redis ? redis.ping() : Promise.resolve(),
    ]
    
    await Promise.all(checks)
    
    return new Response(null, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    return new Response(null, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }
}
