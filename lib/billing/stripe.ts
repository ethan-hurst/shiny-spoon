import Stripe from 'stripe'

// Validate required environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required')
}

// Initialize Stripe with the secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// Subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses',
    monthlyPriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    yearlyPriceId: process.env.STRIPE_PRICE_STARTER_YEARLY,
    monthlyPrice: 99,
    yearlyPrice: Math.round(99 * 12 * 0.83), // 17% discount for yearly
    features: [
      'Up to 1,000 products',
      '2 warehouse locations',
      '5,000 API calls/month',
      'Email support',
    ],
    limits: {
      products: 1000,
      warehouses: 2,
      apiCalls: 5000,
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    description: 'For growing businesses',
    monthlyPriceId: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    yearlyPriceId: process.env.STRIPE_PRICE_GROWTH_YEARLY,
    monthlyPrice: 299,
    yearlyPrice: Math.round(299 * 12 * 0.83), // 17% discount for yearly
    popular: true,
    features: [
      'Up to 10,000 products',
      '10 warehouse locations',
      '50,000 API calls/month',
      'Priority support',
      'Advanced analytics',
    ],
    limits: {
      products: 10000,
      warehouses: 10,
      apiCalls: 50000,
    },
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    description: 'For enterprise businesses',
    monthlyPriceId: process.env.STRIPE_PRICE_SCALE_MONTHLY,
    yearlyPriceId: process.env.STRIPE_PRICE_SCALE_YEARLY,
    monthlyPrice: 799,
    yearlyPrice: Math.round(799 * 12 * 0.83), // 17% discount for yearly
    features: [
      'Unlimited products',
      'Unlimited warehouses',
      '500,000 API calls/month',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
    ],
    limits: {
      products: -1, // unlimited
      warehouses: -1,
      apiCalls: 500000,
    },
  },
}

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS

// Helper to get or create a Stripe customer
export async function getOrCreateStripeCustomer(
  organizationId: string,
  email: string,
  name?: string
): Promise<string> {
  if (!organizationId || !email) {
    throw new Error('Organization ID and email are required')
  }
  // First, check if we already have a Stripe customer ID
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  const supabase = supabaseAdmin

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_customer_id')
    .eq('organization_id', organizationId)
    .single()

  if (billing?.stripe_customer_id) {
    return billing.stripe_customer_id
  }

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      organization_id: organizationId,
    },
  })

  // Save the customer ID to our database
  await supabase.from('customer_billing').upsert({
    organization_id: organizationId,
    stripe_customer_id: customer.id,
  })

  return customer.id
}

// Create a checkout session for subscription
export async function createCheckoutSession({
  customerId,
  plan,
  interval,
  successUrl,
  cancelUrl,
}: {
  customerId: string
  plan: string
  interval: 'month' | 'year'
  successUrl: string
  cancelUrl: string
}) {
  const planConfig = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]
  if (!planConfig) {
    throw new Error(`Invalid subscription plan selected: ${plan}`)
  }

  const priceId =
    interval === 'year' ? planConfig.yearlyPriceId : planConfig.monthlyPriceId
  if (!priceId) {
    throw new Error(
      `Pricing is not configured for the ${plan} plan (${interval}ly billing). Please contact support.`
    )
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: customerId,
      allow_promotion_codes: true,
    })

    return session
  } catch (error) {
    console.error('Error creating checkout session:', error)
    throw new Error('Unable to create checkout session. Please try again.')
  }
}

// Create a portal session for managing subscription
export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return session
  } catch (error) {
    console.error('Error creating billing portal session:', error)
    throw new Error(
      'Unable to create billing portal session. Please try again.'
    )
  }
}

// Get subscription details
export async function getSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice', 'default_payment_method'],
  })

  return subscription
}

// Get invoices for a customer
export async function getInvoices(customerId: string, limit = 10) {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  })

  return invoices.data
}

// Get payment methods for a customer
export async function getPaymentMethods(customerId: string) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  })

  return paymentMethods.data
}

// Cancel subscription at period end
export async function cancelSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })

  return subscription
}

// Resume a canceled subscription
export async function resumeSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })

  return subscription
}

// Update subscription to a different plan
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    }
  )

  return updatedSubscription
}
