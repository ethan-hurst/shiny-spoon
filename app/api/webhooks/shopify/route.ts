// PRP-014: Shopify Webhook Route Handler
import { NextRequest, NextResponse } from 'next/server'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type {
  ShopifyWebhookPayload,
  ShopifyWebhookTopic,
} from '@/types/shopify.types'
import {
  shopifyInventoryWebhookSchema,
  shopifyOrderWebhookSchema,
  shopifyProductWebhookSchema,
} from '@/types/shopify.types'

// Disable body parsing to get raw body for HMAC verification
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// Simple in-memory rate limiter for Edge runtime
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 100 // 100 requests per minute per shop
const MAX_RATE_LIMIT_ENTRIES = 1000 // Prevent memory leak

/**
 * Removes expired and excess entries from the in-memory rate limit map to prevent memory leaks.
 *
 * Deletes entries whose reset time has passed and, if the map still exceeds the maximum allowed entries, removes the oldest entries by reset time.
 */
function cleanupRateLimits() {
  const now = Date.now()
  const entriesToDelete: string[] = []

  for (const [key, limit] of rateLimitMap) {
    if (now > limit.resetTime) {
      entriesToDelete.push(key)
    }
  }

  for (const key of entriesToDelete) {
    rateLimitMap.delete(key)
  }

  // If still too many entries, remove oldest ones
  if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const entries = Array.from(rateLimitMap.entries()).sort(
      (a, b) => a[1].resetTime - b[1].resetTime
    )

    const toRemove = entries.slice(0, entries.length - MAX_RATE_LIMIT_ENTRIES)
    for (const [key] of toRemove) {
      rateLimitMap.delete(key)
    }
  }
}

/**
 * Checks and updates the rate limit for a given shop domain.
 *
 * Returns `true` if the shop is under the allowed request limit for the current window, or `false` if the rate limit has been exceeded.
 */
function checkRateLimit(shopDomain: string): boolean {
  const now = Date.now()
  const key = `shopify-webhook:${shopDomain}`
  const limit = rateLimitMap.get(key)

  // Cleanup periodically (on 1% of requests)
  if (Math.random() < 0.01) {
    cleanupRateLimits()
  }

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return false
  }

  limit.count++
  return true
}

/**
 * Handles incoming Shopify webhook POST requests, performing validation, rate limiting, signature verification, payload parsing, and processing.
 *
 * Validates required headers and enforces a per-shop rate limit. Retrieves the Shopify integration configuration from Supabase and verifies the webhook signature. Parses and validates the webhook payload according to the topic. Processes the webhook asynchronously and logs the outcome. Handles recoverable errors by returning a 500 status to trigger Shopify retries, and stores non-recoverable errors for manual reprocessing.
 *
 * @returns A JSON response indicating success, error, or warning, with appropriate HTTP status codes.
 */
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
      hmac: !!hmac,
    })
    return NextResponse.json(
      { error: 'Missing required headers' },
      { status: 400 }
    )
  }

  // Validate shop domain format
  const shopDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/
  if (!shopDomainRegex.test(shopDomain)) {
    console.error('Invalid shop domain format', { shopDomain })
    return NextResponse.json(
      { error: 'Invalid shop domain format' },
      { status: 400 }
    )
  }

  // Check rate limit
  if (!checkRateLimit(shopDomain)) {
    console.warn(`Rate limit exceeded for shop: ${shopDomain}`)
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = supabaseAdmin

  try {
    // Find integration by shop domain
    const { data: shopifyConfig, error: configError } = await supabase
      .from('shopify_config')
      .select(
        `
        id,
        integration_id,
        integrations!inner(
          id,
          organization_id,
          credentials,
          status,
          config
        )
      `
      )
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
        shop_domain: shopDomain,
      },
    })

    // Verify webhook signature
    const isValid = await connector.verifyWebhook(headers, body)

    if (!isValid) {
      console.error('Invalid webhook signature from Shopify', {
        shop: shopDomain,
        topic,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        shop: shopDomain,
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
          shop_domain: shopDomain,
        },
      })

      return NextResponse.json({ success: true }, { status: 200 })
    } catch (processError) {
      // Log error but return 200 to prevent immediate retry
      console.error('Webhook processing error:', {
        error: processError,
        topic,
        shop: shopDomain,
        webhookId,
      })

      await supabase.rpc('log_shopify_sync_activity', {
        p_integration_id: integration.id,
        p_entity_type: 'webhook',
        p_action: 'failed',
        p_details: {
          topic,
          webhook_id: webhookId,
          shop_domain: shopDomain,
          error:
            processError instanceof Error
              ? processError.message
              : 'Unknown error',
        },
      })

      // Refactored error recovery logic
      const isRecoverableError = (error: unknown): boolean => {
        if (!(error instanceof Error)) return false

        const recoverablePatterns = [
          'network',
          'timeout',
          'ECONNREFUSED',
          'ETIMEDOUT',
          'database connection',
          'transaction',
          'deadlock',
        ]

        const errorMessage = error.message.toLowerCase()
        return recoverablePatterns.some((pattern) =>
          errorMessage.includes(pattern)
        )
      }

      if (isRecoverableError(processError)) {
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }

      // For non-recoverable errors, store for manual processing
      await supabase.from('webhook_queue').insert({
        integration_id: integration.id,
        platform: 'shopify',
        topic,
        payload: parsedData,
        error_message:
          processError instanceof Error
            ? processError.message
            : 'Unknown error',
        retry_count: 0,
        status: 'failed',
      })

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

/**
 * Returns webhook registration and configuration details for a given Shopify shop domain.
 *
 * Responds with the webhook endpoint URL, supported topics, and verification method if the shop exists; otherwise, returns an error.
 */
export async function GET(request: NextRequest) {
  // This endpoint can be used to verify webhook configuration
  // or list registered webhooks

  const shopDomain = request.nextUrl.searchParams.get('shop')

  if (!shopDomain) {
    return NextResponse.json({ error: 'Shop domain required' }, { status: 400 })
  }

  // Validate shop domain format
  const shopDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/
  if (!shopDomainRegex.test(shopDomain)) {
    return NextResponse.json(
      { error: 'Invalid shop domain format' },
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
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
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
      'bulk_operations/finish',
    ],
    verification: 'HMAC-SHA256',
  })
}
