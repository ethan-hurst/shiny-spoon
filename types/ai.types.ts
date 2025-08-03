// types/ai.types.ts
export interface AIPrediction {
  id: string
  organization_id: string
  prediction_type: 'demand' | 'reorder' | 'price' | 'anomaly'
  entity_type: 'product' | 'warehouse' | 'category'
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

export interface AIInsight {
  id: string
  organization_id: string
  insight_type: 'summary' | 'recommendation' | 'alert' | 'trend'
  title: string
  content: string
  severity: 'info' | 'warning' | 'critical'
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

export interface DemandForecast {
  productId: string
  warehouseId: string
  predictions: number[]
  dates: string[]
  confidence: number
  method: 'moving_average' | 'arima' | 'lstm' | 'ensemble'
  generatedAt: Date
}

export interface ReorderSuggestion {
  productId: string
  warehouseId: string
  productName: string
  warehouseName: string
  currentStock: number
  reorderPoint: number
  reorderQuantity: number
  safetyStock: number
  leadTimeDays: number
  confidence: number
  reasoning: string
}

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
    competitorAverage?: number
    inventoryPressure: number
    marginTarget: number
  }
}

export interface AnomalyAlert {
  id: string
  type:
    | 'inventory_spike'
    | 'adjustment_pattern'
    | 'stock_out'
    | 'excess_inventory'
    | 'order_spike'
    | 'large_order'
    | 'price_volatility'
    | 'large_price_change'
  severity: 'info' | 'warning' | 'critical'
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

export interface TrendAnalysis {
  metric: string
  trend: 'increasing' | 'decreasing' | 'stable'
  changePercent: number
  period: string
  confidence: number
  significanceLevel: number
}

export interface TimeSeriesData {
  date: Date
  value: number
}

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

export interface InsightSummary {
  totalInsights: number
  unreadInsights: number
  criticalAlerts: number
  activeRecommendations: number
  lastUpdated: Date
}

export interface DemandPattern {
  productId: string
  seasonal: boolean
  trendDirection: 'up' | 'down' | 'stable'
  volatility: 'low' | 'medium' | 'high'
  avgDailyDemand: number
  peakDays: string[]
  cyclePeriod?: number
}

export interface PricingInsight {
  productId: string
  currentMargin: number
  competitorCount: number
  priceElasticity: number
  lastPriceChange?: string
  recommendation: 'increase' | 'decrease' | 'maintain'
  confidence: number
}

export interface InventoryOptimization {
  productId: string
  warehouseId: string
  currentValue: number
  optimizedValue: number
  potential_savings: number
  turnoverRate: number
  daysOfSupply: number
}

export interface ForecastAccuracy {
  model: string
  mae: number
  mape: number
  rmse: number
  r2: number
  lastEvaluated: Date
}

export interface AIServiceConfig {
  enableForecasting: boolean
  enablePriceOptimization: boolean
  enableAnomalyDetection: boolean
  forecastHorizonDays: number
  confidenceThreshold: number
  updateFrequencyHours: number
}

// Chat/Natural Language Interface Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ChatContext {
  organizationId: string
  userId: string
  sessionId: string
  messages: ChatMessage[]
}

export interface NLQuery {
  query: string
  intent: 'forecast' | 'reorder' | 'anomaly' | 'trend' | 'general'
  entities: Array<{
    type: 'product' | 'warehouse' | 'date' | 'metric'
    value: string
    confidence: number
  }>
  parameters: Record<string, any>
}

export interface NLResponse {
  answer: string
  data?: any
  visualizations?: Array<{
    type: 'chart' | 'table' | 'metric'
    config: any
    data: any
  }>
  suggestedActions?: string[]
  confidence: number
}
