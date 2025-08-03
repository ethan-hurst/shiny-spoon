// components/features/insights/anomaly-alerts.tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Package, RefreshCw, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { detectAnomalies } from '@/app/actions/ai-insights'
import type { AIInsight } from '@/types/ai.types'

interface AnomalyAlertsProps {
  organizationId: string
  insights: AIInsight[]
}

export function AnomalyAlerts({
  organizationId,
  insights,
}: AnomalyAlertsProps) {
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadAnomalies = async () => {
    setIsLoading(true)
    try {
      const result = await detectAnomalies(organizationId)
      if (result.success && result.data) {
        setAnomalies(result.data)
      } else {
        toast.error(result.error || 'Failed to load anomalies')
      }
    } catch (error) {
      toast.error('Failed to load anomalies')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnomalies()
  }, [organizationId])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'out_of_stock':
      case 'low_stock':
      case 'excess_inventory':
        return Package
      default:
        return AlertTriangle
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Anomaly Detection</h2>
          <p className="text-muted-foreground">
            Real-time detection of inventory and operational anomalies
          </p>
        </div>
        <Button variant="outline" onClick={loadAnomalies} disabled={isLoading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* AI Insight Alerts */}
      {insights.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">AI-Generated Alerts</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight) => (
              <Card
                key={insight.id}
                className={getSeverityColor(insight.severity)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                    <Badge variant="outline">{insight.severity}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-3">
                    {insight.content}
                  </CardDescription>
                  {insight.recommended_actions.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-2">
                        Recommended Actions:
                      </p>
                      <ul className="text-sm space-y-1">
                        {insight.recommended_actions.map((action, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Anomalies */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Inventory Anomalies</h3>
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Detecting anomalies...</p>
            </CardContent>
          </Card>
        ) : anomalies.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700 mb-2">
                All Clear
              </h3>
              <p className="text-muted-foreground">
                No inventory anomalies detected
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {anomalies.map((anomaly, index) => {
              const Icon = getAnomalyIcon(anomaly.anomaly_type)
              return (
                <Card
                  key={index}
                  className={getSeverityColor(anomaly.severity)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <CardTitle className="text-base">
                        {anomaly.product_name}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {anomaly.severity}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {anomaly.warehouse_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Current Stock:
                        </span>
                        <span className="font-medium">
                          {anomaly.current_quantity}
                        </span>
                      </div>
                      <p className="text-sm">{anomaly.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
