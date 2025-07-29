// PRP-014: Shopify API Client
import { ShopifyAuth } from './auth'
import { ShopifyAPIError, ShopifyRateLimitError, type RateLimiter } from '@/types/shopify.types'

export interface ShopifyApiClientConfig {
  shop_domain: string
  access_token: string
  api_version: string
  rateLimiter?: RateLimiter
}

export class ShopifyApiClient {
  private auth: ShopifyAuth
  private rateLimiter?: RateLimiter

  constructor(
    auth: ShopifyAuth,
    config: ShopifyApiClientConfig,
    rateLimiter?: RateLimiter
  ) {
    this.auth = auth
    this.rateLimiter = rateLimiter
  }

  /**
   * Make a REST API request with rate limiting
   */
  async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<Response> {
    // Apply rate limiting if configured
    if (this.rateLimiter) {
      await this.rateLimiter.acquire(1)
    }

    try {
      return await this.auth.makeRequest(method, endpoint, body, headers)
    } finally {
      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }
    }
  }

  /**
   * Make a GraphQL request with rate limiting
   */
  async makeGraphQLRequest(
    query: string,
    variables?: Record<string, any>
  ): Promise<Response> {
    // Apply rate limiting if configured
    if (this.rateLimiter) {
      await this.rateLimiter.acquire(1)
    }

    try {
      return await this.auth.makeGraphQLRequest(query, variables)
    } finally {
      if (this.rateLimiter) {
        this.rateLimiter.release(1)
      }
    }
  }

  /**
   * Get products with pagination
   */
  async getProducts(options: {
    limit?: number
    since_id?: number
    status?: 'active' | 'archived' | 'draft'
    vendor?: string
    handle?: string
    product_type?: string
    collection_id?: number
    created_at_min?: string
    created_at_max?: string
    updated_at_min?: string
    updated_at_max?: string
    published_at_min?: string
    published_at_max?: string
    published_status?: 'published' | 'unpublished' | 'any'
    fields?: string
  } = {}): Promise<{
    products: any[]
    hasNextPage: boolean
    nextPageInfo?: string
  }> {
    const params = new URLSearchParams()
    
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.since_id) params.append('since_id', options.since_id.toString())
    if (options.status) params.append('status', options.status)
    if (options.vendor) params.append('vendor', options.vendor)
    if (options.handle) params.append('handle', options.handle)
    if (options.product_type) params.append('product_type', options.product_type)
    if (options.collection_id) params.append('collection_id', options.collection_id.toString())
    if (options.created_at_min) params.append('created_at_min', options.created_at_min)
    if (options.created_at_max) params.append('created_at_max', options.created_at_max)
    if (options.updated_at_min) params.append('updated_at_min', options.updated_at_min)
    if (options.updated_at_max) params.append('updated_at_max', options.updated_at_max)
    if (options.published_at_min) params.append('published_at_min', options.published_at_min)
    if (options.published_at_max) params.append('published_at_max', options.published_at_max)
    if (options.published_status) params.append('published_status', options.published_status)
    if (options.fields) params.append('fields', options.fields)

    const endpoint = `/admin/api/${this.auth.getApiVersion()}/products.json?${params.toString()}`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get products: ${response.status} ${response.statusText}`,
        'PRODUCTS_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    const linkHeader = response.headers.get('Link')
    const hasNextPage = linkHeader?.includes('rel="next"') || false
    const nextPageInfo = linkHeader?.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1]

    return {
      products: data.products || [],
      hasNextPage,
      nextPageInfo,
    }
  }

  /**
   * Get a single product by ID
   */
  async getProduct(productId: string, fields?: string): Promise<any> {
    const params = new URLSearchParams()
    if (fields) params.append('fields', fields)

    const endpoint = `/admin/api/${this.auth.getApiVersion()}/products/${productId}.json?${params.toString()}`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get product ${productId}: ${response.status} ${response.statusText}`,
        'PRODUCT_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    return data.product
  }

  /**
   * Get inventory levels for products
   */
  async getInventoryLevels(options: {
    inventory_item_ids?: number[]
    location_ids?: number[]
    limit?: number
  } = {}): Promise<{
    inventory_levels: any[]
    hasNextPage: boolean
    nextPageInfo?: string
  }> {
    const params = new URLSearchParams()
    
    if (options.inventory_item_ids) {
      options.inventory_item_ids.forEach(id => params.append('inventory_item_ids[]', id.toString()))
    }
    if (options.location_ids) {
      options.location_ids.forEach(id => params.append('location_ids[]', id.toString()))
    }
    if (options.limit) params.append('limit', options.limit.toString())

    const endpoint = `/admin/api/${this.auth.getApiVersion()}/inventory_levels.json?${params.toString()}`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get inventory levels: ${response.status} ${response.statusText}`,
        'INVENTORY_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    const linkHeader = response.headers.get('Link')
    const hasNextPage = linkHeader?.includes('rel="next"') || false
    const nextPageInfo = linkHeader?.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1]

    return {
      inventory_levels: data.inventory_levels || [],
      hasNextPage,
      nextPageInfo,
    }
  }

  /**
   * Update inventory level
   */
  async updateInventoryLevel(
    inventoryItemId: number,
    locationId: number,
    available: number
  ): Promise<any> {
    const body = {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: available,
    }

    const endpoint = `/admin/api/${this.auth.getApiVersion()}/inventory_levels/set.json`
    const response = await this.makeRequest('POST', endpoint, body)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to update inventory level: ${response.status} ${response.statusText}`,
        'INVENTORY_UPDATE_FAILED',
        response.status
      )
    }

    const data = await response.json()
    return data.inventory_level
  }

  /**
   * Get customers with pagination
   */
  async getCustomers(options: {
    limit?: number
    since_id?: number
    created_at_min?: string
    created_at_max?: string
    updated_at_min?: string
    updated_at_max?: string
    fields?: string
  } = {}): Promise<{
    customers: any[]
    hasNextPage: boolean
    nextPageInfo?: string
  }> {
    const params = new URLSearchParams()
    
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.since_id) params.append('since_id', options.since_id.toString())
    if (options.created_at_min) params.append('created_at_min', options.created_at_min)
    if (options.created_at_max) params.append('created_at_max', options.created_at_max)
    if (options.updated_at_min) params.append('updated_at_min', options.updated_at_min)
    if (options.updated_at_max) params.append('updated_at_max', options.updated_at_max)
    if (options.fields) params.append('fields', options.fields)

    const endpoint = `/admin/api/${this.auth.getApiVersion()}/customers.json?${params.toString()}`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get customers: ${response.status} ${response.statusText}`,
        'CUSTOMERS_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    const linkHeader = response.headers.get('Link')
    const hasNextPage = linkHeader?.includes('rel="next"') || false
    const nextPageInfo = linkHeader?.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1]

    return {
      customers: data.customers || [],
      hasNextPage,
      nextPageInfo,
    }
  }

  /**
   * Get orders with pagination
   */
  async getOrders(options: {
    limit?: number
    since_id?: number
    status?: 'open' | 'closed' | 'cancelled' | 'any'
    financial_status?: 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any'
    fulfillment_status?: 'shipped' | 'partial' | 'unshipped' | 'any'
    created_at_min?: string
    created_at_max?: string
    updated_at_min?: string
    updated_at_max?: string
    processed_at_min?: string
    processed_at_max?: string
    fields?: string
  } = {}): Promise<{
    orders: any[]
    hasNextPage: boolean
    nextPageInfo?: string
  }> {
    const params = new URLSearchParams()
    
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.since_id) params.append('since_id', options.since_id.toString())
    if (options.status) params.append('status', options.status)
    if (options.financial_status) params.append('financial_status', options.financial_status)
    if (options.fulfillment_status) params.append('fulfillment_status', options.fulfillment_status)
    if (options.created_at_min) params.append('created_at_min', options.created_at_min)
    if (options.created_at_max) params.append('created_at_max', options.created_at_max)
    if (options.updated_at_min) params.append('updated_at_min', options.updated_at_min)
    if (options.updated_at_max) params.append('updated_at_max', options.updated_at_max)
    if (options.processed_at_min) params.append('processed_at_min', options.processed_at_min)
    if (options.processed_at_max) params.append('processed_at_max', options.processed_at_max)
    if (options.fields) params.append('fields', options.fields)

    const endpoint = `/admin/api/${this.auth.getApiVersion()}/orders.json?${params.toString()}`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get orders: ${response.status} ${response.statusText}`,
        'ORDERS_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    const linkHeader = response.headers.get('Link')
    const hasNextPage = linkHeader?.includes('rel="next"') || false
    const nextPageInfo = linkHeader?.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1]

    return {
      orders: data.orders || [],
      hasNextPage,
      nextPageInfo,
    }
  }

  /**
   * Get B2B catalogs (if available)
   */
  async getCatalogs(): Promise<{
    catalogs: any[]
    hasNextPage: boolean
    nextPageInfo?: string
  }> {
    const endpoint = `/admin/api/${this.auth.getApiVersion()}/catalogs.json`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get catalogs: ${response.status} ${response.statusText}`,
        'CATALOGS_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    const linkHeader = response.headers.get('Link')
    const hasNextPage = linkHeader?.includes('rel="next"') || false
    const nextPageInfo = linkHeader?.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1]

    return {
      catalogs: data.catalogs || [],
      hasNextPage,
      nextPageInfo,
    }
  }

  /**
   * Get price lists for B2B (if available)
   */
  async getPriceLists(): Promise<{
    price_lists: any[]
    hasNextPage: boolean
    nextPageInfo?: string
  }> {
    const endpoint = `/admin/api/${this.auth.getApiVersion()}/price_lists.json`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get price lists: ${response.status} ${response.statusText}`,
        'PRICE_LISTS_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    const linkHeader = response.headers.get('Link')
    const hasNextPage = linkHeader?.includes('rel="next"') || false
    const nextPageInfo = linkHeader?.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1]

    return {
      price_lists: data.price_lists || [],
      hasNextPage,
      nextPageInfo,
    }
  }

  /**
   * Create or update a product
   */
  async createOrUpdateProduct(productData: any): Promise<any> {
    const method = productData.id ? 'PUT' : 'POST'
    const productId = productData.id ? `/${productData.id}` : ''
    
    const endpoint = `/admin/api/${this.auth.getApiVersion()}/products${productId}.json`
    const body = { product: productData }

    const response = await this.makeRequest(method, endpoint, body)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to ${productData.id ? 'update' : 'create'} product: ${response.status} ${response.statusText}`,
        'PRODUCT_UPDATE_FAILED',
        response.status
      )
    }

    const data = await response.json()
    return data.product
  }

  /**
   * Delete a product
   */
  async deleteProduct(productId: string): Promise<void> {
    const endpoint = `/admin/api/${this.auth.getApiVersion()}/products/${productId}.json`
    const response = await this.makeRequest('DELETE', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to delete product ${productId}: ${response.status} ${response.statusText}`,
        'PRODUCT_DELETE_FAILED',
        response.status
      )
    }
  }

  /**
   * Get webhook subscriptions
   */
  async getWebhooks(): Promise<{
    webhooks: any[]
    hasNextPage: boolean
    nextPageInfo?: string
  }> {
    const endpoint = `/admin/api/${this.auth.getApiVersion()}/webhooks.json`
    const response = await this.makeRequest('GET', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get webhooks: ${response.status} ${response.statusText}`,
        'WEBHOOKS_FETCH_FAILED',
        response.status
      )
    }

    const data = await response.json()
    const linkHeader = response.headers.get('Link')
    const hasNextPage = linkHeader?.includes('rel="next"') || false
    const nextPageInfo = linkHeader?.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1]

    return {
      webhooks: data.webhooks || [],
      hasNextPage,
      nextPageInfo,
    }
  }

  /**
   * Create a webhook subscription
   */
  async createWebhook(webhookData: {
    topic: string
    address: string
    format?: 'json' | 'xml'
    fields?: string[]
    metafield_namespaces?: string[]
    private_metafield_namespaces?: string[]
  }): Promise<any> {
    const endpoint = `/admin/api/${this.auth.getApiVersion()}/webhooks.json`
    const body = { webhook: webhookData }

    const response = await this.makeRequest('POST', endpoint, body)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to create webhook: ${response.status} ${response.statusText}`,
        'WEBHOOK_CREATE_FAILED',
        response.status
      )
    }

    const data = await response.json()
    return data.webhook
  }

  /**
   * Delete a webhook subscription
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const endpoint = `/admin/api/${this.auth.getApiVersion()}/webhooks/${webhookId}.json`
    const response = await this.makeRequest('DELETE', endpoint)

    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to delete webhook ${webhookId}: ${response.status} ${response.statusText}`,
        'WEBHOOK_DELETE_FAILED',
        response.status
      )
    }
  }
}