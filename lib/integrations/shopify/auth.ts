// PRP-014: Shopify Authentication Module
import { createClient } from '@/lib/supabase/server'
import { ShopifyAPIError, ShopifyRateLimitError } from '@/types/shopify.types'

export interface ShopifyAuthConfig {
  shop_domain: string
  access_token: string
  api_version: string
}

export class ShopifyAuth {
  private supabase = createClient()
  private config: ShopifyAuthConfig
  private integrationId: string
  private organizationId: string

  constructor(
    integrationId: string,
    organizationId: string,
    config: ShopifyAuthConfig
  ) {
    this.integrationId = integrationId
    this.organizationId = organizationId
    this.config = config
  }

  /**
   * Initialize authentication with stored credentials
   */
  async initialize(): Promise<void> {
    try {
      // Validate that we have the required credentials
      if (!this.config.shop_domain || !this.config.access_token) {
        throw new ShopifyAPIError(
          'Missing required Shopify credentials',
          'MISSING_CREDENTIALS'
        )
      }

      // Test the credentials by making a simple API call
      await this.validateCredentials()
    } catch (error) {
      throw new ShopifyAPIError(
        `Failed to initialize Shopify authentication: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'AUTH_INITIALIZATION_FAILED'
      )
    }
  }

  /**
   * Validate credentials by making a test API call
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/admin/api/2024-01/shop.json')
      
      if (!response.ok) {
        throw new ShopifyAPIError(
          `Shopify API validation failed: ${response.status} ${response.statusText}`,
          'INVALID_CREDENTIALS',
          response.status
        )
      }

      const data = await response.json()
      
      // Verify we got shop data back
      if (!data.shop || !data.shop.id) {
        throw new ShopifyAPIError(
          'Invalid response from Shopify API',
          'INVALID_RESPONSE'
        )
      }

      return true
    } catch (error) {
      if (error instanceof ShopifyAPIError) {
        throw error
      }
      
      throw new ShopifyAPIError(
        `Credential validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VALIDATION_FAILED'
      )
    }
  }

  /**
   * Get the base URL for the Shopify store
   */
  getBaseUrl(): string {
    return `https://${this.config.shop_domain}`
  }

  /**
   * Get the API version
   */
  getApiVersion(): string {
    return this.config.api_version || '2024-01'
  }

  /**
   * Get the access token
   */
  getAccessToken(): string {
    return this.config.access_token
  }

  /**
   * Make an authenticated request to Shopify API
   */
  async makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<Response> {
    const url = `${this.getBaseUrl()}${endpoint}`
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.config.access_token,
      ...headers,
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    }

    if (body) {
      requestOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, requestOptions)

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60
      
      throw new ShopifyRateLimitError(
        'Shopify API rate limit exceeded',
        retryAfterSeconds
      )
    }

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      throw new ShopifyAPIError(
        'Shopify API authentication failed',
        'AUTHENTICATION_FAILED',
        response.status
      )
    }

    return response
  }

  /**
   * Make a GraphQL request to Shopify API
   */
  async makeGraphQLRequest(
    query: string,
    variables?: Record<string, any>
  ): Promise<Response> {
    const endpoint = `/admin/api/${this.getApiVersion()}/graphql.json`
    
    const body = {
      query,
      variables: variables || {},
    }

    return this.makeRequest('POST', endpoint, body)
  }

  /**
   * Update stored credentials
   */
  async updateCredentials(newConfig: Partial<ShopifyAuthConfig>): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('integration_credentials')
        .update({
          credentials: {
            ...this.config,
            ...newConfig,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('integration_id', this.integrationId)
        .eq('organization_id', this.organizationId)

      if (error) {
        throw new Error(`Failed to update credentials: ${error.message}`)
      }

      // Update local config
      this.config = { ...this.config, ...newConfig }
    } catch (error) {
      throw new ShopifyAPIError(
        `Failed to update credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CREDENTIAL_UPDATE_FAILED'
      )
    }
  }

  /**
   * Get shop information
   */
  async getShopInfo(): Promise<{
    id: string
    name: string
    email: string
    domain: string
    province: string
    country: string
    currency: string
    timezone: string
    iana_timezone: string
    money_format: string
    money_with_currency_format: string
    weight_unit: string
    province_code: string
    country_code: string
    country_name: string
    currency_formatted: string
    has_discounts: boolean
    has_gift_cards: boolean
    myshopify_domain: string
    google_apps_domain: string
    google_apps_login_enabled: boolean
    money_in_emails_format: string
    money_with_currency_in_emails_format: string
    eligible_for_payments: boolean
    requires_extra_payments_agreement: boolean
    password_enabled: boolean
    has_storefront: boolean
    finances: boolean
    primary_location_id: number
    cookie_consent_level: string
    visitor_tracking_consent_preference: string
    checkout_api_supported: boolean
    multi_location_enabled: boolean
    setup_required: boolean
    pre_launch_enabled: boolean
    enabled_presentment_currencies: string[]
    transactional_sms_disabled: boolean
    marketing_sms_consent_enabled_at_checkout: boolean
    shop_owner: number
    phone: string
    latitude: number
    longitude: number
    primary_locale: string
    address1: string
    address2: string
    city: string
    zip: string
    created_at: string
    updated_at: string
  }> {
    const response = await this.makeRequest('GET', `/admin/api/${this.getApiVersion()}/shop.json`)
    
    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get shop info: ${response.status} ${response.statusText}`,
        'SHOP_INFO_FAILED',
        response.status
      )
    }

    const data = await response.json()
    return data.shop
  }

  /**
   * Check if the shop has B2B features enabled
   */
  async hasB2BFeatures(): Promise<boolean> {
    try {
      // Try to access B2B-specific endpoints
      const response = await this.makeRequest('GET', `/admin/api/${this.getApiVersion()}/catalogs.json`)
      return response.ok
    } catch (error) {
      // If we get a 404 or other error, B2B features are not available
      return false
    }
  }

  /**
   * Get available locations for the shop
   */
  async getLocations(): Promise<Array<{
    id: number
    name: string
    address1: string
    address2: string
    city: string
    zip: string
    province: string
    country: string
    phone: string
    created_at: string
    updated_at: string
    country_code: string
    country_name: string
    province_code: string
    legacy: boolean
    active: boolean
    admin_graphql_api_id: string
    localized_name: string
    localized_province_name: string
    localized_country_name: string
  }>> {
    const response = await this.makeRequest('GET', `/admin/api/${this.getApiVersion()}/locations.json`)
    
    if (!response.ok) {
      throw new ShopifyAPIError(
        `Failed to get locations: ${response.status} ${response.statusText}`,
        'LOCATIONS_FAILED',
        response.status
      )
    }

    const data = await response.json()
    return data.locations
  }

  /**
   * Get API usage information
   */
  async getApiUsage(): Promise<{
    current: number
    limit: number
    remaining: number
    resetTime: Date
  }> {
    const response = await this.makeRequest('GET', `/admin/api/${this.getApiVersion()}/shop.json`)
    
    const current = parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0', 10)
    const limit = parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '0', 10)
    const retryAfter = response.headers.get('Retry-After')
    
    return {
      current,
      limit,
      remaining: Math.max(0, limit - current),
      resetTime: retryAfter ? new Date(Date.now() + parseInt(retryAfter, 10) * 1000) : new Date(),
    }
  }
}