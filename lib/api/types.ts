/**
 * Core API Types and Interfaces
 */

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: Record<string, any>
  timestamp?: string
  requestId?: string
}

export enum ApiErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  
  // Authentication Errors (401)
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  
  // Authorization Errors (403)
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Not Found Errors (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server Errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

export interface ApiMeta {
  page?: number
  limit?: number
  total?: number
  hasMore?: boolean
  nextCursor?: string
  prevCursor?: string
}

// Pagination Types
export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
}

export interface SortParams {
  sort?: string
  order?: 'asc' | 'desc'
}

// API Key Types
export interface ApiKey {
  id: string
  key: string
  name: string
  tenantId: string
  scopes: ApiScope[]
  tier: ApiTier
  rateLimit: RateLimit
  ipWhitelist?: string[]
  expiresAt?: Date
  lastUsedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export enum ApiScope {
  // Read Scopes
  READ_PRODUCTS = 'read:products',
  READ_INVENTORY = 'read:inventory',
  READ_ORDERS = 'read:orders',
  READ_WAREHOUSES = 'read:warehouses',
  READ_REPORTS = 'read:reports',
  READ_ANALYTICS = 'read:analytics',
  
  // Write Scopes
  WRITE_PRODUCTS = 'write:products',
  WRITE_INVENTORY = 'write:inventory',
  WRITE_ORDERS = 'write:orders',
  WRITE_WAREHOUSES = 'write:warehouses',
  
  // Admin Scopes
  ADMIN_WEBHOOKS = 'admin:webhooks',
  ADMIN_API_KEYS = 'admin:api_keys',
  ADMIN_ALL = 'admin:all'
}

export enum ApiTier {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export interface RateLimit {
  requests: number
  window: number // in seconds
  concurrent?: number
}

// Webhook Types
export interface WebhookSubscription {
  id: string
  tenantId: string
  url: string
  secret: string
  events: WebhookEventType[]
  active: boolean
  description?: string
  headers?: Record<string, string>
  retryConfig?: WebhookRetryConfig
  createdAt: Date
  updatedAt: Date
}

export enum WebhookEventType {
  // Product Events
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRODUCT_DELETED = 'product.deleted',
  
  // Inventory Events
  INVENTORY_UPDATED = 'inventory.updated',
  INVENTORY_LOW_STOCK = 'inventory.low_stock',
  INVENTORY_OUT_OF_STOCK = 'inventory.out_of_stock',
  INVENTORY_MOVEMENT = 'inventory.movement',
  
  // Order Events
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_FULFILLED = 'order.fulfilled',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_SHIPPED = 'order.shipped',
  
  // Warehouse Events
  WAREHOUSE_CREATED = 'warehouse.created',
  WAREHOUSE_UPDATED = 'warehouse.updated',
  WAREHOUSE_TRANSFER_CREATED = 'warehouse.transfer_created',
  WAREHOUSE_TRANSFER_COMPLETED = 'warehouse.transfer_completed',
  
  // Alert Events
  ALERT_TRIGGERED = 'alert.triggered',
  ALERT_RESOLVED = 'alert.resolved'
}

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  tenantId: string
  data: Record<string, any>
  createdAt: Date
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  eventId: string
  url: string
  status: WebhookDeliveryStatus
  statusCode?: number
  response?: string
  error?: string
  attemptNumber: number
  nextRetryAt?: Date
  createdAt: Date
  completedAt?: Date
}

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export interface WebhookRetryConfig {
  maxAttempts: number
  backoffMultiplier: number
  initialDelay: number // in seconds
  maxDelay: number // in seconds
}

// Request Context
export interface ApiContext {
  tenantId: string
  apiKey: ApiKey
  requestId: string
  ipAddress: string
  userAgent?: string
  scopes: ApiScope[]
}

// Common Query Parameters
export interface ListQueryParams extends PaginationParams, SortParams {
  search?: string
  filters?: Record<string, any>
  fields?: string[] // Field selection
  expand?: string[] // Related data expansion
}

// API Statistics
export interface ApiUsageStats {
  apiKeyId: string
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  timestamp: Date
}

export interface ApiQuotaStatus {
  tier: ApiTier
  limits: {
    requests: {
      used: number
      limit: number
      reset: Date
    }
    storage?: {
      used: number
      limit: number
    }
    webhooks?: {
      used: number
      limit: number
    }
  }
}

// Rate Limit Headers
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
  'X-RateLimit-Retry-After'?: string
}

// OpenAPI Types
export interface OpenApiSpec {
  openapi: string
  info: {
    title: string
    version: string
    description: string
    termsOfService?: string
    contact?: {
      name?: string
      url?: string
      email?: string
    }
    license?: {
      name: string
      url?: string
    }
  }
  servers: Array<{
    url: string
    description?: string
    variables?: Record<string, any>
  }>
  paths: Record<string, any>
  components?: {
    schemas?: Record<string, any>
    securitySchemes?: Record<string, any>
    parameters?: Record<string, any>
    responses?: Record<string, any>
  }
  security?: Array<Record<string, string[]>>
  tags?: Array<{
    name: string
    description?: string
  }>
}

// API Versioning
export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2' // Future version
}

export interface ApiEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  version: ApiVersion
  scopes: ApiScope[]
  rateLimit?: Partial<RateLimit>
  deprecated?: boolean
  deprecationDate?: Date
  alternativeEndpoint?: string
}