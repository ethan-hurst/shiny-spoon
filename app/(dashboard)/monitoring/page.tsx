// PRP-016: Data Accuracy Monitor - Dashboard Page
import { Suspense } from 'react'
import { Metadata } from 'next'
import { Activity, AlertTriangle, Database } from 'lucide-react'
import { AlertHealthMonitor } from '@/components/features/monitoring/alert-health-monitor'
import { PerformanceDashboard } from '@/components/features/monitoring/performance-dashboard'
import { SyncHealthMonitor } from '@/components/features/sync/sync-health-monitor'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = {
  title: 'Monitoring - TruthSource',
  description: 'Monitor system health, performance, and alerts',
}

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Monitoring</h1>
        <p className="text-muted-foreground">
          Monitor system health, performance metrics, and critical alerts
        </p>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList>
          <TabsTrigger
            value="performance"
            className="flex items-center space-x-2"
          >
            <Activity className="h-4 w-4" />
            <span>Performance</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Sync Health</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <Suspense fallback={<PerformanceDashboardSkeleton />}>
            <PerformanceDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Suspense fallback={<AlertHealthMonitorSkeleton />}>
            <AlertHealthMonitor />
          </Suspense>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <Suspense fallback={<SyncHealthMonitorSkeleton />}>
            <SyncHealthMonitor />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PerformanceDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Monitoring</h2>
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AlertHealthMonitorSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Alert Health Monitor</CardTitle>
          <CardDescription>Loading alert data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    </div>
  )
}

function SyncHealthMonitorSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sync Health Monitor</CardTitle>
          <CardDescription>Loading sync data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    </div>
  )
}
