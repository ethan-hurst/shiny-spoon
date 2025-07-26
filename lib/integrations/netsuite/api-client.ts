// PRP-013: NetSuite API Client with Rate Limiting
import { z } from 'zod'
import { 
  IntegrationError, 
  RateLimitError,
  AuthenticationError 
} from '@/types/integration.types'
import type { 
  NetSuiteSuiteQLResponse,
  NetSuiteApiError 
} from '@/types/netsuite.types'
import { NetSuiteAuth } from './auth'
import type { RateLimiter } from '../base-connector'

// API response schemas
const suiteQLResponseSchema = z.object({
  items: z.array(z.any()),
  hasMore: z.boolean().optional().default(false),
  totalResults: z.number().optional(),
  links: z.array(z.object({
    rel: z.string(),
    href: z.string(),
  })).optional(),
})

export class NetSuiteApiClient {
  private baseUrl: string
  private suiteQLUrl: string
  
  constructor(
    private auth: NetSuiteAuth,
    datacenterUrl: string,
    private rateLimiter?: RateLimiter
  ) {
    this.baseUrl = `${datacenterUrl}/services/rest`
    this.suiteQLUrl = `${this.baseUrl}/query/v1/suiteql`
  }

  /**
   * Execute a SuiteQL query with automatic pagination support
   */
  async executeSuiteQL<T = any>(
    query: string,
    options: {
      limit?: number
      offset?: number
      preferQueryMode?: 'normal' | 'stream'
    } = {}
  ): Promise<NetSuiteSuiteQLResponse<T>> {
    let rateLimitToken = 0
    
    try {
      // Acquire rate limit token
      if (this.rateLimiter) {
        rateLimitToken = 2 // SuiteQL has higher weight
        await this.rateLimiter.acquire(rateLimitToken)
      }

      const token = await this.auth.getValidAccessToken()
      
      // Build query with pagination - validate numeric values
      let finalQuery = query
      if (options.limit !== undefined || options.offset !== undefined) {
        const limit = Math.min(Math.max(1, options.limit || 1000), 10000) // Validate range
        const offset = Math.max(0, options.offset || 0)
        
        // Check for existing LIMIT/OFFSET using regex to be case-insensitive
        const hasLimit = /\bLIMIT\b/i.test(query)
        const hasOffset = /\bOFFSET\b/i.test(query)
        
        if (!hasLimit && limit > 0) {
          finalQuery += ` LIMIT ${limit}`
        }
        if (!hasOffset && offset > 0) {
          finalQuery += ` OFFSET ${offset}`
        }
      }

      const response = await fetch(this.suiteQLUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': options.preferQueryMode === 'stream' 
            ? 'transient'
            : 'respond-async,wait=10', // Wait up to 10 seconds
        },
        body: JSON.stringify({
          q: finalQuery,
        }),
      })

      if (!response.ok) {
        await this.handleApiError(response)
      }

      const data = await response.json()
      const validated = suiteQLResponseSchema.parse(data)

      // Check for hasMore based on result count
      const hasMore = validated.hasMore || 
        (options.limit !== undefined && validated.items.length === options.limit)

      return {
        items: validated.items as T[],
        hasMore,
        totalResults: validated.totalResults,
        links: validated.links,
      }
    } finally {
      // Always release rate limit token
      if (this.rateLimiter && rateLimitToken > 0) {
        this.rateLimiter.release(rateLimitToken)
      }
    }
  }

  /**
   * Get a record by type and ID
   */
  async getRecord(recordType: string, recordId: string): Promise<any> {
    try {
      if (this.rateLimiter) {
        await this.rateLimiter.acquire(1)
      }

      const token = await this.auth.getValidAccessToken()
      const url = `${this.baseUrl}/record/v1/${recordType}/${recordId}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }

      if (!response.ok) {
        await this.handleApiError(response)
      }

      return await response.json()
    } catch (error) {
      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }
      throw error
    }
  }

  /**
   * Create a new record
   */
  async createRecord(recordType: string, data: any): Promise<any> {
    try {
      if (this.rateLimiter) {
        await this.rateLimiter.acquire(1)
      }

      const token = await this.auth.getValidAccessToken()
      const url = `${this.baseUrl}/record/v1/${recordType}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }

      if (!response.ok) {
        await this.handleApiError(response)
      }

      return await response.json()
    } catch (error) {
      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }
      throw error
    }
  }

  /**
   * Update a record
   */
  async updateRecord(recordType: string, recordId: string, data: any): Promise<any> {
    try {
      if (this.rateLimiter) {
        await this.rateLimiter.acquire(1)
      }

      const token = await this.auth.getValidAccessToken()
      const url = `${this.baseUrl}/record/v1/${recordType}/${recordId}`

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }

      if (!response.ok) {
        await this.handleApiError(response)
      }

      return await response.json()
    } catch (error) {
      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }
      throw error
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(recordType: string, recordId: string): Promise<void> {
    try {
      if (this.rateLimiter) {
        await this.rateLimiter.acquire(1)
      }

      const token = await this.auth.getValidAccessToken()
      const url = `${this.baseUrl}/record/v1/${recordType}/${recordId}`

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }

      if (!response.ok) {
        await this.handleApiError(response)
      }
    } catch (error) {
      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }
      throw error
    }
  }

  /**
   * Execute a batch of SuiteQL queries
   */
  async executeBatchSuiteQL<T = any>(
    queries: string[]
  ): Promise<NetSuiteSuiteQLResponse<T>[]> {
    const results: NetSuiteSuiteQLResponse<T>[] = []
    
    // Execute queries sequentially to respect rate limits
    for (const query of queries) {
      const result = await this.executeSuiteQL<T>(query)
      results.push(result)
    }
    
    return results
  }

  /**
   * Get metadata for a record type
   */
  async getRecordMetadata(recordType: string): Promise<any> {
    try {
      if (this.rateLimiter) {
        await this.rateLimiter.acquire(1)
      }

      const token = await this.auth.getValidAccessToken()
      const url = `${this.baseUrl}/metadata-catalog/record/${recordType}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }

      if (!response.ok) {
        await this.handleApiError(response)
      }

      return await response.json()
    } catch (error) {
      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }
      throw error
    }
  }

  /**
   * Validate SQL identifier (table/column names)
   */
  private validateIdentifier(identifier: string): string {
    // Allow alphanumeric, underscore, and dot (for table.column)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(identifier)) {
      throw new IntegrationError(
        `Invalid identifier: ${identifier}`,
        'INVALID_IDENTIFIER'
      )
    }
    return identifier
  }

  /**
   * Search records using SuiteQL
   */
  async searchRecords<T = any>(
    table: string,
    conditions: Record<string, any>,
    options: {
      select?: string[]
      orderBy?: string
      limit?: number
      offset?: number
    } = {}
  ): Promise<NetSuiteSuiteQLResponse<T>> {
    // Validate table name
    const validatedTable = this.validateIdentifier(table)
    
    // Build SELECT clause with validation
    const selectClause = options.select?.length 
      ? options.select.map(field => this.validateIdentifier(field)).join(', ')
      : '*'
    
    // Build WHERE clause
    const whereConditions = Object.entries(conditions)
      .map(([field, value]) => {
        // Validate field name
        const validatedField = this.validateIdentifier(field)
        
        if (value === null) {
          return `${validatedField} IS NULL`
        } else if (typeof value === 'string') {
          return `${validatedField} = '${value.replace(/'/g, "''")}'`
        } else if (typeof value === 'number') {
          return `${validatedField} = ${value}`
        } else if (typeof value === 'boolean') {
          return `${validatedField} = '${value ? 'T' : 'F'}'`
        }
        return ''
      })
      .filter(Boolean)
      .join(' AND ')
    
    // Build query
    let query = `SELECT ${selectClause} FROM ${validatedTable}`
    if (whereConditions) {
      query += ` WHERE ${whereConditions}`
    }
    if (options.orderBy) {
      // Validate orderBy field
      const validatedOrderBy = this.validateIdentifier(options.orderBy)
      query += ` ORDER BY ${validatedOrderBy}`
    }
    
    return this.executeSuiteQL<T>(query, {
      limit: options.limit,
      offset: options.offset,
    })
  }

  /**
   * Handle API errors
   */
  private async handleApiError(response: Response): Promise<never> {
    let errorData: NetSuiteApiError | null = null
    
    try {
      errorData = await response.json()
    } catch {
      // Failed to parse error response
    }

    // Check for rate limiting
    if (response.status === 429) {
      // NetSuite returns Retry-After header in seconds
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
      
      throw new RateLimitError(
        'NetSuite API rate limit exceeded',
        retryAfter * 1000, // Convert to milliseconds
        errorData
      )
    }

    // Check for authentication errors
    if (response.status === 401) {
      throw new AuthenticationError(
        'NetSuite authentication failed',
        errorData
      )
    }

    // Generic API error
    const message = errorData?.detail || 
      errorData?.title || 
      `NetSuite API error: ${response.status} ${response.statusText}`
    
    throw new IntegrationError(
      message,
      errorData?.['o:errorCode'] || response.status,
      errorData,
      response.status >= 500 // Server errors are retryable
    )
  }

  /**
   * Build a paginated query iterator
   */
  async *iterateSuiteQLResults<T = any>(
    query: string,
    options: {
      pageSize?: number
    } = {}
  ): AsyncGenerator<T[], void, unknown> {
    const pageSize = options.pageSize || 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const result = await this.executeSuiteQL<T>(query, {
        limit: pageSize,
        offset,
      })

      if (result.items.length > 0) {
        yield result.items
      }

      hasMore = result.hasMore
      offset += pageSize
    }
  }

  /**
   * Get all results from a paginated query
   */
  async getAllSuiteQLResults<T = any>(
    query: string,
    options: {
      maxResults?: number
    } = {}
  ): Promise<T[]> {
    const allResults: T[] = []
    const maxResults = options.maxResults || Infinity

    for await (const batch of this.iterateSuiteQLResults<T>(query)) {
      allResults.push(...batch)
      
      if (allResults.length >= maxResults) {
        return allResults.slice(0, maxResults)
      }
    }

    return allResults
  }
}