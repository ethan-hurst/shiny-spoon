/**
 * TestApi API Client
 * HTTP client for TestApi API with rate limiting and error handling
 */

import { TestApiAuth } from './auth'
import type { 
  TestApiConfig, 
  TestApiApiResponse,
  RateLimitInfo 
} from '@/types/test-api.types'

export class TestApiApiClient {
  private config: TestApiConfig
  private auth: TestApiAuth
  private rateLimitInfo: RateLimitInfo | null = null

  constructor(config: TestApiConfig, auth: TestApiAuth) {
    this.config = config
    this.auth = auth
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<TestApiApiResponse<T>> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return this.makeRequest('GET', url.toString())
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any): Promise<TestApiApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`
    return this.makeRequest('POST', url, data)
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any): Promise<TestApiApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`
    return this.makeRequest('PUT', url, data)
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string): Promise<TestApiApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`
    return this.makeRequest('DELETE', url)
  }

  /**
   * Make HTTP request with authentication and rate limiting
   */
  private async makeRequest<T = any>(
    method: string, 
    url: string, 
    data?: any
  ): Promise<TestApiApiResponse<T>> {
    const maxRetries = 3
    let retryCount = 0

    while (retryCount <= maxRetries) {
      try {
        // Check rate limits before making request
        await this.checkRateLimit()

        // Get valid auth token
        const token = await this.auth.getValidToken()

        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TruthSource/1.0',
            ...this.auth.getAuthHeaders()
          }
        }

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data)
        }

        const response = await fetch(url, options)

        // Update rate limit info from response headers
        this.updateRateLimitInfo(response)

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
          console.warn(`TestApi rate limit hit, waiting ${retryAfter} seconds`)
          await this.wait(retryAfter * 1000)
          retryCount++
          continue
        }

        // Handle authentication errors
        if (response.status === 401) {
          if (retryCount < maxRetries) {
            console.warn('TestApi authentication failed, retrying...')
            await this.auth.authenticate()
            retryCount++
            continue
          } else {
            throw new Error('Authentication failed after retries')
          }
        }

        // Parse response
        const responseData = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            responseData.message || 
            responseData.error || 
            `HTTP ${response.status}: ${response.statusText}`
          )
        }

        return {
          success: true,
          data: responseData,
          pagination: this.parsePaginationInfo(response, responseData)
        }

      } catch (error) {
        if (retryCount >= maxRetries) {
          console.error(`TestApi API request failed after ${maxRetries} retries:`, error)
          throw error
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000
        await this.wait(delay)
        retryCount++
      }
    }

    throw new Error('Request failed after all retries')
  }

  /**
   * Check rate limits and wait if necessary
   */
  private async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return

    const now = new Date().getTime()
    const resetTime = new Date(this.rateLimitInfo.resetAt).getTime()

    // If we're near the limit and haven't reset yet, wait
    if (this.rateLimitInfo.remaining <= 1 && now < resetTime) {
      const waitTime = resetTime - now + 1000 // Add 1 second buffer
      console.warn(`TestApi rate limit near exhaustion, waiting ${waitTime}ms`)
      await this.wait(waitTime)
    }
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const limit = response.headers.get('X-RateLimit-Limit')
    const resetAt = response.headers.get('X-RateLimit-Reset')

    if (remaining && limit && resetAt) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining),
        limit: parseInt(limit),
        resetAt: new Date(parseInt(resetAt) * 1000).toISOString()
      }
    }
  }

  /**
   * Parse pagination information from response
   */
  private parsePaginationInfo(response: Response, data: any): any {
    // This depends on how TestApi handles pagination
    // Common patterns:
    
    // Header-based pagination
    const totalCount = response.headers.get('X-Total-Count')
    const currentPage = response.headers.get('X-Current-Page')
    const pageSize = response.headers.get('X-Page-Size')

    if (totalCount && currentPage && pageSize) {
      return {
        total: parseInt(totalCount),
        page: parseInt(currentPage),
        limit: parseInt(pageSize),
        hasMore: (parseInt(currentPage) * parseInt(pageSize)) < parseInt(totalCount)
      }
    }

    // Response body pagination
    if (data.pagination) {
      return {
        total: data.pagination.total,
        page: data.pagination.page || data.pagination.current_page,
        limit: data.pagination.limit || data.pagination.per_page,
        hasMore: data.pagination.has_more || (data.pagination.page < data.pagination.total_pages)
      }
    }

    return undefined
  }

  /**
   * Wait for specified milliseconds
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current rate limit status
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo
  }
}
