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

// Static configuration for stat cards to prevent recreation on each render
const STAT_CARD_CONFIG = [
  {
    title: 'Total Integrations',
    key: 'total' as const,
    icon: Zap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    title: 'Active',
    key: 'active' as const,
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    title: 'Errors',
    key: 'error' as const,
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    title: 'Syncing',
    key: 'syncing' as const,
    icon: Activity,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
]

export function IntegrationStats({ stats }: IntegrationStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {STAT_CARD_CONFIG.map((config) => {
        const Icon = config.icon
        const value = stats[config.key]
        
        return (
          <Card key={config.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {config.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${config.bgColor}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              {config.title === 'Errors' && value > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Requires attention
                </p>
              )}
              {config.title === 'Syncing' && value > 0 && (
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