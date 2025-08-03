import { Activity, CheckCircle, Key, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ApiKeyStatsProps {
  stats: {
    totalKeys: number
    activeKeys: number
    totalCalls: number
    successRate: number
  }
}

export function ApiKeyStats({ stats }: ApiKeyStatsProps) {
  const items = [
    {
      title: 'Total Keys',
      value: stats.totalKeys,
      icon: Key,
      description: 'All time',
      color: 'text-blue-600',
    },
    {
      title: 'Active Keys',
      value: stats.activeKeys,
      icon: Lock,
      description: 'Currently active',
      color: 'text-green-600',
    },
    {
      title: 'API Calls',
      value: stats.totalCalls.toLocaleString(),
      icon: Activity,
      description: 'Last 30 days',
      color: 'text-purple-600',
    },
    {
      title: 'Success Rate',
      value: `${stats.successRate.toFixed(1)}%`,
      icon: CheckCircle,
      description: 'Last 30 days',
      color: 'text-emerald-600',
    },
  ]

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {item.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
