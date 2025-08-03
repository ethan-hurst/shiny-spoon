import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Mock dependencies before importing the module
let mockRedis: any
let mockRatelimit: any

jest.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: jest.fn(() => mockRedis),
  },
}))

jest.mock('@upstash/ratelimit', () => {
  const MockRatelimit = jest.fn(() => mockRatelimit) as any
  MockRatelimit.slidingWindow = jest.fn(() => 'sliding-window-limiter')
  return {
    Ratelimit: MockRatelimit,
  }
})

describe('Ratelimiter', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock instances
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
    }

    mockRatelimit = {
      limit: jest.fn(),
      reset: jest.fn(),
      blockUntilReady: jest.fn(),
      getRemaining: jest.fn(),
    }

    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    // Reset environment variables
    delete process.env.UPSTASH_REDIS_REST_URL

    // Clear module cache to ensure fresh import
    jest.resetModules()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.UPSTASH_REDIS_REST_URL
  })

  describe('initialization with Redis environment', () => {
    it('should initialize rate limiter when UPSTASH_REDIS_REST_URL is set', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Import the module to trigger initialization
      const { ratelimitConfig } = require('@/lib/ratelimiter')

      expect(require('@upstash/redis').Redis.fromEnv).toHaveBeenCalled()
      expect(
        require('@upstash/ratelimit').Ratelimit.slidingWindow
      ).toHaveBeenCalledWith(5, '10 s')
      expect(require('@upstash/ratelimit').Ratelimit).toHaveBeenCalledWith({
        redis: mockRedis,
        limiter: 'sliding-window-limiter',
        analytics: true,
        enableProtection: true,
      })

      expect(ratelimitConfig.enabled).toBe(true)
      expect(ratelimitConfig.ratelimit).toBe(mockRatelimit)
    })

    it('should not initialize rate limiter when UPSTASH_REDIS_REST_URL is not set', () => {
      // Remove environment variable
      delete process.env.UPSTASH_REDIS_REST_URL

      // Import the module to trigger initialization
      const { ratelimitConfig } = require('@/lib/ratelimiter')

      expect(require('@upstash/redis').Redis.fromEnv).not.toHaveBeenCalled()
      expect(require('@upstash/ratelimit').Ratelimit).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Environment variable UPSTASH_REDIS_REST_URL is not set.'
      )

      expect(ratelimitConfig.enabled).toBe(false)
      expect(ratelimitConfig.ratelimit).toBeNull()
    })

    it('should log error message when environment variable is missing', () => {
      // Ensure environment variable is not set
      delete process.env.UPSTASH_REDIS_REST_URL

      // Clear module cache and import
      jest.resetModules()
      require('@/lib/ratelimiter')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Environment variable UPSTASH_REDIS_REST_URL is not set.'
      )
    })

    it('should handle empty environment variable', () => {
      // Set empty environment variable
      process.env.UPSTASH_REDIS_REST_URL = ''

      // Clear module cache and import
      jest.resetModules()
      const { ratelimitConfig } = require('@/lib/ratelimiter')

      expect(require('@upstash/redis').Redis.fromEnv).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Environment variable UPSTASH_REDIS_REST_URL is not set.'
      )
      expect(ratelimitConfig.enabled).toBe(false)
      expect(ratelimitConfig.ratelimit).toBeNull()
    })
  })

  describe('rate limiter configuration', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'
    })

    it('should configure sliding window with correct parameters', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Clear module cache and import
      jest.resetModules()
      require('@/lib/ratelimiter')

      expect(
        require('@upstash/ratelimit').Ratelimit.slidingWindow
      ).toHaveBeenCalledWith(5, '10 s')
    })

    it('should enable analytics', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Clear module cache and import
      jest.resetModules()
      require('@/lib/ratelimiter')

      expect(require('@upstash/ratelimit').Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          analytics: true,
        })
      )
    })

    it('should enable protection', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Clear module cache and import
      jest.resetModules()
      require('@/lib/ratelimiter')

      expect(require('@upstash/ratelimit').Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          enableProtection: true,
        })
      )
    })

    it('should use Redis instance from environment', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Clear module cache and import
      jest.resetModules()
      require('@/lib/ratelimiter')

      expect(require('@upstash/redis').Redis.fromEnv).toHaveBeenCalled()
      expect(require('@upstash/ratelimit').Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          redis: mockRedis,
        })
      )
    })
  })

  describe('exported configuration', () => {
    it('should export enabled configuration when Redis is available', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Clear module cache and import
      jest.resetModules()
      const { ratelimitConfig } = require('@/lib/ratelimiter')

      expect(ratelimitConfig).toEqual({
        enabled: true,
        ratelimit: mockRatelimit,
      })
    })

    it('should export disabled configuration when Redis is not available', () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const { ratelimitConfig } = require('@/lib/ratelimiter')

      expect(ratelimitConfig).toEqual({
        enabled: false,
        ratelimit: null,
      })
    })

    it('should maintain configuration consistency', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      const { ratelimitConfig } = require('@/lib/ratelimiter')

      // When enabled is true, ratelimit should not be null
      if (ratelimitConfig.enabled) {
        expect(ratelimitConfig.ratelimit).not.toBeNull()
      } else {
        expect(ratelimitConfig.ratelimit).toBeNull()
      }
    })
  })

  describe('module reinitialization', () => {
    it('should reinitialize correctly when imported multiple times', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // First import
      const firstImport = require('@/lib/ratelimiter')
      expect(firstImport.ratelimitConfig.enabled).toBe(true)

      // Clear module cache and import again
      jest.resetModules()
      ;(require('@upstash/redis').Redis.fromEnv as jest.Mock).mockClear()
      ;(
        require('@upstash/ratelimit').Ratelimit as jest.MockedClass<
          typeof Ratelimit
        >
      ).mockClear()

      const secondImport = require('@/lib/ratelimiter')
      expect(secondImport.ratelimitConfig.enabled).toBe(true)

      // Should reinitialize
      expect(require('@upstash/redis').Redis.fromEnv).toHaveBeenCalled()
      expect(require('@upstash/ratelimit').Ratelimit).toHaveBeenCalled()
    })

    it('should handle environment changes between imports', () => {
      // First import with Redis enabled
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'
      const firstImport = require('@/lib/ratelimiter')
      expect(firstImport.ratelimitConfig.enabled).toBe(true)

      // Clear module cache and change environment
      jest.resetModules()
      delete process.env.UPSTASH_REDIS_REST_URL
      consoleErrorSpy.mockClear()

      const secondImport = require('@/lib/ratelimiter')
      expect(secondImport.ratelimitConfig.enabled).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle Redis.fromEnv throwing an error', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Mock Redis.fromEnv to throw an error
      ;(
        require('@upstash/redis').Redis.fromEnv as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Redis connection failed')
      })

      expect(() => require('@/lib/ratelimiter')).toThrow(
        'Redis connection failed'
      )
    })

    it('should handle Ratelimit constructor throwing an error', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      // Mock Ratelimit constructor to throw an error
      ;(
        require('@upstash/ratelimit').Ratelimit as jest.MockedClass<
          typeof Ratelimit
        >
      ).mockImplementation(() => {
        throw new Error('Ratelimit initialization failed')
      })

      expect(() => require('@/lib/ratelimiter')).toThrow(
        'Ratelimit initialization failed'
      )
    })
  })

  describe('type safety', () => {
    it('should maintain correct TypeScript types', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      const { ratelimitConfig } = require('@/lib/ratelimiter')

      // Type checking - these should not cause TypeScript errors
      expect(typeof ratelimitConfig.enabled).toBe('boolean')

      if (ratelimitConfig.enabled) {
        expect(ratelimitConfig.ratelimit).toBeDefined()
        // The ratelimit object should have the expected methods
        expect(typeof ratelimitConfig.ratelimit.limit).toBe('function')
      } else {
        expect(ratelimitConfig.ratelimit).toBeNull()
      }
    })

    it('should export the correct RateLimitConfig structure', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      const { ratelimitConfig } = require('@/lib/ratelimiter')

      // Should have exactly the expected properties
      const expectedKeys = ['enabled', 'ratelimit']
      const actualKeys = Object.keys(ratelimitConfig)

      expect(actualKeys.sort()).toEqual(expectedKeys.sort())
    })
  })

  describe('sliding window configuration', () => {
    it('should configure sliding window with 5 requests per 10 seconds', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      require('@/lib/ratelimiter')

      expect(
        require('@upstash/ratelimit').Ratelimit.slidingWindow
      ).toHaveBeenCalledWith(5, '10 s')
      expect(
        require('@upstash/ratelimit').Ratelimit.slidingWindow
      ).toHaveBeenCalledTimes(1)
    })

    it('should pass sliding window limiter to Ratelimit constructor', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      require('@/lib/ratelimiter')

      expect(require('@upstash/ratelimit').Ratelimit).toHaveBeenCalledWith(
        expect.objectContaining({
          limiter: 'sliding-window-limiter',
        })
      )
    })
  })

  describe('Redis environment integration', () => {
    it('should use Redis.fromEnv instead of manual configuration', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      require('@/lib/ratelimiter')

      // Should use fromEnv method which reads from environment automatically
      expect(require('@upstash/redis').Redis.fromEnv).toHaveBeenCalledWith()
      expect(require('@upstash/redis').Redis.fromEnv).toHaveBeenCalledTimes(1)
    })

    it('should handle various Redis environment configurations', () => {
      // Test with different URL formats
      const testUrls = [
        'https://redis.upstash.io',
        'https://mock-redis.upstash.io',
        'https://test-redis-instance.upstash.io',
      ]

      testUrls.forEach((url) => {
        jest.resetModules()
        ;(require('@upstash/redis').Redis.fromEnv as jest.Mock).mockClear()

        process.env.UPSTASH_REDIS_REST_URL = url

        const { ratelimitConfig } = require('@/lib/ratelimiter')

        expect(ratelimitConfig.enabled).toBe(true)
        expect(require('@upstash/redis').Redis.fromEnv).toHaveBeenCalled()
      })
    })
  })

  describe('integration with rate limiting workflow', () => {
    it('should provide usable configuration for rate limiting', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io'

      const { ratelimitConfig } = require('@/lib/ratelimiter')

      // Simulate using the configuration
      if (ratelimitConfig.enabled && ratelimitConfig.ratelimit) {
        // Mock a rate limit check
        mockRatelimit.limit.mockResolvedValue({
          success: true,
          limit: 5,
          remaining: 4,
          reset: Date.now() + 10000,
        })

        expect(ratelimitConfig.ratelimit.limit).toBeDefined()
        expect(typeof ratelimitConfig.ratelimit.limit).toBe('function')
      }
    })

    it('should handle disabled state gracefully', () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const { ratelimitConfig } = require('@/lib/ratelimiter')

      // When disabled, application should handle null ratelimit gracefully
      expect(ratelimitConfig.enabled).toBe(false)
      expect(ratelimitConfig.ratelimit).toBeNull()

      // Typical usage pattern should not break
      if (ratelimitConfig.enabled && ratelimitConfig.ratelimit) {
        // This block should not execute when disabled
        expect(true).toBe(false) // Should not reach here
      } else {
        // Should handle disabled case
        expect(ratelimitConfig.ratelimit).toBeNull()
      }
    })
  })
})
