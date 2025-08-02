import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { tenantCache } from '@/lib/cache/tenant-cache'
import { tenantPool } from '@/lib/db/connection-pool'
import { getQueueStats } from '@/lib/queue/distributed-queue'
import { getRateLimitInfo } from '@/lib/rate-limit/distributed-limiter'

interface Metrics {
  database: DatabaseMetrics
  cache: CacheMetrics
  tenant: TenantMetrics
  queue?: QueueMetrics
  rateLimit?: RateLimitMetrics
  timestamp: string
}

interface DatabaseMetrics {
  activeConnections?: number
  idleConnections?: number
  waitingClients?: number
  maxConnections?: number
  poolStats?: any
}

interface CacheMetrics {
  hitRate: string
  operations: {
    hits: number
    misses: number
    sets: number
    invalidations: number
  }
}

interface TenantMetrics {
  resourceUsage?: {
    storage_used_gb: number
    api_calls_this_hour: number
    active_users: number
    total_products: number
    total_orders: number
  }
  recentActivity?: Record<string, number>
}

interface QueueMetrics {
  [key: string]: {
    waiting: number
    active: number
    completed: number
    failed: number
  }
}

interface RateLimitMetrics {
  [key: string]: {
    limit: number
    remaining: number
    reset: number
  } | null
}

/**
 * Metrics endpoint for monitoring
 * GET /api/metrics
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can view metrics
    if (user.role !== 'admin' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Collect metrics in parallel
    const [dbMetrics, cacheMetrics, tenantMetrics, queueMetrics, rateLimitMetrics] = await Promise.all([
      getDatabaseMetrics(),
      getCacheMetrics(user.organizationId),
      getTenantMetrics(user.organizationId),
      getQueueMetrics(),
      getRateLimitMetrics(user.organizationId),
    ])

    const metrics: Metrics = {
      database: dbMetrics,
      cache: cacheMetrics,
      tenant: tenantMetrics,
      timestamp: new Date().toISOString(),
    }

    // Add optional metrics if available
    if (queueMetrics) {
      metrics.queue = queueMetrics
    }

    if (rateLimitMetrics) {
      metrics.rateLimit = rateLimitMetrics
    }

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'private, max-age=10', // Cache for 10 seconds
      },
    })
  } catch (error) {
    console.error('Metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

/**
 * Get database metrics
 */
async function getDatabaseMetrics(): Promise<DatabaseMetrics> {
  try {
    const supabase = createServerClient()
    
    // Try to get database stats
    const { data: stats, error } = await supabase.rpc('get_db_stats')
    
    if (error) {
      console.error('Failed to get database stats:', error)
      return {}
    }

    // Get connection pool stats if available
    const poolStats = tenantPool.getStats()

    return {
      activeConnections: stats?.active_connections || 0,
      idleConnections: stats?.idle_connections || 0,
      waitingClients: stats?.waiting_clients || 0,
      maxConnections: stats?.max_connections || 100,
      poolStats,
    }
  } catch (error) {
    console.error('Database metrics error:', error)
    return {}
  }
}

/**
 * Get cache metrics for a tenant
 */
async function getCacheMetrics(tenantId: string): Promise<CacheMetrics> {
  try {
    const stats = await tenantCache.getStats(tenantId)
    
    return {
      hitRate: (stats.hitRate * 100).toFixed(2) + '%',
      operations: {
        hits: stats.hits,
        misses: stats.misses,
        sets: stats.sets,
        invalidations: stats.invalidations,
      },
    }
  } catch (error) {
    console.error('Cache metrics error:', error)
    return {
      hitRate: '0%',
      operations: {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
      },
    }
  }
}

/**
 * Get tenant-specific metrics
 */
async function getTenantMetrics(tenantId: string): Promise<TenantMetrics> {
  try {
    const supabase = createServerClient()
    
    // Get resource usage
    const { data: resourceUsage, error: resourceError } = await supabase
      .rpc('get_tenant_resource_usage', { org_id: tenantId })

    if (resourceError) {
      console.error('Failed to get resource usage:', resourceError)
    }

    // Get recent activity metrics
    const { data: usage, error: usageError } = await supabase
      .from('tenant_usage')
      .select('metric_name, metric_value')
      .eq('organization_id', tenantId)
      .gte('measured_at', new Date(Date.now() - 3600000).toISOString()) // Last hour

    if (usageError) {
      console.error('Failed to get tenant usage:', usageError)
    }

    // Aggregate usage metrics
    const recentActivity: Record<string, number> = {}
    usage?.forEach(u => {
      recentActivity[u.metric_name] = (recentActivity[u.metric_name] || 0) + Number(u.metric_value)
    })

    return {
      resourceUsage: resourceUsage || undefined,
      recentActivity: Object.keys(recentActivity).length > 0 ? recentActivity : undefined,
    }
  } catch (error) {
    console.error('Tenant metrics error:', error)
    return {}
  }
}

/**
 * Get queue metrics
 */
async function getQueueMetrics(): Promise<QueueMetrics | undefined> {
  try {
    const stats = await getQueueStats()
    return stats || undefined
  } catch (error) {
    console.error('Queue metrics error:', error)
    return undefined
  }
}

/**
 * Get rate limit metrics for a tenant
 */
async function getRateLimitMetrics(tenantId: string): Promise<RateLimitMetrics | undefined> {
  try {
    const operations = ['api', 'auth', 'export', 'bulk', 'ai'] as const
    const metrics: RateLimitMetrics = {}

    for (const op of operations) {
      metrics[op] = await getRateLimitInfo(tenantId, op)
    }

    return metrics
  } catch (error) {
    console.error('Rate limit metrics error:', error)
    return undefined
  }
}