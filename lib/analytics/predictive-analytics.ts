/**
 * Predictive Analytics Service for TruthSource
 */

export interface DemandForecast {
  productId: string
  predictedDemand: number
  confidence: number
  seasonality: number
  trend: 'increasing' | 'decreasing' | 'stable'
  factors: string[]
}

export interface PriceOptimization {
  productId: string
  currentPrice: number
  optimalPrice: number
  revenueImpact: number
  elasticity: number
  marketPosition: 'premium' | 'competitive' | 'budget'
}

export interface ChurnPrediction {
  customerId: string
  churnRisk: number
  riskFactors: string[]
  retentionScore: number
  nextPurchaseProbability: number
}

export interface AnomalyDetection {
  id: string
  type: 'price' | 'demand' | 'inventory' | 'revenue'
  severity: 'critical' | 'warning' | 'info'
  description: string
  confidence: number
  detectedAt: Date
  data: Record<string, any>
}

export interface SeasonalityAnalysis {
  productId: string
  seasonalityScore: number
  peakSeasons: string[]
  lowSeasons: string[]
  seasonalFactors: Record<string, number>
}

export class PredictiveAnalytics {
  constructor(private supabase: any) {}

  /**
   * Generate demand forecast for products
   */
  async generateDemandForecast(
    productIds: string[],
    forecastPeriod: number = 30
  ): Promise<DemandForecast[]> {
    try {
      const forecasts: DemandForecast[] = []

      for (const productId of productIds) {
        // Get historical sales data
        const { data: salesData } = await this.supabase
          .from('order_items')
          .select('quantity, created_at, unit_price')
          .eq('product_id', productId)
          .gte(
            'created_at',
            new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
          )
          .order('created_at', { ascending: true })

        if (!salesData || salesData.length === 0) {
          continue
        }

        // Calculate demand forecast using time series analysis
        const forecast = this.calculateDemandForecast(salesData, forecastPeriod)
        forecasts.push({
          productId,
          ...forecast,
        })
      }

      return forecasts
    } catch (error) {
      console.error('Error generating demand forecast:', error)
      return []
    }
  }

  /**
   * Optimize pricing for products
   */
  async optimizePricing(productIds: string[]): Promise<PriceOptimization[]> {
    try {
      const optimizations: PriceOptimization[] = []

      for (const productId of productIds) {
        // Get pricing and sales data
        const { data: pricingData } = await this.supabase
          .from('products')
          .select('base_price, current_price')
          .eq('id', productId)
          .single()

        const { data: salesData } = await this.supabase
          .from('order_items')
          .select('quantity, unit_price, created_at')
          .eq('product_id', productId)
          .gte(
            'created_at',
            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
          )

        if (!pricingData || !salesData) {
          continue
        }

        // Calculate price optimization
        const optimization = this.calculatePriceOptimization(
          pricingData,
          salesData
        )
        optimizations.push({
          productId,
          ...optimization,
        })
      }

      return optimizations
    } catch (error) {
      console.error('Error optimizing pricing:', error)
      return []
    }
  }

  /**
   * Predict customer churn risk
   */
  async predictChurnRisk(customerIds: string[]): Promise<ChurnPrediction[]> {
    try {
      const predictions: ChurnPrediction[] = []

      for (const customerId of customerIds) {
        // Get customer behavior data
        const { data: customerData } = await this.supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single()

        const { data: orderData } = await this.supabase
          .from('orders')
          .select('total_amount, created_at, status')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })

        if (!customerData || !orderData) {
          continue
        }

        // Calculate churn risk
        const prediction = this.calculateChurnRisk(customerData, orderData)
        predictions.push({
          customerId,
          ...prediction,
        })
      }

      return predictions
    } catch (error) {
      console.error('Error predicting churn risk:', error)
      return []
    }
  }

  /**
   * Detect anomalies in data
   */
  async detectAnomalies(
    dataType: 'price' | 'demand' | 'inventory' | 'revenue',
    timeRange: { start: Date; end: Date }
  ): Promise<AnomalyDetection[]> {
    try {
      const anomalies: AnomalyDetection[] = []

      // Get relevant data based on type
      let data: any[] = []
      switch (dataType) {
        case 'price':
          data = await this.getPriceData(timeRange)
          break
        case 'demand':
          data = await this.getDemandData(timeRange)
          break
        case 'inventory':
          data = await this.getInventoryData(timeRange)
          break
        case 'revenue':
          data = await this.getRevenueData(timeRange)
          break
      }

      // Detect anomalies using statistical methods
      const detectedAnomalies = this.detectStatisticalAnomalies(data, dataType)
      anomalies.push(...detectedAnomalies)

      return anomalies
    } catch (error) {
      console.error('Error detecting anomalies:', error)
      return []
    }
  }

  /**
   * Analyze seasonality patterns
   */
  async analyzeSeasonality(
    productIds: string[]
  ): Promise<SeasonalityAnalysis[]> {
    try {
      const analyses: SeasonalityAnalysis[] = []

      for (const productId of productIds) {
        // Get historical data for the past 2 years
        const { data: historicalData } = await this.supabase
          .from('order_items')
          .select('quantity, created_at')
          .eq('product_id', productId)
          .gte(
            'created_at',
            new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString()
          )
          .order('created_at', { ascending: true })

        if (!historicalData || historicalData.length === 0) {
          continue
        }

        // Calculate seasonality
        const analysis = this.calculateSeasonality(historicalData)
        analyses.push({
          productId,
          ...analysis,
        })
      }

      return analyses
    } catch (error) {
      console.error('Error analyzing seasonality:', error)
      return []
    }
  }

  /**
   * Calculate demand forecast using time series analysis
   */
  private calculateDemandForecast(
    salesData: any[],
    forecastPeriod: number
  ): Omit<DemandForecast, 'productId'> {
    // Simple moving average for demonstration
    // In production, use more sophisticated algorithms like ARIMA, Prophet, etc.

    const quantities = salesData.map((item) => item.quantity)
    const avgDemand =
      quantities.reduce((sum, qty) => sum + qty, 0) / quantities.length

    // Calculate trend
    const recentAvg =
      quantities.slice(-10).reduce((sum, qty) => sum + qty, 0) / 10
    const olderAvg =
      quantities.slice(0, 10).reduce((sum, qty) => sum + qty, 0) / 10
    const trend =
      recentAvg > olderAvg
        ? 'increasing'
        : recentAvg < olderAvg
          ? 'decreasing'
          : 'stable'

    // Calculate seasonality (simplified)
    const seasonality = this.calculateSeasonalityFactor(salesData)

    // Predict future demand
    const predictedDemand =
      avgDemand *
      (1 + (trend === 'increasing' ? 0.1 : trend === 'decreasing' ? -0.1 : 0))

    return {
      predictedDemand: Math.round(predictedDemand * forecastPeriod),
      confidence: 85, // Simplified confidence calculation
      seasonality,
      trend,
      factors: ['historical_sales', 'trend_analysis', 'seasonality'],
    }
  }

  /**
   * Calculate price optimization
   */
  private calculatePriceOptimization(
    pricingData: any,
    salesData: any[]
  ): Omit<PriceOptimization, 'productId'> {
    const currentPrice = pricingData.current_price || pricingData.base_price
    const basePrice = pricingData.base_price

    // Calculate price elasticity
    const priceChanges = salesData.map((item) => ({
      price: item.unit_price,
      quantity: item.quantity,
    }))

    const elasticity = this.calculatePriceElasticity(priceChanges)

    // Calculate optimal price
    const optimalPrice = this.calculateOptimalPrice(currentPrice, elasticity)

    // Calculate revenue impact
    const revenueImpact = ((optimalPrice - currentPrice) / currentPrice) * 100

    // Determine market position
    const marketPosition = this.determineMarketPosition(currentPrice, basePrice)

    return {
      currentPrice,
      optimalPrice,
      revenueImpact,
      elasticity,
      marketPosition,
    }
  }

  /**
   * Calculate churn risk
   */
  private calculateChurnRisk(
    customerData: any,
    orderData: any[]
  ): Omit<ChurnPrediction, 'customerId'> {
    // Calculate risk factors
    const riskFactors: string[] = []
    let churnRisk = 0

    // Recency of last purchase
    const lastOrder = orderData[0]
    if (lastOrder) {
      const daysSinceLastOrder =
        (Date.now() - new Date(lastOrder.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
      if (daysSinceLastOrder > 90) {
        riskFactors.push('no_recent_purchases')
        churnRisk += 30
      }
    }

    // Purchase frequency
    const avgOrderValue =
      orderData.reduce((sum, order) => sum + order.total_amount, 0) /
      orderData.length
    if (avgOrderValue < 100) {
      riskFactors.push('low_order_value')
      churnRisk += 20
    }

    // Customer tenure
    const customerSince = new Date(customerData.created_at)
    const tenureDays =
      (Date.now() - customerSince.getTime()) / (1000 * 60 * 60 * 24)
    if (tenureDays < 30) {
      riskFactors.push('new_customer')
      churnRisk += 15
    }

    // Calculate retention score
    const retentionScore = Math.max(0, 100 - churnRisk)

    // Calculate next purchase probability
    const nextPurchaseProbability = retentionScore / 100

    return {
      churnRisk: Math.min(100, churnRisk),
      riskFactors,
      retentionScore,
      nextPurchaseProbability,
    }
  }

  /**
   * Detect statistical anomalies
   */
  private detectStatisticalAnomalies(
    data: any[],
    dataType: string
  ): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = []

    if (data.length === 0) return anomalies

    // Calculate mean and standard deviation
    const values = data.map(
      (item) => item.value || item.quantity || item.amount
    )
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length
    const stdDev = Math.sqrt(variance)

    // Detect outliers (values beyond 2 standard deviations)
    values.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev)
      if (zScore > 2) {
        anomalies.push({
          id: `anomaly_${dataType}_${index}`,
          type: dataType as any,
          severity: zScore > 3 ? 'critical' : 'warning',
          description: `Unusual ${dataType} value detected: ${value} (expected: ${mean.toFixed(2)} ± ${stdDev.toFixed(2)})`,
          confidence: Math.min(100, zScore * 25),
          detectedAt: new Date(),
          data: { value, mean, stdDev, zScore },
        })
      }
    })

    return anomalies
  }

  /**
   * Calculate seasonality factor
   */
  private calculateSeasonalityFactor(salesData: any[]): number {
    // Simplified seasonality calculation
    // In production, use FFT or other time series decomposition methods

    const monthlyData = new Array(12).fill(0)
    const monthlyCount = new Array(12).fill(0)

    salesData.forEach((item) => {
      const month = new Date(item.created_at).getMonth()
      monthlyData[month] += item.quantity
      monthlyCount[month]++
    })

    const avgMonthlySales = monthlyData.map((total, month) =>
      monthlyCount[month] > 0 ? total / monthlyCount[month] : 0
    )

    const overallAvg = avgMonthlySales.reduce((sum, avg) => sum + avg, 0) / 12
    const maxMonthlyAvg = Math.max(...avgMonthlySales)

    return maxMonthlyAvg > 0 ? (maxMonthlyAvg - overallAvg) / overallAvg : 0
  }

  /**
   * Calculate price elasticity
   */
  private calculatePriceElasticity(priceChanges: any[]): number {
    if (priceChanges.length < 2) return -1 // Default elasticity

    // Simplified elasticity calculation
    const sorted = priceChanges.sort((a, b) => a.price - b.price)
    const midPoint = Math.floor(sorted.length / 2)

    const lowerHalf = sorted.slice(0, midPoint)
    const upperHalf = sorted.slice(midPoint)

    const lowerAvgPrice =
      lowerHalf.reduce((sum, item) => sum + item.price, 0) / lowerHalf.length
    const upperAvgPrice =
      upperHalf.reduce((sum, item) => sum + item.price, 0) / upperHalf.length
    const lowerAvgQuantity =
      lowerHalf.reduce((sum, item) => sum + item.quantity, 0) / lowerHalf.length
    const upperAvgQuantity =
      upperHalf.reduce((sum, item) => sum + item.quantity, 0) / upperHalf.length

    const priceChange = (upperAvgPrice - lowerAvgPrice) / lowerAvgPrice
    const quantityChange =
      (upperAvgQuantity - lowerAvgQuantity) / lowerAvgQuantity

    return priceChange !== 0 ? quantityChange / priceChange : -1
  }

  /**
   * Calculate optimal price
   */
  private calculateOptimalPrice(
    currentPrice: number,
    elasticity: number
  ): number {
    // Simplified optimal price calculation
    // In production, use more sophisticated pricing models

    if (elasticity >= -1) {
      // Inelastic demand - can increase price
      return currentPrice * 1.1
    } else {
      // Elastic demand - optimize for revenue
      const optimalMarkup = Math.abs(elasticity) / (Math.abs(elasticity) - 1)
      return currentPrice * optimalMarkup
    }
  }

  /**
   * Determine market position
   */
  private determineMarketPosition(
    currentPrice: number,
    basePrice: number
  ): 'premium' | 'competitive' | 'budget' {
    const markup = (currentPrice - basePrice) / basePrice

    if (markup > 0.5) return 'premium'
    if (markup > 0.2) return 'competitive'
    return 'budget'
  }

  /**
   * Calculate seasonality analysis
   */
  private calculateSeasonality(
    historicalData: any[]
  ): Omit<SeasonalityAnalysis, 'productId'> {
    const monthlyData = new Array(12).fill(0)
    const monthlyCount = new Array(12).fill(0)

    historicalData.forEach((item) => {
      const month = new Date(item.created_at).getMonth()
      monthlyData[month] += item.quantity
      monthlyCount[month]++
    })

    const avgMonthlySales = monthlyData.map((total, month) =>
      monthlyCount[month] > 0 ? total / monthlyCount[month] : 0
    )

    const overallAvg = avgMonthlySales.reduce((sum, avg) => sum + avg, 0) / 12
    const maxAvg = Math.max(...avgMonthlySales)
    const minAvg = Math.min(...avgMonthlySales)

    // Calculate seasonality score
    const seasonalityScore = maxAvg > 0 ? (maxAvg - minAvg) / overallAvg : 0

    // Identify peak and low seasons
    const peakSeasons: string[] = []
    const lowSeasons: string[] = []
    const seasonalFactors: Record<string, number> = {}

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    avgMonthlySales.forEach((avg, month) => {
      const factor = overallAvg > 0 ? avg / overallAvg : 1
      seasonalFactors[monthNames[month]] = factor

      if (factor > 1.2) {
        peakSeasons.push(monthNames[month])
      } else if (factor < 0.8) {
        lowSeasons.push(monthNames[month])
      }
    })

    return {
      seasonalityScore,
      peakSeasons,
      lowSeasons,
      seasonalFactors,
    }
  }

  // Helper methods for getting data
  private async getPriceData(timeRange: {
    start: Date
    end: Date
  }): Promise<any[]> {
    const { data } = await this.supabase
      .from('order_items')
      .select('unit_price, created_at')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())

    return data || []
  }

  private async getDemandData(timeRange: {
    start: Date
    end: Date
  }): Promise<any[]> {
    const { data } = await this.supabase
      .from('order_items')
      .select('quantity, created_at')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())

    return data || []
  }

  private async getInventoryData(timeRange: {
    start: Date
    end: Date
  }): Promise<any[]> {
    const { data } = await this.supabase
      .from('inventory')
      .select('quantity, created_at')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())

    return data || []
  }

  private async getRevenueData(timeRange: {
    start: Date
    end: Date
  }): Promise<any[]> {
    const { data } = await this.supabase
      .from('orders')
      .select('total_amount, created_at')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())

    return data || []
  }
}
