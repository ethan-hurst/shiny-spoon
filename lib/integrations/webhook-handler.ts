// PRP-012: Webhook Handler for Integration Framework
import crypto from 'crypto'
import { Headers } from 'next/dist/compiled/@edge-runtime/primitives'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type {
  WebhookEndpoint,
  WebhookEvent,
  IntegrationPlatformType,
} from '@/types/integration.types'

// Webhook configuration with platform-specific details
interface WebhookConfig extends WebhookEndpoint {
  integration_id: string
  organization_id: string
  platform: IntegrationPlatformType
}

// Platform-specific webhook verifiers
type WebhookVerifier = (
  headers: Headers,
  body: string,
  secret: string
) => boolean | Promise<boolean>

export class WebhookHandler {
  private supabase = createAdminClient()
  private verifiers: Record<string, WebhookVerifier>

  constructor() {
    // Initialize platform-specific verifiers
    this.verifiers = {
      shopify: this.verifyShopifyWebhook.bind(this),
      netsuite: this.verifyNetSuiteWebhook.bind(this),
      quickbooks: this.verifyQuickBooksWebhook.bind(this),
      stripe: this.verifyStripeWebhook.bind(this),
      custom: this.verifyGenericWebhook.bind(this),
    }
  }

  /**
   * Get webhook configuration based on platform and headers
   */
  async getWebhookConfig(
    platform: IntegrationPlatformType,
    headers: Headers
  ): Promise<WebhookConfig | null> {
    // Debug logging: capture input parameters
    const debugInfo = {
      platform,
      headers: {} as Record<string, string | null>,
      timestamp: new Date().toISOString(),
    }

    // Extract relevant headers for debugging
    const relevantHeaders = [
      'x-shopify-shop-domain',
      'x-shopify-topic',
      'x-shopify-webhook-id',
      'intuit-company-id',
      'x-netsuite-account-id',
      'x-webhook-id',
      'user-agent',
    ]

    relevantHeaders.forEach((header) => {
      const value = headers.get(header)
      if (value) {
        debugInfo.headers[header] = value
      }
    })

    console.log('[WebhookHandler] getWebhookConfig - Starting query:', debugInfo)

    try {
      // Platform-specific webhook identification
      let query = this.supabase
        .from('webhook_endpoints')
        .select(`
          *,
          integrations!inner(
            id,
            organization_id,
            platform,
            config,
            status
          )
        `)
        .eq('integrations.platform', platform)
        .eq('is_active', true)

      // Track query filters for debugging
      const queryFilters: Record<string, any> = {
        platform,
        is_active: true,
      }

      // Add platform-specific filters
      switch (platform) {
        case 'shopify': {
          const shopDomain = headers.get('x-shopify-shop-domain')
          if (shopDomain) {
            query = query.eq('integrations.config->shop_domain', shopDomain)
            queryFilters.shop_domain = shopDomain
          }
          break
        }

        case 'quickbooks': {
          const companyId = headers.get('intuit-company-id')
          if (companyId) {
            query = query.eq('integrations.config->company_id', companyId)
            queryFilters.company_id = companyId
          }
          break
        }

        default:
          // For other platforms, try to match by webhook URL or other headers
          break
      }

      console.log('[WebhookHandler] getWebhookConfig - Query filters:', queryFilters)

      const { data, error } = await query.single()

      if (error) {
        console.error('[WebhookHandler] getWebhookConfig - Database error:', {
          error: error.message,
          code: error.code,
          details: error.details,
          platform,
          filters: queryFilters,
        })
        return null
      }

      if (!data) {
        console.warn('[WebhookHandler] getWebhookConfig - No webhook config found:', {
          platform,
          filters: queryFilters,
        })
        return null
      }

      const webhookConfig = {
        ...data,
        integration_id: data.integrations.id,
        organization_id: data.integrations.organization_id,
        platform: data.integrations.platform,
      } as WebhookConfig

      console.log('[WebhookHandler] getWebhookConfig - Success:', {
        webhook_id: webhookConfig.id,
        integration_id: webhookConfig.integration_id,
        organization_id: webhookConfig.organization_id,
        platform: webhookConfig.platform,
        endpoint_url: webhookConfig.endpoint_url,
        events: webhookConfig.events,
      })

      return webhookConfig
    } catch (error) {
      console.error('[WebhookHandler] getWebhookConfig - Unexpected error:', {
        error: error instanceof Error ? error.message : String(error),
        platform,
        headers: debugInfo.headers,
      })
      return null
    }
  }

  /**
   * Verify webhook signature based on platform
   */
  async verifyWebhook(
    platform: IntegrationPlatformType,
    headers: Headers,
    body: string,
    secret: string
  ): Promise<boolean> {
    const verifier = this.verifiers[platform] || this.verifiers.custom
    
    try {
      return await verifier(headers, body, secret)
    } catch (error) {
      console.error(`Webhook verification failed for ${platform}:`, error)
      return false
    }
  }

  /**
   * Parse webhook payload based on platform
   */
  parsePayload(
    platform: IntegrationPlatformType,
    body: string,
    headers: Headers
  ): WebhookEvent {
    try {
      const data = JSON.parse(body)
      
      switch (platform) {
        case 'shopify':
          return {
            id: headers.get('x-shopify-webhook-id') || crypto.randomUUID(),
            platform,
            event_type: headers.get('x-shopify-topic') || 'unknown',
            payload: data,
            signature: headers.get('x-shopify-hmac-sha256'),
            timestamp: new Date().toISOString(),
            integration_id: '', // Set by caller
          }

        case 'quickbooks':
          return {
            id: data.eventNotifications?.[0]?.id || crypto.randomUUID(),
            platform,
            event_type: data.eventNotifications?.[0]?.eventType || 'unknown',
            payload: data,
            signature: headers.get('intuit-signature'),
            timestamp: data.eventNotifications?.[0]?.eventDate || new Date().toISOString(),
            integration_id: '',
          }

        case 'netsuite':
          return {
            id: data.id || crypto.randomUUID(),
            platform,
            event_type: data.recordType || 'unknown',
            payload: data,
            signature: headers.get('x-netsuite-signature'),
            timestamp: data.timestamp || new Date().toISOString(),
            integration_id: '',
          }

        default:
          // Generic webhook parsing
          return {
            id: data.id || crypto.randomUUID(),
            platform,
            event_type: data.event || data.type || 'unknown',
            payload: data,
            signature: headers.get('x-webhook-signature'),
            timestamp: data.timestamp || new Date().toISOString(),
            integration_id: '',
          }
      }
    } catch (error) {
      throw new Error(`Failed to parse webhook payload: ${error}`)
    }
  }

  /**
   * Create platform-specific success response
   */
  createSuccessResponse(platform: IntegrationPlatformType): NextResponse {
    switch (platform) {
      case 'shopify':
        // Shopify expects 200 OK with no body
        return new NextResponse(null, { status: 200 })

      case 'quickbooks':
        // QuickBooks expects 200 OK with empty JSON
        return NextResponse.json({}, { status: 200 })

      default:
        // Generic success response
        return NextResponse.json({ success: true }, { status: 200 })
    }
  }

  /**
   * Shopify webhook verification
   */
  private verifyShopifyWebhook(
    headers: Headers,
    body: string,
    secret: string
  ): boolean {
    const hmac = headers.get('x-shopify-hmac-sha256')
    if (!hmac) return false

    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')

    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash))
  }

  /**
   * NetSuite webhook verification
   */
  private verifyNetSuiteWebhook(
    headers: Headers,
    body: string,
    secret: string
  ): boolean {
    const signature = headers.get('x-netsuite-signature')
    if (!signature) return false

    // NetSuite uses HMAC-SHA256 with base64 encoding
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64')

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash))
  }

  /**
   * QuickBooks webhook verification
   */
  private async verifyQuickBooksWebhook(
    headers: Headers,
    body: string,
    secret: string
  ): Promise<boolean> {
    const signature = headers.get('intuit-signature')
    if (!signature) return false

    // QuickBooks uses HMAC-SHA256 with base64 encoding
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64')

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hash)
    )
  }

  /**
   * Stripe webhook verification (example for payment integrations)
   */
  private verifyStripeWebhook(
    headers: Headers,
    body: string,
    secret: string
  ): boolean {
    const signature = headers.get('stripe-signature')
    if (!signature) return false

    // Parse Stripe signature format: t=timestamp,v1=signature
    const elements = signature.split(',')
    const signatureMap = new Map<string, string>()

    for (const element of elements) {
      const [key, value] = element.split('=')
      signatureMap.set(key, value)
    }

    const timestamp = signatureMap.get('t')
    const v1Signature = signatureMap.get('v1')

    if (!timestamp || !v1Signature) return false

    // Verify timestamp is within 5 minutes
    const currentTime = Math.floor(Date.now() / 1000)
    const webhookTime = parseInt(timestamp, 10)
    if (Math.abs(currentTime - webhookTime) > 300) {
      return false
    }

    // Compute expected signature
    const payload = `${timestamp}.${body}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Generic webhook verification with timestamp
   */
  private verifyGenericWebhook(
    headers: Headers,
    body: string,
    secret: string
  ): boolean {
    const signature = headers.get('x-webhook-signature')
    if (!signature) return false

    // Try different signature formats
    
    // Format 1: Simple HMAC
    const simpleHash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    if (signature === simpleHash) return true

    // Format 2: timestamp.signature
    if (signature.includes('.')) {
      const [timestamp, hash] = signature.split('.')
      
      // Verify timestamp is within 5 minutes
      const currentTime = Math.floor(Date.now() / 1000)
      const webhookTime = parseInt(timestamp, 10)
      if (Math.abs(currentTime - webhookTime) > 300) {
        return false
      }

      const payload = `${timestamp}.${body}`
      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))
    }

    return false
  }

  /**
   * Check if webhook should be deduplicated
   */
  async isDuplicate(
    integrationId: string,
    eventId: string,
    eventType: string
  ): Promise<boolean> {
    // Check if we've seen this event in the last hour
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const { data } = await this.supabase
      .from('integration_logs')
      .select('id')
      .eq('integration_id', integrationId)
      .eq('details->event_id', eventId)
      .eq('details->event_type', eventType)
      .gte('created_at', oneHourAgo.toISOString())
      .limit(1)

    return data !== null && data.length > 0
  }

  /**
   * Process webhook based on event type
   */
  async processWebhook(
    config: WebhookConfig,
    event: WebhookEvent
  ): Promise<void> {
    // Check for duplicates
    if (await this.isDuplicate(config.integration_id, event.id, event.event_type)) {
      await this.supabase.rpc('log_integration_activity', {
        p_integration_id: config.integration_id,
        p_organization_id: config.organization_id,
        p_log_type: 'webhook',
        p_severity: 'info',
        p_message: 'Duplicate webhook ignored',
        p_details: {
          event_id: event.id,
          event_type: event.event_type,
        },
      })
      return
    }

    // Platform-specific processing logic would go here
    // This would typically create appropriate sync jobs
    // based on the event type and platform
  }
}