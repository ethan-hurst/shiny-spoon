// PRP-012: Dynamic webhook handler for all platforms
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { WebhookHandler } from '@/lib/integrations/webhook-handler'
import { createAdminClient } from '@/lib/supabase/admin'
import type { IntegrationPlatformType } from '@/types/integration.types'

// Disable body parsing to access raw body for signature verification
export const runtime = 'edge'

// Priority levels for sync jobs
const PRIORITY_LEVELS = {
  CRITICAL: 1,
  HIGH: 3,
  MEDIUM: 5,
  LOW: 7,
} as const

// Platform validation
const VALID_PLATFORMS: IntegrationPlatformType[] = [
  'shopify',
  'netsuite',
  'quickbooks',
  'sap',
  'dynamics365',
  'custom',
]

// Helper function to get integration context based on platform
async function getIntegrationContext(
  platform: string,
  headersList: Headers,
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ id: string; organization_id: string } | null> {
  try {
    switch (platform) {
      case 'shopify': {
        const shopifyShop = headersList.get('x-shopify-shop-domain')
        if (!shopifyShop) return null

        const { data: integration } = await supabase
          .from('integrations')
          .select('id, organization_id')
          .eq('platform', platform)
          .eq('config->shop_domain', shopifyShop)
          .single()

        return integration
      }
      
      case 'netsuite': {
        const accountId = headersList.get('x-netsuite-account-id')
        if (!accountId) return null

        const { data: integration } = await supabase
          .from('integrations')
          .select('id, organization_id')
          .eq('platform', platform)
          .eq('config->account_id', accountId)
          .single()

        return integration
      }
      
      case 'quickbooks': {
        const realmId = headersList.get('x-intuit-realm-id')
        if (!realmId) return null

        const { data: integration } = await supabase
          .from('integrations')
          .select('id, organization_id')
          .eq('platform', platform)
          .eq('config->realm_id', realmId)
          .single()

        return integration
      }
      
      // Add more platform-specific logic as needed
      default:
        return null
    }
  } catch (error) {
    console.error('Error fetching integration context:', error)
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform as IntegrationPlatformType
    
    // Validate platform
    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      )
    }

    // Get request headers and body
    const headersList = headers()
    const body = await request.text()

    // Initialize webhook handler
    const webhookHandler = new WebhookHandler()
    const supabase = createAdminClient()

    // Get webhook configuration for verification
    const webhookConfig = await webhookHandler.getWebhookConfig(
      platform,
      headersList
    )

    if (!webhookConfig) {
      return NextResponse.json(
        { error: 'Webhook configuration not found' },
        { status: 404 }
      )
    }

    // Verify webhook signature
    const isValid = await webhookHandler.verifyWebhook(
      platform,
      headersList,
      body,
      webhookConfig.secret
    )

    if (!isValid) {
      // Log failed verification
      await supabase.rpc('log_integration_activity', {
        p_integration_id: webhookConfig.integration_id,
        p_organization_id: webhookConfig.organization_id,
        p_log_type: 'webhook',
        p_severity: 'error',
        p_message: 'Webhook signature verification failed',
        p_details: {
          platform,
          headers: Object.fromEntries(headersList.entries()),
        },
      })

      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    // Parse webhook payload
    const payload = webhookHandler.parsePayload(platform, body, headersList)

    // Check if this event type is configured
    if (
      webhookConfig.events.length > 0 &&
      !webhookConfig.events.includes(payload.event_type)
    ) {
      return NextResponse.json(
        { message: 'Event type not configured' },
        { status: 200 }
      )
    }

    // Create sync job for processing
    const { data: job, error: jobError } = await supabase.rpc('create_sync_job', {
      p_integration_id: webhookConfig.integration_id,
      p_organization_id: webhookConfig.organization_id,
      p_job_type: 'webhook',
      p_payload: {
        webhook_id: webhookConfig.id,
        event_type: payload.event_type,
        payload: payload.data,
        received_at: new Date().toISOString(),
        platform,
      },
      p_priority: PRIORITY_LEVELS.HIGH, // High priority for webhooks
    })

    if (jobError) {
      throw jobError
    }

    // Update webhook last received timestamp
    await supabase
      .from('webhook_endpoints')
      .update({ last_received_at: new Date().toISOString() })
      .eq('id', webhookConfig.id)

    // Log successful webhook receipt
    await supabase.rpc('log_integration_activity', {
      p_integration_id: webhookConfig.integration_id,
      p_organization_id: webhookConfig.organization_id,
      p_log_type: 'webhook',
      p_severity: 'info',
      p_message: `Webhook received: ${payload.event_type}`,
      p_details: {
        job_id: job,
        event: payload.event_type,
        payload_size: body.length,
      },
    })

    // Return success response (platform-specific if needed)
    return webhookHandler.createSuccessResponse(platform)
  } catch (error) {
    console.error('Webhook processing error:', error)

    // Try to log error if we have integration context
    try {
      const supabase = createAdminClient()
      const platform = params.platform
      const headersList = headers()
      
      // Get integration context using helper function
      const integration = await getIntegrationContext(platform, headersList, supabase)

      if (integration) {
        await supabase.rpc('log_integration_activity', {
          p_integration_id: integration.id,
          p_organization_id: integration.organization_id,
          p_log_type: 'webhook',
          p_severity: 'critical',
          p_message: 'Webhook processing failed',
          p_details: {
            error: error instanceof Error ? error.message : String(error),
            platform,
          },
        })
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle other methods
export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  // Some platforms use GET for webhook verification
  const platform = params.platform as IntegrationPlatformType
  
  if (platform === 'shopify') {
    // Shopify webhook verification
    return NextResponse.json({ message: 'OK' }, { status: 200 })
  }

  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

// List of allowed webhook origins - configure based on your needs
const ALLOWED_WEBHOOK_ORIGINS = [
  'https://api.shopify.com',
  'https://myshopify.com',
  'https://api.netsuite.com',
  'https://quickbooks.api.intuit.com',
  'https://sandbox-quickbooks.api.intuit.com',
] as const

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  
  // Check exact matches
  if (ALLOWED_WEBHOOK_ORIGINS.includes(origin as any)) {
    return true
  }
  
  // Check pattern matches (e.g., Shopify subdomains)
  if (origin.endsWith('.myshopify.com')) {
    return true
  }
  
  return false
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const origin = request.headers.get('origin')
  
  // Only set CORS headers if origin is allowed
  if (!isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin!,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Topic, X-Shopify-Hmac-Sha256, X-Shopify-Shop-Domain, X-Shopify-Webhook-Id',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}