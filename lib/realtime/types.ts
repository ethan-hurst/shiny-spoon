/**
 * Shared types for real-time features
 */

export type ConnectionState =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor'

export interface ConnectionStatus {
  state: ConnectionState
  latency: number
  lastConnected: Date | null
  reconnectAttempts: number
  quality: ConnectionQuality
  error?: string
}

export interface ConnectionMetrics {
  latency: number[]
  stability: number // 0-100 percentage
  throughput: number // messages per second
  lastMeasured: Date
}

export interface QueuedOperation {
  id: string
  type: 'UPDATE' | 'INSERT' | 'DELETE'
  table: string
  data: any
  timestamp: number
  retries: number
  error?: string
}

export interface ProcessResult {
  successful: string[] // operation IDs
  failed: Array<{ id: string; error: string }>
  conflicts: Array<{ id: string; localValue: any; serverValue: any }>
}

export interface PresenceData {
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string
  currentView: 'list' | 'item'
  itemId?: string
  lastActivity: Date
  cursor?: { x: number; y: number }
}

export interface PerformanceMetrics {
  messageLatency: number[]
  reconnectionCount: number
  messageDropRate: number
  subscriptionCount: number
  avgLatency: number
  healthScore: number // 0-100
}

export interface ConflictResolution {
  strategy: 'local' | 'server' | 'merge' | 'manual'
  mergedValue?: any
  resolvedBy?: string
  resolvedAt?: Date
}

export interface OptimisticUpdate<T = any> {
  id: string
  timestamp: number
  originalValue: T
  optimisticValue: T
  status: 'pending' | 'confirmed' | 'failed' | 'conflict'
  error?: string
}

export interface RealtimeConfig {
  enableOptimisticUpdates: boolean
  enableOfflineQueue: boolean
  enablePresence: boolean
  enablePerformanceMonitoring: boolean
  reconnectDelay: number
  maxReconnectAttempts: number
  conflictResolutionStrategy: 'auto' | 'manual'
  queuePersistence: 'memory' | 'indexeddb'
}
