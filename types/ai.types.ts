// PRP-021: AI-Powered Insights - TypeScript Types

export type InsightType = 'summary' | 'recommendation' | 'alert' | 'trend'
export type AnomalyType = 'stock_out' | 'low_stock' | 'large_order' | 'price_volatility' | 'inventory_spike'
export type Severity = 'info' | 'warning' | 'critical'
export type PredictionType = 'demand' | 'reorder' | 'price' | 'anomaly'

export interface AIInsight {
  id: string
  organization_id: string
  insight_type: InsightType
  title: string
  content: string
  severity: Severity
  related_entities: Array<{
    type: string
    id: string
    name: string
  }>
  metrics: Record<string, any>
  recommended_actions: string[]
  is_read: boolean
  is_dismissed: boolean
  created_at: string
  valid_until?: string
}

export interface AIPrediction {
  id: string
  organization_id: string
  prediction_type: PredictionType
  entity_type: 'product' | 'warehouse' | 'category'
  entity_id: string
  prediction_date: string
  prediction_value: Record<string, any>
  confidence_score: number
  model_version: string
  model_parameters: Record<string, any>
  prediction_start: string
  prediction_end: string
  created_at: string
  expires_at?: string
}

export interface DemandForecast {
  productId: string
  warehouseId: string
  predictions: number[]
  confidence: number
  method: 'ensemble' | 'arima' | 'prophet' | 'lstm'
  generatedAt: Date
  metadata?: {
    seasonality?: boolean
    trend?: 'increasing' | 'decreasing' | 'stable'
    volatility?: number
  }
}

export interface ReorderSuggestion {
  productId: string
  warehouseId: string
  currentStock: number
  reorderPoint: number
  reorderQuantity: number
  safetyStock: number
  leadTimeDays: number
  confidence: number
  reasoning: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

export interface PriceRecommendation {
  productId: string
  currentPrice: number
  suggestedPrice: number
  estimatedImpact: {
    revenueChange: number // percentage
    volumeChange: number // percentage
    profitChange: number // percentage
  }
  confidence: number
  reasoning: string
  factors: {
    demandElasticity: number
    competitorAverage: number
    inventoryPressure: number
    marginTarget: number
    marketTrend: 'up' | 'down' | 'stable'
  }
}

export interface AnomalyAlert {
  id: string
  type: AnomalyType
  severity: Severity
  title: string
  description: string
  detectedAt: Date
  confidence: number
  relatedEntities: Array<{
    type: string
    id: string
    name: string
  }>
  suggestedActions: string[]
  metadata?: {
    threshold?: number
    baseline?: number
    deviation?: number
    historicalContext?: string
  }
}

export interface TrendAnalysis {
  metric: string
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  trend: 'increasing' | 'decreasing' | 'stable'
  changeRate: number // percentage
  confidence: number
  seasonality?: {
    detected: boolean
    period?: number
    strength?: number
  }
  forecast?: {
    nextPeriod: number
    confidence: number
  }
}

export interface AIInsightSummary {
  totalInsights: number
  unreadCount: number
  criticalAlerts: number
  recommendations: number
  trends: number
  lastGenerated: Date
}

export interface AIModelPerformance {
  modelType: string
  version: string
  metrics: {
    mae: number // Mean Absolute Error
    rmse: number // Root Mean Square Error
    r2: number // R-squared
    accuracy: number
  }
  trainingDataSize: number
  lastTrained: Date
  nextRetrain: Date
}

export interface AIRecommendation {
  id: string
  type: 'inventory' | 'pricing' | 'demand' | 'efficiency'
  title: string
  description: string
  impact: {
    revenue?: number
    cost?: number
    efficiency?: number
  }
  confidence: number
  implementation: {
    effort: 'low' | 'medium' | 'high'
    timeline: string
    resources: string[]
  }
  status: 'pending' | 'implemented' | 'dismissed'
  created_at: Date
}

export interface AIDashboardData {
  insights: AIInsight[]
  predictions: AIPrediction[]
  anomalies: AnomalyAlert[]
  recommendations: AIRecommendation[]
  summary: AIInsightSummary
  modelPerformance: AIModelPerformance[]
}

export interface AIInsightFilters {
  type?: InsightType[]
  severity?: Severity[]
  dateRange?: {
    from: Date
    to: Date
  }
  read?: boolean
  dismissed?: boolean
}

export interface AIPredictionFilters {
  type?: PredictionType[]
  entityType?: string[]
  dateRange?: {
    from: Date
    to: Date
  }
  confidence?: {
    min: number
    max: number
  }
}

export interface AIInsightActions {
  markAsRead: (insightId: string) => Promise<void>
  dismiss: (insightId: string) => Promise<void>
  implement: (recommendationId: string) => Promise<void>
  generateInsights: () => Promise<void>
  refreshPredictions: () => Promise<void>
}

export interface AIInsightContext {
  insights: AIInsight[]
  predictions: AIPrediction[]
  anomalies: AnomalyAlert[]
  summary: AIInsightSummary
  actions: AIInsightActions
  loading: boolean
  error?: string
}

// Component Props
export interface AIInsightsPanelProps {
  insights: AIInsight[]
  onInsightAction: (action: string, insightId: string) => void
}

export interface AIPredictionsPanelProps {
  predictions: AIPrediction[]
  onPredictionClick: (prediction: AIPrediction) => void
}

export interface AIAnomalyAlertsProps {
  anomalies: AnomalyAlert[]
  onAlertAction: (action: string, alertId: string) => void
}

export interface AIRecommendationsProps {
  recommendations: AIRecommendation[]
  onRecommendationAction: (action: string, recommendationId: string) => void
}

export interface AIDashboardProps {
  data: AIDashboardData
  loading?: boolean
  error?: string
  onRefresh?: () => void
}

export interface AIInsightCardProps {
  insight: AIInsight
  onAction: (action: string) => void
}

export interface AIPredictionCardProps {
  prediction: AIPrediction
  onClick: () => void
}

export interface AIAnomalyCardProps {
  anomaly: AnomalyAlert
  onAction: (action: string) => void
}

export interface AIRecommendationCardProps {
  recommendation: AIRecommendation
  onAction: (action: string) => void
}

// API Response Types
export interface GenerateInsightsResponse {
  success: boolean
  insights?: AIInsight[]
  error?: string
}

export interface GetPredictionsResponse {
  success: boolean
  predictions?: AIPrediction[]
  error?: string
}

export interface GetAnomaliesResponse {
  success: boolean
  anomalies?: AnomalyAlert[]
  error?: string
}

export interface GetRecommendationsResponse {
  success: boolean
  recommendations?: AIRecommendation[]
  error?: string
}

export interface UpdateInsightResponse {
  success: boolean
  error?: string
}

export interface AIModelTrainingResponse {
  success: boolean
  modelId?: string
  performance?: AIModelPerformance
  error?: string
}

// Utility Types
export interface AIInsightStats {
  total: number
  byType: Record<InsightType, number>
  bySeverity: Record<Severity, number>
  unread: number
  critical: number
}

export interface AIPredictionStats {
  total: number
  byType: Record<PredictionType, number>
  averageConfidence: number
  recentPredictions: number
}

export interface AIAnomalyStats {
  total: number
  byType: Record<AnomalyType, number>
  bySeverity: Record<Severity, number>
  resolved: number
  pending: number
}
