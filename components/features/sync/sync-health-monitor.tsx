// PRP-015: Sync Health Monitor Component
'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getSyncHealthData } from '@/app/actions/sync-engine'
import type { SyncHealthStatus } from '@/types/sync-engine.types'

interface SyncHealthMonitorProps {
  integrations: {
    id: string
    name: string
    platform: string
  }[]
}

/**
 * Displays a real-time dashboard of system and integration health statuses, including sync engine, queue metrics, and individual integration details.
 *
 * Uses React Query to fetch real health data from the server, presenting visual indicators, metrics, and alerts for degraded or unhealthy states. Supports manual refresh and auto-refresh every 30 seconds, and summarizes overall system health with detailed breakdowns for each integration.
 *
 * @param integrations - The list of integrations to monitor and display health information for.
 */
export function SyncHealthMonitor({ integrations }: SyncHealthMonitorProps) {
  const {
    data: healthData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['sync-health'],
    queryFn: getSyncHealthData,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  })

  const handleRefresh = () => {
    refetch()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-destructive" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    // Fix type safety (fix-29) - properly type the status parameter
    type StatusType = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
    const statusTyped = status as StatusType

    const variantMap = {
      healthy: 'default',
      degraded: 'secondary',
      unhealthy: 'destructive',
      unknown: 'outline',
    } as const

    const variant = variantMap[statusTyped] || variantMap.unknown

    return (
      <Badge variant={variant} className="gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getOverallStatus = () => {
    if (!healthData) return 'unknown'

    const unhealthyCount = healthData.integration_health.filter(
      (h) => h.status === 'unhealthy'
    ).length
    const degradedCount = healthData.integration_health.filter(
      (h) => h.status === 'degraded'
    ).length

    if (unhealthyCount > 0 || healthData.system_health.status === 'unhealthy') {
      return 'unhealthy'
    }
    if (degradedCount > 0 || healthData.system_health.status === 'degraded') {
      return 'degraded'
    }
    return 'healthy'
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const overallStatus = getOverallStatus()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">System Health</h3>
          {getStatusBadge(overallStatus)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Critical Issues Alert */}
      {overallStatus === 'unhealthy' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Critical Issues Detected</AlertTitle>
          <AlertDescription>
            {healthData?.integration_health
              .filter((h) => h.status === 'unhealthy' && h.issues)
              .map((h) => `${h.integration.name}: ${h.issues?.join(', ')}`)
              .join(' • ')}
          </AlertDescription>
        </Alert>
      )}

      {/* System Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sync Engine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              {getStatusBadge(healthData?.engine_health?.status || 'unknown')}
              <span className="text-sm text-muted-foreground">
                {healthData?.engine_health?.activeJobs || 0} /{' '}
                {healthData?.engine_health?.maxJobs || 0} jobs
              </span>
            </div>
            <Progress
              value={
                ((healthData?.engine_health?.activeJobs || 0) /
                  (healthData?.engine_health?.maxJobs || 1)) *
                100
              }
              className="h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                {healthData?.system_health.metrics.total_queue_depth || 0}
              </span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Pending jobs in queue
              {healthData?.system_health.metrics.stuck_jobs ? (
                <span className="text-yellow-600 ml-1">
                  ({healthData.system_health.metrics.stuck_jobs} stuck)
                </span>
              ) : null}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                {healthData?.integration_health.filter(
                  (h) => h.status !== 'unhealthy'
                ).length || 0}
              </span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Of {integrations.length} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Integration Health Details */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Health</CardTitle>
          <CardDescription>
            Individual health status for each integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {healthData?.integration_health.map((health) => (
              <div key={health.integration_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(health.status)}
                    <div>
                      <p className="font-medium">{health.integration.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {health.integration.platform}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Success:</span>{' '}
                      <span className="font-medium">
                        {(health.metrics.success_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg:</span>{' '}
                      <span className="font-medium">
                        {(health.metrics.average_duration_ms / 1000).toFixed(1)}
                        s
                      </span>
                    </div>
                    {health.metrics.queue_depth > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {health.metrics.queue_depth} queued
                      </Badge>
                    )}
                  </div>
                </div>
                {health.issues && health.issues.length > 0 && (
                  <div className="ml-8 text-sm text-muted-foreground">
                    {health.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 mt-0.5 text-yellow-600" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}
