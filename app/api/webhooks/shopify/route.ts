// PRP-014: Shopify Webhook Handler
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { ShopifyAPIError } from '@/types/shopify.types'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  
  try {
    // Get webhook headers
    const topic = request.headers.get('x-shopify-topic')
    const shopDomain = request.headers.get('x-shopify-shop-domain')
    const hmac = request.headers.get('x-shopify-hmac-sha256')
    const webhookId = request.headers.get('x-shopify-webhook-id')
    const apiVersion = request.headers.get('x-shopify-api-version')

    if (!topic || !shopDomain || !hmac || !webhookId) {
      return NextResponse.json(
        { error: 'Missing required webhook headers' },
        { status: 400 }
      )
    }

    // Get request body
    const body = await request.text()
    
    // Find integration by shop domain
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select(`
        *,
        integration_credentials!inner(*)
      `)
      .eq('platform', 'shopify')
      .eq('status', 'active')
      .single()

    if (integrationError || !integration) {
      console.error('Shopify webhook: Integration not found', { shopDomain })
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Verify webhook signature
    const webhookSecret = integration.integration_credentials[0]?.credentials?.webhook_secret
    if (!webhookSecret) {
      console.error('Shopify webhook: No webhook secret found')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    const expectedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(body, 'utf8')
      .digest('base64')

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      console.error('Shopify webhook: Invalid signature')
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    // Parse webhook payload
    let payload: any
    try {
      payload = JSON.parse(body)
    } catch (error) {
      console.error('Shopify webhook: Invalid JSON payload', { error })
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Add webhook metadata
    const webhookData = {
      ...payload,
      topic,
      shop_domain: shopDomain,
      webhook_id: webhookId,
      api_version: apiVersion,
    }

    // Store webhook event for audit trail
    const { error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        integration_id: integration.id,
        organization_id: integration.organization_id,
        event_type: topic,
        platform: 'shopify',
        payload: webhookData,
        status: 'received',
        received_at: new Date().toISOString(),
      })

    if (webhookError) {
      console.error('Shopify webhook: Failed to store webhook event', { error: webhookError })
      // Don't fail the webhook for storage errors
    }

    // Create connector instance
    const connector = new ShopifyConnector({
      integrationId: integration.id,
      organizationId: integration.organization_id,
      credentials: integration.integration_credentials[0]?.credentials || {},
      settings: integration.config || {},
    })

    // Process webhook
    try {
      await connector.handleWebhook(webhookData)
      
      // Update webhook event status
      await supabase
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('integration_id', integration.id)
        .eq('event_type', topic)
        .eq('received_at', new Date().toISOString())

      console.log('Shopify webhook processed successfully', {
        topic,
        shopDomain,
        webhookId,
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Shopify webhook processing failed', {
        topic,
        shopDomain,
        webhookId,
        error,
      })

      // Update webhook event status
      await supabase
        .from('webhook_events')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          processed_at: new Date().toISOString(),
        })
        .eq('integration_id', integration.id)
        .eq('event_type', topic)
        .eq('received_at', new Date().toISOString())

      // Return 200 to acknowledge receipt even if processing failed
      // Shopify will retry if we return an error status
      return NextResponse.json({ success: false, error: 'Processing failed' })
    }

  } catch (error) {
    console.error('Shopify webhook handler error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint for webhook verification
  return NextResponse.json({ 
    status: 'ok',
    message: 'Shopify webhook endpoint is active'
  })
}