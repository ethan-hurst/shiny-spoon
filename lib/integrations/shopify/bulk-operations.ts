// PRP-014: Shopify Bulk Operations Handler
import { ShopifyApiClient } from './api-client'
import { ShopifyBulkOperation, type SyncResult } from '@/types/shopify.types'
import { createClient } from '@/lib/supabase/server'

export class BulkOperationManager {
  constructor(
    private client: ShopifyApiClient,
    private integrationId: string
  ) {}

  /**
   * Create a bulk operation query
   */
  async createBulkQuery(query: string): Promise<ShopifyBulkOperation> {
    const operation = await this.client.bulkOperation(query)
    
    // Store bulk operation ID for tracking
    await this.saveBulkOperationState(operation.id, operation.status)
    
    return operation
  }

  /**
   * Wait for bulk operation to complete
   */
  async waitForCompletion(
    operationId: string,
    options: {
      checkInterval?: number
      maxWaitTime?: number
      onProgress?: (status: string) => void
    } = {}
  ): Promise<ShopifyBulkOperation> {
    const { 
      checkInterval = 5000, // 5 seconds
      maxWaitTime = 3600000, // 1 hour
      onProgress 
    } = options

    const startTime = Date.now()
    let lastStatus = ''

    while (true) {
      const operation = await this.client.getBulkOperationStatus(operationId)
      
      // Update status if changed
      if (operation.status !== lastStatus) {
        lastStatus = operation.status
        await this.updateBulkOperationState(operationId, operation.status)
        onProgress?.(operation.status)
      }

      // Check if completed
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(operation.status)) {
        return operation
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`Bulk operation timed out after ${maxWaitTime}ms`)
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
  }

  /**
   * Process bulk operation results with streaming (fix-41)
   */
  async processResults<T>(
    url: string,
    processor: (item: T) => Promise<void>
  ): Promise<SyncResult> {
    const startTime = Date.now()
    let totalProcessed = 0
    let totalFailed = 0
    const errors: Error[] = []

    try {
      // Fetch JSONL file with streaming
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch bulk operation results: ${response.statusText}`)
      }

      // Stream processing implementation
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            try {
              const item = JSON.parse(buffer) as T
              await processor(item)
              totalProcessed++
            } catch (error) {
              totalFailed++
              errors.push(error as Error)
            }
          }
          break
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        // Process each complete line
        for (const line of lines) {
          if (!line.trim()) continue
          
          try {
            const item = JSON.parse(line) as T
            await processor(item)
            totalProcessed++

            // Emit progress periodically
            if (totalProcessed % 100 === 0) {
              await this.emitProgress(totalProcessed, totalProcessed + 1000) // Estimate total
          }
        } catch (error) {
          totalFailed++
          errors.push(error as Error)
          console.error('Failed to process bulk operation item:', error)
        }
      }

      const duration = Date.now() - startTime
      return {
        success: totalFailed === 0,
        items_processed: totalProcessed,
        items_failed: totalFailed,
        duration_ms: duration,
        errors: errors.map(e => ({ 
          message: e.message, 
          code: 'BULK_PROCESS_ERROR' 
        }))
      }
    } catch (error) {
      throw new Error(`Bulk operation processing failed: ${error}`)
    }
  }

  /**
   * Cancel a running bulk operation
   */
  async cancelOperation(operationId: string): Promise<void> {
    await this.client.cancelBulkOperation(operationId)
    await this.updateBulkOperationState(operationId, 'CANCELLED')
  }

  /**
   * Handle bulk operation webhook
   */
  async handleBulkOperationWebhook(payload: {
    admin_graphql_api_id: string
    status: string
    url?: string
    error_code?: string
    completed_at?: string
  }): Promise<void> {
    const operationId = payload.admin_graphql_api_id
    
    // Update operation state
    await this.updateBulkOperationState(
      operationId, 
      payload.status,
      payload.url,
      payload.error_code
    )

    // Log completion
    const supabase = await createClient()
    await supabase.rpc('log_shopify_sync_activity', {
      p_integration_id: this.integrationId,
      p_entity_type: 'bulk_operation',
      p_action: payload.status === 'COMPLETED' ? 'completed' : 'failed',
      p_details: {
        operation_id: operationId,
        status: payload.status,
        error_code: payload.error_code,
        completed_at: payload.completed_at
      }
    })
  }

  /**
   * Create bulk mutation for updating products
   */
  createBulkProductUpdate(products: Array<{
    id: string
    title?: string
    descriptionHtml?: string
    vendor?: string
    productType?: string
    tags?: string[]
    status?: 'ACTIVE' | 'ARCHIVED' | 'DRAFT'
  }>): { mutation: string; variables: Record<string, any> } {
    const mutations = products.map((product, index) => `
      product${index}: productUpdate(
        input: $input${index}
      ) {
        product {
          id
        }
        userErrors {
          field
          message
        }
      }
    `).join('\n')

    const variables: Record<string, any> = {}
    
    products.forEach((product, index) => {
      const input: Record<string, unknown> = { id: product.id }
      
      if (product.title !== undefined) input.title = product.title
      if (product.descriptionHtml !== undefined) input.descriptionHtml = product.descriptionHtml
      if (product.vendor !== undefined) input.vendor = product.vendor
      if (product.productType !== undefined) input.productType = product.productType
      if (product.tags !== undefined) input.tags = product.tags
      if (product.status !== undefined) input.status = product.status
      
      variables[`input${index}`] = input
    })

    const variableDeclarations = products.map((_, index) => 
      `$input${index}: ProductInput!`
    ).join(', ')

    return {
      mutation: `mutation BulkProductUpdate(${variableDeclarations}) { ${mutations} }`,
      variables
    }
  }

  /**
   * Create bulk mutation for inventory adjustments
   */
  createBulkInventoryAdjust(adjustments: Array<{
    inventoryItemId: string
    locationId: string
    available: number
  }>): string {
    const mutations = adjustments.map((adj, index) => `
      adjust${index}: inventoryAdjustQuantity(
        input: {
          inventoryLevelId: "gid://shopify/InventoryLevel/${adj.inventoryItemId}?inventory_item_id=${adj.inventoryItemId}&location_id=${adj.locationId}"
          availableDelta: ${adj.available}
        }
      ) {
        inventoryLevel {
          id
          available
        }
        userErrors {
          field
          message
        }
      }
    `).join('\n')

    return `mutation { ${mutations} }`
  }

  /**
   * Resume interrupted bulk operation
   */
  async resumeOperation(operationId: string): Promise<ShopifyBulkOperation> {
    // Check current status
    const operation = await this.client.getBulkOperationStatus(operationId)
    
    if (operation.status === 'RUNNING') {
      // Already running, just wait for completion
      return await this.waitForCompletion(operationId)
    }
    
    if (operation.status === 'COMPLETED' && operation.url) {
      // Already completed, return as is
      return operation
    }

    if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(operation.status)) {
      throw new Error(`Cannot resume operation in ${operation.status} state`)
    }

    // For other states, wait for completion
    return await this.waitForCompletion(operationId)
  }

  /**
   * Private helper methods
   */

  private async saveBulkOperationState(
    operationId: string,
    status: string,
    url?: string,
    errorCode?: string
  ): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('shopify_sync_state')
      .upsert({
        integration_id: this.integrationId,
        entity_type: 'bulk_operation',
        bulk_operation_id: operationId,
        last_sync_at: new Date().toISOString(),
        total_synced: 0,
        total_failed: 0,
        last_error: errorCode,
        metadata: { status, url }
      })
  }

  private async updateBulkOperationState(
    operationId: string,
    status: string,
    url?: string,
    errorCode?: string
  ): Promise<void> {
    const supabase = await createClient()
    
    const updates: any = {
      metadata: { status }
    }

    if (url) {
      updates.metadata.url = url
    }

    if (errorCode) {
      updates.last_error = errorCode
    }

    if (status === 'COMPLETED') {
      updates.last_sync_at = new Date().toISOString()
    }

    await supabase
      .from('shopify_sync_state')
      .update(updates)
      .eq('integration_id', this.integrationId)
      .eq('bulk_operation_id', operationId)
  }

  private async emitProgress(current: number, total: number): Promise<void> {
    const supabase = await createClient()
    
    // Log progress
    await supabase.rpc('log_shopify_sync_activity', {
      p_integration_id: this.integrationId,
      p_entity_type: 'bulk_operation',
      p_action: 'progress',
      p_details: {
        current,
        total,
        percentage: Math.round((current / total) * 100)
      }
    })
  }

  /**
   * Estimate bulk operation cost
   */
  estimateBulkOperationCost(query: string): number {
    // Basic estimation based on query complexity
    const connectionCount = (query.match(/first:\s*\d+/g) || []).length
    const fieldCount = (query.match(/{[^}]+}/g) || []).length
    
    // Bulk operations have a base cost of 10
    return 10 + connectionCount * 2 + Math.ceil(fieldCount / 10)
  }

  /**
   * Check if bulk operation is needed based on data size
   */
  async shouldUseBulkOperation(entityType: string, estimatedCount: number): Promise<boolean> {
    // Use bulk operations for:
    // - Initial sync (no last sync date)
    // - Large datasets (> 10,000 items)
    // - Full sync requests
    
    if (estimatedCount > 10000) {
      return true
    }

    const supabase = await createClient()
    const { data: syncState } = await supabase
      .from('shopify_sync_state')
      .select('last_sync_at')
      .eq('integration_id', this.integrationId)
      .eq('entity_type', entityType)
      .single()

    return !syncState?.last_sync_at
  }
}