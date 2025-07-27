// PRP-016: Data Accuracy Monitor - Main Dashboard Component
'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { triggerAccuracyCheck, acknowledgeAlert, resolveDiscrepancy } from '@/app/actions/monitoring'
import { useAccuracyMonitor } from '@/hooks/use-accuracy-monitor'
import { AccuracyChart } from './accuracy-chart'
import { AlertHistory } from './alert-history'
import { DiscrepancyTable } from './discrepancy-table'

interface AccuracyDashboardProps {
  organizationId: string
  initialAccuracy: number
  initialChecks: any[]
  initialAlerts: any[]
  initialDiscrepancies: any[]
}

/**
 * Displays a comprehensive dashboard for monitoring data accuracy metrics, discrepancies, and alerts for a specified organization.
 *
 * Presents key accuracy statistics, recent trends, active discrepancies, and alerts, with interactive controls for refreshing data, running manual checks, resolving discrepancies, and acknowledging alerts. Provides visual feedback and notifications for user actions and system events.
 *
 * @param organizationId - The unique identifier of the organization whose data accuracy is being monitored.
 * @param initialAccuracy - The initial overall accuracy percentage to display before live data loads.
 * @param initialChecks - The initial list of recent accuracy check records.
 * @param initialAlerts - The initial list of active alerts.
 * @param initialDiscrepancies - The initial list of data discrepancies.
 * @returns The rendered accuracy monitoring dashboard UI.
 */
export function AccuracyDashboard({
  organizationId,
  initialAccuracy,
  initialChecks,
  initialAlerts,
  initialDiscrepancies,
}: AccuracyDashboardProps) {
  const { toast } = useToast()
  const [checking, setChecking] = useState(false)
  
  const {
    currentAccuracy,
    recentChecks,
    activeAlerts,
    discrepancies,
    isLoading,
    refresh,
  } = useAccuracyMonitor({
    organizationId,
    initialAccuracy,
    initialChecks,
    initialAlerts,
    initialDiscrepancies,
  })

  const handleManualCheck = async () => {
    setChecking(true)
    try {
      const result = await triggerAccuracyCheck({
        scope: 'full',
        checkDepth: 'deep',
      })

      if (result.success) {
        toast({
          title: 'Accuracy check started',
          description: 'The check is running in the background. You\'ll be notified when it completes.',
        })
      } else {
        toast({
          title: 'Failed to start check',
          description: result.error || 'An error occurred',
          variant: 'destructive',
        })
      }
    } finally {
      setChecking(false)
    }
  }

  const getAccuracyColor = (score: number) => {
    if (score >= 98) return 'text-green-600'
    if (score >= 95) return 'text-yellow-600'
    if (score >= 90) return 'text-orange-600'
    return 'text-red-600'
  }

  const getAccuracyTrend = () => {
    if (!recentChecks || recentChecks.length < 2) return null

    const latest = recentChecks[0].accuracy_score
    const previous = recentChecks[1].accuracy_score
    const diff = latest - previous

    if (Math.abs(diff) < 0.1) return null

    return diff > 0 ? (
      <div className="flex items-center text-green-600">
        <TrendingUp className="h-4 w-4 mr-1" />
        <span className="text-sm">+{diff.toFixed(1)}%</span>
      </div>
    ) : (
      <div className="flex items-center text-red-600">
        <TrendingDown className="h-4 w-4 mr-1" />
        <span className="text-sm">{diff.toFixed(1)}%</span>
      </div>
    )
  }

  const openDiscrepancies = discrepancies.filter(d => d.status === 'open')
  const criticalDiscrepancies = discrepancies.filter(d => d.severity === 'critical')
  const highDiscrepancies = discrepancies.filter(d => d.severity === 'high')

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Data Accuracy Monitor</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleManualCheck} disabled={checking}>
            {checking ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Run Full Check
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Overall Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div
                className={`text-3xl font-bold ${getAccuracyColor(currentAccuracy)}`}
              >
                {currentAccuracy.toFixed(1)}%
              </div>
              {getAccuracyTrend()}
            </div>
            <Progress
              value={currentAccuracy}
              className="mt-2"
              indicatorClassName={
                currentAccuracy >= 95 ? 'bg-green-500' : 'bg-yellow-500'
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Active Discrepancies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {openDiscrepancies.length}
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="destructive">
                {criticalDiscrepancies.length} Critical
              </Badge>
              <Badge variant="secondary">
                {highDiscrepancies.length} High
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{activeAlerts.length}</div>
              <Bell
                className={`h-8 w-8 ${activeAlerts.length > 0 ? 'text-yellow-500 animate-pulse' : 'text-gray-400'}`}
              />
            </div>
            {activeAlerts.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Requires attention
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {recentChecks[0] ? (
                <>
                  <p className="font-medium">
                    {new Date(recentChecks[0].completed_at || recentChecks[0].created_at).toLocaleString()}
                  </p>
                  <p className="text-muted-foreground">
                    {recentChecks[0].records_checked?.toLocaleString() || 0} records
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">No checks yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Accuracy Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <AccuracyChart data={recentChecks} height={300} />
        </CardContent>
      </Card>

      {/* Active Discrepancies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Discrepancies</CardTitle>
            {openDiscrepancies.length > 0 && (
              <Badge variant="outline">
                {openDiscrepancies.length} Open
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DiscrepancyTable
            discrepancies={openDiscrepancies}
            onResolve={async (id) => {
              try {
                const result = await resolveDiscrepancy(id, 'manual_fixed')
                if (result.success) {
                  toast({
                    title: 'Discrepancy resolved',
                    description: 'The discrepancy has been marked as resolved.',
                  })
                  await refresh()
                } else {
                  toast({
                    title: 'Failed to resolve',
                    description: result.error || 'Failed to resolve discrepancy',
                    variant: 'destructive',
                  })
                }
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'An unexpected error occurred',
                  variant: 'destructive',
                })
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Alerts</CardTitle>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <AlertHistory
            alerts={activeAlerts}
            onAcknowledge={async (id) => {
              try {
                const result = await acknowledgeAlert(id)
                if (result.success) {
                  toast({
                    title: 'Alert acknowledged',
                    description: 'The alert has been acknowledged.',
                  })
                  await refresh()
                } else {
                  toast({
                    title: 'Failed to acknowledge',
                    description: result.error || 'Failed to acknowledge alert',
                    variant: 'destructive',
                  })
                }
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'An unexpected error occurred',
                  variant: 'destructive',
                })
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}