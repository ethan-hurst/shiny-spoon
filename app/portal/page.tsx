import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscription, getUsageStats, getRecentActivity } from '@/lib/billing'
import { AccountOverview } from '@/components/portal/account-overview'
import { QuickActions } from '@/components/portal/quick-actions'
import { UsageSummary } from '@/components/portal/usage-summary'
import { RecentActivity } from '@/components/portal/recent-activity'

/**
 * Renders the customer portal page for authenticated users, displaying account, billing, usage, and recent activity information.
 *
 * Redirects unauthenticated users to the login page and users without an associated organization to the dashboard.
 *
 * @returns The JSX layout for the customer portal page.
 */
export default async function CustomerPortalPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const [subscription, usage, activity] = await Promise.all([
    getSubscription(profile.organization_id),
    getUsageStats(profile.organization_id),
    getRecentActivity(profile.organization_id),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Account Overview</h1>
        <p className="text-muted-foreground mt-2">
          Manage your TruthSource account, billing, and settings
        </p>
      </div>

      <div className="grid gap-6">
        <AccountOverview
          organization={profile.organizations}
          subscription={subscription}
        />

        <QuickActions subscription={subscription} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <UsageSummary usage={usage} limits={subscription?.limits} />
        <RecentActivity activity={activity} />
      </div>
    </div>
  )
}