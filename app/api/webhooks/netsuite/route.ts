// PRP-013: NetSuite Webhook Handler
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebhookHandler } from '@/lib/integrations/webhook-handler'
import { NetSuiteTransformers } from '@/lib/integrations/netsuite/transformers'
import { z } from 'zod'
import crypto from 'crypto'

// NetSuite webhook event schema
const netsuiteWebhookSchema = z.object({
  event_type: z.enum(['item.created', 'item.updated', 'item.deleted', 
    'inventory.updated', 'customer.created', 'customer.updated', 
    'salesorder.created', 'salesorder.updated']),
  timestamp: z.string(),
  account_id: z.string(),
  record: z.object({
    id: z.string(),
    type: z.string(),
    fields: z.record(z.any()),
  }),
  changes: z.array(z.object({
    field: z.string(),
    old_value: z.any(),
    new_value: z.any(),
  })).optional(),
})

// Webhook signature verification
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-netsuite-signature')
    const webhookId = request.headers.get('x-webhook-id')
    
    if (!signature || !webhookId) {
      return NextResponse.json(
        { error: 'Missing webhook headers' },
        { status: 400 }
      )
    }

    // Get webhook endpoint configuration
    const { data: webhook } = await supabase
      .from('webhook_endpoints')
      .select('*, integrations(*)')
      .eq('id', webhookId)
      .eq('is_active', true)
      .single()

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found or inactive' },
        { status: 404 }
      )
    }

    // Verify signature
    const isValid = verifyWebhookSignature(
      rawBody,
      signature,
      webhook.secret
    )

    if (!isValid) {
      await supabase.rpc('log_integration_activity', {
        p_integration_id: webhook.integration_id,
        p_organization_id: webhook.integrations.organization_id,
        p_log_type: 'webhook',
        p_severity: 'warning',
        p_message: 'Invalid webhook signature',
        p_details: { webhook_id: webhookId },
      })

      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse and validate webhook payload
    const data = JSON.parse(rawBody)
    const validated = netsuiteWebhookSchema.parse(data)

    // Create webhook handler
    const handler = new WebhookHandler()
    
    // Create webhook event
    const event = await handler.createWebhookEvent({
      endpoint_id: webhookId,
      event_type: validated.event_type,
      payload: validated,
      headers: Object.fromEntries(request.headers.entries()),
    })

    // Process the webhook based on event type
    
    // Get NetSuite config for transformers
    const { data: netsuiteConfig } = await supabase
      .from('netsuite_config')
      .select('*')
      .eq('integration_id', webhook.integration_id)
      .single()

    const transformers = new NetSuiteTransformers(
      netsuiteConfig?.field_mappings || {}
    )

    try {
      switch (validated.event_type) {
        case 'item.created':
        case 'item.updated': {
          // Transform and upsert product
          const product = await transformers.transformProduct(validated.record.fields)
          
          await supabase
            .from('products')
            .upsert({
              organization_id: webhook.integrations.organization_id,
              sku: product.sku,
              name: product.name,
              description: product.description,
              price: product.price,
              weight: product.weight,
              dimensions: product.dimensions,
              is_active: product.is_active,
              external_id: product.external_id,
              metadata: {
                ...product.metadata,
                source: 'netsuite',
                last_webhook_sync: new Date().toISOString(),
              },
            }, {
              onConflict: 'organization_id,sku',
            })

          break
        }

        case 'inventory.updated': {
          // Get location info
          const locationId = validated.record.fields.location
          const { data: warehouse } = await supabase
            .from('warehouses')
            .select('id')
            .eq('organization_id', webhook.integrations.organization_id)
            .eq('external_id', locationId)
            .single()

          if (warehouse) {
            const inventory = await transformers.transformInventory(
              validated.record.fields,
              { id: locationId, name: validated.record.fields.location_name }
            )

            // Get product by SKU
            const { data: product } = await supabase
              .from('products')
              .select('id')
              .eq('organization_id', webhook.integrations.organization_id)
              .eq('sku', inventory.product_sku)
              .single()

            if (product) {
              await supabase
                .from('inventory')
                .upsert({
                  organization_id: webhook.integrations.organization_id,
                  product_id: product.id,
                  warehouse_id: warehouse.id,
                  quantity: inventory.quantity_available,
                  reserved_quantity: inventory.quantity_on_order || 0,
                  reorder_point: inventory.reorder_point,
                  last_sync: new Date().toISOString(),
                  sync_status: 'synced',
                }, {
                  onConflict: 'organization_id,product_id,warehouse_id',
                })
            }
          }
          break
        }

        case 'customer.created':
        case 'customer.updated': {
          // Transform and upsert customer
          const customer = await transformers.transformCustomer(validated.record.fields)
          
          await supabase
            .from('customers')
            .upsert({
              organization_id: webhook.integrations.organization_id,
              code: customer.code,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              is_active: customer.is_active,
              credit_limit: customer.credit_limit,
              balance: customer.balance,
              external_id: customer.external_id,
              metadata: {
                ...customer.metadata,
                source: 'netsuite',
                last_webhook_sync: new Date().toISOString(),
              },
            }, {
              onConflict: 'organization_id,code',
            })

          break
        }

        case 'salesorder.created':
        case 'salesorder.updated': {
          // For sales orders, we might want to trigger specific actions
          // like inventory reservations or fulfillment updates
          await supabase.rpc('log_integration_activity', {
            p_integration_id: webhook.integration_id,
            p_organization_id: webhook.integrations.organization_id,
            p_log_type: 'webhook',
            p_severity: 'info',
            p_message: `Sales order ${validated.event_type}`,
            p_details: {
              order_number: validated.record.fields.tranid,
              status: validated.record.fields.orderstatus,
            },
          })
          break
        }
      }

      // Mark webhook as processed
      await handler.markWebhookProcessed(event.id, {
        processed_at: new Date().toISOString(),
        response_status: 200,
      })

      // Update last sync timestamp
      await supabase
        .from('integrations')
        .update({
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', webhook.integration_id)

      return NextResponse.json({ success: true })

    } catch (processingError) {
      console.error('Webhook processing error:', processingError)
      
      // Mark webhook as failed
      await handler.markWebhookFailed(event.id, {
        error: processingError instanceof Error ? processingError.message : 'Processing failed',
        response_status: 500,
      })

      throw processingError
    }

  } catch (error) {
    console.error('NetSuite webhook error:', error)
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Webhook registration endpoint
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { integration_id, events, callback_url } = body

    if (!integration_id || !events || !callback_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify integration ownership
    const { data: integration } = await supabase
      .from('integrations')
      .select('organization_id')
      .eq('id', integration_id)
      .single()

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile || integration.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Create or update webhook endpoint
    const secret = crypto.randomBytes(32).toString('hex')
    
    const { data: webhook, error } = await supabase
      .from('webhook_endpoints')
      .upsert({
        integration_id,
        endpoint_url: callback_url,
        events,
        secret,
        is_active: true,
        created_by: user.id,
      }, {
        onConflict: 'integration_id,endpoint_url',
      })
      .select()
      .single()

    if (error) throw error

    // Log webhook registration
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integration_id,
      p_organization_id: integration.organization_id,
      p_log_type: 'webhook',
      p_severity: 'info',
      p_message: 'Webhook endpoint registered',
      p_details: {
        endpoint_id: webhook.id,
        events,
        callback_url,
      },
    })

    return NextResponse.json({
      webhook_id: webhook.id,
      secret,
      events,
      callback_url,
    })

  } catch (error) {
    console.error('Webhook registration error:', error)
    return NextResponse.json(
      { error: 'Failed to register webhook' },
      { status: 500 }
    )
  }
}