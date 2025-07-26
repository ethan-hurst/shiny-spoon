// PRP-016: Data Accuracy Monitor - Auto-Remediation Service
import { createAdminClient } from '@/lib/supabase/admin'
import { Discrepancy, RemediationAction, RemediationLog } from './types'

interface RemediationResult {
  success: boolean
  action: string
  result?: any
  error?: string
}

export class AutoRemediationService {
  private supabase = createAdminClient()
  
  // Safety limits
  private readonly MAX_RETRIES = 3
  private readonly MAX_CHANGES_PER_RUN = 100
  private readonly CHANGE_DELAY_MS = 100 // Throttle to prevent overwhelming systems

  async attemptRemediation(
    discrepancy: Discrepancy
  ): Promise<RemediationResult> {
    try {
      // Determine remediation action based on discrepancy type
      const action = this.determineRemediationAction(discrepancy)
      
      if (!action) {
        return {
          success: false,
          action: 'none',
          error: 'No remediation action available for this discrepancy type',
        }
      }

      // Create remediation log entry
      const { data: logEntry } = await this.supabase
        .from('remediation_log')
        .insert({
          discrepancy_id: discrepancy.id,
          organization_id: discrepancy.organizationId,
          action_type: action.actionType,
          action_config: action.actionConfig,
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (!logEntry) {
        return {
          success: false,
          action: action.actionType,
          error: 'Failed to create remediation log',
        }
      }

      // Execute remediation
      const result = await this.executeRemediation(action, discrepancy)

      // Update log with result
      await this.supabase
        .from('remediation_log')
        .update({
          status: result.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          success: result.success,
          result: result.result,
          error_message: result.error,
        })
        .eq('id', logEntry.id)

      // If successful, update discrepancy status
      if (result.success) {
        await this.supabase
          .from('discrepancies')
          .update({
            status: 'resolved',
            resolution_type: 'auto_fixed',
            resolved_at: new Date().toISOString(),
            metadata: {
              ...discrepancy.metadata,
              auto_remediation_id: logEntry.id,
            }
          })
          .eq('id', discrepancy.id)
      }

      return result
    } catch (error) {
      console.error('Auto-remediation error:', error)
      return {
        success: false,
        action: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private determineRemediationAction(
    discrepancy: Discrepancy
  ): RemediationAction | null {
    // Remediation strategy based on discrepancy type and entity
    const strategies: Record<string, Record<string, RemediationAction>> = {
      stale: {
        inventory: {
          discrepancyId: discrepancy.id,
          actionType: 'sync_retry',
          actionConfig: {
            entityType: 'inventory',
            entityId: discrepancy.entityId,
            forceRefresh: true,
          },
          priority: 'high',
          estimatedImpact: 'Refresh inventory data from source system',
        },
        pricing: {
          discrepancyId: discrepancy.id,
          actionType: 'sync_retry',
          actionConfig: {
            entityType: 'pricing',
            entityId: discrepancy.entityId,
            forceRefresh: true,
          },
          priority: 'medium',
          estimatedImpact: 'Refresh pricing data from source system',
        },
      },
      missing: {
        product: {
          discrepancyId: discrepancy.id,
          actionType: 'sync_retry',
          actionConfig: {
            entityType: 'product',
            entityId: discrepancy.entityId,
            operation: 'create',
          },
          priority: 'high',
          estimatedImpact: 'Push missing product to target system',
        },
      },
      mismatch: {
        inventory: {
          discrepancyId: discrepancy.id,
          actionType: 'value_update',
          actionConfig: {
            entityType: 'inventory',
            entityId: discrepancy.entityId,
            field: discrepancy.fieldName,
            newValue: discrepancy.sourceValue,
          },
          priority: 'medium',
          estimatedImpact: 'Update inventory quantity to match source',
        },
        pricing: {
          discrepancyId: discrepancy.id,
          actionType: 'value_update',
          actionConfig: {
            entityType: 'pricing',
            entityId: discrepancy.entityId,
            field: discrepancy.fieldName,
            newValue: discrepancy.sourceValue,
          },
          priority: 'high',
          estimatedImpact: 'Update price to match source',
        },
      },
    }

    return strategies[discrepancy.discrepancyType]?.[discrepancy.entityType] || null
  }

  private async executeRemediation(
    action: RemediationAction,
    discrepancy: Discrepancy
  ): Promise<RemediationResult> {
    // Add delay to prevent overwhelming systems
    await this.delay(this.CHANGE_DELAY_MS)

    switch (action.actionType) {
      case 'sync_retry':
        return await this.executeSyncRetry(action, discrepancy)
      
      case 'value_update':
        return await this.executeValueUpdate(action, discrepancy)
      
      case 'cache_clear':
        return await this.executeCacheClear(action, discrepancy)
      
      case 'force_refresh':
        return await this.executeForceRefresh(action, discrepancy)
      
      default:
        return {
          success: false,
          action: action.actionType,
          error: `Unknown remediation action: ${action.actionType}`,
        }
    }
  }

  private async executeSyncRetry(
    action: RemediationAction,
    discrepancy: Discrepancy
  ): Promise<RemediationResult> {
    try {
      // Get the integration for this discrepancy
      const integration = await this.getIntegrationForDiscrepancy(discrepancy)
      if (!integration) {
        return {
          success: false,
          action: 'sync_retry',
          error: 'Integration not found',
        }
      }

      // Trigger a sync for this specific entity
      const { data: syncJob } = await this.supabase
        .from('sync_jobs')
        .insert({
          integration_id: integration.id,
          type: 'remediation',
          status: 'pending',
          config: {
            entity_type: action.actionConfig.entityType,
            entity_id: action.actionConfig.entityId,
            force_refresh: action.actionConfig.forceRefresh || false,
            triggered_by: 'auto_remediation',
            discrepancy_id: discrepancy.id,
          },
        })
        .select()
        .single()

      if (!syncJob) {
        return {
          success: false,
          action: 'sync_retry',
          error: 'Failed to create sync job',
        }
      }

      // Wait for sync to complete (with timeout)
      const result = await this.waitForSyncCompletion(syncJob.id, 30000) // 30 second timeout

      return {
        success: result.success,
        action: 'sync_retry',
        result: {
          sync_job_id: syncJob.id,
          sync_status: result.status,
        },
        error: result.error,
      }
    } catch (error) {
      return {
        success: false,
        action: 'sync_retry',
        error: error instanceof Error ? error.message : 'Sync retry failed',
      }
    }
  }

  private async executeValueUpdate(
    action: RemediationAction,
    discrepancy: Discrepancy
  ): Promise<RemediationResult> {
    try {
      const { entityType, entityId, field, newValue } = action.actionConfig

      // Validate the update is safe
      if (!this.isUpdateSafe(entityType, field, newValue)) {
        return {
          success: false,
          action: 'value_update',
          error: 'Update failed safety validation',
        }
      }

      // Get current value for rollback
      const currentValue = await this.getCurrentValue(entityType, entityId, field)

      // Execute the update based on entity type
      let updateResult
      switch (entityType) {
        case 'inventory':
          updateResult = await this.updateInventory(entityId, field, newValue)
          break
        
        case 'pricing':
          updateResult = await this.updatePricing(entityId, field, newValue)
          break
        
        case 'product':
          updateResult = await this.updateProduct(entityId, field, newValue)
          break
        
        default:
          return {
            success: false,
            action: 'value_update',
            error: `Unsupported entity type: ${entityType}`,
          }
      }

      if (!updateResult.success) {
        return {
          success: false,
          action: 'value_update',
          error: updateResult.error,
        }
      }

      // Verify the update was applied
      const verifiedValue = await this.getCurrentValue(entityType, entityId, field)
      const updateVerified = this.valuesMatch(verifiedValue, newValue)

      return {
        success: updateVerified,
        action: 'value_update',
        result: {
          entity_type: entityType,
          entity_id: entityId,
          field: field,
          previous_value: currentValue,
          new_value: newValue,
          verified: updateVerified,
        },
        error: updateVerified ? undefined : 'Update verification failed',
      }
    } catch (error) {
      return {
        success: false,
        action: 'value_update',
        error: error instanceof Error ? error.message : 'Value update failed',
      }
    }
  }

  private async executeCacheClear(
    action: RemediationAction,
    discrepancy: Discrepancy
  ): Promise<RemediationResult> {
    try {
      // Clear relevant caches
      const cacheKeys = this.getCacheKeysForEntity(
        action.actionConfig.entityType,
        action.actionConfig.entityId
      )

      // In a real implementation, this would clear Redis or other cache
      console.log('Clearing cache keys:', cacheKeys)

      // Mark cache as cleared in metadata
      await this.supabase
        .from('discrepancies')
        .update({
          metadata: {
            ...discrepancy.metadata,
            cache_cleared_at: new Date().toISOString(),
            cache_keys_cleared: cacheKeys,
          }
        })
        .eq('id', discrepancy.id)

      return {
        success: true,
        action: 'cache_clear',
        result: {
          keys_cleared: cacheKeys,
          cleared_at: new Date().toISOString(),
        },
      }
    } catch (error) {
      return {
        success: false,
        action: 'cache_clear',
        error: error instanceof Error ? error.message : 'Cache clear failed',
      }
    }
  }

  private async executeForceRefresh(
    action: RemediationAction,
    discrepancy: Discrepancy
  ): Promise<RemediationResult> {
    try {
      // Force refresh is similar to sync_retry but more aggressive
      // It bypasses caches and forces data reload from source
      
      const integration = await this.getIntegrationForDiscrepancy(discrepancy)
      if (!integration) {
        return {
          success: false,
          action: 'force_refresh',
          error: 'Integration not found',
        }
      }

      // Clear all caches first
      await this.executeCacheClear(action, discrepancy)

      // Then trigger sync with force flag
      return await this.executeSyncRetry(
        {
          ...action,
          actionConfig: {
            ...action.actionConfig,
            forceRefresh: true,
            skipCache: true,
          }
        },
        discrepancy
      )
    } catch (error) {
      return {
        success: false,
        action: 'force_refresh',
        error: error instanceof Error ? error.message : 'Force refresh failed',
      }
    }
  }

  // Helper methods
  private async getIntegrationForDiscrepancy(
    discrepancy: Discrepancy
  ): Promise<any> {
    // Get the accuracy check to find the integration
    const { data: check } = await this.supabase
      .from('accuracy_checks')
      .select('integration_id')
      .eq('id', discrepancy.accuracyCheckId)
      .single()

    if (!check?.integration_id) return null

    const { data: integration } = await this.supabase
      .from('integrations')
      .select('*')
      .eq('id', check.integration_id)
      .single()

    return integration
  }

  private async waitForSyncCompletion(
    syncJobId: string,
    timeoutMs: number
  ): Promise<{ success: boolean; status: string; error?: string }> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const { data: job } = await this.supabase
        .from('sync_jobs')
        .select('status, error')
        .eq('id', syncJobId)
        .single()

      if (!job) {
        return { success: false, status: 'not_found', error: 'Sync job not found' }
      }

      if (job.status === 'completed') {
        return { success: true, status: 'completed' }
      }

      if (job.status === 'failed') {
        return { success: false, status: 'failed', error: job.error }
      }

      // Wait before checking again
      await this.delay(1000)
    }

    return { success: false, status: 'timeout', error: 'Sync job timed out' }
  }

  private isUpdateSafe(
    entityType: string,
    field: string,
    newValue: any
  ): boolean {
    // Safety rules for automated updates
    const safetyRules: Record<string, Record<string, (value: any) => boolean>> = {
      inventory: {
        quantity: (val) => typeof val === 'number' && val >= 0 && val < 1000000,
        reserved: (val) => typeof val === 'number' && val >= 0,
      },
      pricing: {
        price: (val) => typeof val === 'number' && val > 0 && val < 1000000,
        cost: (val) => typeof val === 'number' && val >= 0,
      },
      product: {
        name: (val) => typeof val === 'string' && val.length > 0 && val.length < 255,
        description: (val) => typeof val === 'string' && val.length < 5000,
      },
    }

    const rule = safetyRules[entityType]?.[field]
    return rule ? rule(newValue) : false
  }

  private async getCurrentValue(
    entityType: string,
    entityId: string,
    field: string
  ): Promise<any> {
    const { data } = await this.supabase
      .from(entityType)
      .select(field)
      .eq('id', entityId)
      .single()

    return data?.[field]
  }

  private async updateInventory(
    inventoryId: string,
    field: string,
    newValue: any
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('inventory')
      .update({ [field]: newValue })
      .eq('id', inventoryId)

    return { success: !error, error: error?.message }
  }

  private async updatePricing(
    pricingId: string,
    field: string,
    newValue: any
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('pricing_rules')
      .update({ [field]: newValue })
      .eq('id', pricingId)

    return { success: !error, error: error?.message }
  }

  private async updateProduct(
    productId: string,
    field: string,
    newValue: any
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('products')
      .update({ [field]: newValue })
      .eq('id', productId)

    return { success: !error, error: error?.message }
  }

  private valuesMatch(val1: any, val2: any): boolean {
    // Handle number comparison with epsilon
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      return Math.abs(val1 - val2) < 0.01
    }

    // Handle other types
    return val1 === val2
  }

  private getCacheKeysForEntity(
    entityType: string,
    entityId: string
  ): string[] {
    // Generate cache keys that would need to be cleared
    return [
      `${entityType}:${entityId}`,
      `${entityType}:list:*`,
      `accuracy:${entityType}:*`,
    ]
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Batch remediation for multiple discrepancies
  async batchRemediate(
    discrepancyIds: string[]
  ): Promise<{ total: number; success: number; failed: number }> {
    let successCount = 0
    let failedCount = 0

    // Limit batch size for safety
    const batchSize = Math.min(discrepancyIds.length, this.MAX_CHANGES_PER_RUN)

    for (let i = 0; i < batchSize; i++) {
      const { data: discrepancy } = await this.supabase
        .from('discrepancies')
        .select('*')
        .eq('id', discrepancyIds[i])
        .single()

      if (!discrepancy) {
        failedCount++
        continue
      }

      const result = await this.attemptRemediation(discrepancy)
      
      if (result.success) {
        successCount++
      } else {
        failedCount++
      }
    }

    return {
      total: batchSize,
      success: successCount,
      failed: failedCount,
    }
  }
}