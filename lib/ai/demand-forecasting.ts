import { createServerClient } from '@/lib/supabase/server'
import type { DemandForecast, TimeSeriesData } from '@/types/ai.types'

export class DemandForecaster {
  private supabase: ReturnType<typeof createServerClient>

  constructor() {
    this.supabase = createServerClient()
  }

  async forecastDemand(
    productId: string,
    warehouseId: string,
    organizationId: string,
    horizonDays: number = 30
  ): Promise<DemandForecast> {
    // Fetch historical data
    const historicalData = await this.getHistoricalDemand(
      productId,
      warehouseId
    )

    if (historicalData.length < 30) {
      // Use simple moving average for products with limited history
      return this.simpleMovingAverageForecast(productId, warehouseId, historicalData, horizonDays)
    }

    // Prepare time series data
    const timeSeries = this.prepareTimeSeries(historicalData)

    // Try multiple forecasting methods
    const [arima, exponentialSmoothing, linearRegression] = await Promise.all([
      this.arimaForecast(timeSeries, horizonDays),
      this.exponentialSmoothingForecast(timeSeries, horizonDays),
      this.linearRegressionForecast(timeSeries, horizonDays),
    ])

    // Ensemble the predictions
    const ensembledForecast = this.ensemblePredictions([arima, exponentialSmoothing, linearRegression])

    // Calculate confidence intervals
    const confidence = this.calculateConfidence(
      ensembledForecast,
      historicalData
    )

    // Store prediction
    await this.storePrediction({
      productId,
      warehouseId,
      organizationId,
      forecast: ensembledForecast,
      confidence,
      horizonDays,
    })

    return {
      productId,
      warehouseId,
      predictions: ensembledForecast,
      confidence,
      method: 'ensemble',
      generatedAt: new Date(),
      horizonDays,
    }
  }

  private async getHistoricalDemand(
    productId: string,
    warehouseId: string
  ): Promise<TimeSeriesData[]> {
    const { data, error } = await this.supabase
      .from('order_items')
      .select(
        `
        quantity,
        created_at,
        orders!inner(
          organization_id,
          warehouse_id
        )
      `
      )
      .eq('product_id', productId)
      .eq('orders.warehouse_id', warehouseId)
      .gte(
        'created_at',
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order('created_at', { ascending: true })

    if (error) throw error

    // Aggregate by day
    const dailyDemand = new Map<string, number>()

    data?.forEach((item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0]
      dailyDemand.set(date, (dailyDemand.get(date) || 0) + item.quantity)
    })

    return Array.from(dailyDemand.entries()).map(([date, quantity]) => ({
      date: new Date(date),
      value: quantity,
    }))
  }

  private prepareTimeSeries(data: TimeSeriesData[]): number[] {
    // Fill missing dates with zeros
    const fullSeries: number[] = []
    if (data.length === 0) return fullSeries
    
    const startDate = data[0].date
    const endDate = data[data.length - 1].date

    const dateMap = new Map(
      data.map((d) => [d.date.toISOString().split('T')[0], d.value])
    )

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split('T')[0]
      fullSeries.push(dateMap.get(dateStr) || 0)
    }

    return fullSeries
  }

  private async arimaForecast(
    timeSeries: number[],
    horizonDays: number
  ): Promise<number[]> {
    // Simplified ARIMA implementation
    // In production, use a proper ARIMA library or external service
    
    if (timeSeries.length === 0) {
      return new Array(horizonDays).fill(0)
    }

    // Calculate differences (d=1)
    const differences = []
    for (let i = 1; i < timeSeries.length; i++) {
      differences.push(timeSeries[i] - timeSeries[i - 1])
    }

    // Simple AR(1) model on differences
    const mean = differences.reduce((a, b) => a + b, 0) / differences.length
    const variance = differences.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / differences.length
    const stdDev = Math.sqrt(variance)

    // Generate forecast
    const predictions: number[] = []
    let lastValue = timeSeries[timeSeries.length - 1]

    for (let i = 0; i < horizonDays; i++) {
      // Add mean difference with some randomness based on historical variance
      const change = mean + (Math.random() - 0.5) * stdDev * 0.5
      lastValue = Math.max(0, lastValue + change)
      predictions.push(lastValue)
    }

    return predictions
  }

  private async exponentialSmoothingForecast(
    timeSeries: number[],
    horizonDays: number
  ): Promise<number[]> {
    if (timeSeries.length === 0) {
      return new Array(horizonDays).fill(0)
    }

    // Simple exponential smoothing with alpha = 0.3
    const alpha = 0.3
    let smoothed = timeSeries[0]

    for (let i = 1; i < timeSeries.length; i++) {
      smoothed = alpha * timeSeries[i] + (1 - alpha) * smoothed
    }

    // For simple exponential smoothing, forecast is constant
    return new Array(horizonDays).fill(Math.max(0, smoothed))
  }

  private async linearRegressionForecast(
    timeSeries: number[],
    horizonDays: number
  ): Promise<number[]> {
    if (timeSeries.length === 0) {
      return new Array(horizonDays).fill(0)
    }

    // Calculate linear regression
    const n = timeSeries.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = timeSeries

    const xMean = x.reduce((a, b) => a + b) / n
    const yMean = y.reduce((a, b) => a + b) / n

    const slope =
      x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0) /
      x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0)

    const intercept = yMean - slope * xMean

    // Generate forecast
    const predictions: number[] = []
    for (let i = 0; i < horizonDays; i++) {
      const value = slope * (n + i) + intercept
      predictions.push(Math.max(0, value))
    }

    return predictions
  }

  private ensemblePredictions(predictions: number[][]): number[] {
    // Simple average ensemble
    const ensembled: number[] = []
    const numModels = predictions.length

    for (let i = 0; i < predictions[0].length; i++) {
      const sum = predictions.reduce((acc, pred) => acc + pred[i], 0)
      ensembled.push(sum / numModels)
    }

    return ensembled
  }

  private calculateConfidence(
    forecast: number[],
    historical: TimeSeriesData[]
  ): number {
    // Calculate confidence based on historical variance
    if (historical.length === 0) return 0.5
    
    const values = historical.map((h) => h.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length

    const cv = Math.sqrt(variance) / mean // Coefficient of variation

    // Higher CV means lower confidence
    return Math.max(0.5, Math.min(0.95, 1 - cv))
  }

  private simpleMovingAverageForecast(
    productId: string,
    warehouseId: string,
    historical: TimeSeriesData[],
    horizonDays: number
  ): DemandForecast {
    const values = historical.map((h) => h.value)
    const avg = values.length > 0 
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0

    return {
      productId,
      warehouseId,
      predictions: new Array(horizonDays).fill(avg),
      confidence: 0.6,
      method: 'moving_average',
      generatedAt: new Date(),
      horizonDays,
    }
  }

  private async storePrediction(prediction: any): Promise<void> {
    await this.supabase.from('ai_predictions').insert({
      organization_id: prediction.organizationId,
      prediction_type: 'demand',
      entity_type: 'product',
      entity_id: prediction.productId,
      prediction_date: new Date().toISOString().split('T')[0],
      prediction_value: {
        forecast: prediction.forecast,
        horizonDays: prediction.horizonDays,
        warehouseId: prediction.warehouseId,
      },
      confidence_score: prediction.confidence,
      model_version: '1.0.0',
      prediction_start: new Date().toISOString().split('T')[0],
      prediction_end: new Date(
        Date.now() + prediction.horizonDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0],
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000 // Cache for 7 days
      ).toISOString(),
    })
  }
}