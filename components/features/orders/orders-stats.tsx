import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Clock, Truck, DollarSign } from 'lucide-react'

interface OrdersStatsProps {
  stats: {
    total: number
    pending: number
    processing: number
    shipped: number
    totalRevenue: number
  }
}

export function OrdersStats({ stats }: OrdersStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const cards = [
    {
      title: 'Total Orders',
      value: stats.total.toString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Pending',
      value: stats.pending.toString(),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Shipped',
      value: stats.shipped.toString(),
      icon: Truck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}