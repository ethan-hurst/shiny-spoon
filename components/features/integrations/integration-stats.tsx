import { Activity, AlertCircle, CheckCircle, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface IntegrationStatsProps {
  stats: {
    total: number
    active: number
    error: number
    syncing: number
  }
}

export function IntegrationStats({ stats }: IntegrationStatsProps) {
  const statCards = [
    {
      title: 'Total Integrations',
      value: stats.total,
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active',
      value: stats.active,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Errors',
      value: stats.error,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Syncing',
      value: stats.syncing,
      icon: Activity,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.title === 'Errors' && stat.value > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Requires attention
                </p>
              )}
              {stat.title === 'Syncing' && stat.value > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  In progress
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}