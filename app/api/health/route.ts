import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sentryService } from '@/lib/monitoring/sentry-service'

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  services: {
    database: HealthStatus
    redis?: HealthStatus
    externalApis: HealthStatus
  }
  metrics: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
    }
  }
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // Get basic system info
    const uptime = process.uptime()
    const version = process.env.APP_VERSION || '1.0.0'
    const timestamp = new Date().toISOString()

    // Check database health
    const dbHealth = await checkDatabaseHealth()
    
    // Check Redis health (if configured)
    const redisHealth = await checkRedisHealth()
    
    // Check external APIs
    const externalApisHealth = await checkExternalApisHealth()
    
    // Get system metrics
    const metrics = await getSystemMetrics()
    
    // Determine overall status
    const overallStatus = determineOverallStatus([dbHealth, redisHealth, externalApisHealth])
    
    const healthCheck: HealthCheckResult = {
      status: overallStatus,
      timestamp,
      version,
      uptime,
      services: {
        database: dbHealth,
        ...(redisHealth && { redis: redisHealth }),
        externalApis: externalApisHealth,
      },
      metrics,
    }

    // Add breadcrumb for monitoring
    sentryService.addBreadcrumb(
      'Health check performed',
      'health',
      'info',
      { status: overallStatus, responseTime: Date.now() - startTime }
    )

    return NextResponse.json(healthCheck, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503,
    })
  } catch (error) {
    sentryService.captureException(error as Error, {
      action: 'health_check',
    })
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    )
  }
}

async function checkDatabaseHealth(): Promise<HealthStatus> {
  const startTime = Date.now()
  
  try {
    const supabase = createClient()
    
    // Simple query to test database connectivity
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
    
    const responseTime = Date.now() - startTime
    
    if (error) {
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message,
      }
    }
    
    return {
      status: 'healthy',
      responseTime,
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: (error as Error).message,
    }
  }
}

async function checkRedisHealth(): Promise<HealthStatus | null> {
  const startTime = Date.now()
  
  try {
    // Check if Redis is configured
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return null
    }
    
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    
    // Test Redis connection
    await redis.ping()
    
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      responseTime,
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: (error as Error).message,
    }
  }
}

async function checkExternalApisHealth(): Promise<HealthStatus> {
  const startTime = Date.now()
  const checks = []
  
  try {
    // Check Supabase Auth (if configured)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      checks.push(
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`)
          .then(response => response.ok)
          .catch(() => false)
      )
    }
    
    // Check Stripe (if configured)
    if (process.env.STRIPE_SECRET_KEY) {
      checks.push(
        fetch('https://api.stripe.com/v1/account', {
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
        })
          .then(response => response.ok)
          .catch(() => false)
      )
    }
    
    // Wait for all checks to complete
    const results = await Promise.allSettled(checks)
    const successfulChecks = results.filter(
      result => result.status === 'fulfilled' && result.value
    ).length
    
    const responseTime = Date.now() - startTime
    
    if (checks.length === 0) {
      return {
        status: 'healthy',
        responseTime,
      }
    }
    
    const successRate = successfulChecks / checks.length
    
    if (successRate === 1) {
      return {
        status: 'healthy',
        responseTime,
      }
    } else if (successRate >= 0.5) {
      return {
        status: 'degraded',
        responseTime,
        error: `${Math.round((1 - successRate) * 100)}% of external APIs are down`,
      }
    } else {
      return {
        status: 'unhealthy',
        responseTime,
        error: 'Multiple external APIs are down',
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: (error as Error).message,
    }
  }
}

async function getSystemMetrics() {
  const memUsage = process.memoryUsage()
  const totalMemory = memUsage.heapTotal + memUsage.external
  const usedMemory = memUsage.heapUsed + memUsage.external
  
  return {
    memory: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
    cpu: {
      usage: process.cpuUsage ? process.cpuUsage().user / 1000000 : 0, // seconds
    },
  }
}

function determineOverallStatus(statuses: (HealthStatus | null)[]): 'healthy' | 'degraded' | 'unhealthy' {
  const validStatuses = statuses.filter(Boolean) as HealthStatus[]
  
  if (validStatuses.length === 0) {
    return 'healthy' // No services to check
  }
  
  const unhealthyCount = validStatuses.filter(s => s.status === 'unhealthy').length
  const degradedCount = validStatuses.filter(s => s.status === 'degraded').length
  
  if (unhealthyCount > 0) {
    return 'unhealthy'
  } else if (degradedCount > 0) {
    return 'degraded'
  } else {
    return 'healthy'
  }
}
