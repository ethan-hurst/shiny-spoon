'use client'

import Link from 'next/link'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface MarginAlert {
  id: string
  product_id: string
  customer_id?: string
  quantity: number
  base_price: number
  final_price: number
  margin_percent: number
  requested_at: string
  products: {
    name: string
    sku: string
  }
}

interface MarginAlertsProps {
  alerts: MarginAlert[]
}

export function MarginAlerts({ alerts }: MarginAlertsProps) {
  if (alerts.length === 0) return null

  return (
    <Alert className="border-destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Low Margin Warning</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>The following products have margins below the 15% threshold:</p>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 bg-background rounded-lg border"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{alert.products.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {alert.products.sku}
                  </Badge>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Qty: {alert.quantity}</span>
                  <span>Price: {formatCurrency(alert.final_price)}</span>
                  <span className="text-destructive font-medium">
                    Margin: {alert.margin_percent.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/pricing/products/${alert.product_id}`}>
                  Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  )
}
