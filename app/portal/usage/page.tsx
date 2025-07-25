import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription, getUsageStats } from '@/lib/billing'
import { UsageOverview } from '@/components/portal/usage/usage-overview'
import { UsageChart } from '@/components/portal/usage/usage-chart'
import { UsageBreakdown } from '@/components/portal/usage/usage-breakdown'
import { UsageAlerts } from '@/components/portal/usage/usage-alerts'

/**
 * Renders the usage and analytics dashboard for the authenticated user's organization.
 *
 * Ensures the user is authenticated and associated with an organization, then retrieves subscription details, current and historical usage metrics, and API call breakdowns. Displays usage alerts, overview, charts, and top API endpoints.
 */
export default async function UsagePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const [subscription, currentUsage] = await Promise.all([
    getSubscription(profile.organization_id),
    getUsageStats(profile.organization_id),
  ])

  // Get historical usage data for charts
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: historicalUsage } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true })

  // Get API call breakdown by endpoint
  const { data: apiBreakdown } = await supabase
    .from('api_call_logs')
    .select('endpoint, method')
    .eq('organization_id', profile.organization_id)
    .gte('created_at', new Date(new Date().setDate(1)).toISOString()) // Current month

  // Process API breakdown data
  const endpointCounts = apiBreakdown?.reduce((acc, call) => {
    const key = `${call.method} ${call.endpoint}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const topEndpoints = Object.entries(endpointCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Usage & Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Monitor your resource usage and API consumption
        </p>
      </div>

      <UsageAlerts usage={currentUsage} subscription={subscription} />

      <div className="grid gap-6">
        <UsageOverview 
          usage={currentUsage} 
          subscription={subscription}
        />

        <UsageChart 
          historicalUsage={historicalUsage || []}
          currentUsage={currentUsage}
        />

        <UsageBreakdown 
          topEndpoints={topEndpoints}
          totalApiCalls={currentUsage.apiCalls.current}
        />
      </div>
    </div>
  )
}