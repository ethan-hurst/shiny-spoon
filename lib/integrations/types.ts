// PRP-012: Integration Framework Common Types
import type {
  IntegrationError,
  IntegrationPlatformType,
  SyncOptions,
  SyncResult,
} from '@/types/integration.types'

// Field mapping types
export interface FieldMapping {
  source: string
  target: string
  transform?: (value: any) => any
  required?: boolean
  defaultValue?: any
}

export interface EntityMapping {
  entityType: 'products' | 'inventory' | 'pricing' | 'customers' | 'orders'
  fields: FieldMapping[]
  customTransform?: (data: any) => any
}

// Pagination types
export interface PaginationOptions {
  limit: number
  offset?: number
  cursor?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  nextCursor?: string
  total?: number
}

// Batch processing types
export interface BatchOptions {
  size: number
  parallel?: boolean
  maxConcurrent?: number
  onBatchComplete?: (batch: any[], results: any[]) => void
  onBatchError?: (batch: any[], error: Error) => void
}

export interface BatchResult<T> {
  successful: T[]
  failed: Array<{
    item: any
    error: Error
  }>
  skipped: any[]
}

// Data validation types
export interface ValidationRule {
  field: string
  type: 'required' | 'type' | 'format' | 'range' | 'custom'
  value?: any
  message?: string
  validator?: (value: any) => boolean
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{
    field: string
    message: string
    value?: any
  }>
}

// Transform pipeline types
export type TransformFunction<TInput = any, TOutput = any> = (
  data: TInput
) => TOutput | Promise<TOutput>

export interface TransformPipeline<TInput = any, TOutput = any> {
  name: string
  transforms: TransformFunction[]
  errorHandler?: (error: Error, data: TInput) => TOutput | null
}

// Webhook types
export interface WebhookPayload {
  id: string
  timestamp: string
  event: string
  data: any
  platform: IntegrationPlatformType
}

export interface WebhookHandler {
  event: string
  handler: (payload: WebhookPayload) => Promise<void>
  validator?: (payload: any) => boolean
}

// Cache types
export interface CacheOptions {
  ttl?: number // Time to live in seconds
  key?: string | ((params: any) => string)
  invalidateOn?: string[] // Event names that invalidate cache
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  key: string
}

// Metrics types
export interface SyncMetrics {
  startTime: Date
  endTime?: Date
  duration?: number
  itemsProcessed: number
  itemsFailed: number
  itemsSkipped: number
  errors: Error[]
  memoryUsage?: {
    before: number
    after: number
    peak: number
  }
  apiCalls?: {
    total: number
    successful: number
    failed: number
    rateLimited: number
  }
}

// Connection types
export interface ConnectionOptions {
  timeout?: number
  retryOnConnectionError?: boolean
  keepAlive?: boolean
  proxy?: {
    host: string
    port: number
    auth?: {
      username: string
      password: string
    }
  }
}

export interface ConnectionStatus {
  connected: boolean
  lastConnectedAt?: Date
  lastError?: Error
  retryCount: number
  nextRetryAt?: Date
}

// Event types for connectors
export interface ConnectorEventMap {
  connect: () => void
  disconnect: (reason?: string) => void
  error: (error: IntegrationError) => void
  'sync:start': (entityType: string, options?: SyncOptions) => void
  'sync:progress': (progress: {
    current: number
    total: number
    percentage: number
  }) => void
  'sync:complete': (result: SyncResult) => void
  'sync:error': (error: IntegrationError) => void
  'rate-limit': (info: { retryAfter: number; limit: number }) => void
  retry: (info: { attempt: number; maxAttempts: number; delay: number }) => void
  'cache:hit': (key: string) => void
  'cache:miss': (key: string) => void
  'transform:error': (error: Error, data: any) => void
  'validation:error': (errors: ValidationResult) => void
}

// Connector lifecycle hooks
export interface ConnectorLifecycle {
  beforeConnect?: () => Promise<void> | void
  afterConnect?: () => Promise<void> | void
  beforeSync?: (
    entityType: string,
    options?: SyncOptions
  ) => Promise<void> | void
  afterSync?: (entityType: string, result: SyncResult) => Promise<void> | void
  beforeDisconnect?: () => Promise<void> | void
  afterDisconnect?: () => Promise<void> | void
  onError?: (error: IntegrationError) => Promise<void> | void
}

// Platform-specific connector interfaces
export interface NetSuiteConnectorOptions {
  accountId: string
  consumerKey: string
  consumerSecret: string
  tokenId: string
  tokenSecret: string
  restUrl?: string
  soapUrl?: string
  suiteqlUrl?: string
  sandbox?: boolean
}

export interface ShopifyConnectorOptions {
  shopDomain: string
  accessToken: string
  apiVersion: string
  webhookApiVersion?: string
  privateApp?: boolean
}

export interface QuickBooksConnectorOptions {
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  companyId: string
  sandbox?: boolean
  minorVersion?: string
}

// Data transformation utilities
export const commonTransforms = {
  // Convert empty strings to null
  emptyToNull: (value: any) => (value === '' ? null : value),

  // Parse number safely
  toNumber: (value: any) => {
    const num = parseFloat(value)
    return isNaN(num) ? null : num
  },

  // Parse boolean
  toBoolean: (value: any) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
    }
    return !!value
  },

  // Parse date to Date object
  toDate: (value: any) => {
    if (!value) return null
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
  },

  // Parse date to ISO string
  toISOString: (value: any) => {
    if (!value) return null
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date.toISOString()
  },

  // Trim whitespace
  trim: (value: any) => {
    return typeof value === 'string' ? value.trim() : value
  },

  // Convert to uppercase
  toUpperCase: (value: any) => {
    return typeof value === 'string' ? value.toUpperCase() : value
  },

  // Convert to lowercase
  toLowerCase: (value: any) => {
    return typeof value === 'string' ? value.toLowerCase() : value
  },
}

// Validation utilities
export const commonValidators = {
  required: (value: any) =>
    value !== null && value !== undefined && value !== '',

  email: (value: string) => {
    // More comprehensive email validation regex based on RFC 5322
    // This pattern handles most real-world email formats including:
    // - Local parts with dots, hyphens, underscores
    // - Quoted strings in local part
    // - Multiple subdomain levels
    // - New TLDs of varying lengths
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

    // Additional basic checks
    if (!value || typeof value !== 'string') return false
    if (value.length > 254) return false // Max email length per RFC
    if (value.startsWith('.') || value.endsWith('.')) return false
    if (value.includes('..')) return false

    return emailRegex.test(value)
  },

  url: (value: string) => {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  },

  numeric: (value: any) => !isNaN(parseFloat(value)) && isFinite(value),

  minLength: (min: number) => (value: string) => value.length >= min,

  maxLength: (max: number) => (value: string) => value.length <= max,

  inRange: (min: number, max: number) => (value: number) =>
    value >= min && value <= max,

  pattern: (regex: RegExp) => (value: string) => regex.test(value),
}
