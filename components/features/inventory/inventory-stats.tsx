'use client'

import { AlertTriangle, DollarSign, Package, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { InventoryStats as IInventoryStats } from '@/types/inventory.types'

interface InventoryStatsProps {
  stats: IInventoryStats
}

export function InventoryStats({ stats }: InventoryStatsProps) {
  const cards = [
    {
      title: 'Total Value',
      value: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(stats.total_value),
      description: 'Inventory value at cost',
      icon: DollarSign,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Items',
      value: stats.total_items.toLocaleString(),
      description: 'Unique SKU-warehouse combinations',
      icon: Package,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Low Stock',
      value: stats.low_stock_items.toLocaleString(),
      description: 'Items below reorder point',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      alert: stats.low_stock_items > 0,
    },
    {
      title: 'Out of Stock',
      value: stats.out_of_stock_items.toLocaleString(),
      description: 'Items with zero available',
      icon: TrendingDown,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      alert: stats.out_of_stock_items > 0,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.title}
            className={cn(
              'relative overflow-hidden',
              card.alert && 'border-destructive'
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={cn('rounded-lg p-2', card.bgColor)}>
                <Icon className={cn('h-4 w-4', card.iconColor)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
              {card.alert && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full m-2 animate-pulse" />
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
