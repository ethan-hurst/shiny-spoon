import { EventEmitter } from 'events'
import { pipeline, Readable, Transform } from 'stream'
import { promisify } from 'util'
import Papa from 'papaparse'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

const pipelineAsync = promisify(pipeline)

export interface BulkOperationConfig {
  operationType: 'import' | 'export' | 'update' | 'delete'
  entityType: 'products' | 'inventory' | 'pricing' | 'customers'
  chunkSize?: number
  maxConcurrent?: number
  validateOnly?: boolean
  rollbackOnError?: boolean
  mapping?: Record<string, string>
}

export interface BulkOperationProgress {
  operationId: string
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'rolled_back'
  totalRecords: number
  processedRecords: number
  successfulRecords: number
  failedRecords: number
  estimatedTimeRemaining?: number
  currentChunk?: number
  totalChunks?: number
}

export class BulkOperationsEngine extends EventEmitter {
  private supabase: ReturnType<typeof createServerClient>
  private activeOperations = new Map<string, AbortController>()

  constructor() {
    super()
    this.supabase = createServerClient()
  }

  async startOperation(
    file: File | Readable,
    config: BulkOperationConfig,
    userId: string
  ): Promise<string> {
    // Get user's organization
    const { data: userProfile } = await this.supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (!userProfile?.organization_id) {
      throw new Error('User organization not found')
    }

    // Create operation record
    const { data: operation, error } = await this.supabase
      .from('bulk_operations')
      .insert({
        organization_id: userProfile.organization_id,
        operation_type: config.operationType,
        entity_type: config.entityType,
        file_name: file instanceof File ? file.name : 'stream',
        file_size_bytes: file instanceof File ? file.size : null,
        status: 'pending',
        config,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error

    // Create abort controller
    const abortController = new AbortController()
    this.activeOperations.set(operation.id, abortController)

    // Start processing in background
    this.processOperation(
      operation.id,
      file,
      config,
      abortController.signal
    ).catch((err) => {
      console.error(`Bulk operation ${operation.id} failed:`, err)
      this.updateOperationStatus(operation.id, 'failed', { 
        error_log: [
          {
            message: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          }
        ]
      })
    })

    return operation.id
  }

  private async processOperation(
    operationId: string,
    file: File | Readable,
    config: BulkOperationConfig,
    signal: AbortSignal
  ): Promise<void> {
    try {
      // Update status to processing
      await this.updateOperationStatus(operationId, 'processing')

      // Get the appropriate processor
      const processor = this.getProcessor(config.entityType)

      // Create streams - only consume once
      let inputStream: Readable
      if (typeof File !== 'undefined' && file instanceof File) {
        // Check Node.js version for Readable.fromWeb support (available from 16.5.0)
        const versionMatch = process.version.match(/^v(\d+)\.(\d+)\.(\d+)/)
        if (!versionMatch) {
          throw new Error(`Unable to parse Node.js version: ${process.version}`)
        }
        
        const major = parseInt(versionMatch[1], 10)
        const minor = parseInt(versionMatch[2], 10)
        const hasReadableFromWeb = major > 16 || (major === 16 && minor >= 5)

        if (hasReadableFromWeb && Readable.fromWeb) {
          inputStream = Readable.fromWeb(file.stream())
        } else {
          // Fallback for older Node.js versions
          const reader = file.stream().getReader()
          inputStream = new Readable({
            async read() {
              try {
                const { done, value } = await reader.read()
                if (done) {
                  this.push(null)
                } else {
                  this.push(value)
                }
              } catch (error) {
                this.destroy(error)
              }
            },
          })
        }
      } else {
        inputStream = file as Readable
      }

      const parseStream = this.createParseStream(config)
      const validateStream = this.createValidateStream(processor.schema)
      const processStream = this.createProcessStream(
        operationId,
        processor,
        config,
        signal
      )

      // Run pipeline
      await pipelineAsync(
        inputStream,
        parseStream,
        validateStream,
        processStream
      )

      // Check if cancelled
      if (signal.aborted) {
        await this.updateOperationStatus(operationId, 'cancelled')
        return
      }

      // Mark as completed
      await this.updateOperationStatus(operationId, 'completed')
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  private createParseStream(config: BulkOperationConfig): Transform {
    let buffer = ''
    let headers: string[] | null = null
    let rowIndex = 0

    return new Transform({
      objectMode: true,
      transform(chunk: any, encoding: string, callback: Function) {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!headers) {
            headers = Papa.parse(line).data[0] as string[]
            continue
          }

          const row = Papa.parse(line).data[0]
          if (row && row.length > 0) {
            const data: Record<string, any> = {}
            headers.forEach((header, index) => {
              const mappedHeader = config.mapping?.[header] || header
              data[mappedHeader] = row[index]
            })

            this.push({ index: rowIndex++, data })
          }
        }

        callback()
      },
      flush(callback: Function) {
        if (buffer && headers) {
          const row = Papa.parse(buffer).data[0]
          if (row && row.length > 0) {
            const data: Record<string, any> = {}
            headers.forEach((header, index) => {
              const mappedHeader = config.mapping?.[header] || header
              data[mappedHeader] = row[index]
            })

            this.push({ index: rowIndex++, data })
          }
        }
        callback()
      },
    })
  }

  private createValidateStream(schema: z.ZodSchema): Transform {
    return new Transform({
      objectMode: true,
      transform(
        record: { index: number; data: any },
        encoding: string,
        callback: Function
      ) {
        try {
          const validated = schema.parse(record.data)
          this.push({ ...record, data: validated, valid: true })
        } catch (error) {
          if (error instanceof z.ZodError) {
            this.push({
              ...record,
              valid: false,
              errors: error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            })
          } else {
            this.push({
              ...record,
              valid: false,
              errors: [{ message: 'Unknown validation error' }],
            })
          }
        }
        callback()
      },
    })
  }

  private createProcessStream(
    operationId: string,
    processor: EntityProcessor,
    config: BulkOperationConfig,
    signal: AbortSignal
  ): Transform {
    // Validate and sanitize chunkSize
    let chunkSize = config.chunkSize || 100
    if (chunkSize < 1) {
      console.warn(`Invalid chunkSize ${chunkSize}, using minimum of 1`)
      chunkSize = 1
    } else if (chunkSize > 1000) {
      console.warn(`chunkSize ${chunkSize} exceeds maximum, capping at 1000`)
      chunkSize = 1000
    }
    
    let chunk: any[] = []
    let totalProcessed = 0
    let totalSuccess = 0
    let totalFailed = 0
    let totalRecords = 0 // Count records dynamically
    const startTime = Date.now()

    const processChunk = async () => {
      if (chunk.length === 0) return

      const chunkToProcess = [...chunk]
      chunk = []

      // Check if cancelled
      if (signal.aborted) return

      // Process records
      const results = await Promise.allSettled(
        chunkToProcess.map((record) =>
          processor.process(record, config, this.supabase)
        )
      )

      // Record results
      const recordsToInsert = chunkToProcess.map((record, index) => {
        const result = results[index]
        const success = result.status === 'fulfilled'

        return {
          operation_id: operationId,
          record_index: record.index,
          entity_id: success ? result.value?.id : null,
          action:
            config.operationType === 'import' ? 'create' : config.operationType,
          before_data: record.before,
          after_data: success ? result.value : record.data,
          status: success ? 'completed' : 'failed',
          error: result.status === 'rejected' ? result.reason?.message : null,
        }
      })

      await this.supabase.from('bulk_operation_records').insert(recordsToInsert)

      // Update progress
      totalProcessed += chunkToProcess.length
      totalSuccess += results.filter((r) => r.status === 'fulfilled').length
      totalFailed += results.filter((r) => r.status === 'rejected').length

      const progress: BulkOperationProgress = {
        operationId,
        status: 'processing',
        totalRecords,
        processedRecords: totalProcessed,
        successfulRecords: totalSuccess,
        failedRecords: totalFailed,
        estimatedTimeRemaining: this.estimateTimeRemaining(
          totalProcessed,
          totalRecords,
          startTime
        ),
      }

      // Emit progress
      this.emit('progress', progress)

      // Update database
      await this.supabase
        .from('bulk_operations')
        .update({
          processed_records: totalProcessed,
          successful_records: totalSuccess,
          failed_records: totalFailed,
          estimated_completion: new Date(
            Date.now() + (progress.estimatedTimeRemaining || 0) * 1000
          ).toISOString(),
        })
        .eq('id', operationId)

      // Check if should rollback
      if (config.rollbackOnError && totalFailed > 0) {
        throw new Error('Operation failed, initiating rollback')
      }
    }

    return new Transform({
      objectMode: true,
      async transform(record: any, encoding: string, callback: Function) {
        // Count all records (valid and invalid)
        totalRecords++

        if (!record.valid && !config.validateOnly) {
          totalFailed++
          await this.supabase.from('bulk_operation_records').insert({
            operation_id: operationId,
            record_index: record.index,
            action:
              config.operationType === 'import'
                ? 'create'
                : config.operationType,
            status: 'failed',
            error: JSON.stringify(record.errors),
          })

          // Update total records count in database
          await this.supabase
            .from('bulk_operations')
            .update({ total_records: totalRecords })
            .eq('id', operationId)
        } else if (!config.validateOnly) {
          chunk.push(record)

          if (chunk.length >= chunkSize) {
            try {
              await processChunk()
            } catch (error) {
              return callback(error)
            }
          }
        }

        callback()
      },
      async flush(callback: Function) {
        try {
          await processChunk()

          // Final update of total records
          await this.supabase
            .from('bulk_operations')
            .update({ total_records: totalRecords })
            .eq('id', operationId)

          callback()
        } catch (error) {
          callback(error)
        }
      },
    })
  }

  async cancelOperation(operationId: string, userId: string): Promise<void> {
    // Cancel the operation
    const controller = this.activeOperations.get(operationId)
    if (controller) {
      controller.abort()
    }

    // Update status using the database function
    const { error } = await this.supabase.rpc('cancel_bulk_operation', {
      operation_uuid: operationId,
      user_uuid: userId,
    })

    if (error) {
      throw new Error(`Failed to cancel operation: ${error.message}`)
    }
  }

  async rollbackOperation(operationId: string): Promise<void> {
    // Update operation status to processing rollback
    await this.updateOperationStatus(operationId, 'processing', {
      results: { rollback_started: new Date().toISOString() },
    })

    try {
      // Get total count of records to rollback
      const { count: totalRecords } = await this.supabase
        .from('bulk_operation_records')
        .select('*', { count: 'exact', head: true })
        .eq('operation_id', operationId)
        .eq('status', 'completed')

      if (!totalRecords || totalRecords === 0) {
        await this.updateOperationStatus(operationId, 'rolled_back')
        return
      }

      // Process rollbacks in batches
      const batchSize = 1000
      const maxConcurrent = 5
      let processedCount = 0
      let successCount = 0
      let failedCount = 0
      const startTime = Date.now()

      // Get processor once
      const processor = this.getProcessor(
        await this.getOperationEntityType(operationId)
      )

      // Use cursor-style processing to avoid offset issues
      while (true) {
        // Always get the first batch of 'completed' records
        const { data: records, error } = await this.supabase
          .from('bulk_operation_records')
          .select('*')
          .eq('operation_id', operationId)
          .eq('status', 'completed')
          .order('record_index', { ascending: false })
          .limit(batchSize)

        if (error) throw error
        if (!records?.length) break // No more records to process

        // Process batch with concurrency control
        const results = await this.processRollbackBatch(
          records,
          processor,
          maxConcurrent
        )

        // Update record statuses in batch
        const recordUpdates = records.map((record, index) => ({
          id: record.id,
          status: results[index].success ? 'rolled_back' : 'failed',
          error: results[index].success ? null : results[index].error,
        }))

        // Update in chunks to avoid large transactions
        const updateChunkSize = 100
        for (let i = 0; i < recordUpdates.length; i += updateChunkSize) {
          const chunk = recordUpdates.slice(i, i + updateChunkSize)
          await Promise.all(
            chunk.map((update) =>
              this.supabase
                .from('bulk_operation_records')
                .update({
                  status: update.status,
                  error: update.error,
                })
                .eq('id', update.id)
            )
          )
        }

        // Update progress counters
        processedCount += records.length
        successCount += results.filter((r) => r.success).length
        failedCount += results.filter((r) => !r.success).length

        // Emit progress
        const progress = {
          operationId,
          type: 'rollback',
          status: 'processing',
          totalRecords,
          processedRecords: processedCount,
          successfulRecords: successCount,
          failedRecords: failedCount,
          estimatedTimeRemaining: this.estimateTimeRemaining(
            processedCount,
            totalRecords,
            startTime
          ),
        }

        this.emit('rollback-progress', progress)

        // Update operation progress in database
        await this.supabase
          .from('bulk_operations')
          .update({
            results: {
              rollback_progress: {
                total: totalRecords,
                processed: processedCount,
                successful: successCount,
                failed: failedCount,
                percentage: Math.round((processedCount / totalRecords) * 100),
              },
            },
          })
          .eq('id', operationId)
      }

      // Final status update
      await this.updateOperationStatus(operationId, 'rolled_back', {
        results: {
          rollback_completed: new Date().toISOString(),
          rollback_summary: {
            total: totalRecords,
            successful: successCount,
            failed: failedCount,
          },
        },
      })
    } catch (error) {
      console.error(`Rollback operation ${operationId} failed:`, error)
      await this.updateOperationStatus(operationId, 'failed', {
        error_log: [
          {
            message:
              error instanceof Error ? error.message : 'Unknown rollback error',
            timestamp: new Date().toISOString(),
          },
        ],
      })
      throw error
    }
  }

  private async processRollbackBatch(
    records: any[],
    processor: EntityProcessor,
    maxConcurrent: number
  ): Promise<Array<{ success: boolean; error?: string }>> {
    const results: Array<{ success: boolean; error?: string }> = []
    const processing = new Set<Promise<void>>()

    for (let i = 0; i < records.length; i++) {
      const record = records[i]

      // Wait if too many concurrent operations
      while (processing.size >= maxConcurrent) {
        await Promise.race(processing)
      }

      // Process rollback
      const promise = processor
        .rollback(record, this.supabase)
        .then(() => {
          results[i] = { success: true }
        })
        .catch((error) => {
          console.error(`Failed to rollback record ${record.id}:`, error)
          results[i] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        })
        .finally(() => {
          processing.delete(promise)
        })

      processing.add(promise)
    }

    // Wait for all processing to complete
    await Promise.all(processing)
    return results
  }

  private async updateOperationStatus(
    operationId: string,
    status: Database['public']['Tables']['bulk_operations']['Row']['status'],
    additionalData?: Record<string, any>
  ): Promise<void> {
    const updateData: any = { status }

    if (status === 'processing') {
      updateData.started_at = new Date().toISOString()
    } else if (
      status === 'completed' ||
      status === 'failed' ||
      status === 'rolled_back'
    ) {
      updateData.completed_at = new Date().toISOString()
    }

    if (additionalData) {
      Object.assign(updateData, additionalData)
    }

    await this.supabase
      .from('bulk_operations')
      .update(updateData)
      .eq('id', operationId)
  }

  private estimateTimeRemaining(
    processed: number,
    total: number,
    startTime: number
  ): number {
    if (processed === 0) return 0

    const elapsed = Date.now() - startTime
    const rate = processed / (elapsed / 1000)
    const remaining = total - processed

    return Math.ceil(remaining / rate)
  }

  private getProcessor(entityType: string): EntityProcessor {
    switch (entityType) {
      case 'inventory':
        return new InventoryProcessor()
      case 'products':
        return new ProductProcessor()
      case 'pricing':
        return new PricingProcessor()
      case 'customers':
        return new CustomerProcessor()
      default:
        throw new Error(`Unknown entity type: ${entityType}`)
    }
  }

  private async getOperationEntityType(operationId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('bulk_operations')
      .select('entity_type')
      .eq('id', operationId)
      .single()

    if (error) throw error
    return data.entity_type
  }
}

// Entity processors
abstract class EntityProcessor {
  abstract schema: z.ZodSchema
  abstract async process(
    record: any,
    config: BulkOperationConfig,
    supabase: ReturnType<typeof createServerClient>
  ): Promise<any>
  abstract async rollback(
    record: any,
    supabase: ReturnType<typeof createServerClient>
  ): Promise<void>
}

class InventoryProcessor extends EntityProcessor {
  schema = z.object({
    sku: z.string().min(1),
    warehouse_code: z.string().min(1),
    quantity: z.number().int().min(0),
    reason: z.string().optional(),
    notes: z.string().optional(),
  })

  async process(record: any, config: BulkOperationConfig, supabase: any) {
    // Implementation for inventory processing
    const { sku, warehouse_code, quantity, reason, notes } = record.data

    // Look up product and warehouse
    const [productResult, warehouseResult] = await Promise.all([
      supabase.from('products').select('id').eq('sku', sku).single(),
      supabase
        .from('warehouses')
        .select('id')
        .eq('code', warehouse_code)
        .single(),
    ])

    if (productResult.error || warehouseResult.error) {
      throw new Error('Product or warehouse not found')
    }

    // Update inventory
    const { data, error } = await supabase
      .from('inventory')
      .update({
        quantity,
        last_bulk_update: new Date().toISOString(),
      })
      .eq('product_id', productResult.data.id)
      .eq('warehouse_id', warehouseResult.data.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async rollback(record: any, supabase: any) {
    if (record.before_data) {
      await supabase
        .from('inventory')
        .update(record.before_data)
        .eq('id', record.entity_id)
    }
  }
}

class ProductProcessor extends EntityProcessor {
  schema = z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    price: z.number().positive().optional(),
  })

  async process(record: any, config: BulkOperationConfig, supabase: any) {
    const { sku, name, description, category, price } = record.data

    if (config.operationType === 'import') {
      const { data, error } = await supabase
        .from('products')
        .upsert({
          sku,
          name,
          description,
          category,
          price,
        })
        .select()
        .single()

      if (error) throw error
      return data
    } else if (config.operationType === 'update') {
      const { data, error } = await supabase
        .from('products')
        .update({ name, description, category, price })
        .eq('sku', sku)
        .select()
        .single()

      if (error) throw error
      return data
    }
  }

  async rollback(record: any, supabase: any) {
    if (record.action === 'create') {
      await supabase.from('products').delete().eq('id', record.entity_id)
    } else if (record.action === 'update' && record.before_data) {
      await supabase
        .from('products')
        .update(record.before_data)
        .eq('id', record.entity_id)
    }
  }
}

class PricingProcessor extends EntityProcessor {
  schema = z.object({
    sku: z.string().min(1),
    price_tier: z.string().min(1),
    price: z.number().positive(),
    min_quantity: z.number().int().min(1).optional(),
  })

  async process(record: any, config: BulkOperationConfig, supabase: any) {
    // Implementation for pricing processing
    const { sku, price_tier, price, min_quantity } = record.data

    // Look up product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .single()

    if (productError) throw new Error('Product not found')

    const { data, error } = await supabase
      .from('product_pricing')
      .upsert({
        product_id: product.id,
        price_tier,
        price,
        min_quantity: min_quantity || 1,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async rollback(record: any, supabase: any) {
    if (record.action === 'create') {
      await supabase.from('product_pricing').delete().eq('id', record.entity_id)
    } else if (record.before_data) {
      await supabase
        .from('product_pricing')
        .update(record.before_data)
        .eq('id', record.entity_id)
    }
  }
}

class CustomerProcessor extends EntityProcessor {
  schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    company: z.string().optional(),
    price_tier: z.string().optional(),
  })

  async process(record: any, config: BulkOperationConfig, supabase: any) {
    const { email, name, company, price_tier } = record.data

    const { data, error } = await supabase
      .from('customers')
      .upsert({
        email,
        name,
        company,
        price_tier: price_tier || 'standard',
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async rollback(record: any, supabase: any) {
    if (record.action === 'create') {
      await supabase.from('customers').delete().eq('id', record.entity_id)
    } else if (record.before_data) {
      await supabase
        .from('customers')
        .update(record.before_data)
        .eq('id', record.entity_id)
    }
  }
}