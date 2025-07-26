// PRP-015: Sync Statistics Component
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getSyncStatistics } from '@/app/actions/sync-engine'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SyncStatistics } from '@/types/sync-engine.types'

interface SyncStatisticsProps {
  integrations: {
    id: string
    name: string
    platform: string
  }[]
}

const COLORS = {
  products: '#8884d8',
  inventory: '#82ca9d',
  pricing: '#ffc658',
  customers: '#ff7c7c',
  orders: '#8dd1e1',
}

/**
 * Displays synchronization statistics for one or more integrations over selectable time periods.
 *
 * Provides filters for integration and time period, and presents aggregated or individual sync metrics including total syncs, success rate, records synced, average duration, and detailed breakdowns by entity type. Visualizes data using summary cards, bar and pie charts, and entity-specific details.
 *
 * @param integrations - List of available integrations to display statistics for
 */
export function SyncStatistics({ integrations }: SyncStatisticsProps) {
  const [selectedIntegration, setSelectedIntegration] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<'hour' | 'day' | 'week' | 'month'>('day')
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatistics()
  }, [selectedIntegration, selectedPeriod])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      if (selectedIntegration === 'all') {
        // For now, we'll aggregate manually
        // In a real implementation, we'd have a server endpoint for this
        const allStats: SyncStatistics = {
          integration_id: 'all',
          period: selectedPeriod,
          total_syncs: 0,
          successful_syncs: 0,
          failed_syncs: 0,
          average_duration_ms: 0,
          total_records_synced: 0,
          total_conflicts: 0,
          total_errors: 0,
          by_entity_type: {
            products: { count: 0, records: 0, errors: 0 },
            inventory: { count: 0, records: 0, errors: 0 },
            pricing: { count: 0, records: 0, errors: 0 },
            customers: { count: 0, records: 0, errors: 0 },
            orders: { count: 0, records: 0, errors: 0 },
          },
        }

        let totalDuration = 0
        let countWithDuration = 0

        for (const integration of integrations) {
          const stats = await getSyncStatistics(integration.id, selectedPeriod)
          allStats.total_syncs += stats.total_syncs
          allStats.successful_syncs += stats.successful_syncs
          allStats.failed_syncs += stats.failed_syncs
          allStats.total_records_synced += stats.total_records_synced
          allStats.total_conflicts += stats.total_conflicts
          allStats.total_errors += stats.total_errors

          if (stats.average_duration_ms > 0) {
            totalDuration += stats.average_duration_ms * stats.total_syncs
            countWithDuration += stats.total_syncs
          }

          // Aggregate by entity type with runtime check (fix-39)
          for (const [entityType, entityStats] of Object.entries(stats.by_entity_type)) {
            // Runtime check for valid entity type keys
            if (entityType in allStats.by_entity_type) {
              const typedEntityType = entityType as keyof typeof allStats.by_entity_type
              allStats.by_entity_type[typedEntityType].count += entityStats.count
              allStats.by_entity_type[typedEntityType].records += entityStats.records
              allStats.by_entity_type[typedEntityType].errors += entityStats.errors
            } else {
              console.warn(`Unknown entity type received: ${entityType}`)
            }
          }
        }

        if (countWithDuration > 0) {
          allStats.average_duration_ms = Math.round(totalDuration / countWithDuration)
        }

        setStatistics(allStats)
      } else {
        const stats = await getSyncStatistics(selectedIntegration, selectedPeriod)
        setStatistics(stats)
      }
    } catch (error) {
      console.error('Failed to load statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const successRate = statistics && statistics.total_syncs > 0
    ? (statistics.successful_syncs / statistics.total_syncs) * 100
    : 0

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return { icon: Minus, color: 'text-muted-foreground', text: 'N/A' }
    const change = ((current - previous) / previous) * 100
    if (change > 5) return { icon: TrendingUp, color: 'text-green-600', text: `+${change.toFixed(1)}%` }
    if (change < -5) return { icon: TrendingDown, color: 'text-red-600', text: `${change.toFixed(1)}%` }
    return { icon: Minus, color: 'text-muted-foreground', text: '~0%' }
  }

  const entityChartData = statistics ? Object.entries(statistics.by_entity_type)
    .filter(([_, stats]) => stats.count > 0)
    .map(([entity, stats]) => ({
      name: entity.charAt(0).toUpperCase() + entity.slice(1),
      syncs: stats.count,
      records: stats.records,
      errors: stats.errors,
    })) : []

  const pieChartData = statistics ? Object.entries(statistics.by_entity_type)
    .filter(([_, stats]) => stats.records > 0)
    .map(([entity, stats]) => ({
      name: entity.charAt(0).toUpperCase() + entity.slice(1),
      value: stats.records,
      color: COLORS[entity as keyof typeof COLORS],
    })) : []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Integrations</SelectItem>
            {integrations.map((integration) => (
              <SelectItem key={integration.id} value={integration.id}>
                {integration.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hour">Last Hour</SelectItem>
            <SelectItem value="day">Last 24 Hours</SelectItem>
            <SelectItem value="week">Last Week</SelectItem>
            <SelectItem value="month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.total_syncs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {statistics?.successful_syncs || 0} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <div className="h-4 w-4">
              <Progress value={successRate} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {statistics?.failed_syncs || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records Synced</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(statistics?.total_records_synced || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.total_conflicts || 0} conflicts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.average_duration_ms 
                ? `${(statistics.average_duration_ms / 1000).toFixed(1)}s`
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Per sync job
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Entity Type Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Syncs by Entity Type</CardTitle>
          </CardHeader>
          <CardContent>
            {entityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={entityChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="syncs" fill="#8884d8" />
                  <Bar dataKey="errors" fill="#ff7c7c" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No sync data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Records Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Records Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No record data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entity Type Details */}
      <Card>
        <CardHeader>
          <CardTitle>Entity Type Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(statistics?.by_entity_type || {}).map(([entity, stats]) => (
              <div key={entity} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[entity as keyof typeof COLORS] }}
                  />
                  <span className="font-medium capitalize">{entity}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Syncs:</span>{' '}
                    <span className="font-medium">{stats.count}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Records:</span>{' '}
                    <span className="font-medium">{stats.records.toLocaleString()}</span>
                  </div>
                  {stats.errors > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.errors} errors
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}