// PRP-012: Webhook Handler for Integration Framework
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Webhook event schema
const webhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.any()),
  timestamp: z.string(),
  signature: z.string().optional(),
})

// Platform-specific verification strategies
const verificationStrategies = {
  shopify: async (payload: string, signature: string, secret: string) => {
    // Use Web Crypto API for HMAC verification
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(payload)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const expectedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer))
    )

    return `sha256=${expectedSignature}` === signature
  },
  netsuite: async (payload: string, signature: string, secret: string) => {
    // NetSuite uses HMAC-SHA256 for webhook verification
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(payload)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const expectedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer))
    )

    return expectedSignature === signature
  },
  woocommerce: async (payload: string, signature: string, secret: string) => {
    // WooCommerce uses HMAC-SHA256
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(payload)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return expectedSignature === signature
  },
}

export async function verifyWebhookSignature(
  platform: string,
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const strategy =
    verificationStrategies[platform as keyof typeof verificationStrategies]

  if (!strategy) {
    console.warn(`No verification strategy for platform: ${platform}`)
    return true // Allow unverified webhooks for unknown platforms
  }

  try {
    return await strategy(payload, signature, secret)
  } catch (error) {
    console.error(`Webhook verification failed for ${platform}:`, error)
    return false
  }
}

export async function processWebhookEvent(
  platform: string,
  eventType: string,
  eventData: any,
  organizationId: string
) {
  const supabase = createClient()

  try {
    // Log webhook event
    const { error: logError } = await supabase.from('webhook_events').insert({
      platform,
      event_type: eventType,
      event_data: eventData,
      organization_id: organizationId,
      processed_at: new Date().toISOString(),
    })

    if (logError) {
      console.error('Failed to log webhook event:', logError)
    }

    // Process based on platform and event type
    switch (platform) {
      case 'shopify':
        return await processShopifyWebhook(eventType, eventData, organizationId)
      case 'netsuite':
        return await processNetSuiteWebhook(
          eventType,
          eventData,
          organizationId
        )
      case 'woocommerce':
        return await processWooCommerceWebhook(
          eventType,
          eventData,
          organizationId
        )
      default:
        console.warn(`Unknown platform: ${platform}`)
        return { success: false, error: 'Unknown platform' }
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return { success: false, error: 'Processing failed' }
  }
}

async function processShopifyWebhook(
  eventType: string,
  eventData: any,
  organizationId: string
) {
  const supabase = createClient()

  switch (eventType) {
    case 'products/create':
    case 'products/update':
      // Sync product data
      const { error: productError } = await supabase.from('products').upsert({
        external_id: eventData.id.toString(),
        name: eventData.title,
        sku: eventData.variants?.[0]?.sku,
        price: parseFloat(eventData.variants?.[0]?.price || '0'),
        organization_id: organizationId,
        platform: 'shopify',
        last_synced_at: new Date().toISOString(),
      })

      if (productError) throw productError
      break

    case 'orders/create':
    case 'orders/updated':
      // Sync order data
      const { error: orderError } = await supabase.from('orders').upsert({
        external_id: eventData.id.toString(),
        customer_id: eventData.customer?.id?.toString(),
        total_amount: parseFloat(eventData.total_price || '0'),
        status: eventData.financial_status,
        organization_id: organizationId,
        platform: 'shopify',
        last_synced_at: new Date().toISOString(),
      })

      if (orderError) throw orderError
      break
  }

  return { success: true }
}

async function processNetSuiteWebhook(
  eventType: string,
  eventData: any,
  organizationId: string
) {
  const supabase = createClient()

  switch (eventType) {
    case 'item_created':
    case 'item_updated':
      // Sync NetSuite item data
      const { error: productError } = await supabase.from('products').upsert({
        external_id: eventData.id?.toString(),
        name: eventData.itemid,
        sku: eventData.itemid,
        price: parseFloat(eventData.rate || '0'),
        organization_id: organizationId,
        platform: 'netsuite',
        last_synced_at: new Date().toISOString(),
      })

      if (productError) throw productError
      break

    case 'sales_order_created':
    case 'sales_order_updated':
      // Sync NetSuite sales order data
      const { error: orderError } = await supabase.from('orders').upsert({
        external_id: eventData.tranid,
        customer_id: eventData.entity?.toString(),
        total_amount: parseFloat(eventData.total || '0'),
        status: eventData.transtatus,
        organization_id: organizationId,
        platform: 'netsuite',
        last_synced_at: new Date().toISOString(),
      })

      if (orderError) throw orderError
      break
  }

  return { success: true }
}

async function processWooCommerceWebhook(
  eventType: string,
  eventData: any,
  organizationId: string
) {
  const supabase = createClient()

  switch (eventType) {
    case 'product.created':
    case 'product.updated':
      // Sync WooCommerce product data
      const { error: productError } = await supabase.from('products').upsert({
        external_id: eventData.id?.toString(),
        name: eventData.name,
        sku: eventData.sku,
        price: parseFloat(eventData.price || '0'),
        organization_id: organizationId,
        platform: 'woocommerce',
        last_synced_at: new Date().toISOString(),
      })

      if (productError) throw productError
      break

    case 'order.created':
    case 'order.updated':
      // Sync WooCommerce order data
      const { error: orderError } = await supabase.from('orders').upsert({
        external_id: eventData.id?.toString(),
        customer_id: eventData.customer_id?.toString(),
        total_amount: parseFloat(eventData.total || '0'),
        status: eventData.status,
        organization_id: organizationId,
        platform: 'woocommerce',
        last_synced_at: new Date().toISOString(),
      })

      if (orderError) throw orderError
      break
  }

  return { success: true }
}
