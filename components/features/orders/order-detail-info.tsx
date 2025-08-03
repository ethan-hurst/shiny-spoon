import { format } from 'date-fns'
import { Calendar, CreditCard, FileText, MapPin, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { OrderSummary } from '@/types/order.types'

interface OrderDetailInfoProps {
  order: OrderSummary
}

export function OrderDetailInfo({ order }: OrderDetailInfoProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatAddress = (address: any) => {
    if (!address) return 'Not provided'
    return [
      address.line1,
      address.line2,
      `${address.city}, ${address.state} ${address.postal_code}`,
      address.country,
    ]
      .filter(Boolean)
      .join('\n')
  }

  return (
    <div className="space-y-6">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.customer_name ? (
            <>
              <p className="font-medium">{order.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                {order.customer_email}
              </p>
              {order.customer_tier && (
                <Badge variant="secondary" className="mt-2">
                  {order.customer_tier} Customer
                </Badge>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Guest Order</p>
          )}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Discount</span>
                <span className="text-green-600">
                  -{formatCurrency(order.discount_amount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>{formatCurrency(order.tax_amount)}</span>
            </div>
            {order.shipping_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>{formatCurrency(order.shipping_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Shipping Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.shipping_address ? (
              <div>
                <p className="text-sm font-medium mb-1">Shipping Address</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {formatAddress(order.shipping_address)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No shipping address provided
              </p>
            )}

            {order.expected_delivery_date && (
              <div>
                <p className="text-sm font-medium mb-1">Expected Delivery</p>
                <p className="text-sm text-muted-foreground">
                  {format(
                    new Date(order.expected_delivery_date),
                    'MMMM d, yyyy'
                  )}
                </p>
              </div>
            )}

            {order.actual_delivery_date && (
              <div>
                <p className="text-sm font-medium mb-1">Delivered On</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(order.actual_delivery_date), 'MMMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      {order.billing_address && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium mb-1">Billing Address</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {formatAddress(order.billing_address)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Order Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Order Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {order.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {order.external_order_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">External References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium">External Order ID</p>
              <p className="text-sm text-muted-foreground">
                {order.external_order_id}
              </p>
            </div>
            {order.source_platform && (
              <div>
                <p className="text-sm font-medium">Source Platform</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {order.source_platform}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
