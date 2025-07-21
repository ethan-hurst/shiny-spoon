import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { CustomerHeader } from '@/components/features/customers/customer-header'
import { CustomerTabs } from '@/components/features/customers/customer-tabs'
import { CustomerWithStats, ContactRecord } from '@/types/customer.types'

interface PageProps {
  params: {
    id: string
  }
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const supabase = createClient()
  
  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
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
    .select(`
      *,
      customer_tiers!customers_tier_id_fkey (
        name,
        level,
        discount_percentage,
        color
      )
    `)
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (error || !customer) {
    notFound()
  }

  // Run queries in parallel for better performance
  const [
    { data: contacts },
    { data: activities },
    { data: stats }
  ] = await Promise.all([
    supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', params.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    
    supabase
      .from('customer_activities')
      .select('*')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    
    supabase
      .rpc('get_customer_stats', {
        p_customer_id: params.id
      })
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
    primary_contact: contacts?.find((c: any) => c.is_primary) || contacts?.[0]
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <CustomerHeader customer={customerWithStats} />
      
      <CustomerTabs 
        customer={customerWithStats}
        contacts={contacts as any || []}
        activities={activities as any || []}
      />
    </div>
  )
}