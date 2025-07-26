// PRP-015: Core Sync Engine
import { EventEmitter } from 'events'
import { createClient } from '@/lib/supabase/server'
import { BaseConnector } from '@/lib/integrations/base-connector'
import { NetSuiteConnector } from '@/lib/integrations/netsuite/connector'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import type {
  SyncJob,
  SyncJobConfig,
  SyncProgress,
  SyncResult,
  SyncError,
  SyncEngineConfig,
  SyncEngineEvents,
  SyncEntityType,
  SyncConflict,
  ConflictResolutionStrategy,
  PerformanceMetrics,
} from '@/types/sync-engine.types'
import type { ConnectorConfig } from '@/lib/integrations/base-connector'

// Default sync engine configuration
const DEFAULT_CONFIG: SyncEngineConfig = {
  max_concurrent_jobs: 5,
  job_timeout_ms: 300000, // 5 minutes
  enable_conflict_detection: true,
  enable_performance_tracking: true,
  enable_notifications: true,
  notification_channels: [],
  retention_days: 30,
  debug_mode: false,
}

export class SyncEngine extends EventEmitter {
  private config: SyncEngineConfig
  private activeJobs: Map<string, AbortController> = new Map()
  private connectorCache: Map<string, BaseConnector> = new Map()
  private performanceTracker: PerformanceTracker

  constructor(config?: Partial<SyncEngineConfig>) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.performanceTracker = new PerformanceTracker()
  }

  /**
   * Create and queue a new sync job
   */
  async createSyncJob(config: SyncJobConfig): Promise<SyncJob> {
    const supabase = await createClient()
    
    // Get user context
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      throw new Error('User profile not found')
    }

    // Verify integration belongs to user's organization
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, organization_id')
      .eq('id', config.integration_id)
      .eq('organization_id', profile.organization_id)
      .single()

    if (!integration) {
      throw new Error('Integration not found or access denied')
    }

    // Create sync job
    const { data: job, error } = await supabase
      .from('sync_jobs')
      .insert({
        organization_id: profile.organization_id,
        integration_id: config.integration_id,
        job_type: config.job_type,
        config: config,
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !job) {
      throw new Error(`Failed to create sync job: ${error?.message}`)
    }

    // Add to queue
    const priority = config.priority === 'high' ? 80 : config.priority === 'low' ? 20 : 50
    
    const { error: queueError } = await supabase
      .from('sync_queue')
      .insert({
        job_id: job.id,
        priority: priority,
        max_attempts: config.retry_config?.max_attempts || 3,
      })

    if (queueError) {
      // Rollback job creation (fix-53: handle rollback failures)
      try {
        const { error: rollbackError } = await supabase
          .from('sync_jobs')
          .delete()
          .eq('id', job.id)
        
        if (rollbackError) {
          console.error('Failed to rollback job creation', {
            jobId: job.id,
            originalError: queueError,
            rollbackError: rollbackError
          })
          // Continue with original error
        }
      } catch (rollbackException) {
        console.error('Exception during rollback', {
          jobId: job.id,
          originalError: queueError,
          rollbackException
        })
        // Continue with original error
      }
      
      throw new Error(`Failed to queue sync job: ${queueError.message}`)
    }

    this.emit('job:created', job)
    
    return job
  }

  /**
   * Execute a sync job
   */
  async executeJob(jobId: string): Promise<SyncResult> {
    const supabase = await createClient()
    const startTime = Date.now()
    
    // Check concurrent job limit
    if (this.activeJobs.size >= this.config.max_concurrent_jobs) {
      throw new Error('Maximum concurrent jobs reached')
    }

    // Get job details
    const { data: job, error } = await supabase
      .from('sync_jobs')
      .select('*, integrations(*)')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      throw new Error(`Failed to fetch job: ${error?.message}`)
    }

    // Create abort controller for cancellation
    const abortController = new AbortController()
    this.activeJobs.set(jobId, abortController)

    // Set up timeout (fix-54: prevent race condition)
    let timeoutId: NodeJS.Timeout | null = null
    let isTimedOut = false
    
    if (this.config.job_timeout_ms > 0) {
      timeoutId = setTimeout(() => {
        isTimedOut = true
        abortController.abort()
      }, this.config.job_timeout_ms)
    }

    try {
      // Check if already timed out before starting
      if (isTimedOut) {
        throw new Error('Job timed out before execution')
      }
      
      this.emit('job:started', job)
      
      // Initialize performance tracking
      if (this.config.enable_performance_tracking) {
        this.performanceTracker.startJob(jobId)
      }

      // Get connector for integration
      const connector = await this.getOrCreateConnector(
        job.integrations.platform,
        job.integration_id,
        job.organization_id
      )

      // Execute sync based on configuration
      const result = await this.executeSyncWithProgress(
        job,
        connector,
        abortController.signal
      )

      // Track performance metrics
      if (this.config.enable_performance_tracking) {
        const metrics = await this.performanceTracker.endJob(jobId)
        result.performance_metrics = metrics
        
        // Save metrics to database
        await supabase.from('sync_metrics').insert({
          sync_job_id: jobId,
          ...metrics,
        })
      }

      // Complete job
      await supabase.rpc('complete_sync_job', {
        p_job_id: jobId,
        p_result: result,
      })

      this.emit('job:completed', job, result)
      
      return result
      
    } catch (error) {
      const syncError: SyncError = {
        code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        retryable: !abortController.signal.aborted,
      }

      // Complete job with error
      await supabase.rpc('complete_sync_job', {
        p_job_id: jobId,
        p_result: null,
        p_error: syncError,
      })

      this.emit('job:failed', job, syncError)
      
      throw error
      
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      this.activeJobs.delete(jobId)
    }
  }

  /**
   * Execute sync with progress tracking
   */
  private async executeSyncWithProgress(
    job: SyncJob,
    connector: BaseConnector,
    signal: AbortSignal
  ): Promise<SyncResult> {
    const config = job.config as SyncJobConfig
    const entityTypes = config.entity_types
    
    const result: SyncResult = {
      success: true,
      summary: {
        total_processed: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        failed: 0,
      },
      entity_results: {} as any,
      conflicts: [],
      errors: [],
      duration_ms: 0,
    }

    const progress: SyncProgress = {
      phase: 'initializing',
      entities_completed: 0,
      entities_total: entityTypes.length,
      records_processed: 0,
      records_total: 0,
      percentage: 0,
    }

    // Update initial progress
    await this.updateJobProgress(job.id, progress)

    // Process each entity type
    for (let i = 0; i < entityTypes.length; i++) {
      if (signal.aborted) {
        throw new Error('Sync job cancelled')
      }

      const entityType = entityTypes[i]
      progress.current_entity = entityType
      progress.phase = 'fetching'
      
      await this.updateJobProgress(job.id, progress)

      try {
        // Execute sync for entity
        const entityResult = await connector.sync(entityType, {
          limit: config.batch_size,
          force: config.sync_mode === 'full',
          dryRun: false,
          signal: signal,
        })

        // Store entity result
        result.entity_results[entityType] = {
          entity_type: entityType,
          processed: entityResult.items_processed || 0,
          created: entityResult.items_created || 0,
          updated: entityResult.items_updated || 0,
          deleted: entityResult.items_deleted || 0,
          skipped: entityResult.items_skipped || 0,
          failed: entityResult.items_failed || 0,
          errors: entityResult.errors || [],
        }

        // Update summary
        result.summary.total_processed += entityResult.items_processed || 0
        result.summary.created += entityResult.items_created || 0
        result.summary.updated += entityResult.items_updated || 0
        result.summary.deleted += entityResult.items_deleted || 0
        result.summary.skipped += entityResult.items_skipped || 0
        result.summary.failed += entityResult.items_failed || 0

        // Check for conflicts if enabled
        if (this.config.enable_conflict_detection && entityResult.conflicts) {
          const conflicts = await this.detectConflicts(
            job.id,
            entityType,
            entityResult.conflicts
          )
          result.conflicts?.push(...conflicts)
        }

      } catch (error) {
        const syncError: SyncError = {
          code: error instanceof Error ? error.constructor.name : 'ENTITY_SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to sync entity',
          entity_type: entityType,
          timestamp: new Date().toISOString(),
          retryable: true,
        }
        
        result.errors.push(syncError)
        result.success = false
      }

      // Update progress
      progress.entities_completed = i + 1
      progress.percentage = Math.round((progress.entities_completed / progress.entities_total) * 100)
      progress.records_processed = result.summary.total_processed
      
      await this.updateJobProgress(job.id, progress)
    }

    progress.phase = 'finalizing'
    await this.updateJobProgress(job.id, progress)

    return result
  }

  /**
   * Get or create a connector instance
   */
  private async getOrCreateConnector(
    platform: string,
    integrationId: string,
    organizationId: string
  ): Promise<BaseConnector> {
    const cacheKey = `${platform}:${integrationId}`
    
    if (this.connectorCache.has(cacheKey)) {
      return this.connectorCache.get(cacheKey)!
    }

    const supabase = await createClient()
    
    // Get integration details
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*, netsuite_config(*), shopify_config(*)')
      .eq('id', integrationId)
      .single()

    if (error || !integration) {
      throw new Error(`Failed to fetch integration: ${error?.message}`)
    }

    // Create connector config
    const connectorConfig: ConnectorConfig = {
      integrationId: integrationId,
      organizationId: organizationId,
      credentials: {} as any, // Will be loaded by connector
      settings: integration.sync_settings || {},
    }

    let connector: BaseConnector

    switch (platform) {
      case 'netsuite':
        if (!integration.netsuite_config?.[0]) {
          throw new Error('NetSuite configuration not found')
        }
        connectorConfig.settings = {
          ...connectorConfig.settings,
          ...integration.netsuite_config[0],
        }
        connector = new NetSuiteConnector(connectorConfig)
        break
        
      case 'shopify':
        if (!integration.shopify_config?.[0]) {
          throw new Error('Shopify configuration not found')
        }
        connectorConfig.settings = {
          ...connectorConfig.settings,
          ...integration.shopify_config[0],
        }
        connector = new ShopifyConnector(connectorConfig)
        break
        
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    // Initialize connector (fix-52: don't cache on failure)
    try {
      await connector.initialize()
      
      // Only cache if initialization succeeded
      this.connectorCache.set(cacheKey, connector)
      
      return connector
    } catch (error) {
      // Don't cache failed connectors
      console.error(`Failed to initialize connector for ${platform}:${integrationId}`, error)
      
      // Try to disconnect if partially initialized
      try {
        await connector.disconnect()
      } catch (disconnectError) {
        // Ignore disconnect errors
      }
      
      throw error
    }
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(jobId: string, progress: SyncProgress): Promise<void> {
    const supabase = await createClient()
    
    await supabase.rpc('update_sync_job_progress', {
      p_job_id: jobId,
      p_progress: progress,
    })
    
    this.emit('job:progress', jobId, progress)
  }

  /**
   * Detect conflicts in sync results
   */
  private async detectConflicts(
    jobId: string,
    entityType: SyncEntityType,
    potentialConflicts: any[]
  ): Promise<SyncConflict[]> {
    const supabase = await createClient()
    const conflicts: SyncConflict[] = []
    const failedConflicts: Array<{ conflict: any; error: Error }> = []
    
    for (const conflict of potentialConflicts) {
      try {
        // Validate conflict data (fix-51)
        if (!conflict.record_id || !conflict.field) {
          console.warn('Invalid conflict data - missing required fields', conflict)
          continue
        }
        
        const syncConflict: SyncConflict = {
          entity_type: entityType,
          record_id: conflict.record_id,
          field: conflict.field,
          source_value: conflict.source_value,
          target_value: conflict.target_value,
          detected_at: new Date().toISOString(),
        }
        
        // Apply auto-resolution if enabled
        if (conflict.auto_resolve) {
          try {
            const strategy = conflict.resolution_strategy || 'newest_wins'
            const resolvedValue = this.resolveConflict(
              strategy,
              conflict.source_value,
              conflict.target_value,
              conflict.source_timestamp,
              conflict.target_timestamp
            )
            
            syncConflict.resolution = {
              strategy: strategy,
              resolved_value: resolvedValue,
              resolved_at: new Date().toISOString(),
            }
          } catch (resolutionError) {
            console.error('Failed to auto-resolve conflict', {
              conflict: syncConflict,
              error: resolutionError
            })
            // Continue without resolution
          }
        }
        
        conflicts.push(syncConflict)
        
        // Save conflict to database with error handling
        try {
          const { error } = await supabase.from('sync_conflicts').insert({
            sync_job_id: jobId,
            ...syncConflict,
          })
          
          if (error) {
            throw error
          }
          
          this.emit('conflict:detected', syncConflict)
        } catch (dbError) {
          console.error('Failed to save conflict to database', {
            conflict: syncConflict,
            error: dbError
          })
          failedConflicts.push({ conflict: syncConflict, error: dbError as Error })
          // Continue processing other conflicts
        }
      } catch (error) {
        console.error('Error processing conflict', {
          conflict,
          error
        })
        failedConflicts.push({ conflict, error: error as Error })
      }
    }
    
    // Log summary if there were failures
    if (failedConflicts.length > 0) {
      console.warn(`Failed to process ${failedConflicts.length} conflicts`, {
        jobId,
        entityType,
        failedCount: failedConflicts.length,
        totalCount: potentialConflicts.length
      })
    }
    
    return conflicts
  }

  /**
   * Resolve a conflict based on strategy
   */
  private resolveConflict(
    strategy: ConflictResolutionStrategy,
    sourceValue: any,
    targetValue: any,
    sourceTimestamp?: string | Date,
    targetTimestamp?: string | Date
  ): any {
    switch (strategy) {
      case 'source_wins':
        return sourceValue
        
      case 'target_wins':
        return targetValue
        
      case 'newest_wins':
        // Implement proper timestamp comparison (fix-48)
        if (!sourceTimestamp || !targetTimestamp) {
          // If timestamps are missing, log warning and default to source
          this.config.debug_mode && console.warn('Missing timestamps for newest_wins strategy')
          return sourceValue
        }
        
        const sourceTime = new Date(sourceTimestamp).getTime()
        const targetTime = new Date(targetTimestamp).getTime()
        
        // Handle invalid dates
        if (isNaN(sourceTime) || isNaN(targetTime)) {
          this.config.debug_mode && console.warn('Invalid timestamps for comparison', {
            source: sourceTimestamp,
            target: targetTimestamp
          })
          return sourceValue
        }
        
        // Return the value with the newer timestamp
        return sourceTime > targetTime ? sourceValue : targetValue
        
      case 'manual':
        // Manual resolution required
        return null
        
      default:
        return sourceValue
    }
  }

  /**
   * Cancel a running sync job
   */
  async cancelJob(jobId: string): Promise<void> {
    const controller = this.activeJobs.get(jobId)
    
    if (controller) {
      controller.abort()
      
      const supabase = await createClient()
      
      await supabase
        .from('sync_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        
      const { data: job } = await supabase
        .from('sync_jobs')
        .select()
        .eq('id', jobId)
        .single()
        
      if (job) {
        this.emit('job:cancelled', job)
      }
    }
  }

  /**
   * Evict a connector from cache (fix-49)
   */
  async evictConnector(integrationId: string): Promise<void> {
    // Find all cache keys for this integration
    const keysToEvict: string[] = []
    for (const key of this.connectorCache.keys()) {
      if (key.includes(integrationId)) {
        keysToEvict.push(key)
      }
    }
    
    // Disconnect and remove connectors
    for (const key of keysToEvict) {
      const connector = this.connectorCache.get(key)
      if (connector) {
        try {
          await connector.disconnect()
        } catch (error) {
          console.error(`Error disconnecting connector ${key}:`, error)
        }
        this.connectorCache.delete(key)
      }
    }
    
    this.emit('connector:evicted', { integrationId, evictedKeys: keysToEvict })
  }

  /**
   * Evict all connectors from cache
   */
  async evictAllConnectors(): Promise<void> {
    const connectors = Array.from(this.connectorCache.entries())
    
    for (const [key, connector] of connectors) {
      try {
        await connector.disconnect()
      } catch (error) {
        console.error(`Error disconnecting connector ${key}:`, error)
      }
    }
    
    this.connectorCache.clear()
    this.emit('connector:evicted-all', { count: connectors.length })
  }

  /**
   * Get sync engine health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    activeJobs: number
    maxJobs: number
    connectors: number
    issues: string[]
  }> {
    const issues: string[] = []
    
    // Check active jobs
    if (this.activeJobs.size >= this.config.max_concurrent_jobs) {
      issues.push('Maximum concurrent jobs reached')
    }
    
    // Check connector health
    for (const [key, connector] of this.connectorCache) {
      try {
        const healthy = await connector.testConnection()
        if (!healthy) {
          issues.push(`Connector ${key} is unhealthy`)
        }
      } catch (error) {
        issues.push(`Connector ${key} test failed: ${error}`)
      }
    }
    
    const status = issues.length === 0 ? 'healthy' : 
                   issues.length < 3 ? 'degraded' : 'unhealthy'
    
    return {
      status,
      activeJobs: this.activeJobs.size,
      maxJobs: this.config.max_concurrent_jobs,
      connectors: this.connectorCache.size,
      issues,
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    // Cancel all active jobs
    for (const [jobId, controller] of this.activeJobs) {
      controller.abort()
      await this.cancelJob(jobId)
    }
    
    // Disconnect all connectors
    for (const connector of this.connectorCache.values()) {
      await connector.disconnect()
    }
    
    this.activeJobs.clear()
    this.connectorCache.clear()
    this.removeAllListeners()
  }

  // Add type declaration for events
  on<K extends keyof SyncEngineEvents>(
    event: K,
    listener: SyncEngineEvents[K]
  ): this {
    return super.on(event, listener as any)
  }

  emit<K extends keyof SyncEngineEvents>(
    event: K,
    ...args: Parameters<SyncEngineEvents[K]>
  ): boolean {
    return super.emit(event, ...args)
  }
}

// Performance tracking helper
class PerformanceTracker {
  private jobs: Map<string, {
    startTime: number
    apiCalls: number
    apiCallDurations: number[]
    dbQueries: number
    dbQueryDurations: number[]
    bytesReceived: number
    bytesSent: number
    startMemory: number
    startCpuUsage?: NodeJS.CpuUsage
  }> = new Map()

  startJob(jobId: string): void {
    const memoryUsage = process.memoryUsage()
    this.jobs.set(jobId, {
      startTime: Date.now(),
      apiCalls: 0,
      apiCallDurations: [],
      dbQueries: 0,
      dbQueryDurations: [],
      bytesReceived: 0,
      bytesSent: 0,
      startMemory: memoryUsage.heapUsed,
      startCpuUsage: process.cpuUsage ? process.cpuUsage() : undefined
    })
  }

  async endJob(jobId: string): Promise<PerformanceMetrics> {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error('Job not found in performance tracker')
    }

    const duration = Date.now() - job.startTime
    
    // Get memory usage (fix-50: actual memory measurements)
    const memoryUsage = process.memoryUsage()
    const memoryUsedMB = Math.round((memoryUsage.heapUsed - job.startMemory) / 1024 / 1024)
    
    // Calculate actual CPU usage if available
    let cpuUsagePercent = 0
    if (job.startCpuUsage && process.cpuUsage) {
      const endCpuUsage = process.cpuUsage(job.startCpuUsage)
      const totalCpuTime = (endCpuUsage.user + endCpuUsage.system) / 1000 // Convert to ms
      cpuUsagePercent = Math.round((totalCpuTime / duration) * 100)
    }
    
    // Calculate actual durations
    const apiCallDuration = job.apiCallDurations.reduce((sum, d) => sum + d, 0)
    const dbQueryDuration = job.dbQueryDurations.reduce((sum, d) => sum + d, 0)

    const metrics: PerformanceMetrics = {
      api_calls: job.apiCalls,
      api_call_duration_ms: Math.round(apiCallDuration),
      db_queries: job.dbQueries,
      db_query_duration_ms: Math.round(dbQueryDuration),
      memory_used_mb: Math.max(0, memoryUsedMB), // Ensure non-negative
      cpu_usage_percent: Math.min(100, cpuUsagePercent), // Cap at 100%
      network_bytes_sent: job.bytesSent,
      network_bytes_received: job.bytesReceived,
    }

    this.jobs.delete(jobId)
    
    return metrics
  }

  trackApiCall(jobId: string, duration?: number): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.apiCalls++
      if (duration !== undefined) {
        job.apiCallDurations.push(duration)
      }
    }
  }

  trackDbQuery(jobId: string, duration?: number): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.dbQueries++
      if (duration !== undefined) {
        job.dbQueryDurations.push(duration)
      }
    }
  }

  trackNetworkTraffic(jobId: string, sent: number, received: number): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.bytesSent += sent
      job.bytesReceived += received
    }
  }
  
  // Helper to measure async operation duration
  async measureOperation<T>(
    jobId: string,
    type: 'api' | 'db',
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    try {
      const result = await operation()
      const duration = Date.now() - startTime
      
      if (type === 'api') {
        this.trackApiCall(jobId, duration)
      } else {
        this.trackDbQuery(jobId, duration)
      }
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      if (type === 'api') {
        this.trackApiCall(jobId, duration)
      } else {
        this.trackDbQuery(jobId, duration)
      }
      
      throw error
    }
  }
}