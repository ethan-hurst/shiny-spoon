// Mock the external dependencies first
jest.mock('@upstash/ratelimit', () => {
  const MockRatelimit = jest.fn().mockImplementation(() => ({
    limit: jest.fn(),
  }))
  
  // Add static method to the mock class
  MockRatelimit.slidingWindow = jest.fn().mockReturnValue('sliding-window-limiter')
  
  return {
    Ratelimit: MockRatelimit,
  }
})

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}))

import { checkRateLimit, withRateLimit, rateLimiters } from '@/lib/rate-limit'

describe('Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  describe('checkRateLimit', () => {
    it('should return success when limiter is null', async () => {
      const result = await checkRateLimit(null, 'test-identifier')
      
      expect(result).toEqual({
        success: true,
      })
    })

    it('should call limiter.limit with correct identifier', async () => {
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 60000,
        }),
      }

      const result = await checkRateLimit(mockLimiter, 'test-user-123')

      expect(mockLimiter.limit).toHaveBeenCalledWith('test-user-123')
      expect(result).toEqual({
        success: true,
        limit: 10,
        remaining: 9,
        reset: expect.any(Number),
      })
    })

    it('should handle rate limit exceeded', async () => {
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: false,
          limit: 10,
          remaining: 0,
          reset: Date.now() + 30000,
        }),
      }

      const result = await checkRateLimit(mockLimiter, 'test-user-123')

      expect(result).toEqual({
        success: false,
        limit: 10,
        remaining: 0,
        reset: expect.any(Number),
      })
    })

    it('should handle limiter errors gracefully', async () => {
      const mockLimiter = {
        limit: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      }

      await expect(checkRateLimit(mockLimiter, 'test-user-123')).rejects.toThrow('Redis connection failed')
    })
  })

  describe('withRateLimit', () => {
    it('should call original action when rate limit succeeds', async () => {
      const mockAction = jest.fn().mockResolvedValue('action-result')
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 60000,
        }),
      }

      const getIdentifier = jest.fn().mockReturnValue('user-123')
      const wrappedAction = await withRateLimit(mockAction, mockLimiter, getIdentifier)

      const result = await wrappedAction('arg1', 'arg2')

      expect(getIdentifier).toHaveBeenCalledWith('arg1', 'arg2')
      expect(mockAction).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result).toBe('action-result')
    })

    it('should throw error when rate limit is exceeded', async () => {
      const mockAction = jest.fn()
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: false,
          limit: 10,
          remaining: 0,
          reset: Date.now() + 30000,
        }),
      }

      const getIdentifier = jest.fn().mockReturnValue('user-123')
      const wrappedAction = await withRateLimit(mockAction, mockLimiter, getIdentifier)

      await expect(wrappedAction('arg1', 'arg2')).rejects.toThrow(/Rate limit exceeded/)
      expect(mockAction).not.toHaveBeenCalled()
    })

    it('should include correct error message with wait time', async () => {
      const mockAction = jest.fn()
      const resetTime = Date.now() + 45000 // 45 seconds from now
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: false,
          limit: 5,
          remaining: 0,
          reset: resetTime,
        }),
      }

      const getIdentifier = jest.fn().mockReturnValue('user-123')
      const wrappedAction = await withRateLimit(mockAction, mockLimiter, getIdentifier)

      await expect(wrappedAction('arg1', 'arg2')).rejects.toThrow(/Please try again in \d+ seconds/)
    })

    it('should work with null limiter', async () => {
      const mockAction = jest.fn().mockResolvedValue('action-result')
      const getIdentifier = jest.fn().mockReturnValue('user-123')
      const wrappedAction = await withRateLimit(mockAction, null, getIdentifier)

      const result = await wrappedAction('arg1', 'arg2')

      expect(result).toBe('action-result')
      expect(mockAction).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  describe('rateLimiters configuration', () => {
    it('should create rate limiters when Redis is configured', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

      // Re-import to get fresh rate limiters
      jest.resetModules()
      const { rateLimiters } = require('@/lib/rate-limit')

      expect(rateLimiters.orderCreation).toBeDefined()
      expect(rateLimiters.api).toBeDefined()
      expect(rateLimiters.bulkOperations).toBeDefined()
      expect(rateLimiters.export).toBeDefined()
      expect(rateLimiters.auth).toBeDefined()
    })

    it('should set rate limiters to null when Redis is not configured', () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      // Re-import to get fresh rate limiters
      jest.resetModules()
      const { rateLimiters } = require('@/lib/rate-limit')

      expect(rateLimiters.orderCreation).toBeNull()
      expect(rateLimiters.api).toBeNull()
      expect(rateLimiters.bulkOperations).toBeNull()
      expect(rateLimiters.export).toBeNull()
      expect(rateLimiters.auth).toBeNull()
    })
  })

  describe('Type safety', () => {
    it('should maintain proper TypeScript types', async () => {
      const mockAction = jest.fn().mockResolvedValue('result')
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 60000,
        }),
      }

      const getIdentifier = (arg1: string, arg2: number) => `${arg1}-${arg2}`
      const wrappedAction = await withRateLimit(mockAction, mockLimiter, getIdentifier)

      // This should compile without TypeScript errors
      const result: string = await wrappedAction('test', 123)
      expect(result).toBe('result')
    })
  })
})