/**
 * BaseService - Foundation class for all services
 * Provides automatic retry logic, circuit breaker, and monitoring
 */

import { CircuitBreaker } from '@/lib/resilience/circuit-breaker'

export interface ServiceOptions {
  serviceName: string
  maxRetries?: number
  retryDelay?: number
  circuitBreakerEnabled?: boolean
  timeoutMs?: number
  monitoring?: boolean
}

export interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  shouldRetry?: (error: Error) => boolean
}

export interface ServiceContext {
  organizationId: string | null
  userId: string | null
  requestId?: string
  traceId?: string
}

export abstract class BaseService {
  protected serviceName: string
  protected maxRetries: number
  protected retryDelay: number
  protected circuitBreakerEnabled: boolean
  protected timeoutMs: number
  protected monitoring: boolean
  protected circuitBreaker?: CircuitBreaker
  protected context?: ServiceContext

  constructor(options: ServiceOptions) {
    this.serviceName = options.serviceName
    this.maxRetries = options.maxRetries ?? 3
    this.retryDelay = options.retryDelay ?? 1000
    this.circuitBreakerEnabled = options.circuitBreakerEnabled ?? true
    this.timeoutMs = options.timeoutMs ?? 30000
    this.monitoring = options.monitoring ?? true

    if (this.circuitBreakerEnabled) {
      this.circuitBreaker = new CircuitBreaker({
        name: this.serviceName,
        timeout: this.timeoutMs,
        errorThreshold: 50,
        resetTimeout: 30000,
        monitoringPeriod: 60000,
        minimumRequests: 5
      })
    }
  }

  /**
   * Set the service context (organization, user, etc)
   */
  setContext(context: ServiceContext): void {
    this.context = context
  }

  /**
   * Get current context
   */
  getContext(): ServiceContext | undefined {
    return this.context
  }

  /**
   * Execute an operation with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? this.maxRetries
    const retryDelay = options?.retryDelay ?? this.retryDelay
    const shouldRetry = options?.shouldRetry ?? this.isRetryableError
    
    let lastError: Error | undefined
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now()
        
        // Execute with circuit breaker if enabled
        const result = this.circuitBreakerEnabled && this.circuitBreaker
          ? await this.circuitBreaker.execute(() => operation())
          : await operation()
        
        // Record success metrics
        if (this.monitoring) {
          this.recordMetric('operation.success', {
            service: this.serviceName,
            duration: Date.now() - startTime,
            attempt
          })
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        
        // Record failure metrics
        if (this.monitoring) {
          this.recordMetric('operation.failure', {
            service: this.serviceName,
            error: lastError.message,
            attempt
          })
        }
        
        // Check if we should retry
        if (attempt < maxRetries && shouldRetry(lastError)) {
          // Log retry attempt
          console.warn(
            `[${this.serviceName}] Retry attempt ${attempt + 1}/${maxRetries} after error:`,
            lastError.message
          )
          
          // Wait before retrying with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt)
          await this.sleep(delay)
        } else {
          // No more retries, throw the error
          break
        }
      }
    }
    
    // All retries exhausted
    throw this.enrichError(
      lastError || new Error('Operation failed'),
      'MAX_RETRIES_EXCEEDED'
    )
  }

  /**
   * Execute an operation with timeout
   */
  protected async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs ?? this.timeoutMs
    
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeout}ms`)),
          timeout
        )
      )
    ])
  }

  /**
   * Execute an operation with both retry and timeout
   */
  protected async execute<T>(
    operation: () => Promise<T>,
    options?: RetryOptions & { timeoutMs?: number }
  ): Promise<T> {
    return this.withRetry(
      () => this.withTimeout(operation, options?.timeoutMs),
      options
    )
  }

  /**
   * Batch operations for efficiency
   */
  protected async batchExecute<T, R>(
    items: T[],
    operation: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await this.execute(() => operation(batch))
      results.push(...batchResults)
      
      // Log progress
      if (this.monitoring) {
        this.recordMetric('batch.progress', {
          service: this.serviceName,
          processed: results.length,
          total: items.length
        })
      }
    }
    
    return results
  }

  /**
   * Execute operations in parallel with concurrency control
   */
  protected async parallelExecute<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const results: R[] = new Array(items.length)
    const executing: Promise<void>[] = []
    
    for (let i = 0; i < items.length; i++) {
      const promise = (async (index: number) => {
        results[index] = await this.execute(() => operation(items[index]))
      })(i)
      
      executing.push(promise)
      
      if (executing.length >= concurrency) {
        await Promise.race(executing)
        executing.splice(
          executing.findIndex(p => p === promise),
          1
        )
      }
    }
    
    await Promise.all(executing)
    return results
  }

  /**
   * Check if an error is retryable
   */
  protected isRetryableError(error: Error): boolean {
    // Network errors
    if (error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')) {
      return true
    }
    
    // HTTP status codes that are retryable
    const httpError = error as any
    if (httpError.status === 429 || // Too Many Requests
        httpError.status === 502 || // Bad Gateway
        httpError.status === 503 || // Service Unavailable
        httpError.status === 504) { // Gateway Timeout
      return true
    }
    
    // Database errors that might be transient
    if (error.message.includes('deadlock') ||
        error.message.includes('lock timeout') ||
        error.message.includes('connection')) {
      return true
    }
    
    return false
  }

  /**
   * Enrich error with additional context
   */
  protected enrichError(error: Error, code?: string): Error {
    const enrichedError = error as any
    enrichedError.service = this.serviceName
    enrichedError.code = code || 'SERVICE_ERROR'
    enrichedError.context = this.context
    enrichedError.timestamp = new Date().toISOString()
    
    return enrichedError
  }

  /**
   * Record a metric (to be implemented by monitoring system)
   */
  protected recordMetric(name: string, data: Record<string, any>): void {
    if (!this.monitoring) return
    
    // Log for now, integrate with monitoring system later
    console.log(`[METRIC] ${name}:`, {
      ...data,
      timestamp: new Date().toISOString(),
      context: this.context
    })
  }

  /**
   * Log with context
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logData = {
      service: this.serviceName,
      level,
      message,
      data,
      context: this.context,
      timestamp: new Date().toISOString()
    }
    
    switch (level) {
      case 'info':
        console.log('[INFO]', logData)
        break
      case 'warn':
        console.warn('[WARN]', logData)
        break
      case 'error':
        console.error('[ERROR]', logData)
        break
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Validate input data
   */
  protected abstract validateInput<T>(data: unknown): T

  /**
   * Get service health status
   */
  async getHealth(): Promise<{
    service: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    circuitBreaker?: {
      state: string
      stats: any
    }
    checks: Record<string, boolean>
  }> {
    const checks: Record<string, boolean> = {}
    
    // Run health checks (to be implemented by subclasses)
    try {
      checks.basic = await this.runHealthCheck()
    } catch (error) {
      checks.basic = false
    }
    
    return {
      service: this.serviceName,
      status: checks.basic ? 'healthy' : 'unhealthy',
      circuitBreaker: this.circuitBreaker ? {
        state: this.circuitBreaker.getState(),
        stats: this.circuitBreaker.getStats()
      } : undefined,
      checks
    }
  }

  /**
   * Run health check (to be implemented by subclasses)
   */
  protected async runHealthCheck(): Promise<boolean> {
    return true
  }
}