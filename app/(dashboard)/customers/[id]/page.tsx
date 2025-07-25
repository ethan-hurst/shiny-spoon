import { notFound, redirect } from 'next/navigation'
import { CustomerHeader } from '@/components/features/customers/customer-header'
import { CustomerTabs } from '@/components/features/customers/customer-tabs'
import { createClient } from '@/lib/supabase/server'
import { CustomerWithStats } from '@/types/customer.types'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Server component that renders a detailed customer profile page, including customer information, contacts, activities, and statistics.
 *
 * Retrieves the authenticated user's organization, fetches the specified customer and related data, and displays the information using header and tab components. Redirects unauthenticated users to the login page and returns a 404 page if the customer or user profile is not found.
 *
 * @param props - Contains a promise resolving to route parameters with the customer ID.
 * @returns The rendered customer detail page as JSX.
 */
export default async function CustomerDetailPage(props: PageProps) {
  const params = await props.params
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
    notFound()
  }

  // Fetch customer with all related data
  const { data: customer, error } = await supabase
    .from('customers')
    .select(
      `
      *,
      customer_tiers!customers_tier_id_fkey (
        name,
        level,
        discount_percentage,
        color
      )
    `
    )
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (error || !customer) {
    notFound()
  }

  // Run queries in parallel for better performance
  const [{ data: contacts }, { data: activities }, { data: stats }] =
    await Promise.all([
      supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', params.id)
        .eq('organization_id', profile.organization_id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),

      supabase
        .from('customer_activities')
        .select('*')
        .eq('customer_id', params.id)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase.rpc('get_customer_stats', {
        p_customer_id: params.id,
      }),
    ])

  // Transform to CustomerWithStats
  const customerWithStats: CustomerWithStats = {
    ...customer,
    tier_name: customer.customer_tiers?.name,
    tier_level: customer.customer_tiers?.level,
    tier_discount: customer.customer_tiers?.discount_percentage,
    tier_color: customer.customer_tiers?.color,
    total_orders: stats?.[0]?.total_orders || 0,
    total_revenue: stats?.[0]?.total_revenue || 0,
    last_order_date: stats?.[0]?.last_order_date,
    account_age_days: stats?.[0]?.account_age_days || 0,
    contact_count: contacts?.length || 0,
    primary_contact: contacts?.find((c: any) => c.is_primary) || contacts?.[0],
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <CustomerHeader customer={customerWithStats} />

      <CustomerTabs
        customer={customerWithStats}
        contacts={(contacts as any) || []}
        activities={(activities as any) || []}
      />
    </div>
  )
}
