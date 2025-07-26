// PRP-014: Shopify GraphQL API Client
import type { RateLimiter } from '../base-connector'
import { 
  ShopifyGraphQLResponse, 
  ShopifyGraphQLError,
  ShopifyBulkOperation,
  ShopifyAPIError,
  ShopifyRateLimitError
} from '@/types/shopify.types'

interface ShopifyApiConfig {
  shop: string
  accessToken: string
  apiVersion: string
  rateLimiter?: RateLimiter
}

interface BulkOperationResult {
  bulkOperation: ShopifyBulkOperation
  userErrors: Array<{
    field: string[]
    message: string
  }>
}

export class ShopifyApiClient {
  private readonly endpoint: string
  private readonly headers: Record<string, string>
  private rateLimiter: RateLimiter | null
  private apiCallPoints = 0
  private apiCallLimit = 1000 // Shopify's default

  constructor(private config: ShopifyApiConfig) {
    this.endpoint = `https://${config.shop}/admin/api/${config.apiVersion}/graphql.json`
    this.headers = {
      'X-Shopify-Access-Token': config.accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    this.rateLimiter = config.rateLimiter || null
  }

  /**
   * Execute a GraphQL query with cost calculation and rate limiting
   */
  async query<T = any>(
    query: string, 
    variables?: Record<string, any>
  ): Promise<ShopifyGraphQLResponse<T>> {
    // Estimate query cost before execution
    const estimatedCost = this.estimateQueryCost(query)
    
    // Acquire rate limit tokens
    if (this.rateLimiter) {
      await this.rateLimiter.acquire(estimatedCost)
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query, variables })
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
        throw new ShopifyRateLimitError(
          'Shopify API rate limit exceeded',
          retryAfter
        )
      }

      const result = await response.json() as ShopifyGraphQLResponse<T>

      // Update rate limit info from response
      if (result.extensions?.cost) {
        this.apiCallPoints = result.extensions.cost.actualQueryCost
        this.apiCallLimit = result.extensions.cost.throttleStatus.maximumAvailable
      }

      // Handle GraphQL errors
      if (result.errors && result.errors.length > 0) {
        this.handleGraphQLErrors(result.errors)
      }

      // Release tokens on successful request
      if (this.rateLimiter) {
        this.rateLimiter.release(estimatedCost)
      }

      return result
    } catch (error) {
      // Don't release tokens on error - they should count against rate limit
      if (error instanceof ShopifyAPIError) {
        throw error
      }
      throw new ShopifyAPIError(
        `Shopify API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      )
    }
  }

  /**
   * Execute a GraphQL mutation
   */
  async mutation<T = any>(
    mutation: string, 
    variables?: Record<string, any>
  ): Promise<ShopifyGraphQLResponse<T>> {
    return this.query<T>(mutation, variables)
  }

  /**
   * Start a bulk operation for large data queries
   */
  async bulkOperation(query: string): Promise<ShopifyBulkOperation> {
    const mutation = `
      mutation bulkOperationRunQuery($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation {
            id
            status
            errorCode
            createdAt
            url
            partialDataUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await this.mutation<{ bulkOperationRunQuery: BulkOperationResult }>(
      mutation, 
      { query }
    )

    if (!response.data) {
      throw new ShopifyAPIError('No data returned from bulk operation mutation')
    }

    const { bulkOperation, userErrors } = response.data.bulkOperationRunQuery

    if (userErrors.length > 0) {
      throw new ShopifyAPIError(
        `Bulk operation failed: ${userErrors[0].message}`,
        'BULK_OPERATION_ERROR'
      )
    }

    return bulkOperation
  }

  /**
   * Check the status of a bulk operation
   */
  async getBulkOperationStatus(id: string): Promise<ShopifyBulkOperation> {
    const query = `
      query bulkOperation($id: ID!) {
        node(id: $id) {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            url
            partialDataUrl
          }
        }
      }
    `

    const response = await this.query<{ node: ShopifyBulkOperation }>(query, { id })

    if (!response.data?.node) {
      throw new ShopifyAPIError('Bulk operation not found', 'NOT_FOUND', 404)
    }

    return response.data.node
  }

  /**
   * Cancel a running bulk operation
   */
  async cancelBulkOperation(id: string): Promise<void> {
    const mutation = `
      mutation bulkOperationCancel($id: ID!) {
        bulkOperationCancel(id: $id) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await this.mutation<{ bulkOperationCancel: any }>(
      mutation, 
      { id }
    )

    if (response.data?.bulkOperationCancel.userErrors.length > 0) {
      throw new ShopifyAPIError(
        `Failed to cancel bulk operation: ${response.data.bulkOperationCancel.userErrors[0].message}`,
        'BULK_OPERATION_ERROR'
      )
    }
  }

  /**
   * Get current API call limits
   */
  getApiCallLimits(): { used: number; limit: number; available: number } {
    return {
      used: this.apiCallPoints,
      limit: this.apiCallLimit,
      available: this.apiCallLimit - this.apiCallPoints
    }
  }

  /**
   * Estimate the cost of a GraphQL query
   * This is a simplified estimation - real cost depends on actual data returned
   */
  private estimateQueryCost(query: string): number {
    let cost = 1 // Base cost

    // Count connections (first/last parameters)
    const connectionMatches = query.matchAll(/(?:first|last):\s*(\d+)/g)
    for (const match of connectionMatches) {
      const limit = parseInt(match[1], 10)
      // Each item in a connection costs approximately 1 point
      cost += Math.ceil(limit / 2)
    }

    // Count fields (rough estimation based on query complexity)
    const fieldCount = (query.match(/{[^}]+}/g) || []).length
    cost += Math.ceil(fieldCount / 10)

    // Mutations typically cost more
    if (query.trim().startsWith('mutation')) {
      cost *= 10
    }

    return Math.max(1, cost)
  }

  /**
   * Handle GraphQL errors appropriately
   */
  private handleGraphQLErrors(errors: ShopifyGraphQLError[]): never {
    const error = errors[0]
    
    // Check for throttling
    if (error.extensions?.code === 'THROTTLED') {
      throw new ShopifyRateLimitError('GraphQL API throttled', 60)
    }

    // Map common error codes
    const errorCode = error.extensions?.code || 'GRAPHQL_ERROR'
    const statusCode = this.mapErrorCodeToStatus(errorCode)

    throw new ShopifyAPIError(
      error.message,
      errorCode,
      statusCode,
      errors
    )
  }

  /**
   * Map GraphQL error codes to HTTP status codes
   */
  private mapErrorCodeToStatus(code: string): number {
    const errorMap: Record<string, number> = {
      'THROTTLED': 429,
      'ACCESS_DENIED': 403,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'INTERNAL_SERVER_ERROR': 500,
      'BAD_USER_INPUT': 400,
      'INVALID': 422
    }

    return errorMap[code] || 400
  }

  /**
   * Helper method to create a complete product query
   */
  static buildProductQuery(includeMetafields = true, variantLimit = 100): string {
    return `
      id
      title
      handle
      descriptionHtml
      vendor
      productType
      tags
      status
      updatedAt
      createdAt
      variants(first: ${variantLimit}) {
        edges {
          node {
            id
            title
            sku
            price
            compareAtPrice
            inventoryPolicy
            inventoryManagement
            weight
            weightUnit
            barcode
            position
            inventoryItem {
              id
            }
          }
        }
      }
      ${includeMetafields ? `
        metafields(namespace: "truthsource", first: 10) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      ` : ''}
    `
  }

  /**
   * Helper method to create an inventory query
   */
  static buildInventoryQuery(): string {
    return `
      id
      available
      updatedAt
      item {
        id
        sku
        variant {
          id
          product {
            id
          }
        }
      }
      location {
        id
        name
      }
    `
  }

  /**
   * Helper to build a customer query
   */
  static buildCustomerQuery(includeCompany = true): string {
    return `
      id
      email
      firstName
      lastName
      phone
      taxExempt
      tags
      createdAt
      updatedAt
      addresses {
        address1
        address2
        city
        province
        provinceCode
        country
        countryCode
        zip
        phone
        company
      }
      ${includeCompany ? `
        company {
          id
          name
          externalId
          note
          createdAt
          updatedAt
        }
      ` : ''}
    `
  }
}