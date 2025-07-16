import { RealtimeConnectionManager } from './connection-manager'
import { OfflineQueue } from './offline-queue'

export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'unknown'
export type NetworkSpeed = 'fast' | 'medium' | 'slow' | 'offline'

interface NetworkInfo {
  type: NetworkType
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g'
  downlink?: number // Mbps
  rtt?: number // Round trip time in ms
  saveData?: boolean
}

export interface NetworkQualityInfo {
  type: NetworkType
  speed: NetworkSpeed
  downlink: number
  rtt: number
  jitter: number
  packetLoss: number
  recommendation: 'realtime' | 'optimistic' | 'batch' | 'offline'
}

export class NetworkQualityDetector {
  private static instance: NetworkQualityDetector | null = null
  private connectionManager: RealtimeConnectionManager
  private offlineQueue: OfflineQueue
  private rttMeasurements: number[] = []
  private packetLossMeasurements: boolean[] = []
  private listeners: Map<string, (quality: NetworkQualityInfo) => void> = new Map()

  private constructor() {
    this.connectionManager = RealtimeConnectionManager.getInstance()
    this.offlineQueue = OfflineQueue.getInstance()
    
    // Start monitoring
    this.startMonitoring()
  }

  static getInstance(): NetworkQualityDetector {
    if (!NetworkQualityDetector.instance) {
      NetworkQualityDetector.instance = new NetworkQualityDetector()
    }
    return NetworkQualityDetector.instance
  }

  private startMonitoring(): void {
    // Monitor network changes
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      
      if (connection) {
        connection.addEventListener('change', () => {
          this.notifyListeners()
        })
      }
    }

    // Periodic quality checks
    setInterval(() => {
      this.measureNetworkQuality()
    }, 10000) // Every 10 seconds
  }

  private async measureNetworkQuality(): Promise<void> {
    // Measure RTT with multiple pings
    const measurements = await Promise.all([
      this.measureRTT(),
      this.measureRTT(),
      this.measureRTT()
    ])

    measurements.forEach(({ rtt, success }) => {
      if (success && rtt !== null) {
        this.rttMeasurements.push(rtt)
        this.packetLossMeasurements.push(true)
      } else {
        this.packetLossMeasurements.push(false)
      }
    })

    // Keep only recent measurements
    if (this.rttMeasurements.length > 30) {
      this.rttMeasurements = this.rttMeasurements.slice(-30)
    }
    if (this.packetLossMeasurements.length > 30) {
      this.packetLossMeasurements = this.packetLossMeasurements.slice(-30)
    }

    this.notifyListeners()
  }

  private async measureRTT(): Promise<{ rtt: number | null; success: boolean }> {
    const start = performance.now()
    
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      
      if (response.ok) {
        const rtt = performance.now() - start
        return { rtt, success: true }
      }
      
      return { rtt: null, success: false }
    } catch {
      return { rtt: null, success: false }
    }
  }

  getNetworkInfo(): NetworkInfo {
    const info: NetworkInfo = {
      type: 'unknown'
    }

    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      
      if (connection) {
        // Determine network type
        if (connection.type) {
          info.type = connection.type as NetworkType
        }
        
        // Get effective type (4g, 3g, etc.)
        if (connection.effectiveType) {
          info.effectiveType = connection.effectiveType
        }
        
        // Get downlink speed in Mbps
        if (connection.downlink) {
          info.downlink = connection.downlink
        }
        
        // Get RTT
        if (connection.rtt) {
          info.rtt = connection.rtt
        }
        
        // Check if save data is enabled
        if (connection.saveData) {
          info.saveData = connection.saveData
        }
      }
    }

    return info
  }

  getQuality(): NetworkQualityInfo {
    const networkInfo = this.getNetworkInfo()
    const connectionStatus = this.connectionManager.getStatus()
    
    // Calculate average RTT
    const avgRTT = this.rttMeasurements.length > 0
      ? this.rttMeasurements.reduce((a, b) => a + b, 0) / this.rttMeasurements.length
      : connectionStatus.latency || 0
    
    // Calculate jitter (variance in RTT)
    const jitter = this.calculateJitter()
    
    // Calculate packet loss
    const packetLoss = this.calculatePacketLoss()
    
    // Determine network speed
    const speed = this.determineSpeed(networkInfo, avgRTT, packetLoss)
    
    // Get recommendation based on quality
    const recommendation = this.getRecommendation(speed, avgRTT, jitter, packetLoss)
    
    return {
      type: networkInfo.type || 'unknown',
      speed,
      downlink: networkInfo.downlink || 0,
      rtt: avgRTT,
      jitter,
      packetLoss,
      recommendation
    }
  }

  private calculateJitter(): number {
    if (this.rttMeasurements.length < 2) return 0
    
    const diffs: number[] = []
    for (let i = 1; i < this.rttMeasurements.length; i++) {
      diffs.push(Math.abs(this.rttMeasurements[i] - this.rttMeasurements[i - 1]))
    }
    
    return diffs.length > 0
      ? diffs.reduce((a, b) => a + b, 0) / diffs.length
      : 0
  }

  private calculatePacketLoss(): number {
    if (this.packetLossMeasurements.length === 0) return 0
    
    const losses = this.packetLossMeasurements.filter(success => !success).length
    return (losses / this.packetLossMeasurements.length) * 100
  }

  private determineSpeed(
    networkInfo: NetworkInfo, 
    avgRTT: number, 
    packetLoss: number
  ): NetworkSpeed {
    // Check if offline
    if (!navigator.onLine || packetLoss > 50) {
      return 'offline'
    }
    
    // Use effective type if available
    if (networkInfo.effectiveType) {
      switch (networkInfo.effectiveType) {
        case '4g':
          return avgRTT < 150 ? 'fast' : 'medium'
        case '3g':
          return 'medium'
        case '2g':
        case 'slow-2g':
          return 'slow'
      }
    }
    
    // Fallback to RTT-based detection
    if (avgRTT < 100 && packetLoss < 1) return 'fast'
    if (avgRTT < 300 && packetLoss < 5) return 'medium'
    return 'slow'
  }

  private getRecommendation(
    speed: NetworkSpeed,
    rtt: number,
    jitter: number,
    packetLoss: number
  ): 'realtime' | 'optimistic' | 'batch' | 'offline' {
    if (speed === 'offline') return 'offline'
    
    // High quality - use real-time
    if (speed === 'fast' && jitter < 50 && packetLoss < 1) {
      return 'realtime'
    }
    
    // Medium quality - use optimistic updates
    if (speed === 'medium' || (rtt < 500 && packetLoss < 5)) {
      return 'optimistic'
    }
    
    // Poor quality - batch updates
    if (speed === 'slow' && packetLoss < 20) {
      return 'batch'
    }
    
    // Very poor quality - offline mode
    return 'offline'
  }

  shouldThrottle(): boolean {
    const quality = this.getQuality()
    return quality.speed === 'slow' || quality.recommendation === 'batch'
  }

  shouldBatch(): boolean {
    const quality = this.getQuality()
    return quality.recommendation === 'batch'
  }

  isHighQuality(): boolean {
    const quality = this.getQuality()
    return quality.speed === 'fast' && quality.recommendation === 'realtime'
  }

  adaptBehavior<T>(options: {
    highQuality: () => T
    mediumQuality: () => T
    lowQuality: () => T
    offline: () => T
  }): T {
    const quality = this.getQuality()
    
    switch (quality.recommendation) {
      case 'realtime':
        return options.highQuality()
      case 'optimistic':
        return options.mediumQuality()
      case 'batch':
        return options.lowQuality()
      case 'offline':
        return options.offline()
    }
  }

  subscribe(id: string, callback: (quality: NetworkQualityInfo) => void): () => void {
    this.listeners.set(id, callback)
    callback(this.getQuality()) // Initial quality
    
    return () => {
      this.listeners.delete(id)
    }
  }

  private notifyListeners(): void {
    const quality = this.getQuality()
    this.listeners.forEach(callback => callback(quality))
  }

  destroy(): void {
    this.listeners.clear()
    this.rttMeasurements = []
    this.packetLossMeasurements = []
    NetworkQualityDetector.instance = null
  }
}