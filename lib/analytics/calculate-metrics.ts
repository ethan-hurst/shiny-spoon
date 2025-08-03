// PRP-018: Analytics Dashboard - Metrics Calculation Service
import { format } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'

export interface DateRange {
  from: Date
  to: Date
}

export interface OrderAccuracyMetrics {
  date: string
  totalOrders: number
  accurateOrders: number
  errorCount: number
  accuracyRate: number
}

export interface SyncPerformanceMetrics {
  date: string
  syncCount: number
  avgDuration: number
  successRate: number
}

export interface InventoryTrendMetrics {
  date: string
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
}

export interface RevenueImpactMetrics {
  totalSaved: number
  errorsPrevented: number
  projectedAnnualSavings: number
  accuracyImprovement: number
}

export class AnalyticsCalculator {
  private supabase: ReturnType<typeof createServerClient>

  constructor(supabaseClient?: ReturnType<typeof createServerClient>) {
    this.supabase = supabaseClient || createServerClient()
  }

  async calculateOrderAccuracy(
    organizationId: string,
    dateRange: DateRange
  ): Promise<OrderAccuracyMetrics[]> {
    // Query order data with errors - using existing orders table structure
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select('id, created_at, metadata')
      .eq('organization_id', organizationId)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    // Group by date and calculate metrics
    const metricsByDate = new Map<string, OrderAccuracyMetrics>()

    orders.forEach((order) => {
      const date = format(new Date(order.created_at), 'yyyy-MM-dd')

      if (!metricsByDate.has(date)) {
        metricsByDate.set(date, {
          date,
          totalOrders: 0,
          accurateOrders: 0,
          errorCount: 0,
          accuracyRate: 0,
        })
      }

      const metrics = metricsByDate.get(date)!
      metrics.totalOrders++

      // Check for errors in metadata
      const metadata = order.metadata as any
      const hasError = metadata?.hasError || metadata?.errors?.length > 0

      if (!hasError) {
        metrics.accurateOrders++
      } else {
        metrics.errorCount += metadata?.errors?.length || 1
      }
    })

    // Calculate accuracy rates
    metricsByDate.forEach((metrics) => {
      metrics.accuracyRate =
        metrics.totalOrders > 0
          ? (metrics.accurateOrders / metrics.totalOrders) * 100
          : 0
    })

    return Array.from(metricsByDate.values())
  }

  async calculateSyncPerformance(
    organizationId: string,
    dateRange: DateRange
  ): Promise<SyncPerformanceMetrics[]> {
    const { data: syncLogs, error } = await this.supabase
      .from('sync_performance_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('started_at', dateRange.from.toISOString())
      .lte('started_at', dateRange.to.toISOString())
      .order('started_at', { ascending: true })

    if (error) {
      // If table doesn't exist, fall back to sync_jobs
      const { data: syncJobs, error: jobsError } = await this.supabase
        .from('sync_jobs')
        .select('id, created_at, updated_at, status, metadata')
        .eq('organization_id', organizationId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: true })

      if (jobsError) throw jobsError

      // Convert sync jobs to performance metrics format
      const metricsByDate = new Map<string, SyncPerformanceMetrics>()

      syncJobs.forEach((job) => {
        const date = format(new Date(job.created_at), 'yyyy-MM-dd')

        if (!metricsByDate.has(date)) {
          metricsByDate.set(date, {
            date,
            syncCount: 0,
            avgDuration: 0,
            successRate: 0,
          })
        }

        const metrics = metricsByDate.get(date)!
        metrics.syncCount++
      })

      // Calculate aggregated metrics
      metricsByDate.forEach((metrics, date) => {
        const jobsForDate = syncJobs.filter(
          (job) => format(new Date(job.created_at), 'yyyy-MM-dd') === date
        )

        let totalDuration = 0
        let completedCount = 0

        jobsForDate.forEach((job) => {
          if (job.updated_at && job.created_at) {
            const duration =
              new Date(job.updated_at).getTime() -
              new Date(job.created_at).getTime()
            totalDuration += duration
          }
          if (job.status === 'completed') {
            completedCount++
          }
        })

        metrics.avgDuration =
          jobsForDate.length > 0 ? totalDuration / jobsForDate.length : 0
        metrics.successRate =
          jobsForDate.length > 0
            ? (completedCount / jobsForDate.length) * 100
            : 0
      })

      return Array.from(metricsByDate.values())
    }

    // Process actual sync performance logs
    const metricsByDate = new Map<string, SyncPerformanceMetrics>()

    syncLogs.forEach((log) => {
      const date = format(new Date(log.started_at), 'yyyy-MM-dd')

      if (!metricsByDate.has(date)) {
        metricsByDate.set(date, {
          date,
          syncCount: 0,
          avgDuration: 0,
          successRate: 0,
        })
      }

      const metrics = metricsByDate.get(date)!
      metrics.syncCount++
    })

    // Calculate aggregated metrics for each date
    metricsByDate.forEach((metrics, date) => {
      const logsForDate = syncLogs.filter(
        (log) => format(new Date(log.started_at), 'yyyy-MM-dd') === date
      )

      let totalDuration = 0
      let completedCount = 0

      logsForDate.forEach((log) => {
        if (log.duration_ms) {
          totalDuration += log.duration_ms
        }
        if (log.status === 'completed') {
          completedCount++
        }
      })

      metrics.avgDuration =
        logsForDate.length > 0 ? totalDuration / logsForDate.length : 0
      metrics.successRate =
        logsForDate.length > 0 ? (completedCount / logsForDate.length) * 100 : 0
    })

    return Array.from(metricsByDate.values())
  }

  async calculateInventoryTrends(
    organizationId: string,
    dateRange: DateRange
  ): Promise<InventoryTrendMetrics[]> {
    const { data: snapshots, error } = await this.supabase
      .from('inventory_snapshots')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('snapshot_date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('snapshot_date', format(dateRange.to, 'yyyy-MM-dd'))
      .order('snapshot_date', { ascending: true })

    if (error) {
      // Fall back to current inventory table
      const { data: inventory, error: invError } = await this.supabase
        .from('inventory')
        .select('quantity, available_quantity, metadata, updated_at')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: true })

      if (invError) throw invError

      // Create synthetic trend data from current inventory
      const dates = []
      const current = new Date(dateRange.from)
      while (current <= dateRange.to) {
        dates.push(format(current, 'yyyy-MM-dd'))
        current.setDate(current.getDate() + 1)
      }

      return dates.map((date) => ({
        date,
        totalValue: inventory.reduce((sum, item) => {
          const price = (item.metadata as any)?.price || 10 // Default price
          return sum + (item.available_quantity || 0) * price
        }, 0),
        lowStockCount: inventory.filter((item) => {
          const quantity = item.available_quantity || 0
          return quantity > 0 && quantity < 10
        }).length,
        outOfStockCount: inventory.filter(
          (item) => (item.available_quantity || 0) === 0
        ).length,
      }))
    }

    // Process actual snapshots
    const metricsByDate = new Map<string, InventoryTrendMetrics>()

    snapshots.forEach((snapshot) => {
      const date = snapshot.snapshot_date

      if (!metricsByDate.has(date)) {
        metricsByDate.set(date, {
          date,
          totalValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        })
      }

      const metrics = metricsByDate.get(date)!
      metrics.totalValue += Number(snapshot.value) || 0

      if (snapshot.quantity === 0) {
        metrics.outOfStockCount++
      } else if (snapshot.quantity < 10) {
        metrics.lowStockCount++
      }
    })

    return Array.from(metricsByDate.values())
  }

  async calculateRevenueImpact(
    organizationId: string,
    dateRange: DateRange
  ): Promise<RevenueImpactMetrics> {
    // Get order accuracy before and after TruthSource
    const midPoint = new Date(
      dateRange.from.getTime() +
        (dateRange.to.getTime() - dateRange.from.getTime()) / 2
    )

    const [beforeMetrics, afterMetrics] = await Promise.all([
      this.calculateOrderAccuracy(organizationId, {
        from: dateRange.from,
        to: midPoint,
      }),
      this.calculateOrderAccuracy(organizationId, {
        from: midPoint,
        to: dateRange.to,
      }),
    ])

    // Calculate improvements
    const avgAccuracyBefore =
      beforeMetrics.length > 0
        ? beforeMetrics.reduce((sum, m) => sum + m.accuracyRate, 0) /
          beforeMetrics.length
        : 0
    const avgAccuracyAfter =
      afterMetrics.length > 0
        ? afterMetrics.reduce((sum, m) => sum + m.accuracyRate, 0) /
          afterMetrics.length
        : 0
    const accuracyImprovement = avgAccuracyAfter - avgAccuracyBefore

    // Calculate errors prevented
    const totalOrdersAfter = afterMetrics.reduce(
      (sum, m) => sum + m.totalOrders,
      0
    )
    const errorsPrevented = Math.floor(
      totalOrdersAfter * (accuracyImprovement / 100)
    )

    // Calculate revenue saved (avg $12,000 per error)
    const avgErrorCost = 12000
    const totalSaved = errorsPrevented * avgErrorCost

    // Project annual savings
    const daysInRange = Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const projectedAnnualSavings =
      daysInRange > 0 ? (totalSaved / daysInRange) * 365 : 0

    return {
      totalSaved,
      errorsPrevented,
      projectedAnnualSavings,
      accuracyImprovement,
    }
  }

  async cacheMetrics(
    organizationId: string,
    date: Date,
    metrics: Partial<{
      orderAccuracy: OrderAccuracyMetrics
      syncPerformance: SyncPerformanceMetrics
      inventoryTrend: InventoryTrendMetrics
      revenueImpact: RevenueImpactMetrics
    }>
  ): Promise<void> {
    const upserts = []

    if (metrics.orderAccuracy) {
      upserts.push({
        organization_id: organizationId,
        metric_type: 'order_accuracy',
        metric_date: format(date, 'yyyy-MM-dd'),
        total_orders: metrics.orderAccuracy.totalOrders,
        accurate_orders: metrics.orderAccuracy.accurateOrders,
        error_count: metrics.orderAccuracy.errorCount,
        accuracy_rate: metrics.orderAccuracy.accuracyRate,
      })
    }

    if (metrics.syncPerformance) {
      upserts.push({
        organization_id: organizationId,
        metric_type: 'sync_performance',
        metric_date: format(date, 'yyyy-MM-dd'),
        sync_count: metrics.syncPerformance.syncCount,
        sync_duration_ms: metrics.syncPerformance.avgDuration,
        metadata: { success_rate: metrics.syncPerformance.successRate },
      })
    }

    if (upserts.length > 0) {
      await this.supabase.from('analytics_metrics').upsert(upserts, {
        onConflict: 'organization_id,metric_type,metric_date',
      })
    }
  }
}
