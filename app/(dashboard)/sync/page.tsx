// PRP-015: Sync Dashboard Page
import { notFound } from 'next/navigation'
import { Activity, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { ManualSyncTrigger } from '@/components/features/sync/manual-sync-trigger'
import { SyncHealthMonitor } from '@/components/features/sync/sync-health-monitor'
import { SyncJobsList } from '@/components/features/sync/sync-jobs-list'
import { SyncSchedulesList } from '@/components/features/sync/sync-schedules-list'
import { SyncStatisticsPanel } from '@/components/features/sync/sync-statistics'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/server'
import type {
  SyncHealthStatus,
  SyncJob,
  SyncSchedule,
} from '@/types/sync-engine.types'

/**
 * Renders the Sync Dashboard page, providing an authenticated user with an overview and management interface for data synchronization across their organization's integrations.
 *
 * Displays summary metrics, manual sync controls, and tabbed sections for recent sync jobs, schedules, statistics, and system health. Redirects to a 404 page if the user is not authenticated or lacks an associated organization.
 */
export default async function SyncDashboardPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    notFound()
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    notFound()
  }

  // Get integrations for the organization
  const { data: integrations } = await supabase
    .from('integrations')
    .select('id, name, platform, enabled')
    .eq('organization_id', profile.organization_id)
    .eq('enabled', true)
    .order('name')

  // Get recent sync jobs
  const { data: recentJobs } = await supabase
    .from('sync_jobs')
    .select(
      `
      *,
      integrations (
        id,
        name,
        platform
      )
    `
    )
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get sync schedules
  const { data: schedules } = await supabase
    .from('sync_schedules')
    .select(
      `
      *,
      integrations (
        id,
        name,
        platform
      )
    `
    )
    .in('integration_id', integrations?.map((i) => i.id) || [])

  // Get sync statistics
  const { data: stats } = await supabase.rpc('get_sync_statistics', {
    p_integration_id: null, // Get overall stats
    p_period: 'day',
  })

  // Calculate summary metrics
  const activeJobs =
    recentJobs?.filter((job) => ['pending', 'running'].includes(job.status))
      .length || 0

  const failedJobs =
    recentJobs?.filter(
      (job) =>
        job.status === 'failed' &&
        new Date(job.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length || 0

  const enabledSchedules = schedules?.filter((s) => s.enabled).length || 0

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sync Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage data synchronization across all integrations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs}</div>
            <p className="text-xs text-muted-foreground">
              Currently processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Failed Jobs (24h)
            </CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedJobs}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Success Rate (24h)
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats && stats.total_syncs > 0
                ? `${Math.round((stats.successful_syncs / stats.total_syncs) * 100)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.successful_syncs || 0} of {stats?.total_syncs || 0} syncs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Scheduled Syncs
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enabledSchedules}</div>
            <p className="text-xs text-muted-foreground">Active schedules</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Sync Trigger */}
      {integrations && integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Sync</CardTitle>
            <CardDescription>
              Trigger a sync for any integration on demand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManualSyncTrigger integrations={integrations} />
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Recent Jobs</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Jobs</CardTitle>
              <CardDescription>
                View and manage recent synchronization jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentJobs && recentJobs.length > 0 ? (
                <SyncJobsList
                  jobs={
                    recentJobs as (SyncJob & {
                      integrations: {
                        id: string
                        name: string
                        platform: string
                      }
                    })[]
                  }
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sync jobs found. Create an integration and trigger a sync
                  to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Schedules</CardTitle>
              <CardDescription>
                Configure automatic synchronization schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {schedules && schedules.length > 0 ? (
                <SyncSchedulesList
                  schedules={
                    schedules as (SyncSchedule & {
                      integrations: {
                        id: string
                        name: string
                        platform: string
                      }
                    })[]
                  }
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No schedules configured. Set up automatic syncing for your
                  integrations.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Statistics</CardTitle>
              <CardDescription>
                Performance metrics and trends across all integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integrations && integrations.length > 0 ? (
                <SyncStatisticsPanel integrations={integrations} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No integrations found. Add integrations to view statistics.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>
                Monitor the health of your sync infrastructure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integrations && integrations.length > 0 ? (
                <SyncHealthMonitor integrations={integrations} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No integrations found. Add integrations to monitor health.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
