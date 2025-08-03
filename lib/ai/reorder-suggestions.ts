import { createServerClient } from '@/lib/supabase/server'
import type { ReorderSuggestion } from '@/types/ai.types'
import { DemandForecaster } from './demand-forecasting'

export class ReorderPointCalculator {
  private supabase: ReturnType<typeof createServerClient>
  private forecaster: DemandForecaster

  constructor() {
    this.supabase = createServerClient()
    this.forecaster = new DemandForecaster()
  }

  async calculateReorderPoints(
    organizationId: string
  ): Promise<ReorderSuggestion[]> {
    // Get all products with inventory
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
      // Skip if product data is missing
      if (!item.product) continue

      // Get demand forecast
      const forecast = await this.forecaster.forecastDemand(
        item.product_id,
        item.warehouse_id,
        organizationId,
        14 // 2 week horizon for reorder calculation
      )

      // Calculate lead time demand
      const leadTimeDays = item.product.lead_time_days || 7
      const avgDailyDemand =
        forecast.predictions.reduce((a, b) => a + b, 0) /
        forecast.predictions.length
      const leadTimeDemand = avgDailyDemand * leadTimeDays

      // Calculate safety stock
      const safetyStock = this.calculateSafetyStock(
        forecast.predictions,
        leadTimeDays,
        item.product.service_level || 0.95
      )

      // Reorder point = Lead time demand + Safety stock
      const reorderPoint = Math.ceil(leadTimeDemand + safetyStock)

      // Economic order quantity
      const eoq = this.calculateEOQ(
        avgDailyDemand * 365,
        item.product.order_cost || 50,
        item.product.holding_cost || 0.25 * item.product.unit_price
      )

      suggestions.push({
        productId: item.product_id,
        warehouseId: item.warehouse_id,
        currentStock: item.quantity,
        reorderPoint,
        reorderQuantity: Math.ceil(eoq),
        safetyStock: Math.ceil(safetyStock),
        leadTimeDays,
        confidence: forecast.confidence,
        reasoning: this.generateReasoning({
          avgDailyDemand,
          leadTimeDays,
          serviceLevel: item.product.service_level || 0.95,
          currentStock: item.quantity,
          reorderPoint,
        }),
      })
    }

    // Store suggestions
    await this.storeSuggestions(organizationId, suggestions)

    return suggestions
  }

  private calculateSafetyStock(
    demandForecast: number[],
    leadTimeDays: number,
    serviceLevel: number
  ): number {
    // Calculate standard deviation of demand
    const mean = demandForecast.reduce((a, b) => a + b, 0) / demandForecast.length
    const variance =
      demandForecast.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      demandForecast.length
    const stdDev = Math.sqrt(variance)

    // Z-score for service level
    const zScore = this.getZScore(serviceLevel)

    // Safety stock = Z-score × σ × √(Lead time)
    return zScore * stdDev * Math.sqrt(leadTimeDays)
  }

  private calculateEOQ(
    annualDemand: number,
    orderCost: number,
    holdingCost: number
  ): number {
    // Economic Order Quantity = √(2 × D × S / H)
    // D = Annual demand
    // S = Order cost
    // H = Holding cost per unit per year
    if (holdingCost === 0) return 0
    return Math.sqrt((2 * annualDemand * orderCost) / holdingCost)
  }

  private getZScore(serviceLevel: number): number {
    // Approximate Z-scores for common service levels
    const zScores: Record<number, number> = {
      0.9: 1.28,
      0.95: 1.65,
      0.97: 1.88,
      0.99: 2.33,
    }

    // Find closest service level
    const closest = Object.keys(zScores)
      .map(Number)
      .reduce((prev, curr) =>
        Math.abs(curr - serviceLevel) < Math.abs(prev - serviceLevel)
          ? curr
          : prev
      )

    return zScores[closest]
  }

  private generateReasoning(params: {
    avgDailyDemand: number
    leadTimeDays: number
    serviceLevel: number
    currentStock: number
    reorderPoint: number
  }): string {
    const {
      avgDailyDemand,
      leadTimeDays,
      serviceLevel,
      currentStock,
      reorderPoint,
    } = params

    const daysUntilReorder = Math.max(
      0,
      (currentStock - reorderPoint) / avgDailyDemand
    )

    return (
      `Based on average daily demand of ${avgDailyDemand.toFixed(1)} units and ` +
      `${leadTimeDays} day lead time, maintaining ${(serviceLevel * 100).toFixed(0)}% ` +
      `service level requires reorder point of ${reorderPoint} units. ` +
      `Current stock will reach reorder point in approximately ${daysUntilReorder.toFixed(0)} days.`
    )
  }

  private async storeSuggestions(
    organizationId: string,
    suggestions: ReorderSuggestion[]
  ): Promise<void> {
    const predictions = suggestions.map((s) => ({
      organization_id: organizationId,
      prediction_type: 'reorder',
      entity_type: 'product',
      entity_id: s.productId,
      prediction_date: new Date().toISOString().split('T')[0],
      prediction_value: {
        reorderPoint: s.reorderPoint,
        reorderQuantity: s.reorderQuantity,
        safetyStock: s.safetyStock,
        warehouseId: s.warehouseId,
      },
      confidence_score: s.confidence,
      model_version: '1.0.0',
      prediction_start: new Date().toISOString().split('T')[0],
      prediction_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000 // Cache for 7 days
      ).toISOString(),
    }))

    await this.supabase.from('ai_predictions').upsert(predictions, {
      onConflict:
        'organization_id,prediction_type,entity_type,entity_id,prediction_date',
    })
  }
}