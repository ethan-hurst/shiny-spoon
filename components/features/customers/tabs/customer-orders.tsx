'use client'

import Link from 'next/link'
import { Package, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CustomerOrdersProps {
  customerId: string
}

export function CustomerOrders({ customerId }: CustomerOrdersProps) {
  // This is a placeholder component until orders are implemented
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Orders</CardTitle>
            <CardDescription>View and manage customer orders</CardDescription>
          </div>
          <Button asChild>
            <Link
              href={`/orders/new?customer_id=${encodeURIComponent(customerId)}`}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No orders found for this customer
          </p>
          <p className="text-sm text-muted-foreground">
            Orders will appear here once the order management system is
            implemented
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
