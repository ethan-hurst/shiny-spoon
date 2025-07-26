// PRP-012: Integration Framework Types
import { z } from 'zod'
import type { Database } from '@/supabase/types/database-extended'

// Database types
export type Integration = Database['public']['Tables']['integrations']['Row']
export type IntegrationInsert = Database['public']['Tables']['integrations']['Insert']
export type IntegrationUpdate = Database['public']['Tables']['integrations']['Update']

export type IntegrationCredential = Database['public']['Tables']['integration_credentials']['Row']
export type IntegrationCredentialInsert = Database['public']['Tables']['integration_credentials']['Insert']
export type IntegrationCredentialUpdate = Database['public']['Tables']['integration_credentials']['Update']

export type WebhookEndpoint = Database['public']['Tables']['webhook_endpoints']['Row']
export type WebhookEndpointInsert = Database['public']['Tables']['webhook_endpoints']['Insert']
export type WebhookEndpointUpdate = Database['public']['Tables']['webhook_endpoints']['Update']

export type IntegrationLog = Database['public']['Tables']['integration_logs']['Row']
export type IntegrationLogInsert = Database['public']['Tables']['integration_logs']['Insert']

export type SyncJob = Database['public']['Tables']['sync_jobs']['Row']
export type SyncJobInsert = Database['public']['Tables']['sync_jobs']['Insert']
export type SyncJobUpdate = Database['public']['Tables']['sync_jobs']['Update']

export type RateLimitBucket = Database['public']['Tables']['rate_limit_buckets']['Row']

// Enums
export const IntegrationPlatform = {
  NETSUITE: 'netsuite',
  SHOPIFY: 'shopify',
  QUICKBOOKS: 'quickbooks',
  SAP: 'sap',
  DYNAMICS365: 'dynamics365',
  CUSTOM: 'custom',
} as const

export type IntegrationPlatformType = typeof IntegrationPlatform[keyof typeof IntegrationPlatform]

export const IntegrationStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
  CONFIGURING: 'configuring',
  SUSPENDED: 'suspended',
} as const

export type IntegrationStatusType = typeof IntegrationStatus[keyof typeof IntegrationStatus]

export const CredentialType = {
  OAUTH2: 'oauth2',
  API_KEY: 'api_key',
  BASIC_AUTH: 'basic_auth',
  CUSTOM: 'custom',
} as const

export type CredentialTypeEnum = typeof CredentialType[keyof typeof CredentialType]

export const LogType = {
  SYNC: 'sync',
  WEBHOOK: 'webhook',
  ERROR: 'error',
  AUTH: 'auth',
  CONFIG: 'config',
} as const

export type LogTypeEnum = typeof LogType[keyof typeof LogType]

export const LogSeverity = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const

export type LogSeverityEnum = typeof LogSeverity[keyof typeof LogSeverity]

export const JobType = {
  FULL_SYNC: 'full_sync',
  INCREMENTAL_SYNC: 'incremental_sync',
  WEBHOOK: 'webhook',
  MANUAL: 'manual',
} as const

export type JobTypeEnum = typeof JobType[keyof typeof JobType]

export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type JobStatusEnum = typeof JobStatus[keyof typeof JobStatus]

// Extended types with relations
export interface IntegrationWithCredentials extends Integration {
  integration_credentials?: IntegrationCredential[]
  webhook_endpoints?: WebhookEndpoint[]
}

export interface IntegrationWithLogs extends Integration {
  integration_logs?: IntegrationLog[]
}

export interface IntegrationWithJobs extends Integration {
  sync_jobs?: SyncJob[]
}

export interface IntegrationFull extends Integration {
  integration_credentials?: IntegrationCredential[]
  webhook_endpoints?: WebhookEndpoint[]
  integration_logs?: IntegrationLog[]
  sync_jobs?: SyncJob[]
}

// Configuration types
export interface NetSuiteConfig {
  account_id: string
  consumer_key?: string
  consumer_secret?: string
  token_id?: string
  token_secret?: string
  rest_url?: string
  soap_url?: string
  suiteql_url?: string
}

export interface ShopifyConfig {
  shop_domain: string
  api_version: string
  webhook_api_version?: string
  private_app?: boolean
  custom_app?: boolean
}

export interface QuickBooksConfig {
  company_id: string
  sandbox: boolean
  minor_version?: string
}

export interface CustomConfig {
  base_url: string
  auth_type: CredentialTypeEnum
  headers?: Record<string, string>
  query_params?: Record<string, string>
}

export type PlatformConfig =
  | NetSuiteConfig
  | ShopifyConfig
  | QuickBooksConfig
  | CustomConfig

// Sync settings
export interface SyncSettings {
  sync_products: boolean
  sync_inventory: boolean
  sync_pricing: boolean
  sync_customers: boolean
  sync_orders: boolean
  sync_direction: 'push' | 'pull' | 'bidirectional'
  sync_frequency_minutes?: number
  batch_size?: number
  field_mappings?: Record<string, string>
  filters?: Record<string, any>
}

// OAuth types
export interface OAuthCredentials {
  client_id: string
  client_secret: string
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_at?: string
  scope?: string
}

export interface ApiKeyCredentials {
  api_key: string
  api_secret?: string
  additional_headers?: Record<string, string>
}

export interface BasicAuthCredentials {
  username: string
  password: string
}

export type CredentialData =
  | OAuthCredentials
  | ApiKeyCredentials
  | BasicAuthCredentials
  | Record<string, any>

// Webhook types
export interface WebhookEvent {
  id: string
  platform: IntegrationPlatformType
  event_type: string
  payload: any
  signature?: string
  timestamp: string
  integration_id: string
}

export interface WebhookVerification {
  isValid: boolean
  error?: string
}

// Job payload types
export interface SyncJobPayload {
  entity_type: 'products' | 'inventory' | 'pricing' | 'customers' | 'orders'
  operation: 'full' | 'incremental' | 'delta'
  filters?: Record<string, any>
  cursor?: string
  batch_size?: number
}

export interface WebhookJobPayload {
  webhook_id: string
  event_type: string
  event_data: any
  received_at: string
}

export type JobPayload = SyncJobPayload | WebhookJobPayload | Record<string, any>

// Result types
export interface SyncResult {
  success: boolean
  items_processed: number
  items_failed: number
  items_skipped: number
  errors: Array<{
    item_id?: string
    error: string
    details?: any
  }>
  next_cursor?: string
  summary?: Record<string, any>
}

// Validation schemas
export const integrationSchema = z.object({
  name: z.string().min(1).max(255),
  platform: z.enum([
    'netsuite',
    'shopify',
    'quickbooks',
    'sap',
    'dynamics365',
    'custom',
  ]),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'error', 'configuring', 'suspended']).optional(),
  config: z.record(z.any()).optional(),
  sync_settings: z.object({
    sync_products: z.boolean().default(true),
    sync_inventory: z.boolean().default(true),
    sync_pricing: z.boolean().default(true),
    sync_customers: z.boolean().default(false),
    sync_orders: z.boolean().default(false),
    sync_direction: z.enum(['push', 'pull', 'bidirectional']).default('bidirectional'),
    sync_frequency_minutes: z.number().min(5).max(1440).optional(),
    batch_size: z.number().min(1).max(1000).optional(),
    field_mappings: z.record(z.string()).optional(),
    filters: z.record(z.any()).optional(),
  }).optional(),
})

export const credentialSchema = z.object({
  credential_type: z.enum(['oauth2', 'api_key', 'basic_auth', 'custom']),
  credentials: z.record(z.any()),
})

export const webhookEndpointSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(32),
  events: z.array(z.string()).min(1),
  is_active: z.boolean().default(true),
})

export const syncJobSchema = z.object({
  job_type: z.enum(['full_sync', 'incremental_sync', 'webhook', 'manual']),
  payload: z.record(z.any()).optional(),
  priority: z.number().min(1).max(10).default(5),
  scheduled_for: z.string().datetime().optional(),
})

// Error types
export class IntegrationError extends Error {
  constructor(
    message: string,
    public code: string | number,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'IntegrationError'
    // Preserve stack trace in V8 engines (fix-59)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IntegrationError)
    }
  }
}

export class RateLimitError extends IntegrationError {
  constructor(
    message: string,
    public retryAfter: number,
    details?: any
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', details, true)
    this.name = 'RateLimitError'
    // Preserve stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError)
    }
  }
}

export class AuthenticationError extends IntegrationError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_FAILED', details, false)
    this.name = 'AuthenticationError'
    // Preserve stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthenticationError)
    }
  }
}

// Utility types
export interface IntegrationHealth {
  integration_id: string
  status: IntegrationStatusType
  last_sync_at?: string
  error_rate: number
  success_rate: number
  average_sync_duration_ms?: number
  pending_jobs: number
  failed_jobs_24h: number
}

export interface IntegrationMetrics {
  integration_id: string
  period: 'hour' | 'day' | 'week' | 'month'
  syncs_completed: number
  syncs_failed: number
  items_synced: number
  items_failed: number
  average_duration_ms: number
  webhooks_received: number
  webhooks_failed: number
}

// Filter types for queries
export interface IntegrationFilter {
  organization_id?: string
  platform?: IntegrationPlatformType
  status?: IntegrationStatusType
  search?: string
}

export interface LogFilter {
  integration_id?: string
  log_type?: LogTypeEnum
  severity?: LogSeverityEnum
  date_from?: string
  date_to?: string
  search?: string
}

export interface JobFilter {
  integration_id?: string
  job_type?: JobTypeEnum
  status?: JobStatusEnum
  date_from?: string
  date_to?: string
}