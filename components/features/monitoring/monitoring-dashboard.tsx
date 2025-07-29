'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { RefreshCw, Activity, Database, Server, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { sentryService } from '@/lib/monitoring/sentry-service'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  services: {
    database: ServiceStatus
    redis?: ServiceStatus
    externalApis: ServiceStatus
  }
  metrics: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
    }
  }
}

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  error?: string
}

interface PerformanceMetric {
  route: string
  method: string
  responseTime: number
  statusCode: number
  timestamp: string
}

export function MonitoringDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchHealthStatus = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setHealthStatus(data)
      setLastUpdated(new Date())
      
      // Add breadcrumb for monitoring
      sentryService.addBreadcrumb(
        'Health status fetched',
        'monitoring',
        'info',
        { status: data.status }
      )
    } catch (error) {
      sentryService.captureException(error as Error, {
        action: 'fetch_health_status',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPerformanceMetrics = async () => {
    try {
      // This would typically come from your monitoring service
      // For now, we'll simulate some metrics
      const mockMetrics: PerformanceMetric[] = [
        {
          route: '/api/products',
          method: 'GET',
          responseTime: 150,
          statusCode: 200,
          timestamp: new Date().toISOString(),
        },
        {
          route: '/api/inventory',
          method: 'POST',
          responseTime: 320,
          statusCode: 201,
          timestamp: new Date().toISOString(),
        },
      ]
      setPerformanceMetrics(mockMetrics)
    } catch (error) {
      sentryService.captureException(error as Error, {
        action: 'fetch_performance_metrics',
      })
    }
  }

  useEffect(() => {
    fetchHealthStatus()
    fetchPerformanceMetrics()
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchHealthStatus()
      fetchPerformanceMetrics()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800'
      case 'unhealthy':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  if (!healthStatus) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Monitoring
            </CardTitle>
            <CardDescription>
              Real-time system health and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring</h1>
          <p className="text-gray-600">
            Last updated: {lastUpdated?.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={fetchHealthStatus} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Overall System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(healthStatus.status)}
              <Badge className={getStatusColor(healthStatus.status)}>
                {healthStatus.status.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Version {healthStatus.version}</p>
              <p className="text-sm text-gray-600">
                Uptime: {formatUptime(healthStatus.uptime)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge className={getStatusColor(healthStatus.services.database.status)}>
                {healthStatus.services.database.status}
              </Badge>
              {healthStatus.services.database.responseTime && (
                <span className="text-xs text-gray-600">
                  {healthStatus.services.database.responseTime}ms
                </span>
              )}
            </div>
            {healthStatus.services.database.error && (
              <p className="mt-2 text-xs text-red-600">
                {healthStatus.services.database.error}
              </p>
            )}
          </CardContent>
        </Card>

        {healthStatus.services.redis && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4" />
                Redis Cache
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(healthStatus.services.redis.status)}>
                  {healthStatus.services.redis.status}
                </Badge>
                {healthStatus.services.redis.responseTime && (
                  <span className="text-xs text-gray-600">
                    {healthStatus.services.redis.responseTime}ms
                  </span>
                )}
              </div>
              {healthStatus.services.redis.error && (
                <p className="mt-2 text-xs text-red-600">
                  {healthStatus.services.redis.error}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" />
              External APIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge className={getStatusColor(healthStatus.services.externalApis.status)}>
                {healthStatus.services.externalApis.status}
              </Badge>
              {healthStatus.services.externalApis.responseTime && (
                <span className="text-xs text-gray-600">
                  {healthStatus.services.externalApis.responseTime}ms
                </span>
              )}
            </div>
            {healthStatus.services.externalApis.error && (
              <p className="mt-2 text-xs text-red-600">
                {healthStatus.services.externalApis.error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used</span>
                <span>{healthStatus.metrics.memory.used}MB</span>
              </div>
              <Progress value={healthStatus.metrics.memory.percentage} />
              <div className="flex justify-between text-xs text-gray-600">
                <span>Total: {healthStatus.metrics.memory.total}MB</span>
                <span>{healthStatus.metrics.memory.percentage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">CPU Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Usage</span>
                <span>{healthStatus.metrics.cpu.usage.toFixed(2)}s</span>
              </div>
              <Progress value={Math.min(healthStatus.metrics.cpu.usage * 10, 100)} />
              <div className="text-xs text-gray-600">
                CPU time since start
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent API Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {performanceMetrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {metric.method}
                  </Badge>
                  <span className="text-sm font-mono">{metric.route}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span className={metric.responseTime > 1000 ? 'text-red-600' : ''}>
                    {metric.responseTime}ms
                  </span>
                  <Badge 
                    variant={metric.statusCode >= 400 ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {metric.statusCode}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}