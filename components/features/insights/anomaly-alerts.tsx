// components/features/insights/anomaly-alerts.tsx
'use client'

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AIInsight } from '@/types/ai.types'
import { dismissInsight } from '@/app/actions/insights'

interface AnomalyAlertsProps {
  alerts: AIInsight[]
}

export function AnomalyAlerts({ alerts }: AnomalyAlertsProps) {
  if (alerts.length === 0) {
    return null
  }

  const severityConfig = {
    critical: {
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      badgeVariant: 'destructive' as const,
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      badgeVariant: 'secondary' as const,
    },
    info: {
      icon: Info,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      badgeVariant: 'default' as const,
    },
  }

  async function handleDismiss(id: string) {
    await dismissInsight(id)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Alerts</CardTitle>
        <CardDescription>
          Unusual patterns and issues that require attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity || 'info']
            const Icon = config.icon

            return (
              <div
                key={alert.id}
                className={cn(
                  'p-4 rounded-lg border',
                  config.bgColor,
                  config.borderColor
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <Icon className={cn('h-5 w-5 mt-0.5', config.color)} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge variant={config.badgeVariant}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.content}
                      </p>
                      {alert.recommended_actions && alert.recommended_actions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-1">Recommended Actions:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {alert.recommended_actions.map((action, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-600" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <form action={handleDismiss.bind(null, alert.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}