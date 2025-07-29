export enum SyncType {
  INVENTORY = 'inventory',
  PRICING = 'pricing',
  PRODUCTS = 'products',
  ORDERS = 'orders',
  CUSTOMERS = 'customers',
  ALL = 'all',
}

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  COMPLETED_WITH_ERRORS = 'completed_with_errors',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum SyncInterval {
  EVERY_15_MINUTES = 'every_15_minutes',
  EVERY_30_MINUTES = 'every_30_minutes',
  EVERY_HOUR = 'every_hour',
  EVERY_6_HOURS = 'every_6_hours',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  CUSTOM = 'custom',
}

export enum ConflictResolution {
  LOCAL_WINS = 'local_wins',
  EXTERNAL_WINS = 'external_wins',
  MERGE = 'merge',
  MANUAL = 'manual',
}

export enum ConflictType {
  UPDATE_CONFLICT = 'update_conflict',
  DELETE_CONFLICT = 'delete_conflict',
  DATA_MISMATCH = 'data_mismatch',
  DUPLICATE_RECORD = 'duplicate_record',
}

export enum WebhookType {
  PRODUCT_UPDATE = 'product.update',
  PRODUCT_CREATE = 'product.create',
  PRODUCT_DELETE = 'product.delete',
  INVENTORY_UPDATE = 'inventory.update',
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  PRICE_UPDATE = 'price.update',
  CUSTOMER_UPDATE = 'customer.update',
}

export interface SyncResult {
  success: boolean
  error?: string
  data?: any
}

export interface SyncOperation {
  id?: string
  syncType: SyncType
  integrationId: string
  options?: SyncOptions
}

export interface SyncOptions {
  batchSize?: number
  conflictResolution?: ConflictResolution
  includeDeleted?: boolean
  startDate?: Date
  endDate?: Date
  filter?: Record<string, any>
}

export interface SyncConfig {
  id: string
  organization_id: string
  integration_id: string
  sync_type: SyncType
  interval: SyncInterval
  active: boolean
  settings?: SyncSettings
  last_sync?: string
  created_at: string
  updated_at: string
}

export interface SyncSettings {
  batch_size?: number
  conflict_resolution?: ConflictResolution
  rate_limit?: number
  retry_attempts?: number
  retry_delay?: number
  continue_on_error?: boolean
  custom_interval_minutes?: number
}

export interface SyncLog {
  id: string
  sync_config_id: string
  integration_id: string
  status: SyncStatus
  started_at: string
  completed_at?: string
  records_synced?: number
  records_failed?: number
  errors?: any
  retry_count?: number
}

export interface SyncConflict {
  id: string
  type: ConflictType
  field: string
  local_value: any
  external_value: any
  description: string
}

export interface WebhookEvent {
  id: string
  type: WebhookType
  source: string
  data: any
  received_at: string
  signature?: string
}

export interface WebhookConfig {
  id: string
  organization_id: string
  integration_id: string
  webhook_url: string
  secret?: string
  events: string[]
  active: boolean
}