import { redirect } from 'next/navigation'
import { TierList } from '@/components/features/customers/tiers/tier-list'
import { createClient } from '@/lib/supabase/server'

/**
 * Displays the customer tiers for the authenticated user's organization, including the number of customers in each tier.
 *
 * Redirects to the login page if the user is not authenticated. Throws an error if the user's profile is not found.
 * Fetches all tiers and customer counts for the organization, then renders a list of tiers with usage statistics.
 *
 * @returns A React server component rendering the customer tiers management page.
 */
export default async function TiersPage() {
  const supabase = await createClient()

  // Get user's organization
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Get all tiers
  const { data: tiers } = await supabase
    .from('customer_tiers')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('level', { ascending: true })

  // Get customer counts for each tier
  const { data: customerCounts } = await supabase
    .from('customers')
    .select('tier_id')
    .eq('organization_id', profile.organization_id)

  // Create tier usage map
  const tierUsageMap = new Map<string, number>()
  customerCounts?.forEach((customer: any) => {
    if (customer.tier_id) {
      const count = tierUsageMap.get(customer.tier_id) || 0
      tierUsageMap.set(customer.tier_id, count + 1)
    }
  })

  // Add usage counts to tiers
  const tiersWithUsage =
    tiers?.map((tier: any) => ({
      ...tier,
      customer_count: tierUsageMap.get(tier.id) || 0,
    })) || []

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Tiers</h1>
            <p className="text-muted-foreground">
              Manage pricing tiers and customer benefits
            </p>
          </div>
        </div>

        <TierList
          tiers={tiersWithUsage}
          organizationId={profile.organization_id}
        />
      </div>
    </div>
  )
}
