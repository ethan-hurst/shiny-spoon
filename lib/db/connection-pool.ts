import { Pool, PoolConfig } from 'pg'
import { createClient } from '@supabase/supabase-js'

interface TenantPoolConfig extends PoolConfig {
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

/**
 * Tenant-aware connection pool manager
 * Manages separate connection pools per tenant for better isolation
 */
class TenantAwarePool {
  private pools: Map<string, Pool> = new Map()
  private defaultConfig: TenantPoolConfig = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }

  /**
   * Get or create a connection pool for a tenant
   */
  getPool(tenantId: string, shardKey?: number): Pool {
    const poolKey = shardKey ? `${tenantId}-shard-${shardKey}` : tenantId
    
    if (!this.pools.has(poolKey)) {
      const pool = new Pool({
        ...this.defaultConfig,
        // In production, route to different databases based on shard
        connectionString: this.getConnectionString(shardKey),
        // Add tenant context to all queries
        options: `-c app.tenant_id=${tenantId}`,
      })

      // Monitor pool health
      pool.on('error', (err) => {
        console.error(`Pool error for tenant ${tenantId}:`, err)
        // In production, send to monitoring service
      })

      pool.on('connect', (client) => {
        // Set tenant context on each new connection
        client.query(`SET app.tenant_id = '${tenantId}'`).catch(console.error)
      })

      this.pools.set(poolKey, pool)
    }

    return this.pools.get(poolKey)!
  }

  /**
   * Get connection string based on shard key
   */
  private getConnectionString(shardKey?: number): string {
    // In production, return different connection strings based on shard
    // For now, use read replicas for even shards
    if (shardKey && shardKey % 2 === 0) {
      return process.env.DATABASE_REPLICA_URL || process.env.DATABASE_URL!
    }
    return process.env.DATABASE_URL!
  }

  /**
   * Execute a query with tenant context
   */
  async query(tenantId: string, text: string, params: any[], shardKey?: number) {
    const pool = this.getPool(tenantId, shardKey)
    
    const client = await pool.connect()
    
    try {
      // Ensure tenant context is set
      await client.query(`SET app.tenant_id = '${tenantId}'`)
      const result = await client.query(text, params)
      return result
    } finally {
      client.release()
    }
  }

  /**
   * Get pool statistics
   */
  getStats(tenantId?: string) {
    if (tenantId) {
      const pool = this.pools.get(tenantId)
      return pool ? {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      } : null
    }

    // Return stats for all pools
    const stats: Record<string, any> = {}
    this.pools.forEach((pool, key) => {
      stats[key] = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      }
    })
    return stats
  }

  /**
   * Clean up all pools
   */
  async end() {
    const promises = Array.from(this.pools.values()).map(pool => pool.end())
    await Promise.all(promises)
    this.pools.clear()
  }

  /**
   * Clean up idle connections
   */
  async cleanup() {
    const now = Date.now()
    
    for (const [key, pool] of this.pools.entries()) {
      // Remove pools with no active connections
      if (pool.totalCount === 0 && pool.idleCount === 0) {
        await pool.end()
        this.pools.delete(key)
      }
    }
  }
}

// Export singleton instance
export const tenantPool = new TenantAwarePool()

// Cleanup idle pools periodically
if (typeof window === 'undefined') {
  setInterval(() => {
    tenantPool.cleanup().catch(console.error)
  }, 60000) // Every minute
}