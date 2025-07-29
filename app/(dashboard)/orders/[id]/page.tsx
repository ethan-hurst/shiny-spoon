import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrderDetails } from '@/app/actions/orders'
import { OrderDetailHeader } from '@/components/features/orders/order-detail-header'
import { OrderDetailInfo } from '@/components/features/orders/order-detail-info'
import { OrderItemsTable } from '@/components/features/orders/order-items-table'
import { OrderStatusHistory } from '@/components/features/orders/order-status-history'

export const metadata: Metadata = {
  title: 'Order Details | TruthSource',
  description: 'View order details and tracking information',
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get order details
  const orderResult = await getOrderDetails(params.id)
  
  if (!orderResult.success || !orderResult.data) {
    notFound()
  }

  const order = orderResult.data

  // Get status history
  const { data: statusHistory } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-8 space-y-8">
      <OrderDetailHeader order={order} />
      
      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-8">
          <OrderItemsTable items={order.items} />
          
          {statusHistory && statusHistory.length > 0 && (
            <OrderStatusHistory history={statusHistory} />
          )}
        </div>
        
        <div>
          <OrderDetailInfo order={order} />
        </div>
      </div>
    </div>
  )
}