import {
  checkTenantRateLimit,
  rateLimitMiddleware,
  addRateLimitHeaders,
  getRateLimitInfo,
  resetRateLimit,
  rateLimiters,
} from '@/lib/rate-limit/distributed-limiter'
import { createServerClient } from '@/lib/supabase/server'

// Mock dependencies
jest.mock('@upstash/ratelimit')
jest.mock('@upstash/redis')
jest.mock('@/lib/supabase/server')

describe('Distributed Rate Limiter', () => {
  let mockSupabase: any
  let mockRateLimiter: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
    }
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock rate limiter
    mockRateLimiter = {
      limit: jest.fn(),
    }

    // Mock rate limiters if they exist
    if (rateLimiters) {
      Object.keys(rateLimiters).forEach(key => {
        ;(rateLimiters as any)[key] = mockRateLimiter
      })
    }
  })

  describe('checkTenantRateLimit', () => {
    it('should allow request when under limit', async () => {
      mockRateLimiter.limit.mockResolvedValue({
        success: true,
        limit: 100,
        reset: Date.now() + 60000,
        remaining: 99,
      })

      const result = await checkTenantRateLimit('tenant-123', 'api')

      expect(result).toEqual({
        allowed: true,
        reset: expect.any(Number),
        remaining: 99,
        limit: 100,
      })
      expect(mockRateLimiter.limit).toHaveBeenCalledWith('tenant-123:api')
    })

    it('should deny request when rate limit exceeded', async () => {
      mockRateLimiter.limit.mockResolvedValue({
        success: false,
        limit: 100,
        reset: Date.now() + 60000,
        remaining: 0,
      })

      const result = await checkTenantRateLimit('tenant-123', 'api')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      
      // Should track rate limit event
      expect(mockSupabase.from).toHaveBeenCalledWith('tenant_usage')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        organization_id: 'tenant-123',
        metric_name: 'rate_limit_exceeded_api',
        metric_value: 1,
      })
    })

    it('should handle missing rate limiters', async () => {
      // Simulate no rate limiters configured
      const originalRateLimiters = rateLimiters
      ;(global as any).rateLimiters = null

      const result = await checkTenantRateLimit('tenant-123', 'api')

      expect(result).toEqual({
        allowed: true,
        reset: 0,
        remaining: 999,
        limit: 999,
      })

      ;(global as any).rateLimiters = originalRateLimiters
    })

    it('should use different limits for different operations', async () => {
      mockRateLimiter.limit.mockResolvedValue({
        success: true,
        limit: 5,
        reset: Date.now() + 900000, // 15 minutes
        remaining: 4,
      })

      await checkTenantRateLimit('tenant-123', 'auth')

      expect(mockRateLimiter.limit).toHaveBeenCalledWith('tenant-123:auth')
    })
  })

  describe('rateLimitMiddleware', () => {
    it('should return null when request is allowed', async () => {
      mockRateLimiter.limit.mockResolvedValue({
        success: true,
        limit: 100,
        reset: Date.now() + 60000,
        remaining: 99,
      })

      const request = new Request('https://example.com/api/test')
      const result = await rateLimitMiddleware(request, 'tenant-123', 'api')

      expect(result).toBeNull()
    })

    it('should return 429 response when rate limit exceeded', async () => {
      const resetTime = Date.now() + 60000
      mockRateLimiter.limit.mockResolvedValue({
        success: false,
        limit: 100,
        reset: resetTime,
        remaining: 0,
      })

      const request = new Request('https://example.com/api/test')
      const result = await rateLimitMiddleware(request, 'tenant-123', 'api')

      expect(result).not.toBeNull()
      expect(result?.status).toBe(429)
      expect(result?.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(result?.headers.get('X-RateLimit-Reset')).toBe(resetTime.toString())
      expect(result?.headers.get('Retry-After')).toBeTruthy()
    })
  })

  describe('addRateLimitHeaders', () => {
    it('should add rate limit headers to response', () => {
      const originalResponse = new Response('Success', { status: 200 })
      const rateLimitInfo = {
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
      }

      const newResponse = addRateLimitHeaders(originalResponse, rateLimitInfo)

      expect(newResponse.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(newResponse.headers.get('X-RateLimit-Remaining')).toBe('99')
      expect(newResponse.headers.get('X-RateLimit-Reset')).toBe(rateLimitInfo.reset.toString())
    })

    it('should preserve original response properties', async () => {
      const originalBody = 'Original response body'
      const originalResponse = new Response(originalBody, {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'text/plain' },
      })

      const newResponse = addRateLimitHeaders(originalResponse, {
        limit: 100,
        remaining: 99,
        reset: Date.now(),
      })

      expect(newResponse.status).toBe(201)
      expect(newResponse.statusText).toBe('Created')
      expect(newResponse.headers.get('Content-Type')).toBe('text/plain')
      expect(await newResponse.text()).toBe(originalBody)
    })
  })

  describe('getRateLimitInfo', () => {
    it('should return rate limit info for a tenant', async () => {
      mockRateLimiter.limit.mockResolvedValue({
        success: true,
        limit: 100,
        reset: Date.now() + 60000,
        remaining: 99,
      })

      const result = await getRateLimitInfo('tenant-123', 'api')

      expect(result).toEqual({
        limit: 100,
        remaining: 99,
        reset: expect.any(Number),
      })
    })

    it('should return null when rate limiters not configured', async () => {
      const originalRateLimiters = rateLimiters
      ;(global as any).rateLimiters = null

      const result = await getRateLimitInfo('tenant-123', 'api')

      expect(result).toBeNull()

      ;(global as any).rateLimiters = originalRateLimiters
    })

    it('should handle errors gracefully', async () => {
      mockRateLimiter.limit.mockRejectedValue(new Error('Redis error'))

      const result = await getRateLimitInfo('tenant-123', 'api')

      expect(result).toBeNull()
    })
  })

  describe('resetRateLimit', () => {
    it('should reset rate limit for a tenant', async () => {
      const mockRedis = {
        del: jest.fn().mockResolvedValue(1),
      }
      
      // Mock the Redis instance
      const Redis = require('@upstash/redis').Redis
      Redis.mockImplementation(() => mockRedis)

      // Reinitialize to use mocked Redis
      jest.resetModules()
      const { resetRateLimit: resetFn } = require('@/lib/rate-limit/distributed-limiter')

      const result = await resetFn('tenant-123', 'api')

      expect(result).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledWith('rl:tenant-123:api')
    })

    it('should return false when Redis not configured', async () => {
      // Mock no Redis
      const Redis = require('@upstash/redis').Redis
      Redis.mockImplementation(() => null)

      jest.resetModules()
      const { resetRateLimit: resetFn } = require('@/lib/rate-limit/distributed-limiter')

      const result = await resetFn('tenant-123', 'api')

      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      const mockRedis = {
        del: jest.fn().mockRejectedValue(new Error('Redis error')),
      }
      
      const Redis = require('@upstash/redis').Redis
      Redis.mockImplementation(() => mockRedis)

      jest.resetModules()
      const { resetRateLimit: resetFn } = require('@/lib/rate-limit/distributed-limiter')

      const result = await resetFn('tenant-123', 'api')

      expect(result).toBe(false)
    })
  })
})