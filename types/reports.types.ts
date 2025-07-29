// types/reports.types.ts
import { z } from 'zod'

export type ComponentType = 'chart' | 'table' | 'metric' | 'text' | 'image' | 'filter'
export type ExportFormat = 'csv' | 'excel' | 'pdf'
export type AccessLevel = 'private' | 'team' | 'organization'

// Report component schema
export const ReportComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['chart', 'table', 'metric', 'text', 'image', 'filter']),
  config: z.record(z.any()),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.object({
    width: z.number(),
    height: z.number(),
  }),
})

export type ReportComponent = z.infer<typeof ReportComponentSchema>

// Data source schema
export const DataSourceSchema = z.object({
  id: z.string(),
  type: z.enum(['query', 'analytics', 'api']),
  query: z.string().optional(),
  metric: z.string().optional(),
  apiEndpoint: z.string().optional(),
  limit: z.number().optional(),
})

export type DataSource = z.infer<typeof DataSourceSchema>

// Filter schema
export const FilterSchema = z.object({
  id: z.string(),
  type: z.enum(['date', 'select', 'text', 'number']),
  label: z.string(),
  field: z.string(),
  defaultValue: z.any().optional(),
  options: z.array(z.string()).optional(),
})

export type Filter = z.infer<typeof FilterSchema>

// Report configuration schema
export const ReportConfigSchema = z.object({
  name: z.string(),
  layout: z.enum(['grid', 'free']),
  components: z.array(ReportComponentSchema),
  dataSources: z.array(DataSourceSchema),
  filters: z.array(FilterSchema),
  style: z.object({
    theme: z.enum(['light', 'dark']),
    spacing: z.enum(['compact', 'normal', 'comfortable']),
  }),
})

export type ReportConfig = z.infer<typeof ReportConfigSchema>

// Report template
export interface ReportTemplate {
  id: string
  organization_id?: string
  name: string
  description?: string
  category: 'inventory' | 'orders' | 'customers' | 'performance' | 'custom'
  config: ReportConfig
  is_system: boolean
  is_public: boolean
  created_at: string
  created_by?: string
  updated_at: string
}

// Saved report
export interface Report {
  id: string
  organization_id: string
  template_id?: string
  name: string
  description?: string
  config: ReportConfig
  schedule_enabled: boolean
  schedule_cron?: string
  schedule_timezone: string
  schedule_recipients: string[]
  schedule_format: ExportFormat[]
  is_shared: boolean
  share_token?: string
  share_expires_at?: string
  access_level: AccessLevel
  last_run_at?: string
  run_count: number
  created_at: string
  created_by: string
  updated_at: string
}

// Report run
export interface ReportRun {
  id: string
  report_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  parameters: Record<string, any>
  result_url?: string
  result_size_bytes?: number
  record_count?: number
  delivery_status: Array<{
    email: string
    status: 'sent' | 'failed'
    timestamp: string
    error?: string
  }>
  error?: string
  created_at: string
}

// Report component definition
export interface ReportComponentDefinition {
  id: string
  name: string
  type: ComponentType
  category: string
  icon: string
  config_schema: Record<string, any>
  default_config: Record<string, any>
  preview_image?: string
  is_active: boolean
  created_at: string
}

// Chart data types
export interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }>
}

// Table data types
export interface TableData {
  columns: Array<{
    key: string
    label: string
    type?: 'text' | 'number' | 'date' | 'currency'
    width?: number
  }>
  rows: Record<string, any>[]
  totalCount?: number
}

// Metric data types
export interface MetricData {
  value: number
  label: string
  format: 'number' | 'currency' | 'percentage'
  change?: {
    value: number
    period: string
    trend: 'up' | 'down' | 'stable'
  }
  target?: number
}

// Report generation request
export interface ReportGenerationRequest {
  reportId: string
  format: ExportFormat
  parameters?: Record<string, any>
  filters?: Record<string, any>
}

// Report scheduling
export interface ReportSchedule {
  enabled: boolean
  cron: string
  timezone: string
  recipients: string[]
  formats: ExportFormat[]
}

// Report sharing
export interface ReportShare {
  enabled: boolean
  expiresIn?: number // hours
  accessLevel: AccessLevel
}