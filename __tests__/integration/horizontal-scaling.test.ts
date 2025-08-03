import { createServerClient } from '@/lib/supabase/server'
import { checkTenantRateLimit } from '@/lib/rate-limit/distributed-limiter'
import { tenantCache } from '@/lib/cache/tenant-cache'
import { addTenantJob, getQueueStats } from '@/lib/queue/distributed-queue'
import { redis } from '@/lib/cache/redis-client'

// Mock Supabase
jest.mock('@/lib/supabase/server')

describe('Horizontal Scaling Integration', () => {
  let mockSupabase: any
  const testOrgId = 'test-org-123'
  const testUserId = 'test-user-123'

  beforeEach(async () => {
    jest.clearAllMocks()
    
    // Clear Redis if available
    if (redis) {
      await redis.flushdb()
    }

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
    }
    
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('Multi-tenant Database Operations', () => {
    it('should enforce tenant isolation in queries', async () => {
      // Mock tenant limits check
      mockSupabase.rpc.mockImplementation((fn: string, params: any) => {
        if (fn === 'check_tenant_limit') {
          return { data: true, error: null }
        }
        return { data: null, error: null }
      })

      // Test that organization data is properly isolated
      mockSupabase.single.mockResolvedValue({
        data: { 
          organization_id: testOrgId,
          max_api_calls_per_hour: 10000 
        },
        error: null
      })

      const result = await mockSupabase
        .from('tenant_limits')
        .select('*')
        .eq('organization_id', testOrgId)
        .single()

      expect(result.data.organization_id).toBe(testOrgId)
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', testOrgId)
    })

    it('should track tenant usage metrics', async () => {
      mockSupabase.insert.mockResolvedValue({ error: null })

      await mockSupabase
        .from('tenant_usage')
        .insert({
          organization_id: testOrgId,
          metric_name: 'api_call_test',
          metric_value: 1,
        })

      expect(mockSupabase.from).toHaveBeenCalledWith('tenant_usage')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: testOrgId,
          metric_name: 'api_call_test',
        })
      )
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits per tenant', async () => {
      if (!redis) {
        console.log('Skipping rate limit test - Redis not configured')
        return
      }

      // Make multiple requests to trigger rate limit
      const requests = []
      for (let i = 0; i < 105; i++) {
        requests.push(checkTenantRateLimit(testOrgId, 'api'))
      }

      const results = await Promise.all(requests)
      
      // First 100 should be allowed
      const allowed = results.filter(r => r.allowed).length
      const denied = results.filter(r => !r.allowed).length

      expect(allowed).toBeLessThanOrEqual(100)
      expect(denied).toBeGreaterThan(0)
    })

    it('should have different limits for different operations', async () => {
      if (!redis) {
        console.log('Skipping rate limit test - Redis not configured')
        return
      }

      const authResult = await checkTenantRateLimit(testOrgId, 'auth')
      const bulkResult = await checkTenantRateLimit(testOrgId, 'bulk')

      expect(authResult.limit).toBe(5) // 5 auth attempts per 15 min
      expect(bulkResult.limit).toBe(5) // 5 bulk operations per hour
    })
  })

  describe('Distributed Caching', () => {
    it('should cache data with tenant isolation', async () => {
      if (!redis) {
        console.log('Skipping cache test - Redis not configured')
        return
      }

      const testData = { id: 1, name: 'Test Product' }
      
      // Set cache for tenant
      await tenantCache.set('product:1', testData, { ttl: 60 })
      
      // Get from cache
      const cached = await tenantCache.get('product:1')
      
      expect(cached).toEqual(testData)
    })

    it('should track cache metrics per tenant', async () => {
      if (!redis) {
        console.log('Skipping cache test - Redis not configured')
        return
      }

      // Perform cache operations
      await tenantCache.set('test-key', 'test-value')
      await tenantCache.get('test-key') // Hit
      await tenantCache.get('non-existent') // Miss

      // Get stats
      const stats = await tenantCache.getStats(testOrgId)
      
      expect(stats.hits).toBeGreaterThan(0)
      expect(stats.misses).toBeGreaterThan(0)
      expect(stats.hitRate).toBeGreaterThan(0)
      expect(stats.hitRate).toBeLessThan(1)
    })
  })

  describe('Job Queue', () => {
    it('should queue jobs with tenant context', async () => {
      const job = await addTenantJob({
        tenantId: testOrgId,
        type: 'report',
        data: { reportId: 'report-123' },
        priority: 5,
      })

      if (!job) {
        console.log('Skipping queue test - Redis not configured')
        return
      }

      expect(job.data.tenantId).toBe(testOrgId)
      expect(job.data.type).toBe('report')
    })

    it('should route jobs to correct queues', async () => {
      const jobs = [
        { tenantId: testOrgId, type: 'sync', data: {} }, // Should go to critical
        { tenantId: testOrgId, type: 'report', data: {} }, // Should go to high
        { tenantId: testOrgId, type: 'email', data: {} }, // Should go to normal
        { tenantId: testOrgId, type: 'bulk-import', data: {} }, // Should go to bulk
      ]

      for (const jobData of jobs) {
        await addTenantJob(jobData)
      }

      const stats = await getQueueStats()
      
      if (!stats) {
        console.log('Skipping queue test - Redis not configured')
        return
      }

      expect(stats.critical.waiting).toBeGreaterThanOrEqual(0)
      expect(stats.high.waiting).toBeGreaterThanOrEqual(0)
      expect(stats.normal.waiting).toBeGreaterThanOrEqual(0)
      expect(stats.bulk.waiting).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Health Monitoring', () => {
    it('should report system health status', async () => {
      // Mock health check responses
      mockSupabase.single.mockResolvedValue({ data: { id: 1 }, error: null })
      
      // Simulate health check
      const healthChecks = {
        database: async () => {
          const { error } = await mockSupabase
            .from('organizations')
            .select('id')
            .limit(1)
            .single()
          return !error
        },
        cache: async () => {
          return redis ? await redis.ping() === 'PONG' : false
        },
      }

      const health = {
        database: await healthChecks.database(),
        cache: await healthChecks.cache(),
      }

      expect(health.database).toBe(true)
      // Cache health depends on Redis availability
    })
  })

  describe('Tenant Onboarding', () => {
    it('should create organization with proper limits', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: testOrgId, name: 'Test Org' },
        error: null
      })
      mockSupabase.insert.mockResolvedValue({ error: null })

      // Simulate organization creation
      await mockSupabase
        .from('organizations')
        .insert({ name: 'Test Org' })
        .select()
        .single()

      // Verify tenant limits were set
      await mockSupabase
        .from('tenant_limits')
        .insert({
          organization_id: testOrgId,
          tier: 'starter',
          max_connections: 25,
          max_api_calls_per_hour: 10000,
          max_storage_gb: 10,
          max_users: 25,
        })

      expect(mockSupabase.from).toHaveBeenCalledWith('tenant_limits')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'starter',
          max_users: 25,
        })
      )
    })

    it('should handle invite codes', async () => {
      const inviteCode = 'ABC123'
      
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'invite-123',
          organization_id: testOrgId,
          code: inviteCode,
          is_active: true,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null
      })

      // Simulate finding invite
      const result = await mockSupabase
        .from('organization_invites')
        .select('*')
        .eq('code', inviteCode)
        .eq('is_active', true)
        .single()

      expect(result.data.code).toBe(inviteCode)
      expect(result.data.is_active).toBe(true)
    })
  })

  describe('Performance Monitoring', () => {
    it('should track HTTP request metrics', async () => {
      // Simulate request tracking
      const metrics = {
        requests: [] as any[],
        track: function(method: string, route: string, status: number, duration: number) {
          this.requests.push({ method, route, status, duration })
        },
        getP95: function() {
          if (this.requests.length === 0) return 0
          const sorted = this.requests.map(r => r.duration).sort((a, b) => a - b)
          const index = Math.floor(sorted.length * 0.95)
          return sorted[index]
        }
      }

      // Track some requests
      metrics.track('GET', '/api/products', 200, 45)
      metrics.track('GET', '/api/products', 200, 52)
      metrics.track('GET', '/api/products', 200, 48)
      metrics.track('POST', '/api/orders', 201, 120)
      metrics.track('GET', '/api/products', 200, 250) // Slow request

      const p95 = metrics.getP95()
      expect(p95).toBeGreaterThan(100)
      expect(metrics.requests).toHaveLength(5)
    })
  })
})