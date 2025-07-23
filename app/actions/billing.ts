'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, createCheckoutSession, createBillingPortalSession } from '@/lib/billing/stripe'
import { z } from 'zod'

const changePlanSchema = z.object({
  plan: z.enum(['starter', 'growth', 'scale', 'enterprise']),
  interval: z.enum(['month', 'year']),
})

export async function changePlan(formData: FormData) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  const parsed = changePlanSchema.parse({
    plan: formData.get('plan'),
    interval: formData.get('interval'),
  })

  // Get or create Stripe customer
  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_customer_id')
    .eq('organization_id', profile.organization_id)
    .single()

  let stripeCustomerId = billing?.stripe_customer_id

  if (!stripeCustomerId) {
    // Create new Stripe customer
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .single()

    const customer = await stripe.customers.create({
      email: user.email,
      name: org?.name,
      metadata: {
        organization_id: profile.organization_id,
      },
    })

    stripeCustomerId = customer.id

    // Save to database
    const adminSupabase = createAdminClient()
    await adminSupabase
      .from('customer_billing')
      .upsert({
        organization_id: profile.organization_id,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
  }

  // Create checkout session
  const { url } = await createCheckoutSession({
    customerId: stripeCustomerId,
    plan: parsed.plan,
    interval: parsed.interval,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/subscription?success=true`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/subscription`,
  })

  redirect(url)
}

export async function cancelSubscription() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_subscription_id')
    .eq('organization_id', profile.organization_id)
    .single()

  if (!billing?.stripe_subscription_id) {
    throw new Error('No active subscription found')
  }

  // Cancel at period end
  await stripe.subscriptions.update(billing.stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  // Update local record
  const adminSupabase = createAdminClient()
  await adminSupabase
    .from('customer_billing')
    .update({
      subscription_status: 'canceling',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', profile.organization_id)
}

export async function resumeSubscription() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_subscription_id')
    .eq('organization_id', profile.organization_id)
    .single()

  if (!billing?.stripe_subscription_id) {
    throw new Error('No active subscription found')
  }

  // Resume subscription
  await stripe.subscriptions.update(billing.stripe_subscription_id, {
    cancel_at_period_end: false,
  })

  // Update local record
  const adminSupabase = createAdminClient()
  await adminSupabase
    .from('customer_billing')
    .update({
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', profile.organization_id)
}

export async function openBillingPortal() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_customer_id')
    .eq('organization_id', profile.organization_id)
    .single()

  if (!billing?.stripe_customer_id) {
    throw new Error('No billing account found')
  }

  // Create billing portal session
  const { url } = await createBillingPortalSession({
    customerId: billing.stripe_customer_id,
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing`,
  })

  redirect(url)
}

const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
  setAsDefault: z.boolean().optional(),
})

export async function addPaymentMethod(data: z.infer<typeof addPaymentMethodSchema>) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_customer_id')
    .eq('organization_id', profile.organization_id)
    .single()

  if (!billing?.stripe_customer_id) {
    throw new Error('No billing account found')
  }

  // Attach payment method to customer
  await stripe.paymentMethods.attach(data.paymentMethodId, {
    customer: billing.stripe_customer_id,
  })

  // Set as default if requested
  if (data.setAsDefault) {
    await stripe.customers.update(billing.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: data.paymentMethodId,
      },
    })
  }
}

export async function removePaymentMethod(paymentMethodId: string) {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Verify ownership via Stripe
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
  
  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_customer_id')
    .eq('organization_id', profile.organization_id)
    .single()

  if (paymentMethod.customer !== billing?.stripe_customer_id) {
    throw new Error('Unauthorized')
  }

  // Detach payment method
  await stripe.paymentMethods.detach(paymentMethodId)
}