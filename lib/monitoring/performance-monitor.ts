/**
 * Real-time performance monitoring for TruthSource
 */

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: Date
  tags: Record<string, string>
}

export interface PerformanceAlert {
  id: string
  metric: string
  threshold: number
  currentValue: number
  severity: 'warning' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
}

export interface DatabaseQueryMetrics {
  query: string
  duration: number
  table: string
  operation: 'select' | 'insert' | 'update' | 'delete'
  rowsAffected?: number
  error?: string
}

export interface APIMetrics {
  endpoint: string
  method: string
  duration: number
  statusCode: number
  userAgent?: string
  ip?: string
  error?: string
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private alerts: PerformanceAlert[] = []
  private thresholds: Record<string, { warning: number; critical: number }> = {
    'api.response_time': { warning: 1000, critical: 3000 },
    'database.query_time': { warning: 500, critical: 2000 },
    'memory.usage': { warning: 80, critical: 95 },
    'cpu.usage': { warning: 70, critical: 90 },
    'error.rate': { warning: 5, critical: 10 },
  }

  constructor(private supabase: any) {}

  /**
   * Record a performance metric
   */
  async recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags: Record<string, string> = {}
  ): Promise<void> {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    }

    this.metrics.push(metric)

    // Store in database for historical analysis
    await this.supabase
      .from('performance_metrics')
      .insert({
        name,
        value,
        unit,
        tags,
        timestamp: metric.timestamp.toISOString(),
      })

    // Check for alerts
    await this.checkAlerts(metric)
  }

  /**
   * Record API performance metrics
   */
  async recordAPIMetric(metric: APIMetrics): Promise<void> {
    await this.recordMetric('api.response_time', metric.duration, 'ms', {
      endpoint: metric.endpoint,
      method: metric.method,
      statusCode: metric.statusCode.toString(),
    })

    if (metric.error) {
      await this.recordMetric('api.error_rate', 1, 'count', {
        endpoint: metric.endpoint,
        method: metric.method,
        error: metric.error,
      })
    }
  }

  /**
   * Record database query performance
   */
  async recordDatabaseMetric(metric: DatabaseQueryMetrics): Promise<void> {
    await this.recordMetric('database.query_time', metric.duration, 'ms', {
      table: metric.table,
      operation: metric.operation,
      rowsAffected: metric.rowsAffected?.toString() || '0',
    })

    if (metric.error) {
      await this.recordMetric('database.error_rate', 1, 'count', {
        table: metric.table,
        operation: metric.operation,
        error: metric.error,
      })
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkAlerts(metric: PerformanceMetric): Promise<void> {
    const threshold = this.thresholds[metric.name]
    if (!threshold) return

    const { warning, critical } = threshold
    let severity: 'warning' | 'critical' | null = null

    if (metric.value >= critical) {
      severity = 'critical'
    } else if (metric.value >= warning) {
      severity = 'warning'
    }

    if (severity) {
      const alert: PerformanceAlert = {
        id: `${metric.name}-${Date.now()}`,
        metric: metric.name,
        threshold: severity === 'critical' ? critical : warning,
        currentValue: metric.value,
        severity,
        message: `${metric.name} exceeded ${severity} threshold: ${metric.value}${metric.unit} (threshold: ${severity === 'critical' ? critical : warning}${metric.unit})`,
        timestamp: new Date(),
        resolved: false,
      }

      this.alerts.push(alert)

      // Store alert in database
      await this.supabase
        .from('performance_alerts')
        .insert({
          metric: alert.metric,
          threshold: alert.threshold,
          current_value: alert.currentValue,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          resolved: alert.resolved,
        })

      // Send notification for critical alerts
      if (severity === 'critical') {
        await this.sendAlertNotification(alert)
      }
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: PerformanceAlert): Promise<void> {
    // Send to monitoring service (e.g., Sentry, DataDog)
    console.error('🚨 CRITICAL PERFORMANCE ALERT:', alert.message)

    // Send email notification to admins
    await this.supabase
      .from('email_queue')
      .insert({
        to: process.env.ADMIN_EMAIL || 'admin@truthsource.com',
        subject: `🚨 Critical Performance Alert: ${alert.metric}`,
        template: 'performance_alert',
        data: {
          metric: alert.metric,
          current_value: alert.currentValue,
          threshold: alert.threshold,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
        },
        status: 'pending',
      })
  }

  /**
   * Get performance metrics for a time range
   */
  async getMetrics(
    name: string,
    startTime: Date,
    endTime: Date
  ): Promise<PerformanceMetric[]> {
    const { data } = await this.supabase
      .from('performance_metrics')
      .select('*')
      .eq('name', name)
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: true })

    return data?.map((row: any) => ({
      name: row.name,
      value: row.value,
      unit: row.unit,
      timestamp: new Date(row.timestamp),
      tags: row.tags,
    })) || []
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<PerformanceAlert[]> {
    const { data } = await this.supabase
      .from('performance_alerts')
      .select('*')
      .eq('resolved', false)
      .order('timestamp', { ascending: false })

    return data?.map((row: any) => ({
      id: row.id,
      metric: row.metric,
      threshold: row.threshold,
      currentValue: row.current_value,
      severity: row.severity,
      message: row.message,
      timestamp: new Date(row.timestamp),
      resolved: row.resolved,
    })) || []
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    await this.supabase
      .from('performance_alerts')
      .update({ resolved: true })
      .eq('id', alertId)

    // Remove from local alerts
    this.alerts = this.alerts.filter(alert => alert.id !== alertId)
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(): Promise<{
    avgResponseTime: number
    errorRate: number
    activeAlerts: number
    uptime: number
  }> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Get average response time
    const responseTimeMetrics = await this.getMetrics(
      'api.response_time',
      oneHourAgo,
      now
    )
    const avgResponseTime = responseTimeMetrics.length > 0
      ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
      : 0

    // Get error rate
    const errorMetrics = await this.getMetrics('api.error_rate', oneHourAgo, now)
    const totalRequests = await this.getMetrics('api.request_count', oneHourAgo, now)
    const errorRate = totalRequests.length > 0
      ? (errorMetrics.length / totalRequests.length) * 100
      : 0

    // Get active alerts
    const activeAlerts = await this.getActiveAlerts()

    // Calculate uptime (simplified)
    const uptime = 99.9 // This would be calculated from actual data

    return {
      avgResponseTime,
      errorRate,
      activeAlerts: activeAlerts.length,
      uptime,
    }
  }
}

// Global performance monitor instance
let performanceMonitor: PerformanceMonitor | null = null

export function getPerformanceMonitor(supabase: any): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(supabase)
  }
  return performanceMonitor
}

// Performance monitoring middleware
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  metricName: string
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now()
    let error: any = null

    try {
      const result = await fn(...args)
      return result
    } catch (err) {
      error = err
      throw err
    } finally {
      const duration = Date.now() - startTime
      
      // Record performance metric
      if (performanceMonitor) {
        await performanceMonitor.recordMetric(metricName, duration, 'ms', {
          error: error ? error.message : undefined,
        })
      }
    }
  }) as T
} 