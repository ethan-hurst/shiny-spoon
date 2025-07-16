import { RealtimeChannel, RealtimeClient } from '@supabase/supabase-js'
import { 
  ConnectionStatus, 
  ConnectionState, 
  ConnectionQuality,
  ConnectionMetrics,
  RealtimeConfig 
} from './types'

export class RealtimeConnectionManager {
  private static instance: RealtimeConnectionManager | null = null
  private status: ConnectionStatus
  private listeners: Map<string, (status: ConnectionStatus) => void>
  private reconnectTimer: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private metrics: ConnectionMetrics
  private config: RealtimeConfig
  private channels: Map<string, RealtimeChannel> = new Map()
  
  private constructor(config?: Partial<RealtimeConfig>) {
    this.status = {
      state: 'disconnected',
      latency: 0,
      lastConnected: null,
      reconnectAttempts: 0,
      quality: 'poor'
    }
    
    this.listeners = new Map()
    
    this.metrics = {
      latency: [],
      stability: 100,
      throughput: 0,
      lastMeasured: new Date()
    }
    
    this.config = {
      enableOptimisticUpdates: true,
      enableOfflineQueue: true,
      enablePresence: true,
      enablePerformanceMonitoring: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      conflictResolutionStrategy: 'manual',
      queuePersistence: 'indexeddb',
      ...config
    }
    
    this.initializeConnectionMonitoring()
  }
  
  static getInstance(config?: Partial<RealtimeConfig>): RealtimeConnectionManager {
    if (!RealtimeConnectionManager.instance) {
      RealtimeConnectionManager.instance = new RealtimeConnectionManager(config)
    }
    return RealtimeConnectionManager.instance
  }
  
  private initializeConnectionMonitoring(): void {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
      
      // Start ping monitoring for latency
      this.startPingMonitoring()
    }
  }
  
  private startPingMonitoring(): void {
    this.pingInterval = setInterval(() => {
      this.measureLatency()
    }, 5000) // Ping every 5 seconds
  }
  
  private async measureLatency(): Promise<void> {
    const start = Date.now()
    
    try {
      // Simulate ping by making a lightweight request
      // In real implementation, this would ping the Supabase realtime server
      await fetch('/api/health', { method: 'HEAD' })
      
      const latency = Date.now() - start
      this.metrics.latency.push(latency)
      
      // Keep only last 20 measurements
      if (this.metrics.latency.length > 20) {
        this.metrics.latency.shift()
      }
      
      // Update current latency and quality
      this.status.latency = latency
      this.status.quality = this.calculateQuality()
      
      this.notifyListeners()
    } catch (error) {
      // Connection failed
      this.updateStatus('error', error instanceof Error ? error.message : 'Connection failed')
    }
  }
  
  private calculateQuality(): ConnectionQuality {
    const avgLatency = this.getAverageLatency()
    const stability = this.calculateStability()
    
    if (avgLatency < 100 && stability > 95) return 'excellent'
    if (avgLatency < 300 && stability > 85) return 'good'
    if (avgLatency < 1000 && stability > 70) return 'fair'
    return 'poor'
  }
  
  private getAverageLatency(): number {
    if (this.metrics.latency.length === 0) return 0
    const sum = this.metrics.latency.reduce((a, b) => a + b, 0)
    return Math.round(sum / this.metrics.latency.length)
  }
  
  private calculateStability(): number {
    if (this.metrics.latency.length < 2) return 100
    
    // Calculate variance in latency
    const avg = this.getAverageLatency()
    const variance = this.metrics.latency.reduce((sum, latency) => {
      return sum + Math.pow(latency - avg, 2)
    }, 0) / this.metrics.latency.length
    
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = (stdDev / avg) * 100
    
    // Convert to stability score (lower variation = higher stability)
    return Math.max(0, Math.min(100, 100 - coefficientOfVariation))
  }
  
  public getConnectionQuality(): ConnectionMetrics {
    return {
      ...this.metrics,
      stability: this.calculateStability(),
      lastMeasured: new Date()
    }
  }
  
  private getReconnectDelay(): number {
    const baseDelay = this.config.reconnectDelay
    const attempt = this.status.reconnectAttempts
    // Exponential backoff with max delay of 30 seconds
    return Math.min(baseDelay * Math.pow(2, attempt), 30000)
  }
  
  private handleOnline(): void {
    if (this.status.state === 'disconnected') {
      this.connect()
    }
  }
  
  private handleOffline(): void {
    this.updateStatus('disconnected')
  }
  
  public connect(): void {
    if (this.status.state === 'connected' || this.status.state === 'connecting') {
      return
    }
    
    this.updateStatus('connecting')
    
    // Simulate connection process
    // In real implementation, this would establish Supabase realtime connection
    setTimeout(() => {
      if (navigator.onLine) {
        this.updateStatus('connected')
        this.status.lastConnected = new Date()
        this.status.reconnectAttempts = 0
      } else {
        this.attemptReconnect()
      }
    }, 1000)
  }
  
  private attemptReconnect(): void {
    if (this.status.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.updateStatus('error', 'Max reconnection attempts reached')
      return
    }
    
    this.status.reconnectAttempts++
    const delay = this.getReconnectDelay()
    
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }
  
  private updateStatus(state: ConnectionState, error?: string): void {
    this.status.state = state
    if (error) {
      this.status.error = error
    } else {
      delete this.status.error
    }
    
    this.notifyListeners()
  }
  
  public subscribe(id: string, callback: (status: ConnectionStatus) => void): () => void {
    this.listeners.set(id, callback)
    callback(this.status) // Send initial status
    
    return () => {
      this.listeners.delete(id)
    }
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback({ ...this.status }))
  }
  
  public getStatus(): ConnectionStatus {
    return { ...this.status }
  }
  
  public registerChannel(name: string, channel: RealtimeChannel): void {
    this.channels.set(name, channel)
    this.metrics.subscriptionCount = this.channels.size
  }
  
  public unregisterChannel(name: string): void {
    this.channels.delete(name)
    this.metrics.subscriptionCount = this.channels.size
  }
  
  public getHealthScore(): number {
    const latencyScore = Math.max(0, 100 - (this.getAverageLatency() / 10))
    const stabilityScore = this.calculateStability()
    const uptimeScore = this.status.state === 'connected' ? 100 : 0
    const reconnectScore = Math.max(0, 100 - (this.status.reconnectAttempts * 20))
    
    return Math.round((latencyScore + stabilityScore + uptimeScore + reconnectScore) / 4)
  }
  
  public getRecommendations(): string[] {
    const recommendations: string[] = []
    const avgLatency = this.getAverageLatency()
    const stability = this.calculateStability()
    
    if (avgLatency > 500) {
      recommendations.push('High latency detected. Consider checking your network connection.')
    }
    
    if (stability < 80) {
      recommendations.push('Connection instability detected. This may affect real-time updates.')
    }
    
    if (this.status.reconnectAttempts > 2) {
      recommendations.push('Multiple reconnection attempts. Check if the service is available.')
    }
    
    if (this.channels.size > 10) {
      recommendations.push('Many active subscriptions. Consider consolidating channels for better performance.')
    }
    
    return recommendations
  }
  
  public destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }
    
    this.listeners.clear()
    this.channels.clear()
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnline())
      window.removeEventListener('offline', () => this.handleOffline())
    }
    
    RealtimeConnectionManager.instance = null
  }
}