/**
 * Rate limiting utility wrapper
 * Provides a consistent interface for rate limiting across the application
 */

import { ratelimitConfig } from '@/lib/ratelimiter'

// Export the ratelimit instance or a mock if not enabled
export const ratelimit = ratelimitConfig.enabled && ratelimitConfig.ratelimit
  ? ratelimitConfig.ratelimit
  : {
      // Mock implementation for when rate limiting is not enabled
      limit: async (identifier: string) => ({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        pending: Promise.resolve()
      })
    }