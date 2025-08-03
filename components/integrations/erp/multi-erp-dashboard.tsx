'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  MoreVertical,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  Package,
  ShoppingCart,
  Loader2,
  XCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useERPConnections, useSyncStatus, useConflicts } from '@/lib/hooks/use-erp'
import { SyncPerformanceChart } from './sync-performance-chart'
import { ConflictsList } from './conflicts-list'
import { syncERPData } from '@/lib/actions/erp'
import { toast } from 'sonner'

const entityIcons = {
  products: Package,
  inventory: Database,
  orders: ShoppingCart,
  customers: Users,
}

export function MultiERPDashboard() {
  const { data: erpSystems, isLoading: erpsLoading } = useERPConnections()
  const { data: syncStatus, isLoading: syncLoading } = useSyncStatus()
  const { data: conflicts, isLoading: conflictsLoading } = useConflicts()
  const [syncingERP, setSyncingERP] = useState<string | null>(null)

  const handleSync = async (erpId: string) => {
    setSyncingERP(erpId)
    try {
      const result = await syncERPData(erpId)
      if (result.success) {
        toast.success('Sync completed successfully')
      } else {
        toast.error(result.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Failed to start sync')
    } finally {
      setSyncingERP(null)
    }
  }

  const isLoading = erpsLoading || syncLoading || conflictsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalRecords = erpSystems?.reduce((sum, erp) => sum + (erp.recordCount || 0), 0) || 0
  const activeConnections = erpSystems?.filter(erp => erp.connected).length || 0
  const pendingConflicts = conflicts?.filter(c => c.status === 'pending').length || 0

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeConnections}</div>
            <p className="text-xs text-muted-foreground">
              of {erpSystems?.length || 0} configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              across all systems
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.successRate ? `${syncStatus.successRate}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Conflicts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingConflicts}</div>
            <p className="text-xs text-muted-foreground">
              require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ERP Systems */}
      <Card>
        <CardHeader>
          <CardTitle>ERP Systems</CardTitle>
          <CardDescription>
            Manage and monitor your connected ERP systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {erpSystems?.map((erp) => (
              <div
                key={erp.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    erp.connected ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {erp.connected ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium">{erp.name}</h4>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{erp.type}</Badge>
                      <span>•</span>
                      <span>{erp.recordCount?.toLocaleString() || 0} records</span>
                      {erp.lastSync && (
                        <>
                          <span>•</span>
                          <span>
                            Last sync {formatDistanceToNow(new Date(erp.lastSync), { addSuffix: true })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {erp.syncProgress && (
                    <div className="w-32">
                      <Progress value={erp.syncProgress} className="h-2" />
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(erp.id)}
                    disabled={syncingERP === erp.id || !erp.connected}
                  >
                    {syncingERP === erp.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Sync</span>
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        View Logs
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Disconnect
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}

            {(!erpSystems || erpSystems.length === 0) && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No ERP systems connected</p>
                <Button className="mt-4">Add ERP System</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Sync Performance</TabsTrigger>
          <TabsTrigger value="conflicts">
            Data Conflicts
            {pendingConflicts > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingConflicts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="entities">Entity Status</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Sync Performance</CardTitle>
              <CardDescription>
                Monitor synchronization performance across all ERP systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SyncPerformanceChart data={syncStatus} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts">
          <Card>
            <CardHeader>
              <CardTitle>Data Conflicts</CardTitle>
              <CardDescription>
                Review and resolve data conflicts between ERP systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConflictsList conflicts={conflicts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entities">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(entityIcons).map(([entity, Icon]) => (
              <Card key={entity}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base capitalize">{entity}</CardTitle>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {erpSystems?.map((erp) => {
                      const entityData = erp.entities?.[entity]
                      if (!entityData) return null

                      return (
                        <div key={erp.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{erp.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {entityData.count?.toLocaleString() || 0}
                            </span>
                            {entityData.lastSync && (
                              <Clock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Alerts */}
      {conflicts && pendingConflicts > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            You have {pendingConflicts} unresolved data conflicts that require your attention.
            <Button variant="link" className="px-0 ml-2">
              Review Conflicts →
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}