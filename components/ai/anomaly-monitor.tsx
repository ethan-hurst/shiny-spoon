/**
 * Anomaly Monitor Component
 * Real-time anomaly detection and alerting
 */

"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Eye,
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart
} from 'lucide-react'
import { useAnomalyMonitoring, useAnomalyDetection } from '@/hooks/use-ai-service'
import { format } from 'date-fns'

export function AnomalyMonitor() {
  const [selectedDataType, setSelectedDataType] = useState<'inventory' | 'pricing' | 'orders'>('inventory')
  const [sensitivity, setSensitivity] = useState<number>(0.7)
  
  const {
    anomalies,
    totalAnomalies,
    criticalAnomalies,
    isMonitoring,
    lastCheck
  } = useAnomalyMonitoring(['inventory', 'pricing', 'orders'], true)

  const anomalyDetection = useAnomalyDetection()

  const runManualCheck = async () => {
    try {
      await anomalyDetection.mutateAsync({
        data_type: selectedDataType,
        time_range: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        sensitivity,
        include_recommendations: true
      })
    } catch (error) {
      console.error('Manual anomaly check failed:', error)
    }
  }

  const getDataTypeIcon = (dataType: string) => {
    switch (dataType) {
      case 'inventory':
        return <Package className="h-4 w-4" />
      case 'pricing':
        return <DollarSign className="h-4 w-4" />
      case 'orders':
        return <ShoppingCart className="h-4 w-4" />
      default:
        return <TrendingUp className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Anomalies</p>
                <p className="text-2xl font-bold">{totalAnomalies}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Issues</p>
                <p className="text-2xl font-bold text-red-500">{criticalAnomalies}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                <p className="text-sm font-medium">
                  {isMonitoring ? 'Monitoring...' : 'Active'}
                </p>
              </div>
              {isMonitoring ? (
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Check Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Manual Anomaly Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Data Type</label>
              <Select 
                value={selectedDataType} 
                onValueChange={(value: 'inventory' | 'pricing' | 'orders') => setSelectedDataType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inventory">Inventory Data</SelectItem>
                  <SelectItem value="pricing">Pricing Data</SelectItem>
                  <SelectItem value="orders">Order Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium">Sensitivity</label>
              <Select 
                value={sensitivity.toString()} 
                onValueChange={(value) => setSensitivity(parseFloat(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.3">Low (0.3)</SelectItem>
                  <SelectItem value="0.5">Medium (0.5)</SelectItem>
                  <SelectItem value="0.7">High (0.7)</SelectItem>
                  <SelectItem value="0.9">Very High (0.9)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={runManualCheck}
                disabled={anomalyDetection.isPending}
                className="w-full sm:w-auto"
              >
                {anomalyDetection.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Check Now
              </Button>
            </div>
          </div>

          {lastCheck && (
            <p className="text-sm text-muted-foreground">
              Last automated check: {format(new Date(lastCheck), 'PPp')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Anomaly Results */}
      <div className="space-y-4">
        {anomalies.map((result, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getDataTypeIcon(result.analysis_period ? 'inventory' : 'unknown')}
                Anomalies Detected
                <Badge variant="outline">{result.total_anomalies} found</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.anomalies.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">No anomalies detected</p>
                  <p className="text-muted-foreground">
                    System is operating normally. Confidence: {(result.model_confidence * 100).toFixed(1)}%
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {result.anomalies.map((anomaly, anomalyIndex) => (
                    <Alert key={anomalyIndex} variant={anomaly.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={getSeverityColor(anomaly.severity)}>
                                  {anomaly.severity.toUpperCase()}
                                </Badge>
                                <span className="font-medium">{anomaly.anomaly_type}</span>
                              </div>
                              <p className="text-sm">{anomaly.description}</p>
                              {anomaly.affected_entities.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Affected: {anomaly.affected_entities.join(', ')}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(anomaly.detected_at), 'HH:mm')}
                            </span>
                          </div>
                          {anomaly.recommendation && (
                            <div className="bg-muted/50 p-2 rounded text-sm">
                              <strong>Recommendation:</strong> {anomaly.recommendation}
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}