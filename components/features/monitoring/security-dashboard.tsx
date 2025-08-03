'use client'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  Key,
  Lock,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccessControl } from '@/lib/security/access-control'
import { APIKeyManager } from '@/lib/security/api-key-manager'
import { SecurityMonitor } from '@/lib/security/security-monitor'
import { createClient } from '@/lib/supabase/client'

interface SecurityMetrics {
  totalAlerts: number
  criticalAlerts: number
  failedAuthAttempts: number
  suspiciousIPs: number
  blockedRequests: number
  avgResponseTime: number
}

interface SecurityAlert {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  metadata: Record<string, any>
  organization_id: string
  ip_address?: string
  user_agent?: string
  timestamp: Date
  acknowledged: boolean
  resolved: boolean
}

interface APIKey {
  id: string
  name: string
  organization_id: string
  permissions: string[]
  expires_at?: Date
  last_used_at?: Date
  created_at: Date
  is_active: boolean
  rate_limit: number
}

interface IPRule {
  id: string
  organization_id: string
  ip_address: string
  description: string
  is_active: boolean
  created_at: Date
  expires_at?: Date
}

export function SecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [ipRules, setIpRules] = useState<IPRule[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const supabase = createClient()

  useEffect(() => {
    loadSecurityData()
    const interval = setInterval(loadSecurityData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadSecurityData = async () => {
    try {
      setLoading(true)

      // Get security metrics
      const { data: metricsData } = await supabase.rpc('get_security_metrics', {
        org_id: 'current',
        days_back: 7,
      })
      setMetrics(metricsData)

      // Get active security alerts
      const securityMonitor = new SecurityMonitor(supabase)
      const alertsData = await securityMonitor.getActiveAlerts('current')
      setAlerts(alertsData)

      // Get API keys
      const apiKeyManager = new APIKeyManager(supabase)
      const apiKeysData = await apiKeyManager.listAPIKeys('current')
      setApiKeys(apiKeysData)

      // Get IP rules
      const accessControl = new AccessControl(supabase)
      const ipRulesData = await accessControl.getIPWhitelist('current')
      setIpRules(ipRulesData)

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load security data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (
    severity: 'low' | 'medium' | 'high' | 'critical'
  ) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'warning'
      case 'low':
        return 'default'
      default:
        return 'default'
    }
  }

  const getSeverityIcon = (
    severity: 'low' | 'medium' | 'high' | 'critical'
  ) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <Clock className="h-4 w-4" />
      case 'low':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  if (loading && !metrics) {
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
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time security monitoring and threat detection
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadSecurityData} disabled={loading}>
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

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Security Alerts
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  metrics?.criticalAlerts && metrics.criticalAlerts > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {metrics?.totalAlerts || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.criticalAlerts || 0} critical alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Auth</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  metrics?.failedAuthAttempts && metrics.failedAuthAttempts > 10
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {metrics?.failedAuthAttempts || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Failed authentication attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Blocked Requests
            </CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics?.blockedRequests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requests blocked by security rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Suspicious IPs
            </CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  metrics?.suspiciousIPs && metrics.suspiciousIPs > 5
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {metrics?.suspiciousIPs || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Suspicious IP addresses detected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="ip-rules">IP Whitelist</TabsTrigger>
          <TabsTrigger value="threats">Threat Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Security Alerts</CardTitle>
              <CardDescription>
                Real-time security alerts and threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No active security alerts
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <Alert
                      key={alert.id}
                      variant={getSeverityColor(alert.severity)}
                    >
                      {getSeverityIcon(alert.severity)}
                      <AlertTitle className="flex items-center justify-between">
                        {alert.title}
                        <div className="flex items-center space-x-2">
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          {alert.acknowledged && (
                            <Badge variant="outline">Acknowledged</Badge>
                          )}
                        </div>
                      </AlertTitle>
                      <AlertDescription>
                        {alert.description}
                        <div className="mt-2 text-sm space-y-1">
                          {alert.ip_address && (
                            <div>
                              <span className="font-medium">IP:</span>{' '}
                              {alert.ip_address}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Time:</span>{' '}
                            {alert.timestamp.toLocaleString()}
                          </div>
                          {alert.metadata &&
                            Object.keys(alert.metadata).length > 0 && (
                              <details className="mt-2">
                                <summary className="cursor-pointer font-medium">
                                  Details
                                </summary>
                                <pre className="mt-1 text-xs bg-muted p-2 rounded">
                                  {JSON.stringify(alert.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Key Management</CardTitle>
              <CardDescription>
                Manage API keys and monitor usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No API keys configured
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Key className="h-4 w-4" />
                          <span className="font-medium">{key.name}</span>
                          <Badge
                            variant={key.is_active ? 'default' : 'secondary'}
                          >
                            {key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            Rate: {key.rate_limit}/min
                          </Badge>
                          {key.expires_at && (
                            <Badge variant="outline">
                              Expires:{' '}
                              {new Date(key.expires_at).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Permissions:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {key.permissions.map((permission) => (
                              <Badge
                                key={permission}
                                variant="outline"
                                className="text-xs"
                              >
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Last Used:</span>
                          <div className="text-muted-foreground">
                            {key.last_used_at
                              ? new Date(key.last_used_at).toLocaleString()
                              : 'Never'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ip-rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IP Whitelist</CardTitle>
              <CardDescription>
                Manage allowed IP addresses and access rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ipRules.length === 0 ? (
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No IP rules configured
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ipRules.map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4" />
                          <span className="font-mono">{rule.ip_address}</span>
                          <Badge
                            variant={rule.is_active ? 'default' : 'secondary'}
                          >
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {rule.expires_at && (
                          <Badge variant="outline">
                            Expires:{' '}
                            {new Date(rule.expires_at).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm">
                        <div className="text-muted-foreground">
                          {rule.description}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Created:{' '}
                          {new Date(rule.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Threat Intelligence</CardTitle>
              <CardDescription>
                Monitor and analyze security threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">
                      {metrics?.suspiciousIPs || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Suspicious IPs Detected
                    </div>
                  </div>

                  <div className="text-center p-4 border rounded-lg">
                    <TrendingDown className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-red-600">
                      {metrics?.blockedRequests || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Requests Blocked
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Security Recommendations</h4>
                  <div className="space-y-2 text-sm">
                    {metrics?.failedAuthAttempts &&
                      metrics.failedAuthAttempts > 10 && (
                        <div className="flex items-center space-x-2 text-orange-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>
                            High number of failed authentication attempts
                            detected
                          </span>
                        </div>
                      )}

                    {metrics?.suspiciousIPs && metrics.suspiciousIPs > 5 && (
                      <div className="flex items-center space-x-2 text-orange-600">
                        <Globe className="h-4 w-4" />
                        <span>Multiple suspicious IP addresses detected</span>
                      </div>
                    )}

                    {metrics?.criticalAlerts && metrics.criticalAlerts > 0 && (
                      <div className="flex items-center space-x-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>
                          Critical security alerts require immediate attention
                        </span>
                      </div>
                    )}

                    {(!metrics?.failedAuthAttempts ||
                      metrics.failedAuthAttempts <= 5) &&
                      (!metrics?.suspiciousIPs || metrics.suspiciousIPs <= 2) &&
                      (!metrics?.criticalAlerts ||
                        metrics.criticalAlerts === 0) && (
                        <div className="flex items-center space-x-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>Security posture is healthy</span>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
