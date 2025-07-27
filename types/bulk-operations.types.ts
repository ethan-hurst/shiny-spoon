import { z } from 'zod'

// Reusable status type for bulk operations
export type BulkOperationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back' | 'rolling_back'

// Database types matching the schema
export interface BulkOperation {
  id: string
  organization_id: string
  operation_type: 'import' | 'export' | 'update' | 'delete'
  entity_type: 'products' | 'inventory' | 'pricing' | 'customers'
  status: BulkOperationStatus
  
  // File information
  file_name?: string
  file_size_bytes?: number
  file_url?: string
  
  // Progress tracking
  total_records: number
  processed_records: number
  successful_records: number
  failed_records: number
  
  // Timing
  started_at?: string
  completed_at?: string
  estimated_completion?: string
  
  // Configuration and results
  config: BulkOperationConfig
  results: Record<string, any>
  error_log: Array<{ message: string; timestamp: string }>
  
  // Audit
  created_at: string
  created_by: string
  cancelled_at?: string
  cancelled_by?: string
  updated_at: string
}

export interface BulkOperationRecord {
  id: string
  operation_id: string
  record_index: number
  entity_id?: string
  
  // Change tracking
  action: 'create' | 'update' | 'delete'
  before_data?: Record<string, any>
  after_data?: Record<string, any>
  
  // Status
  status: Exclude<BulkOperationStatus, 'cancelled' | 'rolling_back'>
  error?: string
  processed_at?: string
}

// Configuration types
export interface BulkOperationConfig {
  operationType: 'import' | 'export' | 'update' | 'delete'
  entityType: 'products' | 'inventory' | 'pricing' | 'customers'
  chunkSize?: number
  maxConcurrent?: number
  validateOnly?: boolean
  rollbackOnError?: boolean
  mapping?: Record<string, string>
}

// Progress tracking types
export interface BulkOperationProgress {
  operationId: string
  status: BulkOperation['status']
  totalRecords: number
  processedRecords: number
  successfulRecords: number
  failedRecords: number
  estimatedTimeRemaining?: number
  currentChunk?: number
  totalChunks?: number
  rollbackProgress?: {
    total: number
    processed: number
    successful: number
    failed: number
    percentage: number
  }
}

// Event types for SSE
export interface BulkOperationEvent {
  type: 'initial' | 'progress' | 'rollback-progress' | 'error' | 'complete'
  progress?: BulkOperationProgress
  error?: string
}

// Statistics types
export interface BulkOperationStats {
  totalOperations: number
  completedOperations: number
  failedOperations: number
  totalRecordsProcessed: number
  totalRecordsFailed: number
  operationsByType: Record<string, number>
  operationsByDay: Record<string, number>
}

// Entity-specific schemas for validation
export const InventoryBulkSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  warehouse_code: z.string().min(1, 'Warehouse code is required'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  reason: z.string().optional().default('cycle_count'),
  notes: z.string().optional(),
})

export const ProductBulkSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number().positive().optional(),
})

export const PricingBulkSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  price_tier: z.string().min(1, 'Price tier is required'),
  price: z.number().positive('Price must be positive'),
  min_quantity: z.number().int().min(1).optional(),
})

export const CustomerBulkSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  price_tier: z.string().optional(),
})

// Form schemas for UI
export const BulkUploadFormSchema = z.object({
  file: z.custom<File>((val) => {
    // Enhanced file validation for better cross-environment compatibility
    if (typeof File !== 'undefined' && val instanceof File) {
      return true;
    }
    // Check for File-like properties in environments where File might not be available
    return (
      val !== null &&
      typeof val === 'object' &&
      typeof (val as any).name === 'string' &&
      typeof (val as any).size === 'number' &&
      typeof (val as any).type === 'string' &&
      typeof (val as any).stream === 'function'
    );
  }, 'Must be a valid file').refine(
    (file) => file.name.endsWith('.csv'),
    'File must be a CSV'
  ).refine(
    (file) => file.size <= 100 * 1024 * 1024, // 100MB limit
    'File size must not exceed 100MB'
  ),
  operationType: z.enum(['import', 'update']),
  entityType: z.enum(['products', 'inventory', 'pricing', 'customers']),
  validateOnly: z.boolean().default(false),
  rollbackOnError: z.boolean().default(true),
  chunkSize: z.number().min(10).max(10000).optional(),
  maxConcurrent: z.number().min(1).max(10).optional(),
})

// Export types
export type InventoryBulkImport = z.infer<typeof InventoryBulkSchema>
export type ProductBulkImport = z.infer<typeof ProductBulkSchema>
export type PricingBulkImport = z.infer<typeof PricingBulkSchema>
export type CustomerBulkImport = z.infer<typeof CustomerBulkSchema>
export type BulkUploadForm = z.infer<typeof BulkUploadFormSchema>

// Template types
export interface BulkOperationTemplate {
  name: string
  description: string
  entityType: BulkOperationConfig['entityType']
  headers: string[]
  sampleData: string[][]
  downloadFilename: string
}

// Error types
export interface BulkOperationError {
  recordIndex: number
  field?: string
  message: string
  value?: any
  code?: string
}

// Rollback types
export interface RollbackSummary {
  totalRecords: number
  successfulRollbacks: number
  failedRollbacks: number
  startedAt: string
  completedAt?: string
  errors: Array<{
    recordIndex: number
    error: string
  }>
}

// File processing types
export interface CSVParseResult<T> {
  data: T[]
  errors: BulkOperationError[]
  warnings: string[]
  totalRows: number
  validRows: number
}

// Stream processing types
export interface StreamProcessorOptions {
  chunkSize: number
  concurrency: number
  validateSchema?: z.ZodSchema
  onProgress?: (progress: { processed: number; total?: number; rate: number }) => void
  onError?: (error: BulkOperationError) => void
}

// Entity processor interface
export interface EntityProcessor {
  schema: z.ZodSchema
  process(
    record: any,
    config: BulkOperationConfig,
    supabase: any
  ): Promise<any>
  rollback(record: BulkOperationRecord, supabase: any): Promise<void>
  validateBatch?(records: any[]): Promise<BulkOperationError[]>
}

// API response types
export interface BulkOperationApiResponse {
  success: boolean
  operationId?: string
  message?: string
  error?: string
}

export interface BulkOperationDetailsResponse {
  operation: BulkOperation
  records: BulkOperationRecord[]
}

// Column mapping types for flexible CSV headers
export interface ColumnMapping {
  [targetColumn: string]: string[] // array of possible header names
}

export const DefaultColumnMappings: Record<string, ColumnMapping> = {
  inventory: {
    sku: ['sku', 'product_sku', 'item_sku', 'product_code', 'item_code'],
    warehouse_code: ['warehouse_code', 'warehouse', 'location', 'warehouse_id', 'location_code'],
    quantity: ['quantity', 'qty', 'count', 'stock', 'on_hand'],
    reason: ['reason', 'adjustment_reason', 'type'],
    notes: ['notes', 'comments', 'description', 'memo'],
  },
  products: {
    sku: ['sku', 'product_sku', 'product_code', 'item_code'],
    name: ['name', 'product_name', 'title', 'description'],
    description: ['description', 'long_description', 'details'],
    category: ['category', 'product_category', 'type'],
    price: ['price', 'unit_price', 'cost', 'amount'],
  },
  pricing: {
    sku: ['sku', 'product_sku', 'product_code', 'item_code'],
    price_tier: ['price_tier', 'tier', 'customer_tier', 'pricing_tier'],
    price: ['price', 'unit_price', 'cost', 'amount'],
    min_quantity: ['min_quantity', 'min_qty', 'minimum_quantity', 'threshold'],
  },
  customers: {
    email: ['email', 'email_address', 'contact_email'],
    name: ['name', 'customer_name', 'contact_name', 'full_name'],
    company: ['company', 'company_name', 'organization', 'business_name'],
    price_tier: ['price_tier', 'tier', 'customer_tier', 'pricing_tier'],
  },
}