// PRP-019: Custom Reports Builder - TypeScript Types

export type ComponentType = 'chart' | 'table' | 'metric' | 'text' | 'image' | 'filter'
export type ExportFormat = 'csv' | 'excel' | 'pdf'
export type AccessLevel = 'private' | 'team' | 'organization'
export type ReportStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ReportComponent {
  id: string
  type: ComponentType
  config: Record<string, any>
  position: { x: number; y: number }
  size: { width: number; height: number }
}

export interface DataSource {
  id: string
  type: 'query' | 'analytics'
  query?: string
  metric?: string
  limit?: number
}

export interface ReportFilter {
  id: string
  type: string
  config: Record<string, any>
}

export interface ReportStyle {
  theme: 'light' | 'dark'
  spacing: 'compact' | 'normal' | 'loose'
}

export interface ReportConfig {
  name: string
  layout: 'grid' | 'flexible'
  components: ReportComponent[]
  dataSources: DataSource[]
  filters: ReportFilter[]
  style: ReportStyle
}

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

export interface Report {
  id: string
  organization_id: string
  template_id?: string
  name: string
  description?: string
  config: ReportConfig
  
  // Scheduling
  schedule_enabled: boolean
  schedule_cron?: string
  schedule_timezone: string
  schedule_recipients: string[]
  schedule_format: ExportFormat[]
  
  // Sharing
  is_shared: boolean
  share_token?: string
  share_expires_at?: string
  
  // Access control
  access_level: AccessLevel
  
  // Metadata
  last_run_at?: string
  run_count: number
  
  created_at: string
  created_by: string
  updated_at: string
}

export interface ReportRun {
  id: string
  report_id: string
  status: ReportStatus
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

export interface ReportComponentDefinition {
  id: string
  name: string
  type: ComponentType
  category: string
  config_schema: Record<string, any>
  default_config: Record<string, any>
  icon?: string
  preview_image?: string
  is_active: boolean
  created_at: string
}

export interface ComponentLibraryItem {
  id: string
  name: string
  type: ComponentType
  category: string
  icon: React.ComponentType<any>
  configSchema: Record<string, any>
  defaultConfig: Record<string, any>
  preview: React.ComponentType<{ config: any }>
  render: React.ComponentType<{ config: any; data: any }>
}

export interface ReportBuilderProps {
  initialConfig?: ReportConfig
  templateId?: string
  onSave: (config: ReportConfig) => Promise<void>
}

export interface ReportCanvasProps {
  config: ReportConfig
  selectedComponent?: string | null
  onSelectComponent: (componentId: string | null) => void
  onUpdateComponent: (componentId: string, updates: Partial<ReportComponent>) => void
  onDeleteComponent: (componentId: string) => void
}

export interface ComponentPropertiesProps {
  component?: ReportComponent
  onChange: (updates: Partial<ReportComponent>) => void
}

export interface ReportPreviewProps {
  config: ReportConfig
}

export interface DataSourceManagerProps {
  dataSources: DataSource[]
  onChange: (dataSources: DataSource[]) => void
}

export interface ReportSettingsProps {
  config: ReportConfig
  onChange: (config: ReportConfig) => void
}

export interface ReportSchedulerProps {
  report: Report
  onUpdate: (updates: Partial<Report>) => Promise<void>
}

export interface ReportSharingProps {
  report: Report
  onUpdate: (updates: Partial<Report>) => Promise<void>
}

export interface ReportExportProps {
  report: Report
  onExport: (format: ExportFormat) => Promise<void>
}

export interface ReportTemplatesProps {
  templates: ReportTemplate[]
  onSelectTemplate: (template: ReportTemplate) => void
}

export interface ReportsTableProps {
  reports: Report[]
  showSchedule?: boolean
}

export interface ReportRunHistoryProps {
  reportId: string
  runs: ReportRun[]
}

export interface ScheduledReportsProps {
  reports: Report[]
  onUpdateSchedule: (reportId: string, schedule: any) => Promise<void>
}

export interface ReportAnalytics {
  totalReports: number
  scheduledReports: number
  totalRuns: number
  averageRunTime: number
  popularTemplates: Array<{
    template_id: string
    name: string
    usage_count: number
  }>
}

export interface ReportBuilderState {
  config: ReportConfig
  selectedComponent: string | null
  previewMode: boolean
  isSaving: boolean
  hasUnsavedChanges: boolean
}

export interface ReportBuilderActions {
  updateConfig: (updates: Partial<ReportConfig>) => void
  selectComponent: (componentId: string | null) => void
  updateComponent: (componentId: string, updates: Partial<ReportComponent>) => void
  deleteComponent: (componentId: string) => void
  addComponent: (component: ReportComponent) => void
  togglePreviewMode: () => void
  save: () => Promise<void>
  reset: () => void
}

export interface ReportData {
  [dataSourceId: string]: any[]
}

export interface ReportExecutionContext {
  organizationId: string
  userId: string
  dateRange?: {
    from: Date
    to: Date
  }
  parameters: Record<string, any>
}

export interface ReportGenerator {
  generate(
    report: Report,
    format: ExportFormat,
    context: ReportExecutionContext
  ): Promise<{
    data: Buffer | string
    mimeType: string
    filename: string
  }>
}

export interface ReportScheduler {
  scheduleReport(report: Report): void
  cancelReport(reportId: string): void
  runScheduledReports(): Promise<void>
}

export interface ReportNotification {
  type: 'success' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

export interface ReportBuilderContext {
  state: ReportBuilderState
  actions: ReportBuilderActions
  notifications: ReportNotification[]
  addNotification: (notification: ReportNotification) => void
  removeNotification: (id: string) => void
}

// Utility types for form validation
export interface ReportConfigSchema {
  name: z.ZodString
  description: z.ZodOptional<z.ZodString>
  layout: z.ZodEnum<['grid', 'flexible']>
  components: z.ZodArray<z.ZodObject<{
    id: z.ZodString
    type: z.ZodEnum<ComponentType[]>
    config: z.ZodRecord(z.ZodString(), z.ZodAny())
    position: z.ZodObject({
      x: z.ZodNumber()
      y: z.ZodNumber()
    })
    size: z.ZodObject({
      width: z.ZodNumber()
      height: z.ZodNumber()
    })
  }>>
  dataSources: z.ZodArray<z.ZodObject<{
    id: z.ZodString
    type: z.ZodEnum<['query', 'analytics']>
    query: z.ZodOptional<z.ZodString>()
    metric: z.ZodOptional<z.ZodString>()
    limit: z.ZodOptional<z.ZodNumber>()
  }>>
  filters: z.ZodArray<z.ZodObject<{
    id: z.ZodString
    type: z.ZodString()
    config: z.ZodRecord(z.ZodString(), z.ZodAny())
  }>>
  style: z.ZodObject({
    theme: z.ZodEnum<['light', 'dark']>()
    spacing: z.ZodEnum<['compact', 'normal', 'loose']>()
  })
}

// API response types
export interface SaveReportResponse {
  success: boolean
  reportId?: string
  error?: string
}

export interface RunReportResponse {
  success: boolean
  data?: Buffer | string
  mimeType?: string
  filename?: string
  error?: string
}

export interface ScheduleReportResponse {
  success: boolean
  error?: string
}

export interface ShareReportResponse {
  success: boolean
  shareUrl?: string
  error?: string
}

export interface ExportReportResponse {
  success: boolean
  downloadUrl?: string
  error?: string
}
