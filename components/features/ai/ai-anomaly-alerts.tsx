'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import type { AIAnomalyAlertsProps, AnomalyAlert } from '@/types/ai.types'

export function AIAnomalyAlerts({ anomalies, onAlertAction }: AIAnomalyAlertsProps) {
  if (anomalies.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Anomalies Detected</h3>
          <p className="text-muted-foreground">
            Great! No unusual patterns have been detected in your data.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {anomalies.map((anomaly) => (
        <AIAnomalyCard
          key={anomaly.id}
          anomaly={anomaly}
          onAction={onAlertAction}
        />
      ))}
    </div>
  )
}

function AIAnomalyCard({ anomaly, onAction }: { anomaly: AnomalyAlert; onAction: (action: string) => void }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'stock_out':
        return '🚨'
      case 'low_stock':
        return '⚠️'
      case 'large_order':
        return '📦'
      case 'price_volatility':
        return '📈'
      default:
        return '🔍'
    }
  }

  return (
    <Card className={`border-l-4 border-l-${anomaly.severity === 'critical' ? 'red' : anomaly.severity === 'warning' ? 'orange' : 'blue'}-500`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getAnomalyIcon(anomaly.type)}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base">{anomaly.title}</CardTitle>
                <Badge className={getSeverityColor(anomaly.severity)}>
                  {anomaly.severity}
                </Badge>
                <Badge variant="outline">
                  {(anomaly.confidence * 100).toFixed(0)}% confidence
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {anomaly.detectedAt.toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('resolve')}
              title="Mark as resolved"
            >
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('dismiss')}
              title="Dismiss"
            >
              <XCircle className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4">{anomaly.description}</p>

        {/* Related Entities */}
        {anomaly.relatedEntities && anomaly.relatedEntities.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Related:</p>
            <div className="flex flex-wrap gap-2">
              {anomaly.relatedEntities.map((entity, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {entity.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Actions */}
        {anomaly.suggestedActions && anomaly.suggestedActions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Suggested Actions:</p>
            <div className="space-y-2">
              {anomaly.suggestedActions.map((action, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 