import { z } from 'zod'

// Prediction types
export type PredictionType = 'demand' | 'reorder' | 'price' | 'anomaly'
export type EntityType = 'product' | 'warehouse' | 'category'
export type InsightType = 'summary' | 'recommendation' | 'alert' | 'trend'
export type SeverityLevel = 'info' | 'warning' | 'critical'

// Time series data point
export interface TimeSeriesData {
  date: Date
  value: number
  label?: string
}

// Demand forecast interface
export interface DemandForecast {
  productId: string
  warehouseId: string
  predictions: number[]
  confidence: number
  method: 'arima' | 'lstm' | 'prophet' | 'moving_average' | 'ensemble'
  generatedAt: Date
  horizonDays?: number
}

// Reorder suggestion interface
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
}

// Price recommendation interface
export interface PriceRecommendation {
  productId: string
  currentPrice: number
  suggestedPrice: number
  estimatedImpact: {
    revenueChange: number
    volumeChange: number
  }
  confidence: number
  reasoning: string
  factors: {
    demandElasticity: number
    competitorAverage: number | null
    inventoryPressure: number
    marginTarget: number
  }
}

// Anomaly alert interface
export interface AnomalyAlert {
  id: string
  type: string
  severity: SeverityLevel
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
}

// Trend analysis interface
export interface TrendAnalysis {
  metric: string
  trend: 'increasing' | 'decreasing' | 'stable'
  changeRate: number
  significance: number
  forecast: number[]
  insights: string[]
}

// AI prediction database type
export interface AIPrediction {
  id: string
  organization_id: string
  prediction_type: PredictionType
  entity_type: EntityType
  entity_id: string
  prediction_date: string
  prediction_value: any
  confidence_score: number
  model_version: string
  model_parameters: Record<string, any>
  prediction_start: string
  prediction_end: string
  created_at: string
  expires_at?: string
}

// AI insight database type
export interface AIInsight {
  id: string
  organization_id: string
  insight_type: InsightType
  title: string
  content: string
  severity?: SeverityLevel
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

// ML training data type
export interface MLTrainingData {
  id: string
  organization_id: string
  model_type: string
  data: any
  feature_names: string[]
  metrics: {
    mae?: number
    rmse?: number
    r2?: number
    accuracy?: number
  }
  created_at: string
}

// Validation schemas
export const demandForecastSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  horizonDays: z.number().min(1).max(365).default(30)
})

export const priceOptimizationSchema = z.object({
  productIds: z.array(z.string().uuid()).optional(),
  includeCompetitors: z.boolean().default(true),
  targetMargin: z.number().min(0).max(1).optional()
})

export const anomalyDetectionSchema = z.object({
  scope: z.enum(['all', 'inventory', 'orders', 'pricing']).default('all'),
  lookbackDays: z.number().min(1).max(90).default(7),
  sensitivityLevel: z.enum(['low', 'medium', 'high']).default('medium')
})

export const insightQuerySchema = z.object({
  types: z.array(z.enum(['summary', 'recommendation', 'alert', 'trend'])).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  isRead: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20)
})

// Chat message type
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: Date
}