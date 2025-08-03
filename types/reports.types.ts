// types/reports.types.ts
import { z } from 'zod'

// Component types
export type ComponentType = 'chart' | 'table' | 'metric' | 'text' | 'image' | 'filter'
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter'
export type ExportFormat = 'csv' | 'excel' | 'pdf'
export type ReportCategory = 'inventory' | 'orders' | 'customers' | 'performance' | 'custom'
export type AccessLevel = 'private' | 'team' | 'organization'

// Component configuration
export interface ReportComponent {
  id: string
  type: ComponentType
  config: Record<string, any>
  position: { x: number; y: number }
  size: { width: number; height: number }
}

// Data source configuration
export interface DataSource {
  id: string
  type: 'query' | 'analytics'
  query?: string
  metric?: string
  limit?: number
}

// Filter configuration
export interface ReportFilter {
  id: string
  field: string
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between'
  value: any
}

// Report configuration
export interface ReportConfig {
  name: string
  layout: 'grid' | 'flex'
  components: ReportComponent[]
  dataSources: DataSource[]
  filters: ReportFilter[]
  style: {
    theme: 'light' | 'dark'
    spacing: 'compact' | 'normal' | 'relaxed'
  }
}

// Database types
export interface ReportTemplate {
  id: string
  organization_id?: string
  name: string
  description?: string
  category: ReportCategory
  config: ReportConfig
  is_system: boolean
  is_public: boolean
  created_at: string
  created_by?: string
  updated_at: string
}

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
    status: string
    timestamp: string
    error?: string
  }>
  error?: string
  created_at: string
}

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

// Scheduled report (extends Report)
export interface ScheduledReport extends Report {
  schedule_enabled: true
  schedule_cron: string
}

// Validation schemas
export const reportConfigSchema = z.object({
  name: z.string().min(1).max(255),
  layout: z.enum(['grid', 'flex']),
  components: z.array(z.object({
    id: z.string(),
    type: z.enum(['chart', 'table', 'metric', 'text', 'image', 'filter']),
    config: z.record(z.any()),
    position: z.object({ x: z.number(), y: z.number() }),
    size: z.object({ width: z.number(), height: z.number() })
  })),
  dataSources: z.array(z.object({
    id: z.string(),
    type: z.enum(['query', 'analytics']),
    query: z.string().optional(),
    metric: z.string().optional(),
    limit: z.number().optional()
  })),
  filters: z.array(z.object({
    id: z.string(),
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'gt', 'lt', 'between']),
    value: z.any()
  })),
  style: z.object({
    theme: z.enum(['light', 'dark']),
    spacing: z.enum(['compact', 'normal', 'relaxed'])
  })
})

export const reportScheduleSchema = z.object({
  enabled: z.boolean(),
  cron: z.string().optional(),
  timezone: z.string(),
  recipients: z.array(z.string().email()),
  formats: z.array(z.enum(['csv', 'excel', 'pdf']))
})

export const reportShareSchema = z.object({
  enabled: z.boolean(),
  expiresIn: z.number().optional() // hours
})