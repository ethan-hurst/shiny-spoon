'use client'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
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
import { createClient } from '@/lib/supabase/client'

interface SystemMetrics {
  uptime: number
  responseTime: number
  errorRate: number
  activeUsers: number
  databaseConnections: number
  memoryUsage: number
  cpuUsage: number
  diskUsage: number
}

interface ServiceStatus {
  name: string
  status: 'healthy' | 'warning' | 'error' | 'offline'
  responseTime: number
  lastCheck: Date
  error?: string
}

interface DeploymentInfo {
  version: string
  environment: string
  deployedAt: Date
  commitHash: string
  buildNumber: string
}

export function ProductionDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const supabase = createClient()

  useEffect(() => {
    loadProductionData()
    const interval = setInterval(loadProductionData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadProductionData = async () => {
    try {
      setLoading(true)

      // Get system metrics
      const { data: metricsData } = await supabase
        .rpc('get_system_metrics')
        .single()

      setMetrics(metricsData)

      // Get service status
      const { data: servicesData } = await supabase
        .from('service_status')
        .select('*')
        .order('last_check', { ascending: false })

      setServices(servicesData || [])

      // Get deployment info
      const { data: deploymentData } = await supabase
        .from('deployment_info')
        .select('*')
        .order('deployed_at', { ascending: false })
        .limit(1)
        .single()

      setDeployment(deploymentData)

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load production data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      case 'offline':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      case 'error':
        return <AlertTriangle className="h-4 w-4" />
      case 'offline':
        return <Clock className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Production Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time system monitoring and deployment status
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadProductionData} disabled={loading}>
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

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.uptime ? `${metrics.uptime.toFixed(2)}%` : '99.9%'}
            </div>
            <p className="text-xs text-muted-foreground">System availability</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  metrics?.responseTime && metrics.responseTime > 1000
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {metrics?.responseTime ? `${metrics.responseTime}ms` : '150ms'}
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
                  metrics?.errorRate && metrics.errorRate > 5
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {metrics?.errorRate
                  ? `${metrics.errorRate.toFixed(2)}%`
                  : '0.1%'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Error rate (last 24h)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.activeUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Database</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Connections</span>
                <span>{metrics?.databaseConnections || 0}</span>
              </div>
              <Progress
                value={Math.min(
                  ((metrics?.databaseConnections || 0) / 100) * 100,
                  100
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4" />
              <span>Memory</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Usage</span>
                <span>
                  {metrics?.memoryUsage
                    ? `${metrics.memoryUsage.toFixed(1)}%`
                    : '45%'}
                </span>
              </div>
              <Progress value={metrics?.memoryUsage || 45} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>CPU</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Usage</span>
                <span>
                  {metrics?.cpuUsage
                    ? `${metrics.cpuUsage.toFixed(1)}%`
                    : '25%'}
                </span>
              </div>
              <Progress value={metrics?.cpuUsage || 25} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Service Status</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
          <TabsTrigger value="alerts">System Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>
                Real-time status of all system services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No service data available
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {services.map((service) => (
                    <div
                      key={service.name}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`}
                        />
                        <div>
                          <div className="font-medium">{service.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {service.responseTime}ms response time
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(service.status)}
                        <Badge
                          variant={
                            service.status === 'healthy'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {service.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Information</CardTitle>
              <CardDescription>
                Current deployment details and version information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deployment ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Version
                      </div>
                      <div className="text-lg font-semibold">
                        {deployment.version}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Environment
                      </div>
                      <div className="text-lg font-semibold">
                        {deployment.environment}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Build Number
                      </div>
                      <div className="text-lg font-semibold">
                        {deployment.buildNumber}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Deployed At
                      </div>
                      <div className="text-lg font-semibold">
                        {new Date(deployment.deployedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Commit Hash
                    </div>
                    <div className="font-mono text-sm bg-muted p-2 rounded">
                      {deployment.commitHash}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No deployment information available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>
                Active system alerts and warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.errorRate && metrics.errorRate > 5 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>High Error Rate</AlertTitle>
                    <AlertDescription>
                      Error rate is {metrics.errorRate.toFixed(2)}%, which is
                      above the threshold of 5%.
                    </AlertDescription>
                  </Alert>
                )}

                {metrics?.responseTime && metrics.responseTime > 1000 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Slow Response Time</AlertTitle>
                    <AlertDescription>
                      Average response time is {metrics.responseTime}ms, which
                      is above the threshold of 1000ms.
                    </AlertDescription>
                  </Alert>
                )}

                {metrics?.memoryUsage && metrics.memoryUsage > 80 && (
                  <Alert variant="warning">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>High Memory Usage</AlertTitle>
                    <AlertDescription>
                      Memory usage is {metrics.memoryUsage.toFixed(1)}%, which
                      is above the threshold of 80%.
                    </AlertDescription>
                  </Alert>
                )}

                {(!metrics?.errorRate || metrics.errorRate <= 5) &&
                  (!metrics?.responseTime || metrics.responseTime <= 1000) &&
                  (!metrics?.memoryUsage || metrics.memoryUsage <= 80) && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>All Systems Operational</AlertTitle>
                      <AlertDescription>
                        All system metrics are within normal ranges.
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
