/**
 * AI Service Status Component
 * Shows the health and status of AI services
 */

"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useAIServiceHealth } from '@/hooks/use-ai-service'

export function AIServiceStatus() {
  const { data: health, isLoading, error, isError } = useAIServiceHealth()

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            AI Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Checking AI service status...</p>
        </CardContent>
      </Card>
    )
  }

  if (isError || !health) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            AI Service Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error?.message || 'Unable to connect to AI service. Some features may be unavailable.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const allAgentsHealthy = Object.values(health.agents).every(status => status)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {allAgentsHealthy ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
          AI Service Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Service</span>
          <Badge variant={health.status === 'healthy' ? 'default' : 'destructive'}>
            {health.service} v{health.version} - {health.status}
          </Badge>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">AI Agents</h4>
          <div className="grid grid-cols-1 gap-2">
            <AgentStatus 
              name="Demand Forecasting" 
              status={health.agents.demand_forecasting}
              description="Predicts future product demand"
            />
            <AgentStatus 
              name="Delivery Prediction" 
              status={health.agents.delivery_prediction}
              description="Estimates delivery times and logistics"
            />
            <AgentStatus 
              name="Anomaly Detection" 
              status={health.agents.anomaly_detection}
              description="Monitors for data inconsistencies"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface AgentStatusProps {
  name: string
  status: boolean
  description: string
}

function AgentStatus({ name, status, description }: AgentStatusProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {status ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium">{name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Badge variant={status ? 'default' : 'destructive'} className="ml-2">
        {status ? 'Active' : 'Inactive'}
      </Badge>
    </div>
  )
}