/**
 * AI Service API Client
 * Client for communicating with the TruthSource AI Service
 */

export interface DemandForecastRequest {
  product_ids: string[]
  warehouse_ids?: string[]
  forecast_days?: number
  include_seasonality?: boolean
}

export interface DemandForecastItem {
  product_id: string
  warehouse_id?: string
  date: string
  predicted_demand: number
  confidence_score: number
  seasonal_factor?: number
}

export interface DemandForecastResponse {
  forecasts: DemandForecastItem[]
  model_accuracy: number
  generated_at: string
  forecast_horizon_days: number
}

export interface DeliveryPredictionRequest {
  origin_warehouse: string
  destination_address: {
    street?: string
    city: string
    state: string
    zip: string
    country?: string
  }
  product_ids: string[]
  carrier?: string
  service_level?: 'standard' | 'express' | 'overnight'
}

export interface DeliveryPredictionResponse {
  estimated_delivery_date: string
  confidence_score: number
  transit_days: number
  carrier_recommendation: string
  factors_considered: string[]
  alternative_options?: Array<{
    carrier: string
    service_level: string
    estimated_date: string
    cost_estimate?: number
  }>
}

export interface AnomalyDetectionRequest {
  data_type: 'inventory' | 'pricing' | 'orders'
  time_range: {
    start: string
    end: string
  }
  sensitivity?: number
  include_recommendations?: boolean
}

export interface AnomalyItem {
  anomaly_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affected_entities: string[]
  detected_at: string
  recommendation?: string
}

export interface AnomalyDetectionResponse {
  anomalies: AnomalyItem[]
  total_anomalies: number
  analysis_period: {
    start: string
    end: string
  }
  model_confidence: number
  next_check_recommended: string
}

export interface HealthResponse {
  status: string
  service: string
  version: string
  agents: {
    demand_forecasting: boolean
    delivery_prediction: boolean
    anomaly_detection: boolean
  }
}

class AIServiceClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000'
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI Service error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health')
  }

  async forecastDemand(request: DemandForecastRequest): Promise<DemandForecastResponse> {
    return this.request<DemandForecastResponse>('/api/v1/forecast/demand', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async predictDelivery(request: DeliveryPredictionRequest): Promise<DeliveryPredictionResponse> {
    return this.request<DeliveryPredictionResponse>('/api/v1/predict/delivery', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async detectAnomalies(request: AnomalyDetectionRequest): Promise<AnomalyDetectionResponse> {
    return this.request<AnomalyDetectionResponse>('/api/v1/detect/anomalies', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
}

// Export singleton instance
export const aiServiceClient = new AIServiceClient()

// Export client class for testing
export { AIServiceClient }