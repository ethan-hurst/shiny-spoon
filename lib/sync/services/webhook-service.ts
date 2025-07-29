import { WebhookEvent, WebhookType, SyncResult } from '@/lib/sync/types'
import { createBrowserClient } from '@/lib/supabase/client'
import crypto from 'crypto'

export class WebhookService {
  private supabase = createBrowserClient()

  async processWebhook(event: WebhookEvent): Promise<SyncResult> {
    try {
      // Check for duplicate webhook
      const { data: existingWebhook } = await this.supabase
        .from('webhook_logs')
        .select('id, status')
        .eq('webhook_id', event.id)
        .single()

      if (existingWebhook && existingWebhook.status === 'processed') {
        return {
          success: true,
          data: { status: 'duplicate' },
        }
      }

      // Get organization from webhook source
      const { data: org } = await this.supabase
        .from('organizations')
        .select('id, name, external_platforms')
        .single()

      if (!org) {
        throw new Error('Organization not found')
      }

      // Process based on webhook type
      let result: any
      switch (event.type) {
        case WebhookType.PRODUCT_UPDATE:
          result = await this.processProductUpdate(event.data, org.id)
          break
        case WebhookType.INVENTORY_UPDATE:
          result = await this.processInventoryUpdate(event.data, org.id)
          break
        case WebhookType.ORDER_CREATED:
          result = await this.processOrderCreated(event.data, org.id)
          break
        case WebhookType.PRICE_UPDATE:
          result = await this.processPriceUpdate(event.data, org.id)
          break
        default:
          throw new Error(`Unsupported webhook type: ${event.type}`)
      }

      // Log webhook processing
      await this.supabase
        .from('webhook_logs')
        .upsert({
          webhook_id: event.id,
          organization_id: org.id,
          type: event.type,
          status: 'processed',
          payload: event.data,
          processed_at: new Date().toISOString(),
        })

      return {
        success: true,
        data: { status: 'processed', ...result },
      }
    } catch (error) {
      // Log error
      await this.supabase
        .from('webhook_logs')
        .upsert({
          webhook_id: event.id,
          type: event.type,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          payload: event.data,
        })

      return {
        success: false,
        error: `Failed to process webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  private async processProductUpdate(data: any, orgId: string): Promise<any> {
    await this.supabase
      .from('products')
      .update({
        name: data.name || data.title,
        price: data.price,
        updated_at: new Date().toISOString(),
      })
      .eq('external_id', data.id)
      .eq('organization_id', orgId)

    return { updated: true }
  }

  private async processInventoryUpdate(data: any, orgId: string): Promise<any> {
    await this.supabase
      .from('inventory')
      .update({
        quantity: data.quantity || data.available,
        warehouse_id: data.warehouse_id || data.location_id,
        updated_at: new Date().toISOString(),
      })
      .eq('sku', data.sku)
      .eq('organization_id', orgId)

    return { updated: true }
  }

  private async processOrderCreated(data: any, orgId: string): Promise<any> {
    // Create order
    const { data: order } = await this.supabase
      .from('orders')
      .insert({
        external_id: data.order_id || data.id,
        organization_id: orgId,
        customer_id: data.customer_id,
        total_amount: data.total,
        status: 'pending',
        order_data: data,
        source_platform: 'shopify',
      })
      .select()
      .single()

    // Update inventory for items
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        await this.supabase
          .from('inventory')
          .update({
            reserved_quantity: item.quantity,
          })
          .eq('sku', item.sku)
          .eq('organization_id', orgId)
      }
    }

    return { order_id: order?.id }
  }

  private async processPriceUpdate(data: any, orgId: string): Promise<any> {
    await this.supabase
      .from('product_pricing')
      .update({
        base_price: data.price,
        updated_at: new Date().toISOString(),
      })
      .eq('sku', data.sku)
      .eq('organization_id', orgId)

    return { updated: true }
  }

  validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    platform: string
  ): boolean {
    switch (platform) {
      case 'shopify':
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload, 'utf8')
          .digest('base64')
        return hash === signature

      case 'netsuite':
        // NetSuite uses different signature method
        const nsHash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex')
        return nsHash === signature

      default:
        return false
    }
  }

  async retryFailedWebhooks(): Promise<SyncResult> {
    const { data: failedWebhooks } = await this.supabase
      .from('webhook_logs')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', 5)
      .order('created_at', { ascending: true })
      .limit(10)

    if (!failedWebhooks || failedWebhooks.length === 0) {
      return {
        success: true,
        data: { processed: 0, failed: 0 },
      }
    }

    let processed = 0
    let failed = 0

    for (const webhook of failedWebhooks) {
      const event: WebhookEvent = {
        id: webhook.webhook_id,
        type: webhook.type,
        source: webhook.source || 'unknown',
        data: webhook.payload,
        received_at: webhook.created_at,
      }

      const result = await this.processWebhook(event)
      if (result.success) {
        processed++
      } else {
        failed++
        // Increment retry count
        await this.supabase
          .from('webhook_logs')
          .update({ retry_count: (webhook.retry_count || 0) + 1 })
          .eq('id', webhook.id)
      }
    }

    return {
      success: true,
      data: { processed, failed },
    }
  }

  async getWebhookStatus(webhookId: string): Promise<SyncResult> {
    const { data, error } = await this.supabase
      .from('webhook_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .single()

    if (error) {
      return {
        success: false,
        error: `Webhook not found: ${error.message}`,
      }
    }

    return {
      success: true,
      data,
    }
  }
}