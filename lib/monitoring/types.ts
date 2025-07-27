// PRP-016: Data Accuracy Monitor Types

export interface AccuracyCheckConfig {
  scope: 'full' | 'inventory' | 'pricing' | 'products'
  integrationId?: string
  sampleSize?: number
  checkDepth: 'shallow' | 'deep'
}

export interface DiscrepancyResult {
  entityType: string
  entityId: string
  fieldName: string
  sourceValue: unknown
  targetValue: unknown
  discrepancyType: 'missing' | 'mismatch' | 'stale' | 'duplicate'
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
}

export interface AccuracyCheck {
  id: string
  organizationId: string
  checkType: 'scheduled' | 'manual' | 'triggered'
  scope: 'full' | 'inventory' | 'pricing' | 'products'
  integrationId?: string
  status: 'running' | 'completed' | 'failed'
  accuracyScore?: number
  discrepanciesFound: number
  recordsChecked: number
  startedAt: Date
  completedAt?: Date
  durationMs?: number
  syncJobId?: string
  createdAt: Date
}

export interface Discrepancy {
  id: string
  accuracyCheckId: string
  organizationId: string
  entityType: string
  entityId: string
  fieldName: string
  sourceValue: unknown
  targetValue: unknown
  expectedValue?: unknown
  discrepancyType: 'missing' | 'mismatch' | 'stale' | 'duplicate'
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidenceScore: number
  status: 'open' | 'investigating' | 'resolved' | 'ignored'
  resolutionType?: 'auto_fixed' | 'manual_fixed' | 'false_positive'
  resolvedAt?: Date
  resolvedBy?: string
  detectedAt: Date
  metadata: Record<string, unknown>
}

export interface AlertRule {
  id: string
  organizationId: string
  name: string
  description?: string
  isActive: boolean
  entityType?: string[]
  severityThreshold: string
  accuracyThreshold: number
  discrepancyCountThreshold: number
  checkFrequency: number // seconds
  evaluationWindow: number // seconds
  notificationChannels: ('email' | 'sms' | 'in_app' | 'webhook')[]
  autoRemediate: boolean
  escalationPolicy: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface Alert {
  id: string
  alertRuleId: string
  organizationId: string
  title: string
  message: string
  severity: string
  triggeredBy: 'threshold' | 'anomaly' | 'pattern'
  triggerValue: Record<string, unknown>
  accuracyCheckId?: string
  status: 'active' | 'acknowledged' | 'resolved' | 'snoozed'
  acknowledgedBy?: string
  acknowledgedAt?: Date
  resolvedAt?: Date
  notificationsSent: Record<string, unknown>
  createdAt: Date
}

export interface NotificationLog {
  id: string
  alertId: string
  channel: 'email' | 'sms' | 'in_app' | 'webhook'
  recipient: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  sentAt?: Date
  deliveredAt?: Date
  providerResponse?: Record<string, unknown>
  errorMessage?: string
  createdAt: Date
}

export interface RemediationLog {
  id: string
  discrepancyId: string
  organizationId: string
  actionType: 'sync_retry' | 'value_update' | 'cache_clear' | 'force_refresh' | 'rollback'
  actionConfig: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  success?: boolean
  result?: Record<string, unknown>
  errorMessage?: string
  createdAt: Date
}

export interface AccuracyMetric {
  id: string
  organizationId: string
  integrationId?: string
  accuracyScore: number
  totalRecords: number
  discrepancyCount: number
  metricsByType: Record<string, number>
  metricTimestamp: Date
  bucketDuration: number // seconds
  createdAt: Date
}

// Notification configuration
export interface NotificationConfig {
  channel: 'email' | 'sms' | 'in_app' | 'webhook'
  alertId: string
  organizationId: string
  title: string
  message: string
  severity: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

// Check progress event
export interface CheckProgressEvent {
  checkId: string
  integrationId?: string
  progress: number // 0-100
  currentStep?: string
  estimatedTimeRemaining?: number // seconds
}

// Check result summary
export interface CheckResultSummary {
  checkId: string
  accuracyScore: number
  discrepanciesFound: number
  recordsChecked: number
  duration: number
  discrepanciesBySeverity: {
    critical: number
    high: number
    medium: number
    low: number
  }
  discrepanciesByType: {
    missing: number
    mismatch: number
    stale: number
    duplicate: number
  }
}

// Anomaly detection result
export interface AnomalyResult {
  entityId: string
  anomalyType: 'statistical' | 'pattern' | 'threshold'
  confidence: number
  deviationScore: number
  historicalAverage?: number
  currentValue: number
  explanation: string
}

// Alert configuration
export interface AlertConfig {
  ruleId: string
  checkId: string
  triggerReason: string
  accuracyScore: number
  discrepancyCount: number
  metadata?: Record<string, unknown>
}

// Remediation action
export interface RemediationAction {
  discrepancyId: string
  actionType: 'sync_retry' | 'value_update' | 'cache_clear' | 'force_refresh' | 'rollback'
  actionConfig: Record<string, unknown>
  priority: 'low' | 'medium' | 'high'
  estimatedImpact: string
}

// Accuracy trend data point
export interface AccuracyTrendPoint {
  timestamp: Date
  accuracyScore: number
  recordsChecked: number
  discrepancyCount: number
  integrationId?: string
}

// Filter options for various queries
export interface AccuracyCheckFilter {
  organizationId: string
  status?: ('running' | 'completed' | 'failed')[]
  scope?: ('full' | 'inventory' | 'pricing' | 'products')[]
  integrationId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface DiscrepancyFilter {
  organizationId: string
  accuracyCheckId?: string
  entityType?: string[]
  severity?: ('low' | 'medium' | 'high' | 'critical')[]
  status?: ('open' | 'investigating' | 'resolved' | 'ignored')[]
  discrepancyType?: ('missing' | 'mismatch' | 'stale' | 'duplicate')[]
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface AlertFilter {
  organizationId: string
  status?: ('active' | 'acknowledged' | 'resolved' | 'snoozed')[]
  severity?: string[]
  alertRuleId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}