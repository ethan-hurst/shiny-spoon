import { createClient } from '@/lib/supabase/server'
import { stripe, SUBSCRIPTION_PLANS } from './stripe'
import type { SubscriptionData, Invoice, PaymentMethod } from '@/types/billing.types'

export interface UsageStats {
  products: {
    current: number
    limit: number
    percentage: number
  }
  warehouses: {
    current: number
    limit: number
    percentage: number
  }
  apiCalls: {
    current: number
    limit: number
    percentage: number
  }
}

// Re-export types for backward compatibility
export type { SubscriptionData, Invoice, PaymentMethod } from '@/types/billing.types'

/**
 * Retrieves the subscription details for a given organization.
 *
 * If the organization does not have a Stripe subscription, returns default free tier subscription data. Otherwise, fetches the subscription from Stripe, determines the plan, and returns subscription information including plan limits.
 *
 * @param organizationId - The unique identifier of the organization
 * @returns The organization's subscription data, or `null` if an error occurs while fetching from Stripe
 */
export async function getSubscription(organizationId: string): Promise<SubscriptionData | null> {
  const supabase = await createClient()

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('*')
    .eq('organization_id', organizationId)
    .single()

  if (!billing || !billing.stripe_subscription_id) {
    // Return free tier defaults
    return {
      id: 'free',
      plan: 'starter',
      interval: 'month',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      limits: SUBSCRIPTION_PLANS.starter.limits,
    }
  }

  // Get subscription from Stripe
  try {
    const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id)
    const firstItem = subscription.items.data[0]
    if (!firstItem) {
      throw new Error('No subscription items found')
    }
    const priceId = firstItem.price.id
    
    // Determine which plan based on price ID
    let plan = 'starter'
    for (const [key, value] of Object.entries(SUBSCRIPTION_PLANS)) {
      if (value.monthlyPriceId === priceId || value.yearlyPriceId === priceId) {
        plan = key
        break
      }
    }

    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS
    return {
      id: subscription.id,
      plan: plan as 'starter' | 'growth' | 'scale' | 'enterprise',
      interval: firstItem.price.recurring?.interval as 'month' | 'year',
      status: subscription.status as 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      limits: SUBSCRIPTION_PLANS[planKey]?.limits || SUBSCRIPTION_PLANS.starter.limits,
    }
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

/**
 * Retrieves usage statistics for products, warehouses, and API calls for a given organization.
 *
 * Calculates current usage counts and usage percentages relative to the organization's subscription plan limits for the current billing period.
 *
 * @param organizationId - The unique identifier of the organization whose usage stats are being retrieved.
 * @returns An object containing current usage, plan limits, and usage percentages for products, warehouses, and API calls.
 */
export async function getUsageStats(organizationId: string): Promise<UsageStats> {
  const supabase = await createClient()

  // Get current period
  const periodStart = new Date()
  periodStart.setDate(1)
  periodStart.setHours(0, 0, 0, 0)

  // Get subscription to know limits
  const subscription = await getSubscription(organizationId)
  const planKey = subscription?.plan || 'starter'
  const limits = SUBSCRIPTION_PLANS[planKey as keyof typeof SUBSCRIPTION_PLANS]?.limits || SUBSCRIPTION_PLANS.starter.limits

  // Get actual usage counts
  const [productCount, warehouseCount, apiCallCount] = await Promise.all([
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('warehouses')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('usage_metrics')
      .select('metric_value')
      .eq('organization_id', organizationId)
      .eq('metric_type', 'api_calls')
      .gte('period_start', periodStart.toISOString())
      .single(),
  ])

  const products = productCount.count || 0
  const warehouses = warehouseCount.count || 0
  const apiCalls = apiCallCount.data?.metric_value || 0

  return {
    products: {
      current: products,
      limit: limits.products,
      percentage: limits.products === -1 ? 0 : (products / limits.products) * 100,
    },
    warehouses: {
      current: warehouses,
      limit: limits.warehouses,
      percentage: limits.warehouses === -1 ? 0 : (warehouses / limits.warehouses) * 100,
    },
    apiCalls: {
      current: apiCalls,
      limit: limits.apiCalls,
      percentage: (apiCalls / limits.apiCalls) * 100,
    },
  }
}

/**
 * Retrieves recent API call activity for the specified organization.
 *
 * @param organizationId - The unique identifier of the organization
 * @param limit - The maximum number of activity records to return (default is 10)
 * @returns An array of recent activity objects representing API calls, each including id, type, description, timestamp, and metadata
 */
export async function getRecentActivity(organizationId: string, limit = 10) {
  const supabase = await createClient()

  // For now, we'll get recent API calls as activity
  const { data: apiCalls } = await supabase
    .from('api_call_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Transform into activity format
  const activity = apiCalls?.map((call: any) => ({
    id: call.id,
    type: 'api_call',
    description: `API call to ${call.method} ${call.endpoint}`,
    timestamp: call.created_at,
    metadata: {
      status_code: call.status_code,
      response_time_ms: call.response_time_ms,
    },
  })) || []

  return activity
}

/**
 * Retrieves a list of invoices for the specified organization.
 *
 * Returns up to 100 invoices from Stripe associated with the organization's customer billing record. If no Stripe customer ID is found or an error occurs, returns an empty array.
 *
 * @param organizationId - The unique identifier of the organization
 * @returns An array of invoice objects containing status, amounts, currency, period, creation date, and invoice URLs
 */
export async function getInvoices(organizationId: string): Promise<Invoice[]> {
  const supabase = await createClient()

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_customer_id')
    .eq('organization_id', organizationId)
    .single()

  if (!billing?.stripe_customer_id) {
    return []
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: billing.stripe_customer_id,
      limit: 100,
    })

    return invoices.data.map(invoice => ({
      id: invoice.id,
      status: (invoice.status || 'draft') as Invoice['status'],
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      period_start: invoice.period_start,
      period_end: invoice.period_end,
      created: invoice.created,
      invoice_pdf: invoice.invoice_pdf || null,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
    }))
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return []
  }
}

/**
 * Retrieves the list of card payment methods associated with an organization's Stripe customer account.
 *
 * Returns an array of payment methods, each containing card brand, last four digits, and expiration details. If no Stripe customer is found or an error occurs, returns an empty array.
 */
export async function getPaymentMethods(organizationId: string): Promise<PaymentMethod[]> {
  const supabase = await createClient()

  const { data: billing } = await supabase
    .from('customer_billing')
    .select('stripe_customer_id')
    .eq('organization_id', organizationId)
    .single()

  if (!billing?.stripe_customer_id) {
    return []
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: billing.stripe_customer_id,
      type: 'card',
    })

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand || '',
      last4: pm.card?.last4 || '',
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
    }))
  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return []
  }
}

/**
 * Retrieves the list of team members associated with the specified organization.
 *
 * @param organizationId - The unique identifier of the organization whose team members are to be fetched.
 * @returns An array of team member profiles, or an empty array if none are found.
 */
export async function getTeamMembers(organizationId: string) {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('user_profiles')
    .select('*, auth.users(email, created_at, last_sign_in_at)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  return members || []
}

/**
 * Retrieves pending team invitations for the specified organization.
 *
 * Returns invitations that have not been accepted and have not expired.
 *
 * @param organizationId - The unique identifier of the organization
 * @returns An array of pending invitation objects, or an empty array if none exist
 */
export async function getPendingInvites(organizationId: string) {
  const supabase = await createClient()

  const { data: invites } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return invites || []
}

/**
 * Returns an empty array as team activity tracking is not yet implemented.
 */
export async function getTeamActivity(_organizationId: string, _limit = 20) {
  const _supabase = await createClient()

  // For now, return empty array - would need to implement activity tracking
  return []
}