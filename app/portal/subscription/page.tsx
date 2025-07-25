import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing'
import { SUBSCRIPTION_PLANS } from '@/lib/billing/stripe'
import { CurrentPlan } from '@/components/portal/subscription/current-plan'
import { PlanSelector } from '@/components/portal/subscription/plan-selector'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle } from 'lucide-react'

interface SubscriptionPageProps {
  searchParams: Promise<{
    success?: string
  }>
}

/**
 * Renders the subscription and billing management page for authenticated users.
 *
 * Displays the current subscription plan, allows eligible users to select or change plans, and shows relevant alerts based on subscription status or recent updates. Redirects unauthenticated users to the login page and users without an organization to the dashboard.
 *
 * @param props - Contains a promise resolving to search parameters, which may include a success indicator for subscription updates.
 * @returns The subscription management page as a React server component.
 */
export default async function SubscriptionPage(props: SubscriptionPageProps) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const subscription = await getSubscription(profile.organization_id)

  // Transform plans for display
  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([key, value]) => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    monthlyPrice: value.monthlyPrice,
    yearlyPrice: value.yearlyPrice || Math.floor(value.monthlyPrice * 10), // 2 months free (16.67% discount)
    features: [
      value.limits.products === -1 
        ? 'Unlimited products' 
        : `Up to ${value.limits.products.toLocaleString()} products`,
      value.limits.warehouses === -1 
        ? 'Unlimited warehouses' 
        : `Up to ${value.limits.warehouses} warehouses`,
      `${value.limits.apiCalls.toLocaleString()} API calls/month`,
      ...(key === 'starter' ? [
        'Email support',
        'Basic analytics',
        'Standard integrations',
      ] : []),
      ...(key === 'growth' ? [
        'Priority email support',
        'Advanced analytics',
        'Custom integrations',
        'Bulk operations',
        'API webhooks',
      ] : []),
      ...(key === 'scale' ? [
        'Phone & email support',
        'Custom analytics',
        'All integrations',
        'Dedicated account manager',
        'Custom contracts',
        'SLA guarantee',
      ] : []),
    ],
    popular: key === 'growth',
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Subscription & Billing</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription plan and billing preferences
        </p>
      </div>

      {searchParams.success && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Your subscription has been updated successfully!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <CurrentPlan 
          subscription={subscription}
          organization={profile.organizations}
        />

        {subscription?.id !== 'enterprise' && (
          <>
            <PlanSelector 
              plans={plans}
              currentPlan={subscription?.plan || 'free'}
              currentInterval={subscription?.interval || 'month'}
            />
          </>
        )}

        {subscription?.id === 'enterprise' && (
          <Alert>
            <AlertDescription>
              You're on an Enterprise plan. Please contact your account manager for any changes to your subscription.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}