// PRP-012: Base Connector Class for Integration Framework
import { EventEmitter } from 'events'
import {
  IntegrationError,
  RateLimitError,
  type Integration,
  type SyncResult,
  type IntegrationPlatformType,
  type LogSeverityEnum,
  type CredentialData,
} from '@/types/integration.types'

// Logger interface
export interface Logger {
  debug(message: string, data?: any): void
  info(message: string, data?: any): void
  warn(message: string, data?: any): void
  error(message: string, data?: any): void
}

// Rate limiter interface
export interface RateLimiter {
  acquire(weight?: number): Promise<void>
  release(weight?: number): void
  isRateLimited(): boolean
  getRemainingRequests(): number
  getResetTime(): Date
}

// Sync options
export interface SyncOptions {
  cursor?: string
  limit?: number
  filters?: Record<string, any>
  force?: boolean
  dryRun?: boolean
}

// Connector configuration
export interface ConnectorConfig {
  integrationId: string
  organizationId: string
  credentials: CredentialData
  settings: Record<string, any>
  rateLimiter?: RateLimiter
  logger?: Logger
}

// Connector events
export interface ConnectorEvents {
  'sync:start': (type: string) => void
  'sync:progress': (progress: { current: number; total: number }) => void
  'sync:complete': (result: SyncResult) => void
  'sync:error': (error: IntegrationError) => void
  'retry': (attempt: { attempt: number; error: string }) => void
  'rate-limit': (info: { retryAfter: number }) => void
  'error': (error: IntegrationError) => void
}

// Logger adapter that delegates to an injected logger implementation
export class LoggerAdapter implements Logger {
  constructor(
    private integrationId: string,
    private logger?: Logger
  ) {
    // If no logger provided, use console as fallback
    if (!this.logger) {
      this.logger = {
        debug: (message: string, data?: any) => console.debug(message, data),
        info: (message: string, data?: any) => console.info(message, data),
        warn: (message: string, data?: any) => console.warn(message, data),
        error: (message: string, data?: any) => console.error(message, data),
      }
    }
  }

  debug(message: string, data?: any): void {
    this.logger!.debug(`[${this.integrationId}] ${message}`, {
      integrationId: this.integrationId,
      ...data
    })
  }

  info(message: string, data?: any): void {
    this.logger!.info(`[${this.integrationId}] ${message}`, {
      integrationId: this.integrationId,
      ...data
    })
  }

  warn(message: string, data?: any): void {
    this.logger!.warn(`[${this.integrationId}] ${message}`, {
      integrationId: this.integrationId,
      ...data
    })
  }

  error(message: string, data?: any): void {
    this.logger!.error(`[${this.integrationId}] ${message}`, {
      integrationId: this.integrationId,
      ...data
    })
  }
}

// Factory function to create production loggers (Winston, Pino, etc.)
export type LoggerFactory = (integrationId: string) => Logger

// Default logger implementation using console (for backward compatibility)
export class DefaultLogger extends LoggerAdapter {
  constructor(integrationId: string) {
    super(integrationId)
  }
}

/**
 * Example usage with Winston:
 * 
 * import winston from 'winston'
 * 
 * const winstonLogger = winston.createLogger({
 *   level: 'info',
 *   format: winston.format.json(),
 *   transports: [
 *     new winston.transports.File({ filename: 'error.log', level: 'error' }),
 *     new winston.transports.File({ filename: 'combined.log' })
 *   ]
 * })
 * 
 * const config: ConnectorConfig = {
 *   integrationId: 'int_123',
 *   organizationId: 'org_456',
 *   credentials: { ... },
 *   settings: { ... },
 *   logger: new LoggerAdapter('int_123', winstonLogger)
 * }
 * 
 * Example usage with Pino:
 * 
 * import pino from 'pino'
 * 
 * const pinoLogger = pino({
 *   level: 'info',
 *   transport: {
 *     target: 'pino-pretty'
 *   }
 * })
 * 
 * const config: ConnectorConfig = {
 *   integrationId: 'int_123',
 *   organizationId: 'org_456',
 *   credentials: { ... },
 *   settings: { ... },
 *   logger: new LoggerAdapter('int_123', pinoLogger)
 * }
 */

// Default rate limiter implementation
export class DefaultRateLimiter implements RateLimiter {
  private requests = 0
  private maxRequests = 100
  private windowStart = Date.now()
  private windowMs = 60000 // 1 minute

  async acquire(weight: number = 1): Promise<void> {
    const now = Date.now()
    if (now - this.windowStart > this.windowMs) {
      this.requests = 0
      this.windowStart = now
    }

    if (this.requests + weight > this.maxRequests) {
      const retryAfter = this.windowMs - (now - this.windowStart)
      throw new RateLimitError(
        'Rate limit exceeded',
        Math.ceil(retryAfter / 1000)
      )
    }

    this.requests += weight
  }

  release(weight: number = 1): void {
    this.requests = Math.max(0, this.requests - weight)
  }

  isRateLimited(): boolean {
    return this.requests >= this.maxRequests
  }

  getRemainingRequests(): number {
    return Math.max(0, this.maxRequests - this.requests)
  }

  getResetTime(): Date {
    return new Date(this.windowStart + this.windowMs)
  }
}

// Abstract base connector class
export abstract class BaseConnector extends EventEmitter {
  protected config: ConnectorConfig
  protected logger: Logger
  protected rateLimiter: RateLimiter
  private authenticated = false

  constructor(config: ConnectorConfig) {
    super()
    this.config = config
    this.logger = config.logger || new DefaultLogger(config.integrationId)
    this.rateLimiter = config.rateLimiter || new DefaultRateLimiter()
  }

  // Abstract methods to be implemented by each connector
  abstract get platform(): IntegrationPlatformType
  abstract authenticate(): Promise<void>
  abstract testConnection(): Promise<boolean>
  abstract syncProducts(options?: SyncOptions): Promise<SyncResult>
  abstract syncInventory(options?: SyncOptions): Promise<SyncResult>
  abstract syncPricing(options?: SyncOptions): Promise<SyncResult>
  abstract syncCustomers?(options?: SyncOptions): Promise<SyncResult>
  abstract syncOrders?(options?: SyncOptions): Promise<SyncResult>

  // Common initialization
  async initialize(): Promise<void> {
    this.logger.info('Initializing connector')
    
    if (!this.authenticated) {
      await this.authenticate()
      this.authenticated = true
    }

    const connected = await this.testConnection()
    if (!connected) {
      throw new IntegrationError(
        'Failed to establish connection',
        'CONNECTION_FAILED'
      )
    }

    this.logger.info('Connector initialized successfully')
  }

  // Common sync orchestration
  async sync(
    entityType: 'products' | 'inventory' | 'pricing' | 'customers' | 'orders',
    options?: SyncOptions
  ): Promise<SyncResult> {
    this.emit('sync:start', entityType)
    this.logger.info(`Starting ${entityType} sync`, options)

    try {
      if (!this.authenticated) {
        await this.initialize()
      }

      let result: SyncResult

      switch (entityType) {
        case 'products':
          result = await this.syncProducts(options)
          break
        case 'inventory':
          result = await this.syncInventory(options)
          break
        case 'pricing':
          result = await this.syncPricing(options)
          break
        case 'customers':
          if (!this.syncCustomers) {
            throw new IntegrationError(
              `${entityType} sync not supported for ${this.platform}`,
              'NOT_SUPPORTED'
            )
          }
          result = await this.syncCustomers(options)
          break
        case 'orders':
          if (!this.syncOrders) {
            throw new IntegrationError(
              `${entityType} sync not supported for ${this.platform}`,
              'NOT_SUPPORTED'
            )
          }
          result = await this.syncOrders(options)
          break
        default:
          throw new IntegrationError(
            `Unknown entity type: ${entityType}`,
            'INVALID_ENTITY_TYPE'
          )
      }

      this.emit('sync:complete', result)
      this.logger.info(`${entityType} sync completed`, {
        success: result.success,
        processed: result.items_processed,
        failed: result.items_failed,
      })

      return result
    } catch (error) {
      this.emit('sync:error', error as IntegrationError)
      this.handleError(error, `${entityType} sync`)
      throw error
    }
  }

  // Common retry logic with exponential backoff
  protected async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      retries?: number
      factor?: number
      minTimeout?: number
      maxTimeout?: number
      randomize?: boolean
    } = {}
  ): Promise<T> {
    const {
      retries = 3,
      factor = 2,
      minTimeout = 1000,
      maxTimeout = 60000,
      randomize = true,
    } = options

    let lastError: Error
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === retries) {
          throw error
        }

        // Check if error is retryable
        if (error instanceof IntegrationError && !error.retryable) {
          throw error
        }

        // Calculate delay with exponential backoff
        let delay = Math.min(minTimeout * Math.pow(factor, attempt), maxTimeout)
        
        // Add jitter if randomize is enabled
        if (randomize) {
          delay = delay * (0.5 + Math.random() * 0.5)
        }

        // Special handling for rate limit errors
        if (error instanceof RateLimitError) {
          delay = error.retryAfter * 1000
          this.emit('rate-limit', { retryAfter: error.retryAfter })
        }

        this.logger.warn(
          `Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`,
          { error: lastError.message }
        )
        
        this.emit('retry', {
          attempt: attempt + 1,
          error: lastError.message,
        })

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }

  // Common rate limiting wrapper
  protected async withRateLimit<T>(
    fn: () => Promise<T>,
    weight: number = 1
  ): Promise<T> {
    await this.rateLimiter.acquire(weight)
    try {
      return await fn()
    } finally {
      this.rateLimiter.release(weight)
    }
  }

  // Common error handling
  protected handleError(error: any, context: string): void {
    const standardError = this.standardizeError(error)
    
    this.logger.error(`${context}: ${standardError.message}`, {
      code: standardError.code,
      details: standardError.details,
    })
    
    this.emit('error', standardError)
    throw standardError
  }

  // Standardize errors across platforms
  protected standardizeError(error: any): IntegrationError {
    // Already an IntegrationError
    if (error instanceof IntegrationError) {
      return error
    }

    // HTTP error with response
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || error.message

      // Rate limit error
      if (status === 429) {
        const retryAfter = parseInt(
          error.response.headers?.['retry-after'] || '60'
        )
        return new RateLimitError(message, retryAfter, error.response.data)
      }

      // Authentication error
      if (status === 401 || status === 403) {
        return new IntegrationError(
          message,
          'AUTHENTICATION_FAILED',
          error.response.data,
          false
        )
      }

      // Server error (retryable)
      if (status >= 500) {
        return new IntegrationError(
          message,
          `HTTP_${status}`,
          error.response.data,
          true
        )
      }

      // Client error (not retryable)
      return new IntegrationError(
        message,
        `HTTP_${status}`,
        error.response.data,
        false
      )
    }

    // Network or system error
    if (error.code) {
      const retryable = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(
        error.code
      )
      return new IntegrationError(
        error.message,
        error.code,
        { originalError: error },
        retryable
      )
    }

    // Unknown error
    return new IntegrationError(
      error.message || 'Unknown error',
      'UNKNOWN',
      { originalError: error },
      false
    )
  }

  // Helper to emit progress events
  protected emitProgress(current: number, total: number): void {
    this.emit('sync:progress', { current, total })
  }

  // Get connector metadata
  getMetadata(): {
    platform: IntegrationPlatformType
    integrationId: string
    organizationId: string
    authenticated: boolean
  } {
    return {
      platform: this.platform,
      integrationId: this.config.integrationId,
      organizationId: this.config.organizationId,
      authenticated: this.authenticated,
    }
  }

  // Cleanup resources
  async disconnect(): Promise<void> {
    this.authenticated = false
    this.removeAllListeners()
    this.logger.info('Connector disconnected')
  }
}