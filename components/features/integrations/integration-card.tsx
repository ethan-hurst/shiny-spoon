import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  RefreshCw,
  Settings,
  Eye
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import type { 
  Integration, 
  IntegrationPlatformType, 
  IntegrationStatusType 
} from '@/types/integration.types'

interface IntegrationCardProps {
  integration: Integration & {
    health_score?: number
    last_sync_duration?: number
    active_job?: {
      id: string
      status: string
      progress?: number
    }
  }
  onSync: (integrationId: string) => void
  onConfigure: (integrationId: string) => void
  onViewDetails: (integrationId: string) => void
  isLoading?: boolean
}

export function IntegrationCard({
  integration,
  onSync,
  onConfigure,
  onViewDetails,
  isLoading = false
}: IntegrationCardProps) {
  const getStatusIcon = (status: IntegrationStatusType) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'configuring':
        return <Settings className="h-4 w-4 text-blue-500" />
      case 'suspended':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: IntegrationStatusType) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'error':
        return 'destructive'
      case 'configuring':
        return 'secondary'
      case 'suspended':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getPlatformDisplayName = (platform: IntegrationPlatformType) => {
    switch (platform) {
      case 'netsuite':
        return 'NetSuite'
      case 'shopify':
        return 'Shopify'
      case 'quickbooks':
        return 'QuickBooks'
      case 'sap':
        return 'SAP'
      case 'dynamics365':
        return 'Dynamics 365'
      default:
        return platform.charAt(0).toUpperCase() + platform.slice(1)
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const canSync = integration.status === 'active' && !integration.active_job

  return (
    <Card className="relative">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              {integration.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {getPlatformDisplayName(integration.platform)}
              </Badge>
              <div className="flex items-center gap-1">
                {getStatusIcon(integration.status)}
                <Badge variant={getStatusColor(integration.status)} className="text-xs">
                  {integration.status}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(integration.id)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Score */}
        {integration.health_score !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Health Score</span>
              <span className="font-medium">{integration.health_score}%</span>
            </div>
            <Progress 
              value={integration.health_score} 
              className="h-2"
              indicatorClassName={getHealthColor(integration.health_score)}
            />
          </div>
        )}

        {/* Last Sync */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last Sync</span>
          <span className="font-medium">
            {integration.last_sync_at
              ? formatDistanceToNow(new Date(integration.last_sync_at), {
                  addSuffix: true,
                })
              : 'Never'}
          </span>
        </div>

        {/* Sync Duration */}
        {integration.last_sync_duration && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">
              {integration.last_sync_duration < 1000
                ? `${integration.last_sync_duration}ms`
                : `${(integration.last_sync_duration / 1000).toFixed(1)}s`}
            </span>
          </div>
        )}

        {/* Error Count */}
        {integration.error_count > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Recent Errors</span>
            <span className="font-medium text-red-600">
              {integration.error_count}
            </span>
          </div>
        )}

        {/* Active Job Progress */}
        {integration.active_job && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Sync</span>
              <span className="font-medium">
                {integration.active_job.progress || 0}%
              </span>
            </div>
            <Progress 
              value={integration.active_job.progress || 0} 
              className="h-2"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => onSync(integration.id)}
            disabled={!canSync || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : integration.active_job ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConfigure(integration.id)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}