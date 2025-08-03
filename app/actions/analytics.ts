// PRP-018: Analytics Dashboard - Server Actions
'use server'

import { format } from 'date-fns'
import { AnalyticsCalculator } from '@/lib/analytics/calculate-metrics'
import type { DateRange } from '@/lib/analytics/calculate-metrics'
import { generateCSV } from '@/lib/csv/parser'
import { createServerClient } from '@/lib/supabase/server'

export async function exportAnalytics({
  organizationId,
  dateRange,
  format: exportFormat,
}: {
  organizationId: string
  dateRange: DateRange
  format: 'csv' | 'pdf'
}) {
  const supabase = createServerClient()

  // Verify user has access
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const calculator = new AnalyticsCalculator()

    // Fetch all metrics
    const [orderAccuracy, syncPerformance, inventoryTrends] = await Promise.all(
      [
        calculator.calculateOrderAccuracy(organizationId, dateRange),
        calculator.calculateSyncPerformance(organizationId, dateRange),
        calculator.calculateInventoryTrends(organizationId, dateRange),
      ]
    )

    if (exportFormat === 'csv') {
      // Create a map of dates to metrics for proper alignment
      const dateMap = new Map<string, any>()

      // Populate with order accuracy data
      orderAccuracy.forEach((metric) => {
        dateMap.set(metric.date, {
          date: metric.date,
          order_accuracy: metric.accuracyRate,
          total_orders: metric.totalOrders,
          error_count: metric.errorCount,
          sync_count: 0,
          avg_sync_duration: 0,
          inventory_value: 0,
          low_stock_count: 0,
        })
      })

      // Add sync performance data by matching dates
      syncPerformance.forEach((metric) => {
        const existing = dateMap.get(metric.date)
        if (existing) {
          existing.sync_count = metric.syncCount
          existing.avg_sync_duration = metric.avgDuration
        } else {
          dateMap.set(metric.date, {
            date: metric.date,
            order_accuracy: 0,
            total_orders: 0,
            error_count: 0,
            sync_count: metric.syncCount,
            avg_sync_duration: metric.avgDuration,
            inventory_value: 0,
            low_stock_count: 0,
          })
        }
      })

      // Add inventory trends data by matching dates
      inventoryTrends.forEach((metric) => {
        const existing = dateMap.get(metric.date)
        if (existing) {
          existing.inventory_value = metric.totalValue
          existing.low_stock_count = metric.lowStockCount
        } else {
          dateMap.set(metric.date, {
            date: metric.date,
            order_accuracy: 0,
            total_orders: 0,
            error_count: 0,
            sync_count: 0,
            avg_sync_duration: 0,
            inventory_value: metric.totalValue,
            low_stock_count: metric.lowStockCount,
          })
        }
      })

      // Convert map to sorted array
      const csvData = Array.from(dateMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const csv = generateCSV(csvData, [
        { key: 'date', header: 'Date' },
        { key: 'order_accuracy', header: 'Order Accuracy (%)' },
        { key: 'total_orders', header: 'Total Orders' },
        { key: 'error_count', header: 'Error Count' },
        { key: 'sync_count', header: 'Sync Count' },
        { key: 'avg_sync_duration', header: 'Avg Sync Duration (ms)' },
        { key: 'inventory_value', header: 'Inventory Value ($)' },
        { key: 'low_stock_count', header: 'Low Stock Items' },
      ])

      return {
        data: csv,
        filename: `analytics_${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}.csv`,
      }
    } else {
      // PDF generation would go here
      // For now, return error
      return { error: 'PDF export not yet implemented' }
    }
  } catch (error) {
    console.error('Export error:', error)
    return { error: 'Failed to export analytics' }
  }
}

export async function refreshAnalyticsCache(organizationId: string) {
  const supabase = createServerClient()

  // Verify user has access
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const calculator = new AnalyticsCalculator()
    const today = new Date()

    // Calculate today's metrics
    const dateRange = {
      from: new Date(today.setHours(0, 0, 0, 0)),
      to: new Date(today.setHours(23, 59, 59, 999)),
    }

    const [orderAccuracy, syncPerformance] = await Promise.all([
      calculator.calculateOrderAccuracy(organizationId, dateRange),
      calculator.calculateSyncPerformance(organizationId, dateRange),
    ])

    // Cache the metrics
    if (orderAccuracy.length > 0) {
      await calculator.cacheMetrics(organizationId, today, {
        orderAccuracy: orderAccuracy[0],
        syncPerformance: syncPerformance[0],
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Cache refresh error:', error)
    return { error: 'Failed to refresh cache' }
  }
}
