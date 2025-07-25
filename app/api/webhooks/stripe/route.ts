import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/billing/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

/**
 * Handles incoming Stripe webhook POST requests and synchronizes billing and subscription data with the backend.
 *
 * Validates the Stripe webhook signature and processes supported event types, including subscription creation, updates, cancellations, invoice payments, and customer updates. Updates relevant records in the Supabase database to reflect the latest billing and subscription status. Returns appropriate HTTP responses for success or error conditions.
 *
 * @param request - The incoming Next.js API request containing the Stripe webhook event
 * @returns A JSON response indicating success or error status
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  // Validate webhook signature exists
  if (!signature) {
    console.error('Webhook error: Missing stripe-signature header')
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  // Validate webhook secret exists
  if (!webhookSecret) {
    console.error('Webhook error: STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    console.log(`Webhook received: ${event.type} [${event.id}]`)
  } catch (err) {
    const error = err as Error
    console.error('Webhook signature verification failed:', error.message)
    return NextResponse.json(
      { error: 'Invalid signature', details: error.message },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log(`Processing checkout.session.completed for session ${session.id}`)
        
        if (session.mode === 'subscription' && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )

          // Validate required data
          if (!session.client_reference_id) {
            console.error(`Missing client_reference_id for session ${session.id}`)
            throw new Error('Missing organization reference')
          }

          if (!session.customer) {
            console.error(`Missing customer for session ${session.id}`)
            throw new Error('Missing customer ID')
          }

          // Check if subscription has items
          if (!subscription.items.data.length) {
            console.error(`No subscription items found for subscription ${subscription.id}`)
            throw new Error('No subscription items found')
          }

          const firstItem = subscription.items.data[0]
          if (!firstItem?.price || typeof firstItem.price === 'string') {
            console.error(`Invalid price object for subscription ${subscription.id}`)
            throw new Error('Invalid subscription price data')
          }

          // Update customer billing record
          const { error } = await supabaseAdmin
            .from('customer_billing')
            .upsert({
              organization_id: session.client_reference_id,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              subscription_plan: getPlanFromPriceId(firstItem.price.id),
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (error) {
            console.error(`Failed to update customer billing for subscription ${subscription.id}:`, error)
            throw error
          }

          console.log(`Successfully processed checkout for subscription ${subscription.id}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`Processing customer.subscription.updated for subscription ${subscription.id}`)
        
        // Check if subscription has items
        if (!subscription.items.data.length) {
          console.error(`No subscription items found for subscription ${subscription.id}`)
          throw new Error('No subscription items found')
        }

        const firstItem = subscription.items.data[0]
        if (!firstItem?.price || typeof firstItem.price === 'string') {
          console.error(`Invalid price object for subscription ${subscription.id}`)
          throw new Error('Invalid subscription price data')
        }

        // Update subscription details
        const { error } = await supabaseAdmin
          .from('customer_billing')
          .update({
            subscription_status: subscription.status,
            subscription_plan: getPlanFromPriceId(firstItem.price.id),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error(`Failed to update billing for subscription ${subscription.id}:`, error)
          throw error
        }

        console.log(`Successfully updated billing for subscription ${subscription.id}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`Processing customer.subscription.deleted for subscription ${subscription.id}`)
        
        // Mark subscription as canceled
        const { error } = await supabaseAdmin
          .from('customer_billing')
          .update({
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error(`Failed to mark subscription ${subscription.id} as canceled:`, error)
          throw error
        }

        console.log(`Successfully marked subscription ${subscription.id} as canceled`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`Processing invoice.payment_succeeded for invoice ${invoice.id} (customer: ${invoice.customer})`)
        
        // Update usage metrics reset if needed
        if (invoice.billing_reason === 'subscription_cycle') {
          if (!invoice.customer) {
            console.error(`Missing customer ID for invoice ${invoice.id}`)
            throw new Error('Missing customer ID in invoice')
          }

          const { data: billing, error: billingError } = await supabaseAdmin
            .from('customer_billing')
            .select('organization_id')
            .eq('stripe_customer_id', invoice.customer)
            .single()

          if (billingError) {
            console.error(`Failed to fetch billing info for customer ${invoice.customer}:`, billingError)
            throw billingError
          }

          if (billing && billing.organization_id) {
            // Reset monthly API call count
            const { error: metricsError } = await supabaseAdmin
              .from('usage_metrics')
              .insert({
                organization_id: billing.organization_id,
                metric_type: 'api_calls',
                metric_value: 0,
                period_start: new Date().toISOString(),
                period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              })

            if (metricsError) {
              console.error(`Failed to reset usage metrics for organization ${billing.organization_id}:`, metricsError)
              throw metricsError
            }

            console.log(`Reset usage metrics for organization ${billing.organization_id}`)
          } else {
            console.warn(`No billing record found for customer ${invoice.customer}`)
          }
        }

        console.log(`Successfully processed payment for invoice ${invoice.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`Processing invoice.payment_failed for invoice ${invoice.id} (customer: ${invoice.customer})`)
        
        if (!invoice.customer) {
          console.error(`Missing customer ID for failed invoice ${invoice.id}`)
          throw new Error('Missing customer ID in failed invoice')
        }

        // Update subscription status
        const { error } = await supabaseAdmin
          .from('customer_billing')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', invoice.customer)

        if (error) {
          console.error(`Failed to update subscription status for customer ${invoice.customer}:`, error)
          throw error
        }

        // Log payment failure details
        console.error(`Payment failed for invoice ${invoice.id}:`, {
          customer: invoice.customer,
          amount: invoice.amount_due,
          currency: invoice.currency,
          attempt: invoice.attempt_count,
        })

        // TODO: Implement email notification service
        console.log(`Subscription marked as past_due for customer ${invoice.customer}`)
        break
      }

      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        console.log(`Processing customer.updated for customer ${customer.id}`)
        
        // Update customer info if needed
        if (customer.metadata?.organization_id) {
          if (!customer.email) {
            console.warn(`No email provided for customer ${customer.id}`)
          }

          const { error } = await supabaseAdmin
            .from('organizations')
            .update({
              billing_email: customer.email || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', customer.metadata.organization_id)

          if (error) {
            console.error(`Failed to update organization ${customer.metadata.organization_id}:`, error)
            throw error
          }

          console.log(`Updated billing email for organization ${customer.metadata.organization_id}`)
        } else {
          console.log(`No organization_id in metadata for customer ${customer.id}, skipping update`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    console.log(`Successfully processed webhook event ${event.type} [${event.id}]`)
    return NextResponse.json({ received: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Error processing webhook event ${event.type} [${event.id}]:`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Webhook processing failed', details: errorMessage },
      { status: 500 }
    )
  }
}

// Helper function to determine plan from price ID
function getPlanFromPriceId(priceId: string): string {
  // Build price map only with available environment variables
  const priceIdMap: Record<string, string> = {}
  
  if (process.env.STRIPE_PRICE_STARTER_MONTHLY) {
    priceIdMap[process.env.STRIPE_PRICE_STARTER_MONTHLY] = 'starter'
  }
  if (process.env.STRIPE_PRICE_STARTER_YEARLY) {
    priceIdMap[process.env.STRIPE_PRICE_STARTER_YEARLY] = 'starter'
  }
  if (process.env.STRIPE_PRICE_GROWTH_MONTHLY) {
    priceIdMap[process.env.STRIPE_PRICE_GROWTH_MONTHLY] = 'growth'
  }
  if (process.env.STRIPE_PRICE_GROWTH_YEARLY) {
    priceIdMap[process.env.STRIPE_PRICE_GROWTH_YEARLY] = 'growth'
  }
  if (process.env.STRIPE_PRICE_SCALE_MONTHLY) {
    priceIdMap[process.env.STRIPE_PRICE_SCALE_MONTHLY] = 'scale'
  }
  if (process.env.STRIPE_PRICE_SCALE_YEARLY) {
    priceIdMap[process.env.STRIPE_PRICE_SCALE_YEARLY] = 'scale'
  }

  const plan = priceIdMap[priceId]
  if (!plan) {
    console.warn(`Unknown price ID: ${priceId}. Defaulting to 'starter' plan.`)
  }
  
  return plan || 'starter'
}