'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle, Edit, Package, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateOrder } from '@/app/actions/orders'
import type { OrderStatus, OrderSummary } from '@/types/order.types'

interface OrderDetailHeaderProps {
  order: OrderSummary
}

export function OrderDetailHeader({ order }: OrderDetailHeaderProps) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(
    order.status
  )

  const handleStatusUpdate = async () => {
    if (selectedStatus === order.status) {
      setEditingStatus(false)
      return
    }

    setIsUpdating(true)
    try {
      const result = await updateOrder(order.id, { status: selectedStatus })
      if (result.success) {
        toast.success('Order status updated successfully')
        router.refresh()
        setEditingStatus(false)
      } else {
        toast.error(result.error || 'Failed to update status')
      }
    } catch (error) {
      toast.error('An error occurred while updating the order')
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return Package
      case 'processing':
      case 'shipped':
        return Truck
      case 'delivered':
        return CheckCircle
      default:
        return Package
    }
  }

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const StatusIcon = getStatusIcon(order.status)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">Order #{order.order_number}</h1>
            {editingStatus ? (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedStatus}
                  onValueChange={(value: OrderStatus) =>
                    setSelectedStatus(value)
                  }
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleStatusUpdate}
                  disabled={isUpdating}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingStatus(false)
                    setSelectedStatus(order.status)
                  }}
                  disabled={isUpdating}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Badge
                className={`${getStatusColor(order.status)} flex items-center gap-1`}
              >
                <StatusIcon className="h-3 w-3" />
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Placed on{' '}
            {format(new Date(order.order_date), 'MMMM d, yyyy at h:mm a')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editingStatus &&
            order.status !== 'delivered' &&
            order.status !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingStatus(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Update Status
              </Button>
            )}
        </div>
      </div>
    </div>
  )
}
