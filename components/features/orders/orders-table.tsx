'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { MoreHorizontal, Eye, Edit, X } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { cancelOrder } from '@/app/actions/orders'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { OrderSummary } from '@/types/order.types'

interface OrdersTableProps {
  orders: OrderSummary[]
  total: number
  page: number
  limit: number
}

export function OrdersTable({ orders, total, page, limit }: OrdersTableProps) {
  const router = useRouter()
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const handleCancel = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return

    setCancellingId(orderId)
    try {
      const result = await cancelOrder(orderId)
      if (result.success) {
        toast.success('Order cancelled successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to cancel order')
      }
    } catch (error) {
      toast.error('An error occurred while cancelling the order')
    } finally {
      setCancellingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; className: string }> = {
      pending: { variant: 'secondary', className: 'bg-gray-100 text-gray-800' },
      confirmed: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
      processing: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800' },
      shipped: { variant: 'secondary', className: 'bg-purple-100 text-purple-800' },
      delivered: { variant: 'secondary', className: 'bg-green-100 text-green-800' },
      cancelled: { variant: 'destructive', className: '' },
      refunded: { variant: 'destructive', className: '' },
    }

    const config = variants[status] || variants.pending

    return (
      <Badge variant={config.variant} className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <Link 
                      href={`/dashboard/orders/${order.id}`}
                      className="hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.order_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {order.customer_name ? (
                      <Link
                        href={`/dashboard/customers/${order.customer_id}`}
                        className="hover:underline"
                      >
                        {order.customer_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Guest</span>
                    )}
                  </TableCell>
                  <TableCell>{order.item_count}</TableCell>
                  <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          disabled={cancellingId === order.id}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/orders/${order.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/orders/${order.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Order
                          </Link>
                        </DropdownMenuItem>
                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCancel(order.id)}
                              className="text-destructive"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel Order
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl="/dashboard/orders"
        />
      )}
    </div>
  )
}