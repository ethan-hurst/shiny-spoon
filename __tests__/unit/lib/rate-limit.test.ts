import {
  rateLimiters,
  checkRateLimit,
  withRateLimit
} from '@/lib/rate-limit'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Mock dependencies
jest.mock('@upstash/ratelimit')
jest.mock('@upstash/redis')

// Mock environment variables
const mockEnv = {
  UPSTASH_REDIS_REST_URL: 'https://mock-redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'mock-token'
}

describe('Rate Limit', () => {
  let mockRedis: jest.Mocked<Redis>
  let mockRatelimit: jest.Mocked<Ratelimit>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Save original environment
    originalEnv = process.env

    // Mock Redis constructor
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn()
    } as any

    ;(Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis)

    // Mock Ratelimit constructor and methods
    mockRatelimit = {
      limit: jest.fn(),
      reset: jest.fn(),
      blockUntilReady: jest.fn(),
      getRemaining: jest.fn()
    } as any

    ;(Ratelimit as jest.MockedClass<typeof Ratelimit>).mockImplementation(() => mockRatelimit)

    // Mock static methods
    ;(Ratelimit.slidingWindow as jest.Mock) = jest.fn().mockReturnValue('sliding-window-limiter')

    // Mock console.error to avoid noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  describe('Redis initialization', () => {
    it('should create Redis instance when environment variables are provided', () => {
      // Set environment variables BEFORE importing
      process.env.UPSTASH_REDIS_REST_URL = mockEnv.UPSTASH_REDIS_REST_URL
      process.env.UPSTASH_REDIS_REST_TOKEN = mockEnv.UPSTASH_REDIS_REST_TOKEN

      // Clear module cache and re-import to trigger initialization
      jest.resetModules()
      require('@/lib/rate-limit')

      expect(Redis).toHaveBeenCalledWith({
        url: mockEnv.UPSTASH_REDIS_REST_URL,
        token: mockEnv.UPSTASH_REDIS_REST_TOKEN
      })
    })

    it('should not create Redis instance when environment variables are missing', () => {
      // Remove environment variables
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      // Clear the constructor call count
      ;(Redis as jest.MockedClass<typeof Redis>).mockClear()

      // Re-import to trigger initialization
      jest.resetModules()
      const { rateLimiters } = require('@/lib/rate-limit')

      expect(Redis).not.toHaveBeenCalled()
      expect(rateLimiters.api).toBeNull()
      expect(rateLimiters.orderCreation).toBeNull()
    })
  })

  describe('Rate limiter configurations', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = mockEnv.UPSTASH_REDIS_REST_URL
      process.env.UPSTASH_REDIS_REST_TOKEN = mockEnv.UPSTASH_REDIS_REST_TOKEN
    })

    it('should configure order creation rate limiter correctly', () => {
      jest.resetModules()
      require('@/lib/rate-limit')

      expect(Ratelimit).toHaveBeenCalledWith({
        redis: mockRedis,
        limiter: 'sliding-window-limiter',
        analytics: true,
        prefix: 'rl:order:create'
      })

      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(10, '1 m')
    })

    it('should configure API rate limiter correctly', () => {
      jest.resetModules()
      require('@/lib/rate-limit')

      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(100, '1 m')
      expect(Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'rl:api'
        })
      )
    })

    it('should configure bulk operations rate limiter correctly', () => {
      jest.resetModules()
      require('@/lib/rate-limit')

      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(5, '1 h')
      expect(Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'rl:bulk'
        })
      )
    })

    it('should configure export rate limiter correctly', () => {
      jest.resetModules()
      require('@/lib/rate-limit')

      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(20, '1 h')
      expect(Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'rl:export'
        })
      )
    })

    it('should configure auth rate limiter correctly', () => {
      jest.resetModules()
      require('@/lib/rate-limit')

      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(5, '15 m')
      expect(Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'rl:auth'
        })
      )
    })

    it('should enable analytics for all rate limiters', () => {
      jest.resetModules()
      require('@/lib/rate-limit')

      // Check that all Ratelimit instances were created with analytics: true
      const calls = (Ratelimit as jest.MockedClass<typeof Ratelimit>).mock.calls
      calls.forEach(call => {
        expect(call[0]).toEqual(
          expect.objectContaining({
            analytics: true
          })
        )
      })
    })
  })

  describe('checkRateLimit', () => {
    it('should return success when limiter is null', async () => {
      const result = await checkRateLimit(null, 'test-identifier')

      expect(result).toEqual({ success: true })
    })

    it('should return rate limit result when limiter is provided', async () => {
      const mockResult = {
        success: true,
        limit: 100,
        remaining: 95,
        reset: Date.now() + 60000
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)

      const result = await checkRateLimit(mockRatelimit, 'test-identifier')

      expect(mockRatelimit.limit).toHaveBeenCalledWith('test-identifier')
      expect(result).toEqual(mockResult)
    })

    it('should handle rate limit exceeded', async () => {
      const mockResult = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 30000
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)

      const result = await checkRateLimit(mockRatelimit, 'test-identifier')

      expect(result).toEqual(mockResult)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle different identifier formats', async () => {
      const mockResult = {
        success: true,
        limit: 10,
        remaining: 5,
        reset: Date.now() + 60000
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)

      // Test with IP address
      await checkRateLimit(mockRatelimit, '192.168.1.1')
      expect(mockRatelimit.limit).toHaveBeenCalledWith('192.168.1.1')

      // Test with user ID
      await checkRateLimit(mockRatelimit, 'user:123')
      expect(mockRatelimit.limit).toHaveBeenCalledWith('user:123')

      // Test with complex identifier
      await checkRateLimit(mockRatelimit, 'org:456:user:789')
      expect(mockRatelimit.limit).toHaveBeenCalledWith('org:456:user:789')
    })

    it('should handle Redis connection errors gracefully', async () => {
      const error = new Error('Redis connection failed')
      mockRatelimit.limit.mockRejectedValue(error)

      await expect(checkRateLimit(mockRatelimit, 'test-identifier')).rejects.toThrow(error)
    })
  })

  describe('withRateLimit', () => {
    const mockAction = jest.fn()
    const mockGetIdentifier = jest.fn()

    beforeEach(() => {
      mockAction.mockClear()
      mockGetIdentifier.mockClear()
    })

    it('should execute action when rate limit allows', async () => {
      const mockResult = {
        success: true,
        limit: 100,
        remaining: 95,
        reset: Date.now() + 60000
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)
      mockGetIdentifier.mockReturnValue('test-identifier')
      mockAction.mockResolvedValue('action-result')

      const wrappedAction = await withRateLimit(mockAction, mockRatelimit, mockGetIdentifier)
      const result = await wrappedAction('test-arg1', 'test-arg2')

      expect(mockGetIdentifier).toHaveBeenCalledWith('test-arg1', 'test-arg2')
      expect(mockRatelimit.limit).toHaveBeenCalledWith('test-identifier')
      expect(mockAction).toHaveBeenCalledWith('test-arg1', 'test-arg2')
      expect(result).toBe('action-result')
    })

    it('should throw error when rate limit is exceeded', async () => {
      const resetTime = Date.now() + 30000
      const mockResult = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: resetTime
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)
      mockGetIdentifier.mockReturnValue('test-identifier')

      const wrappedAction = await withRateLimit(mockAction, mockRatelimit, mockGetIdentifier)

      await expect(wrappedAction('test-arg')).rejects.toThrow(/Rate limit exceeded/)
      expect(mockAction).not.toHaveBeenCalled()
    })

    it('should include rate limit details in error message', async () => {
      const resetTime = Date.now() + 45000 // 45 seconds from now
      const mockResult = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: resetTime
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)
      mockGetIdentifier.mockReturnValue('test-identifier')

      const wrappedAction = await withRateLimit(mockAction, mockRatelimit, mockGetIdentifier)

      await expect(wrappedAction('test-arg')).rejects.toThrow(
        expect.stringMatching(/Rate limit exceeded.*45.*seconds.*Limit: 10.*Remaining: 0/)
      )
    })

    it('should work when limiter is null', async () => {
      mockGetIdentifier.mockReturnValue('test-identifier')
      mockAction.mockResolvedValue('action-result')

      const wrappedAction = await withRateLimit(mockAction, null, mockGetIdentifier)
      const result = await wrappedAction('test-arg')

      expect(mockAction).toHaveBeenCalledWith('test-arg')
      expect(result).toBe('action-result')
    })

    it('should preserve action signature and return type', async () => {
      const typedAction = async (a: string, b: number): Promise<string> => {
        return `${a}-${b}`
      }

      const getIdentifier = (a: string, b: number): string => `${a}:${b}`

      mockRatelimit.limit.mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 95,
        reset: Date.now() + 60000
      })

      const wrappedAction = await withRateLimit(typedAction, mockRatelimit, getIdentifier)
      const result = await wrappedAction('test', 123)

      expect(result).toBe('test-123')
    })

    it('should handle synchronous actions', async () => {
      const syncAction = (x: number): number => x * 2
      const getIdentifier = (x: number): string => `sync:${x}`

      mockRatelimit.limit.mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 95,
        reset: Date.now() + 60000
      })

      const wrappedAction = await withRateLimit(syncAction, mockRatelimit, getIdentifier)
      const result = await wrappedAction(5)

      expect(result).toBe(10)
    })

    it('should handle actions that throw errors', async () => {
      const errorAction = async (): Promise<void> => {
        throw new Error('Action failed')
      }

      const getIdentifier = (): string => 'error-test'

      mockRatelimit.limit.mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 95,
        reset: Date.now() + 60000
      })

      const wrappedAction = await withRateLimit(errorAction, mockRatelimit, getIdentifier)

      await expect(wrappedAction()).rejects.toThrow('Action failed')
    })

    it('should calculate wait time correctly', async () => {
      const resetTime = Date.now() + 120000 // 2 minutes from now
      const mockResult = {
        success: false,
        limit: 5,
        remaining: 0,
        reset: resetTime
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)
      mockGetIdentifier.mockReturnValue('test-identifier')

      const wrappedAction = await withRateLimit(mockAction, mockRatelimit, mockGetIdentifier)

      await expect(wrappedAction('test-arg')).rejects.toThrow(
        expect.stringMatching(/120.*seconds/)
      )
    })

    it('should format reset time in error message', async () => {
      const resetTime = Date.now() + 60000
      const expectedResetDate = new Date(resetTime)
      const mockResult = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: resetTime
      }

      mockRatelimit.limit.mockResolvedValue(mockResult)
      mockGetIdentifier.mockReturnValue('test-identifier')

      const wrappedAction = await withRateLimit(mockAction, mockRatelimit, mockGetIdentifier)

      await expect(wrappedAction('test-arg')).rejects.toThrow(
        expect.stringMatching(new RegExp(`Reset: ${expectedResetDate.toLocaleTimeString()}`))
      )
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = mockEnv.UPSTASH_REDIS_REST_URL
      process.env.UPSTASH_REDIS_REST_TOKEN = mockEnv.UPSTASH_REDIS_REST_TOKEN
    })

    it('should work with real rate limiter configuration', async () => {
      jest.resetModules()
      const { rateLimiters, checkRateLimit } = require('@/lib/rate-limit')

      // Mock successful rate limit check
      mockRatelimit.limit.mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000
      })

      const result = await checkRateLimit(rateLimiters.api, '192.168.1.1')

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(99)
    })

    it('should handle complete rate limiting workflow', async () => {
      const testAction = jest.fn().mockResolvedValue('success')
      const getIdentifier = (userId: string): string => `user:${userId}`

      // Simulate rate limit allowing request
      mockRatelimit.limit.mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 5,
        reset: Date.now() + 60000
      })

      const wrappedAction = await withRateLimit(testAction, mockRatelimit, getIdentifier)
      const result = await wrappedAction('user123')

      expect(result).toBe('success')
      expect(testAction).toHaveBeenCalledWith('user123')
    })

    it('should handle fallback when Redis is unavailable', async () => {
      // Simulate no Redis configuration
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      jest.resetModules()
      const { rateLimiters, checkRateLimit, withRateLimit } = require('@/lib/rate-limit')

      // All rate limiters should be null
      expect(rateLimiters.api).toBeNull()
      expect(rateLimiters.orderCreation).toBeNull()

      // checkRateLimit should allow all requests
      const checkResult = await checkRateLimit(rateLimiters.api, 'test-id')
      expect(checkResult.success).toBe(true)

      // withRateLimit should execute actions without restriction
      const testAction = jest.fn().mockResolvedValue('no-redis-result')
      const getIdentifier = (): string => 'test'

      const wrappedAction = await withRateLimit(testAction, rateLimiters.api, getIdentifier)
      const result = await wrappedAction()

      expect(result).toBe('no-redis-result')
      expect(testAction).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle malformed reset time', async () => {
      const mockResult = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: undefined // Malformed reset time
      }

      mockRatelimit.limit.mockResolvedValue(mockResult as any)
      mockGetIdentifier.mockReturnValue('test-identifier')

      const mockAction = jest.fn()
      const wrappedAction = await withRateLimit(mockAction, mockRatelimit, mockGetIdentifier)

      // Should still throw error but handle undefined reset gracefully
      await expect(wrappedAction('test')).rejects.toThrow(/Rate limit exceeded/)
    })

    it('should handle identifier extraction errors', async () => {
      const errorAction = jest.fn()
      const errorGetIdentifier = jest.fn().mockImplementation(() => {
        throw new Error('Identifier extraction failed')
      })

      const wrappedAction = await withRateLimit(errorAction, mockRatelimit, errorGetIdentifier)

      await expect(wrappedAction('test')).rejects.toThrow('Identifier extraction failed')
      expect(mockRatelimit.limit).not.toHaveBeenCalled()
      expect(errorAction).not.toHaveBeenCalled()
    })
  })
})