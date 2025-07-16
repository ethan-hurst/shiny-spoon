import { PerformanceMetrics } from './types'

interface MetricEvent {
  type: 'message' | 'subscription' | 'reconnection' | 'error'
  timestamp: number
  duration?: number
  success: boolean
  metadata?: any
}

export class RealtimePerformanceMonitor {
  private static instance: RealtimePerformanceMonitor | null = null
  private metrics: PerformanceMetrics
  private events: MetricEvent[] = []
  private maxEvents = 1000 // Keep last 1000 events
  private listeners: Map<string, (metrics: PerformanceMetrics) => void> = new Map()

  private constructor() {
    this.metrics = {
      messageLatency: [],
      reconnectionCount: 0,
      messageDropRate: 0,
      subscriptionCount: 0,
      avgLatency: 0,
      healthScore: 100
    }
    
    // Start periodic metric calculation
    setInterval(() => this.calculateMetrics(), 5000)
  }

  static getInstance(): RealtimePerformanceMonitor {
    if (!RealtimePerformanceMonitor.instance) {
      RealtimePerformanceMonitor.instance = new RealtimePerformanceMonitor()
    }
    return RealtimePerformanceMonitor.instance
  }

  recordEvent(event: MetricEvent): void {
    this.events.push(event)
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    // Update immediate metrics
    if (event.type === 'message' && event.duration !== undefined) {
      this.metrics.messageLatency.push(event.duration)
      if (this.metrics.messageLatency.length > 100) {
        this.metrics.messageLatency.shift()
      }
    } else if (event.type === 'reconnection') {
      this.metrics.reconnectionCount++
    }

    this.calculateMetrics()
  }

  recordMessageLatency(latency: number): void {
    this.recordEvent({
      type: 'message',
      timestamp: Date.now(),
      duration: latency,
      success: true
    })
  }

  recordSubscription(subscribed: boolean): void {
    if (subscribed) {
      this.metrics.subscriptionCount++
    } else {
      this.metrics.subscriptionCount = Math.max(0, this.metrics.subscriptionCount - 1)
    }
    
    this.recordEvent({
      type: 'subscription',
      timestamp: Date.now(),
      success: subscribed
    })
  }

  recordReconnection(): void {
    this.recordEvent({
      type: 'reconnection',
      timestamp: Date.now(),
      success: true
    })
  }

  recordError(error: string): void {
    this.recordEvent({
      type: 'error',
      timestamp: Date.now(),
      success: false,
      metadata: { error }
    })
  }

  private calculateMetrics(): void {
    // Calculate average latency
    if (this.metrics.messageLatency.length > 0) {
      const sum = this.metrics.messageLatency.reduce((a, b) => a + b, 0)
      this.metrics.avgLatency = Math.round(sum / this.metrics.messageLatency.length)
    }

    // Calculate message drop rate (last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const recentEvents = this.events.filter(e => e.timestamp > fiveMinutesAgo)
    const messageEvents = recentEvents.filter(e => e.type === 'message')
    const failedMessages = messageEvents.filter(e => !e.success).length
    
    if (messageEvents.length > 0) {
      this.metrics.messageDropRate = (failedMessages / messageEvents.length) * 100
    }

    // Calculate health score
    this.metrics.healthScore = this.calculateHealthScore()

    // Notify listeners
    this.notifyListeners()
  }

  private calculateHealthScore(): number {
    let score = 100

    // Deduct for high latency
    if (this.metrics.avgLatency > 1000) score -= 30
    else if (this.metrics.avgLatency > 500) score -= 20
    else if (this.metrics.avgLatency > 200) score -= 10

    // Deduct for reconnections
    const recentReconnections = this.getRecentReconnections(5 * 60 * 1000) // Last 5 minutes
    if (recentReconnections > 5) score -= 30
    else if (recentReconnections > 2) score -= 20
    else if (recentReconnections > 0) score -= 10

    // Deduct for message drops
    if (this.metrics.messageDropRate > 5) score -= 30
    else if (this.metrics.messageDropRate > 2) score -= 20
    else if (this.metrics.messageDropRate > 0) score -= 10

    // Deduct for too many subscriptions
    if (this.metrics.subscriptionCount > 20) score -= 20
    else if (this.metrics.subscriptionCount > 10) score -= 10

    return Math.max(0, Math.min(100, score))
  }

  private getRecentReconnections(timeWindow: number): number {
    const since = Date.now() - timeWindow
    return this.events.filter(
      e => e.type === 'reconnection' && e.timestamp > since
    ).length
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getHealthScore(): number {
    return this.metrics.healthScore
  }

  getRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.avgLatency > 500) {
      recommendations.push('High message latency detected. Consider optimizing message size or frequency.')
    }

    if (this.metrics.messageDropRate > 2) {
      recommendations.push('Message drops detected. Check network stability and error logs.')
    }

    const recentReconnections = this.getRecentReconnections(5 * 60 * 1000)
    if (recentReconnections > 2) {
      recommendations.push('Frequent reconnections detected. Check server health and network stability.')
    }

    if (this.metrics.subscriptionCount > 10) {
      recommendations.push('Many active subscriptions. Consider consolidating channels for better performance.')
    }

    if (this.metrics.healthScore < 70) {
      recommendations.push('Overall health is degraded. Review all performance metrics and take action.')
    }

    return recommendations
  }

  getDetailedReport(): {
    summary: PerformanceMetrics
    events: MetricEvent[]
    recommendations: string[]
    timeline: { [key: string]: number }
  } {
    // Create timeline of events per minute
    const timeline: { [key: string]: number } = {}
    const now = Date.now()
    
    // Group events by minute for the last hour
    for (let i = 0; i < 60; i++) {
      const minuteStart = now - (i + 1) * 60 * 1000
      const minuteEnd = now - i * 60 * 1000
      const key = new Date(minuteEnd).toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
      
      timeline[key] = this.events.filter(
        e => e.timestamp >= minuteStart && e.timestamp < minuteEnd
      ).length
    }

    return {
      summary: this.getMetrics(),
      events: this.events.slice(-100), // Last 100 events
      recommendations: this.getRecommendations(),
      timeline
    }
  }

  subscribe(id: string, callback: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.set(id, callback)
    callback(this.metrics) // Initial metrics
    
    return () => {
      this.listeners.delete(id)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback({ ...this.metrics }))
  }

  reset(): void {
    this.events = []
    this.metrics = {
      messageLatency: [],
      reconnectionCount: 0,
      messageDropRate: 0,
      subscriptionCount: 0,
      avgLatency: 0,
      healthScore: 100
    }
    this.notifyListeners()
  }

  destroy(): void {
    this.listeners.clear()
    this.events = []
    RealtimePerformanceMonitor.instance = null
  }
}