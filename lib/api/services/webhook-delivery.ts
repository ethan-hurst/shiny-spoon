import { createClient } from '@/lib/supabase/server'
import { WebhookSubscription, WebhookEvent, WebhookDeliveryStatus } from '@/lib/api/types'
import crypto from 'crypto'

/**
 * Generate webhook signature
 */
function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const message = `${timestamp}.${payload}`
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string,
  tolerance: number = 300 // 5 minutes
): boolean {
  // Check timestamp to prevent replay attacks
  const currentTime = Math.floor(Date.now() / 1000)
  const webhookTime = parseInt(timestamp)
  
  if (Math.abs(currentTime - webhookTime) > tolerance) {
    return false
  }
  
  // Verify signature
  const expectedSignature = generateWebhookSignature(payload, secret, timestamp)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Deliver webhook event
 */
export async function deliverWebhook(
  subscription: WebhookSubscription,
  event: WebhookEvent
): Promise<void> {
  const supabase = createClient()
  
  // Create delivery record
  const { data: delivery, error: createError } = await supabase
    .from('webhook_deliveries')
    .insert({
      webhook_id: subscription.id,
      event_id: event.id,
      url: subscription.url,
      status: 'pending',
      attempt_number: 1
    })
    .select()
    .single()
  
  if (createError || !delivery) {
    console.error('Failed to create webhook delivery:', createError)
    return
  }
  
  // Prepare payload
  const payload = JSON.stringify({
    id: event.id,
    type: event.type,
    created_at: event.createdAt,
    data: event.data
  })
  
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = generateWebhookSignature(payload, subscription.secret, timestamp)
  
  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-ID': event.id,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': signature,
    ...subscription.headers
  }
  
  try {
    // Send webhook
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    
    const responseText = await response.text()
    
    // Update delivery status
    if (response.ok) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'success',
          status_code: response.status,
          response: responseText.substring(0, 1000), // Limit response size
          completed_at: new Date().toISOString()
        })
        .eq('id', delivery.id)
    } else {
      // Check if we should retry
      const shouldRetry = response.status >= 500 || response.status === 429
      const maxAttempts = subscription.retryConfig?.maxAttempts || 3
      
      if (shouldRetry && delivery.attempt_number < maxAttempts) {
        // Calculate next retry time
        const backoffMultiplier = subscription.retryConfig?.backoffMultiplier || 2
        const initialDelay = subscription.retryConfig?.initialDelay || 60
        const maxDelay = subscription.retryConfig?.maxDelay || 3600
        
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, delivery.attempt_number - 1),
          maxDelay
        )
        
        const nextRetryAt = new Date(Date.now() + delay * 1000)
        
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'retrying',
            status_code: response.status,
            response: responseText.substring(0, 1000),
            next_retry_at: nextRetryAt.toISOString()
          })
          .eq('id', delivery.id)
      } else {
        // Mark as failed
        await supabase
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            status_code: response.status,
            response: responseText.substring(0, 1000),
            completed_at: new Date().toISOString()
          })
          .eq('id', delivery.id)
      }
    }
  } catch (error) {
    // Network or timeout error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if we should retry
    const maxAttempts = subscription.retryConfig?.maxAttempts || 3
    
    if (delivery.attempt_number < maxAttempts) {
      // Calculate next retry time
      const backoffMultiplier = subscription.retryConfig?.backoffMultiplier || 2
      const initialDelay = subscription.retryConfig?.initialDelay || 60
      const maxDelay = subscription.retryConfig?.maxDelay || 3600
      
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, delivery.attempt_number - 1),
        maxDelay
      )
      
      const nextRetryAt = new Date(Date.now() + delay * 1000)
      
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'retrying',
          error: errorMessage,
          next_retry_at: nextRetryAt.toISOString()
        })
        .eq('id', delivery.id)
    } else {
      // Mark as failed
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          error: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', delivery.id)
    }
  }
}

/**
 * Retry failed webhook deliveries
 */
export async function retryWebhookDeliveries(): Promise<void> {
  const supabase = createClient()
  
  // Get deliveries that need to be retried
  const { data: deliveries, error } = await supabase
    .from('webhook_deliveries')
    .select(`
      *,
      webhook:webhook_subscriptions(*),
      event:webhook_events(*)
    `)
    .eq('status', 'retrying')
    .lte('next_retry_at', new Date().toISOString())
    .limit(10)
  
  if (error || !deliveries) {
    console.error('Failed to fetch webhook deliveries:', error)
    return
  }
  
  // Process each delivery
  for (const delivery of deliveries) {
    if (!delivery.webhook || !delivery.event) continue
    
    // Increment attempt number
    await supabase
      .from('webhook_deliveries')
      .update({
        attempt_number: delivery.attempt_number + 1
      })
      .eq('id', delivery.id)
    
    // Deliver webhook
    await deliverWebhook(
      delivery.webhook as WebhookSubscription,
      delivery.event as WebhookEvent
    )
  }
}

/**
 * Trigger webhook event
 */
export async function triggerWebhookEvent(
  tenantId: string,
  type: string,
  data: Record<string, any>
): Promise<void> {
  const supabase = createClient()
  
  // Create event
  const { data: event, error: eventError } = await supabase
    .from('webhook_events')
    .insert({
      tenant_id: tenantId,
      type,
      data
    })
    .select()
    .single()
  
  if (eventError || !event) {
    console.error('Failed to create webhook event:', eventError)
    return
  }
  
  // Get active subscriptions for this event
  const { data: subscriptions, error: subError } = await supabase
    .from('webhook_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .contains('events', [type])
  
  if (subError || !subscriptions) {
    console.error('Failed to fetch webhook subscriptions:', subError)
    return
  }
  
  // Create deliveries for each subscription
  const webhookEvent: WebhookEvent = {
    id: event.id,
    type: event.type,
    tenantId: event.tenant_id,
    data: event.data,
    createdAt: new Date(event.created_at)
  }
  
  for (const subscription of subscriptions) {
    await deliverWebhook(subscription as WebhookSubscription, webhookEvent)
  }
}

/**
 * Clean up old webhook events and deliveries
 */
export async function cleanupWebhookData(daysToKeep: number = 30): Promise<void> {
  const supabase = createClient()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  
  // Delete old deliveries
  await supabase
    .from('webhook_deliveries')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
  
  // Delete old events that have no pending deliveries
  await supabase
    .from('webhook_events')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .not('id', 'in', supabase
      .from('webhook_deliveries')
      .select('event_id')
      .in('status', ['pending', 'retrying'])
    )
}