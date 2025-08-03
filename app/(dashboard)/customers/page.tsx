import Link from 'next/link'
import { Plus } from 'lucide-react'
import { CustomerFilters } from '@/components/features/customers/customer-filters'
import { CustomerImportExport } from '@/components/features/customers/customer-import-export'
import { CustomerStats } from '@/components/features/customers/customer-stats'
import { CustomerTable } from '@/components/features/customers/customer-table'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { CustomerWithStats } from '@/types/customer.types'

interface PageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    tier_id?: string
    customer_type?: string
    page?: string
  }>
}

export default async function CustomersPage(props: PageProps) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // Get user's organization
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Build query with filters
  let query = supabase
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
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  // Apply search filter
  if (searchParams.search) {
    query = query.or(
      `company_name.ilike.%${searchParams.search}%,display_name.ilike.%${searchParams.search}%`
    )
  }

  // Apply status filter
  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  // Apply tier filter
  if (searchParams.tier_id) {
    query = query.eq('tier_id', searchParams.tier_id)
  }

  // Apply customer type filter
  if (searchParams.customer_type) {
    query = query.eq('customer_type', searchParams.customer_type)
  }

  // Pagination
  const page = parseInt(searchParams.page || '1')
  const pageSize = 25
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.range(from, to)

  const { data: customers, error } = await query

  if (error) {
    console.error('Error fetching customers:', error)
    throw new Error('Failed to load customers')
  }

  // Get contact counts for customers
  const customerIds = customers?.map((c: any) => c.id) || []
  const { data: contactCounts } = await supabase
    .from('customer_contacts')
    .select('customer_id')
    .in('customer_id', customerIds)

  // Get order counts and revenue for customers
  const { data: orderStats } = await supabase
    .from('orders')
    .select('customer_id, total_amount, status')
    .eq('organization_id', profile.organization_id)
    .in('customer_id', customerIds)

  // Calculate customer stats
  const customerStats =
    customers?.map((customer: any) => {
      const contacts =
        contactCounts?.filter((c: any) => c.customer_id === customer.id)
          .length || 0
      const orders =
        orderStats?.filter((o: any) => o.customer_id === customer.id) || []
      const totalRevenue = orders.reduce(
        (sum: number, order: any) => sum + (order.total_amount || 0),
        0
      )
      const orderCount = orders.length
      const lastOrder =
        orders.length > 0
          ? Math.max(
              ...orders.map((o: any) => new Date(o.created_at).getTime())
            )
          : null

      return {
        ...customer,
        contact_count: contacts,
        order_count: orderCount,
        total_revenue: totalRevenue,
        last_order_date: lastOrder ? new Date(lastOrder).toISOString() : null,
      }
    }) || []

  // Get customer stats
  const { data: stats, error: statsError } = await supabase.rpc(
    'get_organization_customer_stats',
    {
      p_organization_id: profile.organization_id,
    }
  )

  if (statsError) {
    console.error('Error fetching customer stats:', statsError)
  }

  // Get tiers for filters
  const { data: tiers } = await supabase
    .from('customer_tiers')
    .select('id, name, color')
    .eq('organization_id', profile.organization_id)
    .order('level', { ascending: true })

  // Transform data to include computed fields
  const customersWithStats: CustomerWithStats[] = (customers || []).map(
    (customer: any) => ({
      ...customer,
      tier_name: customer.customer_tiers?.name,
      tier_level: customer.customer_tiers?.level,
      tier_discount: customer.customer_tiers?.discount_percentage,
      tier_color: customer.customer_tiers?.color,
      contact_count:
        customerStats.find((c: any) => c.id === customer.id)?.contact_count ||
        0,
      order_count:
        customerStats.find((c: any) => c.id === customer.id)?.order_count || 0,
      total_revenue:
        customerStats.find((c: any) => c.id === customer.id)?.total_revenue ||
        0,
      last_order_date:
        customerStats.find((c: any) => c.id === customer.id)?.last_order_date ||
        null,
      account_age_days: Math.floor(
        (Date.now() - new Date(customer.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    })
  )

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer profiles, contacts, and pricing tiers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomerImportExport organizationId={profile.organization_id} />
          <Link href="/customers/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <CustomerStats
        stats={
          stats || {
            total_customers: customers?.length || 0,
            active_customers:
              customers?.filter((c: CustomerWithStats) => c.status === 'active')
                .length || 0,
            inactive_customers:
              customers?.filter(
                (c: CustomerWithStats) => c.status === 'inactive'
              ).length || 0,
            suspended_customers:
              customers?.filter(
                (c: CustomerWithStats) => c.status === 'suspended'
              ).length || 0,
            by_tier:
              tiers?.map(
                (tier: { id: string; name: string; color: string }) => ({
                  tier_name: tier.name,
                  count:
                    customers?.filter(
                      (c: CustomerWithStats) => c.tier_id === tier.id
                    ).length || 0,
                })
              ) || [],
          }
        }
      />

      {/* Filters */}
      <CustomerFilters tiers={tiers || []} defaultValues={searchParams} />

      {/* Table */}
      <CustomerTable
        customers={customersWithStats}
        currentPage={page}
        pageSize={pageSize}
        hasMore={customers?.length === pageSize}
        organizationId={profile.organization_id}
      />
    </div>
  )
}
