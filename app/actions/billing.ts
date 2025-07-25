'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe, createCheckoutSession, createBillingPortalSession } from '@/lib/billing/stripe'
import { z } from 'zod'

// Validate required environment variables at module load
function validateEnvironmentVariables() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_APP_URL',
    'STRIPE_SECRET_KEY',
  ]

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      'Please check your .env.local file.'
    )
  }
}

// Validate on module load
validateEnvironmentVariables()

const changePlanSchema = z.object({
  plan: z.enum(['starter', 'growth', 'scale', 'enterprise']),
  interval: z.enum(['month', 'year']),
})

/**
 * Changes the subscription plan for the authenticated user's organization and redirects to the Stripe checkout session.
 *
 * Validates the selected plan and billing interval, ensures the user is authenticated and associated with an organization, and creates or retrieves a Stripe customer as needed. Initiates a Stripe checkout session for the new plan and redirects the user to complete payment.
 *
 * @param formData - The form data containing the selected plan and billing interval.
 */
export async function changePlan(formData: FormData) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('You must be logged in to change your subscription plan.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      throw new Error('Unable to find your organization. Please contact support.')
    }

    const parsed = changePlanSchema.safeParse({
      plan: formData.get('plan'),
      interval: formData.get('interval'),
    })

    if (!parsed.success) {
      throw new Error('Invalid plan or billing interval selected.')
    }

    // Get or create Stripe customer
    const { data: billing, error: billingError } = await supabase
      .from('customer_billing')
      .select('stripe_customer_id')
      .eq('organization_id', profile.organization_id)
      .single()

    if (billingError && billingError.code !== 'PGRST116') { // PGRST116 is "no rows found"
      throw new Error('Unable to retrieve billing information. Please try again.')
    }

    let stripeCustomerId = billing?.stripe_customer_id

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .single()

      const customer = await stripe.customers.create({
        email: user.email!,
        name: org?.name || 'Unknown Organization',
        metadata: {
          organization_id: profile.organization_id,
        },
      })

      stripeCustomerId = customer.id

      // Save to database
      const adminSupabase = supabaseAdmin
      const { error: upsertError } = await adminSupabase
        .from('customer_billing')
        .upsert({
          organization_id: profile.organization_id,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        })
      
      if (upsertError) {
        throw new Error('Failed to save billing information. Please try again.')
      }
    }

    // Create checkout session
    const { url } = await createCheckoutSession({
      customerId: stripeCustomerId,
      plan: parsed.data.plan,
      interval: parsed.data.interval,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/subscription?success=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/subscription`,
    })

    if (!url) {
      throw new Error('Unable to create checkout session. Please try again.')
    }

    redirect(url)
  } catch (error) {
    // Log error for debugging but return user-friendly message
    console.error('Error changing plan:', error)
    
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    
    throw new Error('An unexpected error occurred. Please try again or contact support.')
  }
}

/**
 * Cancels the current organization's Stripe subscription at the end of the current billing period.
 *
 * Authenticates the user, verifies organization and subscription existence, updates the Stripe subscription to cancel at period end, and marks the local subscription status as "canceling".
 *
 * @throws If the user is not authenticated, the organization or subscription cannot be found, or if updating local records fails.
 */
export async function cancelSubscription() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('You must be logged in to cancel your subscription.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      throw new Error('Unable to find your organization. Please contact support.')
    }

    const { data: billing, error: billingError } = await supabase
      .from('customer_billing')
      .select('stripe_subscription_id')
      .eq('organization_id', profile.organization_id)
      .single()

    if (billingError || !billing?.stripe_subscription_id) {
      throw new Error('No active subscription found to cancel.')
    }

    // Cancel at period end
    await stripe.subscriptions.update(billing.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Update local record
    const adminSupabase = supabaseAdmin
    const { error: updateError } = await adminSupabase
      .from('customer_billing')
      .update({
        subscription_status: 'canceling',
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', profile.organization_id)
    
    if (updateError) {
      throw new Error('Subscription canceled but failed to update local records. Please contact support.')
    }
  } catch (error) {
    console.error('Error canceling subscription:', error)
    
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    
    throw new Error('Failed to cancel subscription. Please try again or contact support.')
  }
}

/**
 * Resumes a canceled subscription for the authenticated user's organization.
 *
 * Reactivates the organization's Stripe subscription by disabling cancellation at period end and updates the local subscription status to "active". Throws an error if authentication fails, the organization or subscription cannot be found, or if updating local records fails.
 */
export async function resumeSubscription() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('You must be logged in to resume your subscription.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      throw new Error('Unable to find your organization. Please contact support.')
    }

    const { data: billing, error: billingError } = await supabase
      .from('customer_billing')
      .select('stripe_subscription_id')
      .eq('organization_id', profile.organization_id)
      .single()

    if (billingError || !billing?.stripe_subscription_id) {
      throw new Error('No subscription found to resume.')
    }

    // Resume subscription
    await stripe.subscriptions.update(billing.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    // Update local record
    const adminSupabase = supabaseAdmin
    const { error: updateError } = await adminSupabase
      .from('customer_billing')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', profile.organization_id)
    
    if (updateError) {
      throw new Error('Subscription resumed but failed to update local records. Please contact support.')
    }
  } catch (error) {
    console.error('Error resuming subscription:', error)
    
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    
    throw new Error('Failed to resume subscription. Please try again or contact support.')
  }
}

/**
 * Redirects the authenticated user to the Stripe billing portal for their organization.
 *
 * Authenticates the user, retrieves their organization's Stripe customer ID, creates a billing portal session, and redirects to the portal. Throws an error if authentication, organization lookup, or billing setup fails.
 */
export async function openBillingPortal() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('You must be logged in to access the billing portal.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      throw new Error('Unable to find your organization. Please contact support.')
    }

    const { data: billing, error: billingError } = await supabase
      .from('customer_billing')
      .select('stripe_customer_id')
      .eq('organization_id', profile.organization_id)
      .single()

    if (billingError || !billing?.stripe_customer_id) {
      throw new Error('No billing account found. Please set up billing first.')
    }

    // Create billing portal session
    const { url } = await createBillingPortalSession({
      customerId: billing.stripe_customer_id,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing`,
    })

    if (!url) {
      throw new Error('Unable to create billing portal session. Please try again.')
    }

    redirect(url)
  } catch (error) {
    console.error('Error opening billing portal:', error)
    
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    
    throw new Error('Failed to open billing portal. Please try again or contact support.')
  }
}

const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
  setAsDefault: z.boolean().optional(),
})

/**
 * Adds a payment method to the organization's Stripe customer account.
 *
 * Validates the provided payment method data, attaches the payment method to the organization's Stripe customer, and optionally sets it as the default payment method for invoices. Throws user-friendly errors for invalid input, authentication issues, or Stripe-specific problems.
 */
export async function addPaymentMethod(data: z.infer<typeof addPaymentMethodSchema>) {
  try {
    // Validate input
    const validatedData = addPaymentMethodSchema.safeParse(data)
    if (!validatedData.success) {
      throw new Error('Invalid payment method data provided.')
    }

    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('You must be logged in to add a payment method.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      throw new Error('Unable to find your organization. Please contact support.')
    }

    const { data: billing, error: billingError } = await supabase
      .from('customer_billing')
      .select('stripe_customer_id')
      .eq('organization_id', profile.organization_id)
      .single()

    if (billingError || !billing?.stripe_customer_id) {
      throw new Error('No billing account found. Please set up billing first.')
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(validatedData.data.paymentMethodId, {
      customer: billing.stripe_customer_id,
    })

    // Set as default if requested
    if (validatedData.data.setAsDefault) {
      await stripe.customers.update(billing.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: validatedData.data.paymentMethodId,
        },
      })
    }
  } catch (error) {
    console.error('Error adding payment method:', error)
    
    if (error instanceof Error) {
      // Handle specific Stripe errors
      if (error.message.includes('already been attached')) {
        throw new Error('This payment method has already been added.')
      }
      if (error.message.includes('payment_method')) {
        throw new Error('Invalid payment method. Please check your card details.')
      }
      
      throw new Error(error.message)
    }
    
    throw new Error('Failed to add payment method. Please try again or contact support.')
  }
}

/**
 * Removes a payment method from the authenticated user's organization's Stripe account.
 *
 * Validates the payment method ID, ensures the user is authenticated and belongs to an organization, verifies ownership of the payment method, and detaches it from Stripe. Throws user-friendly errors if validation fails or the payment method cannot be removed.
 */
export async function removePaymentMethod(paymentMethodId: string) {
  try {
    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      throw new Error('Invalid payment method ID provided.')
    }

    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('You must be logged in to remove a payment method.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.organization_id) {
      throw new Error('Unable to find your organization. Please contact support.')
    }

    // Verify ownership via Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    
    const { data: billing, error: billingError } = await supabase
      .from('customer_billing')
      .select('stripe_customer_id')
      .eq('organization_id', profile.organization_id)
      .single()

    if (billingError || !billing?.stripe_customer_id) {
      throw new Error('No billing account found.')
    }

    if (paymentMethod.customer !== billing.stripe_customer_id) {
      throw new Error('You do not have permission to remove this payment method.')
    }

    // Detach payment method
    await stripe.paymentMethods.detach(paymentMethodId)
  } catch (error) {
    console.error('Error removing payment method:', error)
    
    if (error instanceof Error) {
      // Handle specific Stripe errors
      if (error.message.includes('resource_missing')) {
        throw new Error('Payment method not found or already removed.')
      }
      
      throw new Error(error.message)
    }
    
    throw new Error('Failed to remove payment method. Please try again or contact support.')
  }
}