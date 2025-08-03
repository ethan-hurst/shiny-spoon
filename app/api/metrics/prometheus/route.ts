import { NextResponse } from 'next/server'
import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client'
import { createServerClient } from '@/lib/supabase/server'
import { redis } from '@/lib/cache/redis-client'
import { getQueueStats } from '@/lib/queue/distributed-queue'

// Initialize metrics
collectDefaultMetrics({ prefix: 'inventory_' })

// Custom metrics
const httpRequestDuration = new Histogram({
  name: 'inventory_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
})

const httpRequestTotal = new Counter({
  name: 'inventory_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
})

const activeConnections = new Gauge({
  name: 'inventory_db_connections_active',
  help: 'Number of active database connections',
})

const cacheHitRate = new Gauge({
  name: 'inventory_cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['tenant'],
})

const queueSize = new Gauge({
  name: 'inventory_queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'status'],
})

const tenantUsage = new Gauge({
  name: 'inventory_tenant_usage',
  help: 'Tenant resource usage',
  labelNames: ['tenant', 'metric'],
})

// Register metrics
register.registerMetric(httpRequestDuration)
register.registerMetric(httpRequestTotal)
register.registerMetric(activeConnections)
register.registerMetric(cacheHitRate)
register.registerMetric(queueSize)
register.registerMetric(tenantUsage)

/**
 * Prometheus metrics endpoint
 * GET /api/metrics/prometheus
 */
export async function GET(request: Request) {
  try {
    // Verify metrics token
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.METRICS_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Collect custom metrics
    await collectCustomMetrics()

    // Return metrics in Prometheus format
    const metrics = await register.metrics()
    
    return new Response(metrics, {
      headers: {
        'Content-Type': register.contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      { status: 500 }
    )
  }
}

async function collectCustomMetrics() {
  try {
    const supabase = createServerClient()

    // Database connections
    const { data: dbStats } = await supabase.rpc('get_db_stats')
    if (dbStats) {
      activeConnections.set(dbStats.active_connections || 0)
    }

    // Queue statistics
    const queueStats = await getQueueStats()
    if (queueStats) {
      Object.entries(queueStats).forEach(([queueName, stats]) => {
        queueSize.set({ queue: queueName, status: 'waiting' }, stats.waiting)
        queueSize.set({ queue: queueName, status: 'active' }, stats.active)
        queueSize.set({ queue: queueName, status: 'completed' }, stats.completed)
        queueSize.set({ queue: queueName, status: 'failed' }, stats.failed)
      })
    }

    // Get top tenants for detailed metrics
    const { data: tenants } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(10)

    if (tenants) {
      for (const tenant of tenants) {
        // Cache hit rate
        if (redis) {
          const hour = new Date().getHours()
          const hits = await redis.get(`cache:hit:${tenant.id}:${hour}`) || 0
          const misses = await redis.get(`cache:miss:${tenant.id}:${hour}`) || 0
          const total = Number(hits) + Number(misses)
          const hitRate = total > 0 ? (Number(hits) / total) * 100 : 0
          
          cacheHitRate.set({ tenant: tenant.id }, hitRate)
        }

        // Resource usage
        const { data: usage } = await supabase
          .rpc('get_tenant_resource_usage', { org_id: tenant.id })

        if (usage) {
          tenantUsage.set({ tenant: tenant.id, metric: 'storage_gb' }, usage.storage_used_gb || 0)
          tenantUsage.set({ tenant: tenant.id, metric: 'api_calls' }, usage.api_calls_this_hour || 0)
          tenantUsage.set({ tenant: tenant.id, metric: 'active_users' }, usage.active_users || 0)
          tenantUsage.set({ tenant: tenant.id, metric: 'products' }, usage.total_products || 0)
          tenantUsage.set({ tenant: tenant.id, metric: 'orders' }, usage.total_orders || 0)
        }
      }
    }
  } catch (error) {
    console.error('Error collecting custom metrics:', error)
  }
}

// Export middleware to track HTTP metrics
export function trackHttpMetrics(
  method: string,
  route: string,
  statusCode: number,
  duration: number
) {
  httpRequestTotal.inc({ method, route, status_code: statusCode.toString() })
  httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration)
}