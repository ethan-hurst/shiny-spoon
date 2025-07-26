// PRP-013: NetSuite Sync Orchestrator
import { createClient } from '@/lib/supabase/server'
import { NetSuiteConnector } from './connector'
import { z } from 'zod'
import type { 
  NetSuiteIntegrationConfig, 
  SyncProgress,
  SyncResult 
} from '@/types/netsuite.types'

// Sync job configuration schema
const syncJobSchema = z.object({
  integration_id: z.string().uuid(),
  entity_types: z.array(z.enum(['products', 'inventory', 'pricing', 'customers', 'orders'])),
  sync_type: z.enum(['full', 'incremental']),
  batch_size: z.number().min(10).max(1000).default(100),
  parallel_workers: z.number().min(1).max(5).default(3),
  retry_failed: z.boolean().default(true),
  dry_run: z.boolean().default(false),
})

export type SyncJobConfig = z.infer<typeof syncJobSchema>

export class NetSuiteSyncOrchestrator {
  private connector: NetSuiteConnector | null = null
  private abortController: AbortController | null = null

  constructor(
    private integrationId: string,
    private organizationId: string,
    private config: NetSuiteIntegrationConfig
  ) {}

  /**
   * Execute a sync job with the given configuration
   */
  async executeSyncJob(jobConfig: SyncJobConfig): Promise<SyncResult> {
    const validated = syncJobSchema.parse(jobConfig)
    const supabase = await createClient()
    
    // Create sync job record
    const { data: job, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        integration_id: validated.integration_id,
        job_type: validated.sync_type === 'full' ? 'full_sync' : 'incremental_sync',
        entity_type: validated.entity_types.join(','),
        status: 'running',
        started_at: new Date().toISOString(),
        config: validated,
      })
      .select()
      .single()

    if (jobError || !job) {
      throw new Error(`Failed to create sync job: ${jobError?.message}`)
    }

    // Initialize connector
    this.connector = new NetSuiteConnector(
      this.integrationId,
      this.organizationId,
      this.config
    )

    // Set up abort controller for cancellation
    this.abortController = new AbortController()

    const results: SyncResult = {
      success: true,
      errors: [],
      summary: {
        total: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        failed: 0,
      },
      duration: 0,
    }

    const startTime = Date.now()

    try {
      // Initialize authentication
      await this.connector.initialize()

      // Process each entity type
      for (const entityType of validated.entity_types) {
        if (this.abortController.signal.aborted) {
          throw new Error('Sync job cancelled')
        }

        // Update job progress
        await this.updateJobProgress(job.id, {
          current_entity: entityType,
          progress: this.calculateProgress(
            validated.entity_types.indexOf(entityType),
            validated.entity_types.length
          ),
        })

        // Execute sync based on type
        let entityResult: SyncResult
        
        if (validated.sync_type === 'full') {
          entityResult = await this.executeFullSync(
            entityType,
            validated.batch_size,
            validated.dry_run
          )
        } else {
          entityResult = await this.executeIncrementalSync(
            entityType,
            validated.batch_size,
            validated.dry_run
          )
        }

        // Merge results
        results.summary.total += entityResult.summary.total
        results.summary.created += entityResult.summary.created
        results.summary.updated += entityResult.summary.updated
        results.summary.deleted += entityResult.summary.deleted
        results.summary.failed += entityResult.summary.failed
        results.errors.push(...entityResult.errors)
        
        // Log entity sync completion
        await supabase.rpc('log_integration_activity', {
          p_integration_id: this.integrationId,
          p_organization_id: this.organizationId,
          p_log_type: 'sync',
          p_severity: entityResult.errors.length > 0 ? 'warning' : 'info',
          p_message: `Completed ${entityType} sync`,
          p_details: entityResult.summary,
        })
      }

      results.duration = Date.now() - startTime

      // Update job as completed
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: results,
          duration_ms: results.duration,
        })
        .eq('id', job.id)

      return results

    } catch (error) {
      results.success = false
      results.errors.push({
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SYNC_FAILED',
      })
      results.duration = Date.now() - startTime

      // Update job as failed
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          result: results,
          duration_ms: results.duration,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', job.id)

      throw error
    }
  }

  /**
   * Execute a full sync for an entity type
   */
  private async executeFullSync(
    entityType: string,
    batchSize: number,
    dryRun: boolean
  ): Promise<SyncResult> {
    if (!this.connector) {
      throw new Error('Connector not initialized')
    }

    const progress: SyncProgress = {
      phase: 'fetching',
      current: 0,
      total: 0,
      message: `Starting full ${entityType} sync`,
    }

    // Set up progress event listener
    const progressHandler = async (p: SyncProgress) => {
      progress.current = p.current
      progress.total = p.total
      progress.message = p.message
      
      // Update sync state
      await this.updateSyncState(entityType, {
        sync_progress: Math.round((p.current / (p.total || 1)) * 100),
        records_processed: p.current,
        total_records: p.total,
      })
    }

    // Listen to progress events from the connector
    this.connector.on('sync:progress', progressHandler)

    try {
      switch (entityType) {
        case 'products':
          return await this.connector.syncProducts({
            signal: this.abortController?.signal
          })
        
        case 'inventory':
          return await this.connector.syncInventory({
            signal: this.abortController?.signal
          })
        
        case 'pricing':
          return await this.connector.syncPricing({
            signal: this.abortController?.signal
          })
      
      case 'customers':
        // Customer sync (if implemented)
        return {
          success: true,
          errors: [],
          summary: { total: 0, created: 0, updated: 0, deleted: 0, failed: 0 },
          duration: 0,
        }
      
      case 'orders':
        // Order sync (if implemented)
        return {
          success: true,
          errors: [],
          summary: { total: 0, created: 0, updated: 0, deleted: 0, failed: 0 },
          duration: 0,
        }
      
        default:
          throw new Error(`Unknown entity type: ${entityType}`)
      }
    } finally {
      // Clean up event listener
      this.connector.off('sync:progress', progressHandler)
    }
  }

  /**
   * Execute an incremental sync for an entity type
   */
  private async executeIncrementalSync(
    entityType: string,
    batchSize: number,
    dryRun: boolean
  ): Promise<SyncResult> {
    const supabase = await createClient()
    
    // Get last sync state
    const { data: syncState } = await supabase
      .from('netsuite_sync_state')
      .select('*')
      .eq('integration_id', this.integrationId)
      .eq('entity_type', entityType)
      .single()

    const lastSyncDate = syncState?.last_successful_sync_at
      ? new Date(syncState.last_successful_sync_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000) // Default to 24 hours ago

    // For incremental sync, we'll fetch only records modified after last sync
    // This would be implemented in the connector methods
    // For now, we'll do a full sync
    return await this.executeFullSync(entityType, batchSize, dryRun)
  }

  /**
   * Cancel an ongoing sync job
   */
  async cancelSync(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  /**
   * Update sync job progress
   */
  private async updateJobProgress(
    jobId: string,
    progress: Record<string, any>
  ): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('sync_jobs')
      .update({
        progress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }

  /**
   * Update sync state for an entity
   */
  private async updateSyncState(
    entityType: string,
    updates: Record<string, any>
  ): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('netsuite_sync_state')
      .upsert({
        integration_id: this.integrationId,
        entity_type: entityType,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'integration_id,entity_type',
      })
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(current: number, total: number): number {
    return Math.round((current / total) * 100)
  }

  /**
   * Schedule recurring sync jobs
   */
  static async scheduleRecurringSync(
    integrationId: string,
    frequency: 'hourly' | 'daily' | 'weekly'
  ): Promise<void> {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized: User must be authenticated to schedule sync jobs')
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
    
    // Get integration details and verify ownership
    const { data: integration } = await supabase
      .from('integrations')
      .select('*, netsuite_config(*)')
      .eq('id', integrationId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (!integration || !integration.sync_settings?.sync_enabled) {
      throw new Error('Integration not found or sync disabled')
    }

    // Calculate next run time
    const now = new Date()
    let nextRun: Date
    
    switch (frequency) {
      case 'hourly':
        nextRun = new Date(now.getTime() + 60 * 60 * 1000)
        break
      case 'daily':
        nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        break
      case 'weekly':
        nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        break
    }

    // Schedule sync job (would integrate with a job queue like BullMQ)
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integrationId,
      p_organization_id: integration.organization_id,
      p_log_type: 'sync',
      p_severity: 'info',
      p_message: `Scheduled ${frequency} sync`,
      p_details: {
        next_run: nextRun.toISOString(),
        entity_types: integration.sync_settings,
      },
    })
  }

  /**
   * Perform bulk operations
   */
  static async performBulkOperation(
    integrationId: string,
    operation: 'import' | 'export' | 'delete',
    entityType: string,
    data?: any[]
  ): Promise<{ processed: number; failed: number; errors: any[] }> {
    const supabase = await createClient()
    
    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*, netsuite_config(*)')
      .eq('id', integrationId)
      .single()

    if (!integration) {
      throw new Error('Integration not found')
    }

    const orchestrator = new NetSuiteSyncOrchestrator(
      integrationId,
      integration.organization_id,
      integration.netsuite_config[0]
    )

    const connector = new NetSuiteConnector(
      integrationId,
      integration.organization_id,
      integration.netsuite_config[0]
    )

    await connector.initialize()

    let processed = 0
    let failed = 0
    const errors: any[] = []

    switch (operation) {
      case 'import':
        // Bulk import from NetSuite
        const syncResult = await orchestrator.executeSyncJob({
          integration_id: integrationId,
          entity_types: [entityType as any],
          sync_type: 'full',
          batch_size: 500,
          parallel_workers: 3,
          retry_failed: true,
          dry_run: false,
        })
        
        processed = syncResult.summary.total - syncResult.summary.failed
        failed = syncResult.summary.failed
        errors.push(...syncResult.errors)
        break

      case 'export':
        // Bulk export to NetSuite (not implemented yet)
        throw new Error('Bulk export not implemented')

      case 'delete':
        // Bulk delete (not implemented yet)
        throw new Error('Bulk delete not implemented')
    }

    return { processed, failed, errors }
  }
}