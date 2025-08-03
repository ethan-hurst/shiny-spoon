'use client'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Gauge,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getQueryCache } from '@/lib/cache/query-cache'
import { getPerformanceMonitor } from '@/lib/monitoring/performance-monitor'
import { createClient } from '@/lib/supabase/client'

interface PerformanceSummary {
  avgResponseTime: number
  errorRate: number
  activeAlerts: number
  uptime: number
}

interface PerformanceAlert {
  id: string
  metric: string
  threshold: number
  currentValue: number
  severity: 'warning' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
  avgResponseTime: number
}

interface QueryPerformance {
  queryHash: string
  queryText: string
  avgExecutionTime: number
  executionCount: number
}

export function PerformanceDashboard() {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [slowQueries, setSlowQueries] = useState<QueryPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const supabase = createClient()

  useEffect(() => {
    loadPerformanceData()
    const interval = setInterval(loadPerformanceData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadPerformanceData = async () => {
    try {
      setLoading(true)

      // Get performance summary
      const monitor = getPerformanceMonitor(supabase)
      const summaryData = await monitor.getPerformanceSummary()
      setSummary(summaryData)

      // Get active alerts
      const alertsData = await monitor.getActiveAlerts()
      setAlerts(alertsData)

      // Get cache statistics
      const cache = getQueryCache('performance')
      const cacheData = cache.getStats()
      setCacheStats(cacheData)

      // Get slow queries
      const { data: slowQueriesData } = await supabase.rpc('get_slow_queries', {
        org_id: 'current',
        limit_count: 10,
      })
      setSlowQueries(slowQueriesData || [])

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: 'warning' | 'critical') => {
    return severity === 'critical' ? 'destructive' : 'default'
  }

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99.9) return 'text-green-600'
    if (uptime >= 99.0) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime < 500) return 'text-green-600'
    if (responseTime < 1000) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of system performance and health
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadPerformanceData} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Badge variant="outline">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={getResponseTimeColor(summary?.avgResponseTime || 0)}
              >
                {summary?.avgResponseTime.toFixed(0) || 0}ms
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Average API response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  summary?.errorRate && summary.errorRate > 5
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {summary?.errorRate.toFixed(2) || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">API error rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className={getUptimeColor(summary?.uptime || 0)}>
                {summary?.uptime.toFixed(2) || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">System uptime</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  summary?.activeAlerts && summary.activeAlerts > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {summary?.activeAlerts || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Performance alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="queries">Slow Queries</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Alerts</CardTitle>
              <CardDescription>
                Active performance alerts and warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <Alert
                      key={alert.id}
                      variant={getSeverityColor(alert.severity)}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center justify-between">
                        {alert.metric}
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription>
                        {alert.message}
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Current:</span>{' '}
                          {alert.currentValue}
                          <span className="mx-2">|</span>
                          <span className="font-medium">Threshold:</span>{' '}
                          {alert.threshold}
                          <span className="mx-2">|</span>
                          <span className="font-medium">Time:</span>{' '}
                          {alert.timestamp.toLocaleString()}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
              <CardDescription>
                Query cache statistics and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cacheStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Hit Rate</p>
                      <div className="flex items-center space-x-2">
                        <Progress
                          value={cacheStats.hitRate}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium">
                          {cacheStats.hitRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Cache Size</p>
                      <p className="text-2xl font-bold">
                        {cacheStats.size} items
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Cache Hits</p>
                      <p className="text-2xl font-bold text-green-600">
                        {cacheStats.hits.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Cache Misses</p>
                      <p className="text-2xl font-bold text-red-600">
                        {cacheStats.misses.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Average Response Time</p>
                    <p className="text-2xl font-bold">
                      <span
                        className={getResponseTimeColor(
                          cacheStats.avgResponseTime
                        )}
                      >
                        {cacheStats.avgResponseTime.toFixed(0)}ms
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No cache statistics available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slow Queries</CardTitle>
              <CardDescription>
                Database queries taking longer than 1 second
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slowQueries.length === 0 ? (
                <div className="text-center py-8">
                  <Gauge className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No slow queries detected
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {slowQueries.map((query, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="destructive">
                          {query.avgExecutionTime.toFixed(0)}ms
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {query.executionCount} executions
                        </span>
                      </div>
                      <p className="text-sm font-mono bg-muted p-2 rounded">
                        {query.queryText.substring(0, 200)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
