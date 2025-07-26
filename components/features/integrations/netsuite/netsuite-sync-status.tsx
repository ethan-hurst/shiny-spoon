// PRP-013: NetSuite Sync Status Component
'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  Loader2,
  Activity,
} from 'lucide-react'
import { triggerSync } from '@/app/actions/integrations'
import { toast } from '@/components/ui/use-toast'

interface NetSuiteSyncStatusProps {
  integrationId: string
  syncStates: any[] | null
  recentLogs: any[] | null
}

const entityIcons = {
  products: Package,
  inventory: Package,
  pricing: DollarSign,
  customers: Users,
  orders: ShoppingCart,
}

const severityColors = {
  info: 'default',
  warning: 'secondary',
  error: 'destructive',
  debug: 'outline',
} as const

const statusColors = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'success',
  failed: 'destructive',
  skipped: 'outline',
} as const

export function NetSuiteSyncStatus({ 
  integrationId, 
  syncStates, 
  recentLogs 
}: NetSuiteSyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  async function handleResync(entityType: string) {
    setIsSyncing(true)

    try {
      const formData = new FormData()
      formData.append('integrationId', integrationId)
      formData.append('entityType', entityType)
      
      await triggerSync(formData)
      
      toast({
        title: 'Sync started',
        description: `${entityType} resync has been initiated.`,
      })
    } catch (error) {
      console.error('Failed to trigger resync:', error)
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync',
        variant: 'destructive',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Group sync states by entity type
  const syncStatesByEntity = (syncStates || []).reduce((acc, state) => {
    if (!acc[state.entity_type]) {
      acc[state.entity_type] = state
    } else if (new Date(state.last_sync_at) > new Date(acc[state.entity_type].last_sync_at)) {
      acc[state.entity_type] = state
    }
    return acc
  }, {} as Record<string, any>)

  // Calculate overall sync health
  const activeSyncs = Object.values(syncStatesByEntity).filter(
    state => state.sync_status === 'in_progress'
  ).length
  
  const failedSyncs = Object.values(syncStatesByEntity).filter(
    state => state.sync_status === 'failed'
  ).length

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="details">Sync Details</TabsTrigger>
        <TabsTrigger value="logs">Activity Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sync Health</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {failedSyncs === 0 ? (
                  <span className="text-green-600">Healthy</span>
                ) : (
                  <span className="text-red-600">{failedSyncs} Failed</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeSyncs > 0 && `${activeSyncs} sync${activeSyncs > 1 ? 's' : ''} in progress`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {syncStates && syncStates.length > 0 ? (
                  formatDistanceToNow(new Date(syncStates[0].last_sync_at), { addSuffix: true })
                ) : (
                  'Never'
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all entity types
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Records Synced</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(syncStatesByEntity).reduce(
                  (sum, state) => sum + (state.records_processed || 0),
                  0
                ).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total records processed
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entity Sync Status</CardTitle>
            <CardDescription>
              Current sync status for each data type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['products', 'inventory', 'pricing', 'customers', 'orders'].map((entityType) => {
                const state = syncStatesByEntity[entityType]
                const Icon = entityIcons[entityType as keyof typeof entityIcons]
                const isInProgress = state?.sync_status === 'in_progress'
                const progress = state?.sync_progress || 0

                return (
                  <div key={entityType} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium capitalize">{entityType}</span>
                        {state && (
                          <Badge 
                            variant={statusColors[state.sync_status as keyof typeof statusColors] || 'outline'}
                          >
                            {state.sync_status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {state && (
                          <span className="text-sm text-muted-foreground">
                            {state.last_sync_at 
                              ? formatDistanceToNow(new Date(state.last_sync_at), { addSuffix: true })
                              : 'Never synced'
                            }
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResync(entityType)}
                          disabled={isSyncing || isInProgress}
                        >
                          {isInProgress ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {isInProgress && (
                      <Progress value={progress} className="h-2" />
                    )}
                    {state?.last_error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Sync Error</AlertTitle>
                        <AlertDescription className="text-xs">
                          {state.last_error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="details" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Detailed Sync Information</CardTitle>
            <CardDescription>
              Comprehensive sync statistics for each entity type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>
                Last updated: {new Date().toLocaleString()}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Next Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncStates && syncStates.length > 0 ? (
                  syncStates.map((state) => (
                    <TableRow key={state.id}>
                      <TableCell className="font-medium capitalize">
                        {state.entity_type}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={statusColors[state.sync_status as keyof typeof statusColors] || 'outline'}
                        >
                          {state.sync_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {state.last_sync_at 
                          ? new Date(state.last_sync_at).toLocaleString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        {state.sync_duration ? `${state.sync_duration}s` : '-'}
                      </TableCell>
                      <TableCell>
                        {state.records_processed || 0} / {state.total_records || 0}
                      </TableCell>
                      <TableCell>
                        {state.error_count || 0}
                      </TableCell>
                      <TableCell>
                        {state.next_sync_at 
                          ? new Date(state.next_sync_at).toLocaleString()
                          : 'Manual'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No sync history available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="logs" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription>
              Recent integration activity and error logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLogs && recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start space-x-3 border-b pb-3 last:border-0"
                  >
                    <div className="mt-0.5">
                      {log.severity === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : log.severity === 'warning' ? (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={severityColors[log.severity as keyof typeof severityColors] || 'outline'}
                          className="text-xs"
                        >
                          {log.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.log_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{log.message}</p>
                      {log.details && (
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No activity logs available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}