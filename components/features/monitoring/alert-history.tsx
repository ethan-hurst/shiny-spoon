// PRP-016: Data Accuracy Monitor - Alert History Component
'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Alert } from '@/lib/monitoring/types'

interface AlertHistoryProps {
  alerts: Alert[]
  onAcknowledge: (id: string) => Promise<void>
}

export function AlertHistory({ alerts, onAcknowledge }: AlertHistoryProps) {
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<string>>(new Set())

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingIds(prev => new Set(prev).add(id))
    try {
      await onAcknowledge(id)
    } finally {
      setAcknowledgingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />
      case 'medium':
        return <Bell className="h-5 w-5 text-yellow-500" />
      case 'low':
        return <Info className="h-5 w-5 text-blue-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string): "destructive" | "secondary" | "outline" | "default" => {
    switch (status) {
      case 'active':
        return 'destructive'
      case 'acknowledged':
        return 'secondary'
      case 'resolved':
        return 'outline'
      default:
        return 'default'
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
        <p>No active alerts</p>
        <p className="text-sm mt-1">Your data accuracy is within acceptable thresholds.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Card key={alert.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{alert.title}</h4>
                  <Badge variant={getStatusColor(alert.status)} className="text-xs">
                    {alert.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {alert.message.split('\n')[0]}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </span>
                  {alert.alert_rules?.name && (
                    <>
                      <span>•</span>
                      <span>Rule: {alert.alert_rules.name}</span>
                    </>
                  )}
                  {alert.trigger_value?.accuracy_score !== undefined && (
                    <>
                      <span>•</span>
                      <span>Accuracy: {alert.trigger_value.accuracy_score.toFixed(1)}%</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {alert.status === 'active' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAcknowledge(alert.id)}
                disabled={acknowledgingIds.has(alert.id)}
              >
                {acknowledgingIds.has(alert.id) ? (
                  <CheckCircle className="h-4 w-4 animate-pulse" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </Card>
      ))}

      {alerts.length > 5 && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm">
            View All Alerts
          </Button>
        </div>
      )}
    </div>
  )
}