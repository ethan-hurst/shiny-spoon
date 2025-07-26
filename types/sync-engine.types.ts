// PRP-015: Sync Engine Core Types
import { z } from 'zod'
import type { IntegrationPlatformType } from './integration.types'

// Sync job types
export const SyncJobType = z.enum(['manual', 'scheduled', 'webhook', 'retry'])
export type SyncJobType = z.infer<typeof SyncJobType>

// Sync job status
export const SyncJobStatus = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled'])
export type SyncJobStatus = z.infer<typeof SyncJobStatus>

// Sync entity types
export const SyncEntityType = z.enum(['products', 'inventory', 'pricing', 'customers', 'orders'])
export type SyncEntityType = z.infer<typeof SyncEntityType>

// Sync conflict resolution strategies
export const ConflictResolutionStrategy = z.enum(['source_wins', 'target_wins', 'newest_wins', 'manual'])
export type ConflictResolutionStrategy = z.infer<typeof ConflictResolutionStrategy>

// Sync job configuration
export const syncJobConfigSchema = z.object({
  integration_id: z.string().uuid(),
  job_type: SyncJobType,
  entity_types: z.array(SyncEntityType),
  sync_mode: z.enum(['full', 'incremental']).default('incremental'),
  batch_size: z.number().min(10).max(1000).default(100),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  scheduled_at: z.string().datetime().optional(),
  retry_config: z.object({
    max_attempts: z.number().default(3),
    backoff_multiplier: z.number().default(2),
    initial_delay_ms: z.number().default(1000),
  }).optional(),
  conflict_resolution: z.object({
    strategy: ConflictResolutionStrategy,
    auto_resolve: z.boolean().default(true),
  }).default({
    strategy: 'newest_wins',
    auto_resolve: true,
  }),
})

export type SyncJobConfig = z.infer<typeof syncJobConfigSchema>

// Sync job record
export interface SyncJob {
  id: string
  organization_id: string
  integration_id: string
  job_type: SyncJobType
  status: SyncJobStatus
  config: SyncJobConfig
  started_at?: string
  completed_at?: string
  duration_ms?: number
  progress?: SyncProgress
  result?: SyncResult
  error?: SyncError
  created_at: string
  updated_at: string
  created_by?: string
}

// Sync progress tracking
export interface SyncProgress {
  phase: 'queued' | 'initializing' | 'fetching' | 'transforming' | 'upserting' | 'finalizing'
  current_entity?: SyncEntityType
  entities_completed: number
  entities_total: number
  records_processed: number
  records_total: number
  percentage: number
  message?: string
  eta_seconds?: number
}

// Sync result summary
export interface SyncResult {
  success: boolean
  summary: {
    total_processed: number
    created: number
    updated: number
    deleted: number
    skipped: number
    failed: number
  }
  entity_results: Record<SyncEntityType, EntitySyncResult>
  conflicts?: SyncConflict[]
  errors: SyncError[]
  duration_ms: number
  performance_metrics?: PerformanceMetrics
}

// Entity-specific sync result
export interface EntitySyncResult {
  entity_type: SyncEntityType
  processed: number
  created: number
  updated: number
  deleted: number
  skipped: number
  failed: number
  errors: SyncError[]
  sample_records?: any[]
}

// Sync conflict detection
export interface SyncConflict {
  entity_type: SyncEntityType
  record_id: string
  field: string
  source_value: any
  target_value: any
  detected_at: string
  resolution?: {
    strategy: ConflictResolutionStrategy
    resolved_value: any
    resolved_by?: string
    resolved_at: string
  }
}

// Sync error tracking
export interface SyncError {
  code: string
  message: string
  entity_type?: SyncEntityType
  record_id?: string
  details?: any
  timestamp: string
  retryable: boolean
}

// Performance metrics
export interface PerformanceMetrics {
  api_calls: number
  api_call_duration_ms: number
  db_queries: number
  db_query_duration_ms: number
  memory_used_mb: number
  cpu_usage_percent: number
  network_bytes_sent: number
  network_bytes_received: number
}

// Sync schedule configuration
export const syncScheduleSchema = z.object({
  enabled: z.boolean().default(true),
  frequency: z.enum(['every_5_min', 'every_15_min', 'every_30_min', 'hourly', 'daily', 'weekly']),
  timezone: z.string().default('UTC'),
  day_of_week: z.number().min(0).max(6).optional(), // 0 = Sunday, 6 = Saturday
  hour: z.number().min(0).max(23).optional(),
  minute: z.number().min(0).max(59).optional(),
  entity_types: z.array(SyncEntityType),
  active_hours: z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }).optional(),
})

export type SyncSchedule = z.infer<typeof syncScheduleSchema>

// Sync engine configuration
export interface SyncEngineConfig {
  max_concurrent_jobs: number
  job_timeout_ms: number
  enable_conflict_detection: boolean
  enable_performance_tracking: boolean
  enable_notifications: boolean
  notification_channels: NotificationChannel[]
  retention_days: number
  debug_mode: boolean
}

// Notification channels
export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook'
  enabled: boolean
  config: Record<string, any>
  events: SyncNotificationEvent[]
}

// Notification events
export type SyncNotificationEvent = 
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'conflicts_detected'
  | 'performance_degradation'
  | 'quota_exceeded'

// Sync engine events
export interface SyncEngineEvents {
  'job:created': (job: SyncJob) => void
  'job:started': (job: SyncJob) => void
  'job:progress': (jobId: string, progress: SyncProgress) => void
  'job:completed': (job: SyncJob, result: SyncResult) => void
  'job:failed': (job: SyncJob, error: SyncError) => void
  'job:cancelled': (job: SyncJob) => void
  'conflict:detected': (conflict: SyncConflict) => void
  'performance:warning': (metrics: PerformanceMetrics) => void
}

// Sync state management
export interface SyncState {
  integration_id: string
  entity_type: SyncEntityType
  last_sync_at?: string
  last_successful_sync_at?: string
  last_cursor?: string
  sync_version: number
  metadata?: Record<string, any>
}

// Queue item for job processing
export interface QueueItem {
  job_id: string
  priority: number
  created_at: string
  attempts: number
  next_attempt_at?: string
  locked_by?: string
  locked_at?: string
}

// Sync statistics
export interface SyncStatistics {
  integration_id: string
  period: 'hour' | 'day' | 'week' | 'month'
  total_syncs: number
  successful_syncs: number
  failed_syncs: number
  average_duration_ms: number
  total_records_synced: number
  total_conflicts: number
  total_errors: number
  by_entity_type: Record<SyncEntityType, {
    count: number
    records: number
    errors: number
  }>
}

// Sync health status
export interface SyncHealthStatus {
  integration_id: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  last_check_at: string
  metrics: {
    success_rate: number
    average_duration_ms: number
    error_rate: number
    queue_depth: number
    oldest_pending_job_age_ms?: number
  }
  issues?: string[]
}