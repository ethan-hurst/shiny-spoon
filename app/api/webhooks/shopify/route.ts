// PRP-014: Shopify Webhook Route Handler
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ShopifyWebhookTopic, ShopifyWebhookPayload } from '@/types/shopify.types'
import { 
  shopifyProductWebhookSchema,
  shopifyInventoryWebhookSchema,
  shopifyOrderWebhookSchema 
} from '@/types/shopify.types'

// Disable body parsing to get raw body for HMAC verification
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headers = request.headers

  // Get webhook metadata
  const topic = headers.get('x-shopify-topic') as ShopifyWebhookTopic | null
  const shopDomain = headers.get('x-shopify-shop-domain')
  const hmac = headers.get('x-shopify-hmac-sha256')
  const webhookId = headers.get('x-shopify-webhook-id')
  const apiVersion = headers.get('x-shopify-api-version')

  // Validate required headers
  if (!topic || !shopDomain || !hmac) {
    console.error('Missing required Shopify webhook headers', {
      topic: !!topic,
      shopDomain: !!shopDomain,
      hmac: !!hmac
    })
    return NextResponse.json(
      { error: 'Missing required headers' },
      { status: 400 }
    )
  }

  const supabase = supabaseAdmin

  try {
    // Find integration by shop domain
    const { data: shopifyConfig, error: configError } = await supabase
      .from('shopify_config')
      .select(`
        id,
        integration_id,
        integrations!inner(
          id,
          organization_id,
          credentials,
          status,
          config
        )
      `)
      .eq('shop_domain', shopDomain)
      .single()

    if (configError || !shopifyConfig) {
      console.error(`No integration found for shop: ${shopDomain}`, configError)
      // Return 200 to prevent Shopify retries for unknown shops
      return NextResponse.json(
        { success: true, message: 'Shop not configured' },
        { status: 200 }
      )
    }

    const integration = shopifyConfig.integrations

    // Check if integration is active
    if (integration.status !== 'active') {
      // Integration inactive for shop
      return NextResponse.json(
        { success: true, message: 'Integration inactive' },
        { status: 200 }
      )
    }

    // Initialize connector
    const connector = new ShopifyConnector({
      integrationId: integration.id,
      organizationId: integration.organization_id,
      credentials: integration.credentials,
      settings: {
        ...integration.config,
        shop_domain: shopDomain
      }
    })

    // Verify webhook signature
    const isValid = await connector.verifyWebhook(headers, body)

    if (!isValid) {
      console.error('Invalid webhook signature from Shopify', {
        shop: shopDomain,
        topic
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate webhook body based on topic
    let parsedData: ShopifyWebhookPayload
    try {
      parsedData = JSON.parse(body)
      
      // Add webhook metadata
      parsedData.webhook_id = webhookId
      parsedData.api_version = apiVersion || '2024-01'
      
      // Validate based on topic
      switch (topic) {
        case 'products/create':
        case 'products/update':
        case 'products/delete':
          shopifyProductWebhookSchema.parse(parsedData)
          break
          
        case 'inventory_levels/update':
          shopifyInventoryWebhookSchema.parse(parsedData)
          break
          
        case 'orders/create':
        case 'orders/updated':
        case 'orders/cancelled':
          shopifyOrderWebhookSchema.parse(parsedData)
          break
          
        // Other webhook topics don't need strict validation
        default:
          break
      }
    } catch (parseError) {
      console.error('Failed to parse webhook body', {
        error: parseError,
        topic,
        shop: shopDomain
      })
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    // Process webhook asynchronously
    try {
      await connector.handleWebhook(topic, parsedData)
      
      // Log successful processing
      await supabase.rpc('log_shopify_sync_activity', {
        p_integration_id: integration.id,
        p_entity_type: 'webhook',
        p_action: 'processed',
        p_details: {
          topic,
          webhook_id: webhookId,
          shop_domain: shopDomain
        }
      })

      return NextResponse.json(
        { success: true },
        { status: 200 }
      )
    } catch (processError) {
      // Log error but return 200 to prevent immediate retry
      console.error('Webhook processing error:', {
        error: processError,
        topic,
        shop: shopDomain,
        webhookId
      })

      await supabase.rpc('log_shopify_sync_activity', {
        p_integration_id: integration.id,
        p_entity_type: 'webhook',
        p_action: 'failed',
        p_details: {
          topic,
          webhook_id: webhookId,
          shop_domain: shopDomain,
          error: processError instanceof Error ? processError.message : 'Unknown error'
        }
      })

      // Return 200 for non-recoverable errors to prevent Shopify retry storm
      // Only return 500 for temporary/network errors that should be retried
      const isRecoverable = processError instanceof Error && 
        (processError.message.includes('network') || 
         processError.message.includes('timeout') ||
         processError.message.includes('database'))

      if (isRecoverable) {
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { success: true, warning: 'Webhook stored for later processing' },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Webhook handler error:', error)

    // For unexpected errors, return 500 to trigger retry
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Webhook registration endpoint (optional - for programmatic registration)
export async function GET(request: NextRequest) {
  // This endpoint can be used to verify webhook configuration
  // or list registered webhooks
  
  const shopDomain = request.nextUrl.searchParams.get('shop')
  
  if (!shopDomain) {
    return NextResponse.json(
      { error: 'Shop domain required' },
      { status: 400 }
    )
  }

  const supabase = supabaseAdmin

  // Verify shop exists in our system
  const { data: config } = await supabase
    .from('shopify_config')
    .select('id, shop_domain')
    .eq('shop_domain', shopDomain)
    .single()

  if (!config) {
    return NextResponse.json(
      { error: 'Shop not found' },
      { status: 404 }
    )
  }

  // Return webhook endpoint info
  return NextResponse.json({
    shop: shopDomain,
    webhook_url: `${process.env.NEXT_PUBLIC_URL}/api/webhooks/shopify`,
    supported_topics: [
      'products/create',
      'products/update',
      'products/delete',
      'inventory_levels/update',
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'customers/create',
      'customers/update',
      'bulk_operations/finish'
    ],
    verification: 'HMAC-SHA256'
  })
}