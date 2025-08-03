import { EventEmitter } from 'events'
import { Logger } from '@/lib/logger'
import { RateLimiter } from '@/lib/rate-limit/rate-limiter'
import { CacheManager } from '@/lib/cache/cache-manager'
import {
  ERPConfig,
  Product,
  ProductQuery,
  Inventory,
  InventoryQuery,
  Order,
  OrderQuery,
  Customer,
  CustomerQuery,
  ERPEvent,
  ERPEntity,
  BulkResult,
  ERPType,
  ERPEventType,
} from './types'

export interface ConnectorOptions {
  logger?: Logger
  rateLimiter?: RateLimiter
  cache?: CacheManager
  retryOptions?: {
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
}

export abstract class BaseERPConnector<TConfig extends ERPConfig = ERPConfig> extends EventEmitter {
  protected config: TConfig
  protected logger: Logger
  protected rateLimiter: RateLimiter
  protected cache: CacheManager
  protected isConnected: boolean = false
  protected retryOptions: Required<ConnectorOptions['retryOptions']>

  constructor(config: TConfig, options: ConnectorOptions = {}) {
    super()
    
    this.config = config
    this.logger = options.logger || new Logger(`ERP:${config.type}`)
    this.rateLimiter = options.rateLimiter || new RateLimiter({
      maxRequests: config.rateLimitPerMinute || 60,
      windowMs: 60 * 1000,
    })
    this.cache = options.cache || new CacheManager({
      ttl: 5 * 60 * 1000, // 5 minutes default
      prefix: `erp:${config.type.toLowerCase()}:`,
    })
    this.retryOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      ...options.retryOptions,
    }
  }

  // Abstract methods that must be implemented by each connector
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract testConnection(): Promise<boolean>
  
  // Standard ERP operations
  abstract getProducts(params: ProductQuery): Promise<Product[]>
  abstract upsertProduct(product: Product): Promise<Product>
  abstract deleteProduct(productId: string): Promise<void>
  
  abstract getInventory(params: InventoryQuery): Promise<Inventory[]>
  abstract updateInventory(updates: Inventory[]): Promise<void>
  
  abstract getOrders(params: OrderQuery): Promise<Order[]>
  abstract createOrder(order: Order): Promise<Order>
  abstract updateOrder(orderId: string, updates: Partial<Order>): Promise<Order>
  abstract cancelOrder(orderId: string, reason?: string): Promise<void>
  
  abstract getCustomers(params: CustomerQuery): Promise<Customer[]>
  abstract upsertCustomer(customer: Customer): Promise<Customer>
  abstract deleteCustomer(customerId: string): Promise<void>
  
  // Webhook/event support
  abstract subscribeToEvents(events: ERPEventType[]): Promise<void>
  abstract unsubscribeFromEvents(events: ERPEventType[]): Promise<void>
  abstract handleWebhook(payload: any): Promise<void>
  
  // Batch operations
  abstract bulkSync(entity: ERPEntity, data: any[]): Promise<BulkResult>

  // Common methods with base implementation
  async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect()
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null
    let delay = this.retryOptions.retryDelay

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        // Apply rate limiting
        await this.rateLimiter.checkLimit()
        
        // Execute operation
        const result = await operation()
        
        // Log success on retry
        if (attempt > 0) {
          this.logger.info(`Operation ${operationName} succeeded on attempt ${attempt + 1}`)
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on specific errors
        if (this.isNonRetryableError(error)) {
          throw error
        }
        
        // Log retry attempt
        if (attempt < this.retryOptions.maxRetries) {
          this.logger.warn(
            `Operation ${operationName} failed on attempt ${attempt + 1}, retrying in ${delay}ms`,
            { error: error instanceof Error ? error.message : error }
          )
          
          // Wait before retry
          await this.sleep(delay)
          delay *= this.retryOptions.backoffMultiplier
        }
      }
    }

    // All retries exhausted
    this.logger.error(`Operation ${operationName} failed after ${this.retryOptions.maxRetries + 1} attempts`)
    throw lastError
  }

  protected async getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.cache.get<T>(key)
    if (cached !== null) {
      this.logger.debug(`Cache hit for key: ${key}`)
      return cached
    }

    // Fetch and cache
    this.logger.debug(`Cache miss for key: ${key}, fetching...`)
    const data = await fetcher()
    await this.cache.set(key, data, ttl)
    
    return data
  }

  protected async invalidateCache(pattern: string): Promise<void> {
    await this.cache.delete(pattern)
    this.logger.debug(`Cache invalidated for pattern: ${pattern}`)
  }

  protected emitEvent(event: ERPEvent): void {
    this.emit('erp-event', event)
    this.emit(event.type, event)
  }

  protected isNonRetryableError(error: any): boolean {
    // Authentication errors
    if (error.code === 401 || error.code === 403) {
      return true
    }
    
    // Bad request errors
    if (error.code === 400) {
      return true
    }
    
    // Custom non-retryable errors
    if (error.retryable === false) {
      return true
    }
    
    return false
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  protected buildCacheKey(...parts: any[]): string {
    return parts
      .map(part => {
        if (typeof part === 'object') {
          return JSON.stringify(part)
        }
        return String(part)
      })
      .join(':')
  }

  // Utility methods for common transformations
  protected parseDate(value: any): Date | undefined {
    if (!value) return undefined
    
    const date = new Date(value)
    return isNaN(date.getTime()) ? undefined : date
  }

  protected parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined
    }
    
    const num = Number(value)
    return isNaN(num) ? undefined : num
  }

  protected parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1' || value === 'yes'
    }
    return Boolean(value)
  }

  protected sanitizeString(value: any): string | undefined {
    if (value === null || value === undefined) return undefined
    return String(value).trim() || undefined
  }

  // Batch processing utilities
  protected async processBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await processor(batch)
      results.push(...batchResults)
      
      // Log progress
      const progress = Math.min(i + batchSize, items.length)
      this.logger.info(`Processed ${progress}/${items.length} items`)
    }
    
    return results
  }

  // Health check
  async getHealth(): Promise<{
    connected: boolean
    type: ERPType
    name: string
    lastSync?: Date
    uptime: number
  }> {
    const connected = await this.testConnection().catch(() => false)
    
    return {
      connected,
      type: this.config.type,
      name: this.config.name,
      lastSync: this.config.lastSync,
      uptime: process.uptime(),
    }
  }

  // Metrics collection
  protected recordMetric(metric: string, value: number, tags?: Record<string, string>): void {
    this.emit('metric', {
      metric,
      value,
      tags: {
        erp_type: this.config.type,
        erp_name: this.config.name,
        ...tags,
      },
      timestamp: new Date(),
    })
  }

  // Error handling
  protected handleError(error: any, context: string): Error {
    const err = error instanceof Error ? error : new Error(String(error))
    
    // Add context
    (err as any).context = context
    (err as any).erpType = this.config.type
    (err as any).erpName = this.config.name
    
    // Log error
    this.logger.error(`Error in ${context}`, { error: err })
    
    // Record error metric
    this.recordMetric('erp.error', 1, { operation: context })
    
    return err
  }
}