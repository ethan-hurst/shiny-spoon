import { createServerClient } from '@/lib/supabase/server'
import type {
  AnomalyAlert,
  DemandForecast,
  PriceRecommendation,
  ReorderSuggestion,
  TrendAnalysis,
} from '@/types/ai.types'

export class AIService {
  private supabase: ReturnType<typeof createServerClient>

  constructor() {
    this.supabase = createServerClient()
  }

  async generateInsights(
    organizationId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<{
    summary: string
    recommendations: string[]
    alerts: AnomalyAlert[]
  }> {
    // Fetch relevant data
    const [inventory, orders, pricing] = await Promise.all([
      this.getInventoryData(organizationId, dateRange),
      this.getOrderData(organizationId, dateRange),
      this.getPricingData(organizationId, dateRange),
    ])

    // Generate insights using AI (simplified for now)
    const insights = this.generateMockInsights(inventory, orders, pricing)

    // Store insights
    await this.storeInsights(organizationId, insights)

    return insights
  }

  async getDemandForecast(
    productId: string,
    warehouseId: string,
    organizationId: string,
    horizonDays: number = 30
  ): Promise<DemandForecast> {
    // Get historical data
    const historicalData = await this.getHistoricalDemand(
      productId,
      warehouseId
    )

    // Generate forecast (simplified)
    const forecast = this.generateMockForecast(historicalData, horizonDays)

    // Store prediction
    await this.storePrediction({
      productId,
      warehouseId,
      organizationId,
      forecast,
      horizonDays,
    })

    return {
      productId,
      warehouseId,
      predictions: forecast.predictions,
      confidence: forecast.confidence,
      method: 'ensemble',
      generatedAt: new Date(),
    }
  }

  async getReorderSuggestions(
    organizationId: string
  ): Promise<ReorderSuggestion[]> {
    // Get inventory data
    const { data: inventory } = await this.supabase
      .from('inventory')
      .select(
        `
        *,
        product:products(*),
        warehouse:warehouses(*)
      `
      )
      .eq('organization_id', organizationId)

    if (!inventory) return []

    const suggestions: ReorderSuggestion[] = []

    for (const item of inventory) {
      // Calculate reorder point (simplified)
      const avgDailyDemand = 10 // Would calculate from historical data
      const leadTimeDays = item.product?.lead_time_days || 7
      const safetyStock = Math.ceil(avgDailyDemand * 0.5)
      const reorderPoint = Math.ceil(avgDailyDemand * leadTimeDays + safetyStock)

      suggestions.push({
        productId: item.product_id,
        warehouseId: item.warehouse_id,
        currentStock: item.quantity,
        reorderPoint,
        reorderQuantity: Math.ceil(avgDailyDemand * 30), // 30 days supply
        safetyStock,
        leadTimeDays,
        confidence: 0.85,
        reasoning: `Based on average daily demand of ${avgDailyDemand} units and ${leadTimeDays} day lead time`,
      })
    }

    return suggestions
  }

  async getPriceRecommendations(
    organizationId: string,
    productIds?: string[]
  ): Promise<PriceRecommendation[]> {
    // Get products to optimize
    const query = this.supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)

    if (productIds?.length) {
      query.in('id', productIds)
    }

    const { data: products } = await query

    if (!products) return []

    const recommendations: PriceRecommendation[] = []

    for (const product of products) {
      const currentPrice = product.price || 0
      const suggestedPrice = currentPrice * 1.1 // 10% increase
      const elasticity = -1.2 // Mock elasticity

      recommendations.push({
        productId: product.id,
        currentPrice,
        suggestedPrice,
        estimatedImpact: {
          revenueChange: 0.08, // 8% increase
          volumeChange: -0.12, // 12% decrease
        },
        confidence: 0.78,
        reasoning: 'Price optimization based on demand elasticity and market conditions',
        factors: {
          demandElasticity: elasticity,
          competitorAverage: currentPrice * 0.95,
          inventoryPressure: 0.5,
          marginTarget: 0.3,
        },
      })
    }

    return recommendations
  }

  async detectAnomalies(
    organizationId: string,
    scope: 'all' | 'inventory' | 'orders' | 'pricing' = 'all'
  ): Promise<AnomalyAlert[]> {
    const anomalies: AnomalyAlert[] = []

    if (scope === 'all' || scope === 'inventory') {
      const inventoryAnomalies = await this.detectInventoryAnomalies(organizationId)
      anomalies.push(...inventoryAnomalies)
    }

    if (scope === 'all' || scope === 'orders') {
      const orderAnomalies = await this.detectOrderAnomalies(organizationId)
      anomalies.push(...orderAnomalies)
    }

    if (scope === 'all' || scope === 'pricing') {
      const pricingAnomalies = await this.detectPricingAnomalies(organizationId)
      anomalies.push(...pricingAnomalies)
    }

    return anomalies
  }

  private async getInventoryData(
    organizationId: string,
    dateRange: { from: Date; to: Date }
  ) {
    const { data } = await this.supabase
      .from('inventory')
      .select('*')
      .eq('organization_id', organizationId)

    return {
      summary: {
        totalProducts: data?.length || 0,
        lowStockItems: data?.filter((i) => i.quantity < 10).length || 0,
        totalValue: data?.reduce((sum, i) => sum + (i.value || 0), 0) || 0,
      },
      data,
    }
  }

  private async getOrderData(
    organizationId: string,
    dateRange: { from: Date; to: Date }
  ) {
    const { data } = await this.supabase
      .from('orders')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())

    const patterns = {
      totalOrders: data?.length || 0,
      averageOrderValue: data?.length
        ? data.reduce((sum, o) => sum + (o.total || 0), 0) / data.length
        : 0,
      peakDays: this.identifyPeakDays(data || []),
    }

    return { patterns, data }
  }

  private async getPricingData(
    organizationId: string,
    dateRange: { from: Date; to: Date }
  ) {
    const { data } = await this.supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)

    return {
      overview: {
        priceChanges: 0, // Would track price changes
        averageMargin: this.calculateAverageMargin(data || []),
      },
      data,
    }
  }

  private generateMockInsights(inventory: any, orders: any, pricing: any) {
    return {
      summary: 'Your inventory accuracy improved by 2.3% this week. Low stock alerts decreased by 15%.',
      recommendations: [
        'Review pricing strategy for top 5 products',
        'Increase safety stock for high-demand items',
        'Monitor seasonal demand patterns',
      ],
      alerts: [
        {
          id: 'anomaly-1',
          type: 'inventory_spike',
          severity: 'warning',
          title: 'Unusual Inventory Adjustment',
          description: 'Large adjustment detected for Product A',
          detectedAt: new Date(),
          confidence: 0.9,
          relatedEntities: [{ type: 'product', id: '123', name: 'Product A' }],
          suggestedActions: ['Verify adjustment', 'Check for errors'],
        },
      ],
    }
  }

  private async getHistoricalDemand(
    productId: string,
    warehouseId: string
  ): Promise<any[]> {
    const { data } = await this.supabase
      .from('order_items')
      .select('quantity, created_at')
      .eq('product_id', productId)
      .gte(
        'created_at',
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      )

    return data || []
  }

  private generateMockForecast(historicalData: any[], horizonDays: number) {
    const avgDemand = historicalData.length > 0
      ? historicalData.reduce((sum, item) => sum + item.quantity, 0) / historicalData.length
      : 10

    const predictions = Array.from({ length: horizonDays }, (_, i) =>
      Math.round(avgDemand * (1 + Math.sin(i / 7) * 0.2)) // Add some seasonality
    )

    return {
      predictions,
      confidence: 0.85,
    }
  }

  private identifyPeakDays(orders: any[]): string[] {
    // Mock implementation
    return ['Monday', 'Wednesday', 'Friday']
  }

  private calculateAverageMargin(products: any[]): number {
    if (!products.length) return 0
    const margins = products.map(p => (p.price - p.unit_cost) / p.price)
    return margins.reduce((sum, margin) => sum + margin, 0) / margins.length
  }

  private async detectInventoryAnomalies(organizationId: string): Promise<AnomalyAlert[]> {
    const { data: inventory } = await this.supabase
      .from('inventory')
      .select('*, products(*)')
      .eq('organization_id', organizationId)

    const anomalies: AnomalyAlert[] = []

    if (inventory) {
      for (const item of inventory) {
        // Zero stock for active products
        if (item.quantity === 0 && item.products?.is_active) {
          anomalies.push({
            id: `stock-out-${item.id}`,
            type: 'stock_out',
            severity: 'critical',
            title: 'Product Out of Stock',
            description: `${item.products.name} is completely out of stock`,
            detectedAt: new Date(),
            confidence: 1.0,
            relatedEntities: [
              {
                type: 'product',
                id: item.product_id,
                name: item.products.name,
              },
            ],
            suggestedActions: [
              'Place emergency reorder',
              'Check for pending shipments',
              'Update product availability status',
            ],
          })
        }

        // Low stock
        if (item.quantity <= (item.reorder_point || 5)) {
          anomalies.push({
            id: `low-stock-${item.id}`,
            type: 'low_stock',
            severity: 'warning',
            title: 'Low Stock Alert',
            description: `${item.products.name} has only ${item.quantity} units remaining`,
            detectedAt: new Date(),
            confidence: 0.9,
            relatedEntities: [
              {
                type: 'product',
                id: item.product_id,
                name: item.products.name,
              },
            ],
            suggestedActions: [
              'Place reorder',
              'Check demand forecast',
              'Review safety stock levels',
            ],
          })
        }
      }
    }

    return anomalies
  }

  private async detectOrderAnomalies(organizationId: string): Promise<AnomalyAlert[]> {
    const { data: recentOrders } = await this.supabase
      .from('orders')
      .select('*')
      .eq('organization_id', organizationId)
      .gte(
        'created_at',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )

    const anomalies: AnomalyAlert[] = []

    if (recentOrders) {
      // Detect large orders
      const largeOrders = recentOrders.filter((o) => o.total > 10000)
      for (const order of largeOrders) {
        anomalies.push({
          id: `large-order-${order.id}`,
          type: 'large_order',
          severity: 'info',
          title: 'Large Order Detected',
          description: `Order #${order.order_number} for $${order.total.toLocaleString()}`,
          detectedAt: new Date(),
          confidence: 1.0,
          relatedEntities: [
            {
              type: 'order',
              id: order.id,
              name: order.order_number,
            },
          ],
          suggestedActions: [
            'Verify customer credit',
            'Confirm inventory availability',
            'Consider manual review',
          ],
        })
      }
    }

    return anomalies
  }

  private async detectPricingAnomalies(organizationId: string): Promise<AnomalyAlert[]> {
    // Mock pricing anomalies
    return [
      {
        id: 'price-anomaly-1',
        type: 'price_volatility',
        severity: 'warning',
        title: 'High Price Volatility',
        description: 'Product X has had multiple price changes in 7 days',
        detectedAt: new Date(),
        confidence: 0.9,
        relatedEntities: [
          {
            type: 'product',
            id: '123',
            name: 'Product X',
          },
        ],
        suggestedActions: [
          'Review pricing strategy',
          'Check competitor pricing',
          'Stabilize pricing',
        ],
      },
    ]
  }

  private async storeInsights(
    organizationId: string,
    insights: any
  ): Promise<void> {
    const insightRecords = [
      {
        organization_id: organizationId,
        insight_type: 'summary',
        title: 'Daily Business Summary',
        content: insights.summary,
        severity: 'info',
      },
      ...insights.recommendations.map((rec: string) => ({
        organization_id: organizationId,
        insight_type: 'recommendation',
        title: 'AI Recommendation',
        content: rec,
        severity: 'info',
      })),
    ]

    await this.supabase.from('ai_insights').insert(insightRecords)
  }

  private async storePrediction(prediction: any): Promise<void> {
    await this.supabase.from('ai_predictions').insert({
      organization_id: prediction.organizationId,
      prediction_type: 'demand',
      entity_type: 'product',
      entity_id: prediction.productId,
      prediction_date: new Date().toISOString().split('T')[0],
      prediction_value: {
        forecast: prediction.forecast.predictions,
        horizonDays: prediction.horizonDays,
      },
      confidence_score: prediction.forecast.confidence,
      model_version: '1.0.0',
      prediction_start: new Date().toISOString().split('T')[0],
      prediction_end: new Date(
        Date.now() + prediction.horizonDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0],
    })
  }
} 