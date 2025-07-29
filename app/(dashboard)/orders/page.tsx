import { Suspense } from 'react'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { OrdersTable } from '@/components/features/orders/orders-table'
import { OrdersHeader } from '@/components/features/orders/orders-header'
import { OrdersStats } from '@/components/features/orders/orders-stats'
import { Skeleton } from '@/components/ui/skeleton'
import { listOrders } from '@/app/actions/orders'

export const metadata: Metadata = {
  title: 'Orders | TruthSource',
  description: 'Manage your orders and track fulfillment',
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { 
    status?: string
    search?: string
    from?: string
    to?: string
    page?: string
  }
}) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Parse filters
  const page = parseInt(searchParams.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  // Fetch orders
  const ordersResult = await listOrders({
    status: searchParams.status as any,
    search: searchParams.search || undefined,
    from_date: searchParams.from || undefined,
    to_date: searchParams.to || undefined,
    limit,
    offset,
  })

  if (!ordersResult.success || !ordersResult.data) {
    throw new Error(ordersResult.error || 'Failed to fetch orders')
  }

  // Get order statistics
  const { data: stats } = await supabase
    .from('orders')
    .select('status, total_amount')
    .eq('organization_id', profile.organization_id)

  const orderStats = {
    total: stats?.length || 0,
    pending: stats?.filter((o: any) => o.status === 'pending').length || 0,
    processing: stats?.filter((o: any) => o.status === 'processing').length || 0,
    shipped: stats?.filter((o: any) => o.status === 'shipped').length || 0,
    totalRevenue: stats?.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0) || 0,
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <OrdersHeader />
      
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <OrdersStats stats={orderStats} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrdersTable 
          orders={ordersResult.data.orders}
          total={ordersResult.data.total}
          page={page}
          limit={limit}
        />
      </Suspense>
    </div>
  )
}