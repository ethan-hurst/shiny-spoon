import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/billing/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        if (session.mode === 'subscription' && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )

          // Update customer billing record
          await supabase
            .from('customer_billing')
            .upsert({
              organization_id: session.client_reference_id!,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              subscription_plan: getPlanFromPriceId(subscription.items.data[0].price.id),
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Update subscription details
        await supabase
          .from('customer_billing')
          .update({
            subscription_status: subscription.status,
            subscription_plan: getPlanFromPriceId(subscription.items.data[0].price.id),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Mark subscription as canceled
        await supabase
          .from('customer_billing')
          .update({
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        
        // Log successful payment
        console.log(`Payment succeeded for invoice ${invoice.id}`)
        
        // Update usage metrics reset if needed
        if (invoice.billing_reason === 'subscription_cycle') {
          const { data: billing } = await supabase
            .from('customer_billing')
            .select('organization_id')
            .eq('stripe_customer_id', invoice.customer)
            .single()

          if (billing) {
            // Reset monthly API call count
            await supabase
              .from('usage_metrics')
              .insert({
                organization_id: billing.organization_id,
                metric_type: 'api_calls',
                metric_value: 0,
                period_start: new Date().toISOString(),
                period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              })
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        
        // Update subscription status
        await supabase
          .from('customer_billing')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', invoice.customer)

        // TODO: Send email notification about failed payment
        console.error(`Payment failed for invoice ${invoice.id}`)
        break
      }

      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        
        // Update customer info if needed
        if (customer.metadata.organization_id) {
          await supabase
            .from('organizations')
            .update({
              billing_email: customer.email,
              updated_at: new Date().toISOString(),
            })
            .eq('id', customer.metadata.organization_id)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Helper function to determine plan from price ID
function getPlanFromPriceId(priceId: string): string {
  const priceIdMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER_MONTHLY!]: 'starter',
    [process.env.STRIPE_PRICE_STARTER_YEARLY!]: 'starter',
    [process.env.STRIPE_PRICE_GROWTH_MONTHLY!]: 'growth',
    [process.env.STRIPE_PRICE_GROWTH_YEARLY!]: 'growth',
    [process.env.STRIPE_PRICE_SCALE_MONTHLY!]: 'scale',
    [process.env.STRIPE_PRICE_SCALE_YEARLY!]: 'scale',
  }

  return priceIdMap[priceId] || 'starter'
}