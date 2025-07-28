import { createAdminClient } from '@/lib/supabase/admin'
import { RateLimitError, type IntegrationPlatformType } from '@/types/integration.types'

export interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
  burstSize?: number
  platform: IntegrationPlatformType
}

export interface RateLimitStatus {
  remaining: number
  total: number
  resetAt: Date
  isAtLimit: boolean
}

// Platform-specific default configurations
const DEFAULT_RATE_LIMITS: Record<IntegrationPlatformType, RateLimitConfig> = {
  netsuite: {
    maxRequests: 5,
    windowSeconds: 1,
    burstSize: 10,
    platform: 'netsuite',
  },
  shopify: {
    maxRequests: 2,
    windowSeconds: 1,
    burstSize: 40, // Shopify has a bucket system
    platform: 'shopify',
  },
  quickbooks: {
    maxRequests: 100,
    windowSeconds: 60,
    platform: 'quickbooks',
  },
  sap: {
    maxRequests: 10,
    windowSeconds: 1,
    platform: 'sap',
  },
  dynamics365: {
    maxRequests: 20,
    windowSeconds: 60,
    platform: 'dynamics365',
  },
  custom: {
    maxRequests: 60,
    windowSeconds: 60,
    platform: 'custom',
  },
}

export class RateLimiter {
  private config: RateLimitConfig
  private supabase = createAdminClient()
  private integrationId: string

  constructor(
    integrationId: string,
    platform: IntegrationPlatformType,
    customConfig?: Partial<RateLimitConfig>
  ) {
    this.integrationId = integrationId
    this.config = {
      ...DEFAULT_RATE_LIMITS[platform],
      ...customConfig,
      platform,
    }
  }

  /**
   * Acquire rate limit tokens
   */
  async acquire(weight: number = 1): Promise<void> {
    const status = await this.getStatus()

    if (status.remaining < weight) {
      const retryAfter = Math.ceil(
        (status.resetAt.getTime() - Date.now()) / 1000
      )
      throw new RateLimitError(
        `Rate limit exceeded for ${this.config.platform}`,
        retryAfter,
        {
          platform: this.config.platform,
          remaining: status.remaining,
          total: status.total,
          resetAt: status.resetAt,
        }
      )
    }

    // Update the bucket
    await this.updateBucket(weight)
  }

  /**
   * Release rate limit tokens (for systems that track returned tokens)
   */
  async release(weight: number = 1): Promise<void> {
    // For most APIs, this is a no-op since tokens aren't returned
    // But some systems might track this for burst allowances
    await this.updateBucket(-weight)
  }

  /**
   * Check if at rate limit without consuming tokens
   */
  async isAtLimit(): Promise<boolean> {
    const status = await this.getStatus()
    return status.isAtLimit
  }

  /**
   * Get current rate limit status
   */
  async getStatus(): Promise<RateLimitStatus> {
    const now = new Date()
    const windowStart = this.getWindowStart(now)

    // Get or create the current bucket
    const { data: bucket, error } = await this.supabase
      .from('rate_limit_buckets')
      .select('*')
      .eq('integration_id', this.integrationId)
      .eq('bucket_key', 'api_calls')
      .eq('window_start', windowStart.toISOString())
      .single()

    if (error && error.code !== 'PGRST116') {
      // Error other than "not found"
      throw new Error(`Failed to get rate limit status: ${error.message}`)
    }

    const currentBucket = bucket || {
      request_count: 0,
      max_requests: this.config.maxRequests,
      window_start: windowStart.toISOString(),
      window_duration_seconds: this.config.windowSeconds,
    }

    const resetAt = new Date(
      new Date(currentBucket.window_start).getTime() +
      currentBucket.window_duration_seconds * 1000
    )

    const remaining = Math.max(0, currentBucket.max_requests - currentBucket.request_count)

    return {
      remaining,
      total: currentBucket.max_requests,
      resetAt,
      isAtLimit: remaining === 0,
    }
  }

  /**
   * Get remaining requests
   */
  async getRemainingRequests(): Promise<number> {
    const status = await this.getStatus()
    return status.remaining
  }

  /**
   * Get reset time
   */
  async getResetTime(): Promise<Date> {
    const status = await this.getStatus()
    return status.resetAt
  }

  /**
   * Update rate from API response headers (for platforms that provide this)
   */
  async updateFromHeaders(headers: Record<string, string>): Promise<void> {
    // Platform-specific header parsing
    switch (this.config.platform) {
      case 'shopify':
        await this.updateFromShopifyHeaders(headers)
        break
      case 'netsuite':
        await this.updateFromNetSuiteHeaders(headers)
        break
      default:
        // Generic rate limit headers
        await this.updateFromGenericHeaders(headers)
        break
    }
  }

  /**
   * Reset rate limit bucket (for testing or manual reset)
   */
  async reset(): Promise<void> {
    await this.supabase
      .from('rate_limit_buckets')
      .delete()
      .eq('integration_id', this.integrationId)
      .eq('bucket_key', 'api_calls')
  }

  private async updateBucket(requestCount: number): Promise<void> {
    const now = new Date()
    const windowStart = this.getWindowStart(now)

    // Upsert the bucket
    const { error } = await this.supabase
      .from('rate_limit_buckets')
      .upsert({
        integration_id: this.integrationId,
        bucket_key: 'api_calls',
        window_start: windowStart.toISOString(),
        window_duration_seconds: this.config.windowSeconds,
        request_count: requestCount,
        max_requests: this.config.maxRequests,
      })

    if (error) {
      // If it's a conflict, try to increment instead
      if (error.code === '23505') {
        const { error: updateError } = await this.supabase
          .rpc('increment_rate_limit_bucket', {
            p_integration_id: this.integrationId,
            p_bucket_key: 'api_calls',
            p_window_start: windowStart.toISOString(),
            p_increment: requestCount,
          })

        if (updateError) {
          throw new Error(`Failed to update rate limit bucket: ${updateError.message}`)
        }
      } else {
        throw new Error(`Failed to update rate limit bucket: ${error.message}`)
      }
    }
  }

  private getWindowStart(timestamp: Date): Date {
    const windowMs = this.config.windowSeconds * 1000
    return new Date(Math.floor(timestamp.getTime() / windowMs) * windowMs)
  }

  private async updateFromShopifyHeaders(headers: Record<string, string>): Promise<void> {
    // Shopify uses call limit headers
    const callLimit = headers['x-shopify-shop-api-call-limit']
    if (callLimit) {
      const [used, total] = callLimit.split('/').map(Number)
      
      // Update bucket with current usage
      const now = new Date()
      const windowStart = this.getWindowStart(now)

      await this.supabase
        .from('rate_limit_buckets')
        .upsert({
          integration_id: this.integrationId,
          bucket_key: 'api_calls',
          window_start: windowStart.toISOString(),
          window_duration_seconds: this.config.windowSeconds,
          request_count: used,
          max_requests: total,
        })
    }
  }

  private async updateFromNetSuiteHeaders(headers: Record<string, string>): Promise<void> {
    // NetSuite doesn't provide rate limit headers, so we track locally
    // This is primarily used for logging actual consumption
    const remaining = parseInt(headers['x-rate-limit-remaining'] || '0', 10)
    const limit = parseInt(headers['x-rate-limit-limit'] || '0', 10)

    if (remaining > 0 && limit > 0) {
      const used = limit - remaining
      const now = new Date()
      const windowStart = this.getWindowStart(now)

      await this.supabase
        .from('rate_limit_buckets')
        .upsert({
          integration_id: this.integrationId,
          bucket_key: 'api_calls',
          window_start: windowStart.toISOString(),
          window_duration_seconds: this.config.windowSeconds,
          request_count: used,
          max_requests: limit,
        })
    }
  }

  private async updateFromGenericHeaders(headers: Record<string, string>): Promise<void> {
    // Standard rate limit headers
    const remaining = parseInt(
      headers['x-ratelimit-remaining'] || 
      headers['x-rate-limit-remaining'] || 
      '0', 
      10
    )
    const limit = parseInt(
      headers['x-ratelimit-limit'] || 
      headers['x-rate-limit-limit'] || 
      '0', 
      10
    )
    const reset = parseInt(
      headers['x-ratelimit-reset'] || 
      headers['x-rate-limit-reset'] || 
      '0', 
      10
    )

    if (remaining >= 0 && limit > 0) {
      const used = limit - remaining
      let windowStart: Date

      if (reset > 0) {
        // Reset timestamp provided
        windowStart = new Date(reset * 1000 - this.config.windowSeconds * 1000)
      } else {
        // Use current window
        windowStart = this.getWindowStart(new Date())
      }

      await this.supabase
        .from('rate_limit_buckets')
        .upsert({
          integration_id: this.integrationId,
          bucket_key: 'api_calls',
          window_start: windowStart.toISOString(),
          window_duration_seconds: this.config.windowSeconds,
          request_count: used,
          max_requests: limit,
        })
    }
  }
}

/**
 * Global rate limit coordinator for managing limits across integrations
 */
export class RateLimitCoordinator {
  private limiters = new Map<string, RateLimiter>()
  private supabase = createAdminClient()

  /**
   * Get rate limiter for a specific integration
   */
  getLimiterForIntegration(
    integrationId: string,
    platform: IntegrationPlatformType,
    customConfig?: Partial<RateLimitConfig>
  ): RateLimiter {
    const key = `${integrationId}:${platform}`
    
    if (!this.limiters.has(key)) {
      const limiter = new RateLimiter(integrationId, platform, customConfig)
      this.limiters.set(key, limiter)
    }

    return this.limiters.get(key)!
  }

  /**
   * Get rate limiter for a platform (shared across integrations)
   */
  getLimiterForPlatform(platform: IntegrationPlatformType): RateLimiter {
    return this.getLimiterForIntegration(`platform:${platform}`, platform)
  }

  /**
   * Check global rate limits across all integrations
   */
  async getGlobalStatus(): Promise<Record<IntegrationPlatformType, RateLimitStatus[]>> {
    const { data: buckets, error } = await this.supabase
      .from('rate_limit_buckets')
      .select(`
        *,
        integrations!inner(
          platform
        )
      `)
      .gte('window_start', new Date(Date.now() - 60000).toISOString()) // Last minute

    if (error) {
      throw new Error(`Failed to get global rate limit status: ${error.message}`)
    }

    const statusByPlatform: Record<string, RateLimitStatus[]> = {}

    for (const bucket of buckets || []) {
      const platform = bucket.integrations.platform
      if (!statusByPlatform[platform]) {
        statusByPlatform[platform] = []
      }

      const resetAt = new Date(
        new Date(bucket.window_start).getTime() +
        bucket.window_duration_seconds * 1000
      )

      statusByPlatform[platform].push({
        remaining: Math.max(0, bucket.max_requests - bucket.request_count),
        total: bucket.max_requests,
        resetAt,
        isAtLimit: bucket.request_count >= bucket.max_requests,
      })
    }

    return statusByPlatform
  }

  /**
   * Clean up old rate limit buckets
   */
  async cleanup(olderThanHours: number = 24): Promise<void> {
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - olderThanHours)

    const { error } = await this.supabase
      .from('rate_limit_buckets')
      .delete()
      .lt('window_start', cutoff.toISOString())

    if (error) {
      console.error('Failed to clean up rate limit buckets:', error)
    }
  }
}