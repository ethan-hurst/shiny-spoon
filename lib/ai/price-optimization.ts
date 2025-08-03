import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createServerClient } from '@/lib/supabase/server'
import type { PriceRecommendation } from '@/types/ai.types'

export class PriceOptimizer {
  private supabase: ReturnType<typeof createServerClient>

  constructor() {
    this.supabase = createServerClient()
  }

  async optimizePricing(
    organizationId: string,
    productIds?: string[]
  ): Promise<PriceRecommendation[]> {
    // Get products to optimize
    const query = this.supabase
      .from('products')
      .select(
        `
        *,
        inventory(quantity, warehouse_id)
      `
      )
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (productIds?.length) {
      query.in('id', productIds)
    }

    const { data: products } = await query

    if (!products) return []

    const recommendations: PriceRecommendation[] = []

    for (const product of products) {
      // Get market data
      const marketData = await this.getMarketData(product)

      // Get demand elasticity
      const elasticity = await this.calculateDemandElasticity(product)

      // Get competitive pricing
      const competitorPrices = await this.getCompetitorPrices(product)

      // Calculate optimal price
      const optimalPrice = this.calculateOptimalPrice({
        currentPrice: product.price,
        cost: product.unit_cost || product.price * 0.6, // Assume 40% margin if cost not set
        elasticity,
        competitorPrices,
        inventoryLevel: product.inventory?.reduce(
          (sum: number, i: any) => sum + i.quantity,
          0
        ) || 0,
        marketData,
      })

      // Generate AI reasoning
      const reasoning = await this.generatePricingReasoning({
        product,
        currentPrice: product.price,
        suggestedPrice: optimalPrice,
        elasticity,
        competitorPrices,
        marketData,
      })

      recommendations.push({
        productId: product.id,
        currentPrice: product.price,
        suggestedPrice: optimalPrice,
        estimatedImpact: this.estimateRevenueImpact(
          product,
          product.price,
          optimalPrice,
          elasticity
        ),
        confidence: this.calculateConfidence(marketData, competitorPrices),
        reasoning,
        factors: {
          demandElasticity: elasticity,
          competitorAverage: competitorPrices.length
            ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
            : null,
          inventoryPressure: this.calculateInventoryPressure(product),
          marginTarget: 0.3, // 30% target margin
        },
      })
    }

    // Store recommendations
    await this.storeRecommendations(organizationId, recommendations)

    return recommendations
  }

  private async getMarketData(product: any): Promise<any> {
    // Get historical order data to determine market trends
    const { data: recentOrders } = await this.supabase
      .from('order_items')
      .select('quantity, price, created_at')
      .eq('product_id', product.id)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })

    if (!recentOrders || recentOrders.length === 0) {
      return {
        trend: 'stable',
        seasonality: 1.0,
        marketGrowth: 0.05,
      }
    }

    // Calculate trend
    const firstMonth = recentOrders.slice(0, recentOrders.length / 3)
    const lastMonth = recentOrders.slice(-recentOrders.length / 3)
    
    const firstMonthQty = firstMonth.reduce((sum, o) => sum + o.quantity, 0)
    const lastMonthQty = lastMonth.reduce((sum, o) => sum + o.quantity, 0)
    
    const growthRate = firstMonthQty > 0 
      ? (lastMonthQty - firstMonthQty) / firstMonthQty
      : 0

    return {
      trend: growthRate > 0.1 ? 'growing' : growthRate < -0.1 ? 'declining' : 'stable',
      seasonality: 1.0, // Would calculate based on historical patterns
      marketGrowth: growthRate,
    }
  }

  private async calculateDemandElasticity(product: any): Promise<number> {
    // Get historical price changes and corresponding demand changes
    const { data: orderHistory } = await this.supabase
      .from('order_items')
      .select('quantity, price, created_at')
      .eq('product_id', product.id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!orderHistory || orderHistory.length < 10) {
      // Default elasticity for new products
      return -1.2
    }

    // Group by price points
    const priceGroups = new Map<number, number[]>()
    orderHistory.forEach(order => {
      const price = order.price
      if (!priceGroups.has(price)) {
        priceGroups.set(price, [])
      }
      priceGroups.get(price)!.push(order.quantity)
    })

    // Need at least 2 different price points
    if (priceGroups.size < 2) {
      return -1.2
    }

    // Calculate average quantity for each price
    const priceQuantityPairs: [number, number][] = []
    priceGroups.forEach((quantities, price) => {
      const avgQuantity = quantities.reduce((a, b) => a + b, 0) / quantities.length
      priceQuantityPairs.push([price, avgQuantity])
    })

    // Sort by price
    priceQuantityPairs.sort((a, b) => a[0] - b[0])

    // Calculate elasticity between consecutive price points
    let totalElasticity = 0
    let count = 0

    for (let i = 1; i < priceQuantityPairs.length; i++) {
      const [p1, q1] = priceQuantityPairs[i - 1]
      const [p2, q2] = priceQuantityPairs[i]
      
      if (p2 !== p1 && q1 !== 0) {
        const priceChange = (p2 - p1) / p1
        const quantityChange = (q2 - q1) / q1
        const elasticity = quantityChange / priceChange
        
        totalElasticity += elasticity
        count++
      }
    }

    return count > 0 ? totalElasticity / count : -1.2
  }

  private async getCompetitorPrices(product: any): Promise<number[]> {
    // In a real implementation, this would integrate with competitor monitoring APIs
    // For now, simulate competitor prices based on current price
    const basePrice = product.price
    const variance = 0.1 // 10% variance
    
    return [
      basePrice * (1 - variance),
      basePrice * (1 - variance / 2),
      basePrice * (1 + variance / 2),
      basePrice * (1 + variance),
    ].filter(p => p > 0)
  }

  private calculateOptimalPrice(params: {
    currentPrice: number
    cost: number
    elasticity: number
    competitorPrices: number[]
    inventoryLevel: number
    marketData: any
  }): number {
    const { currentPrice, cost, elasticity, competitorPrices, inventoryLevel, marketData } =
      params

    // Base optimal price using markup pricing
    const targetMargin = 0.3
    const markupPrice = cost / (1 - targetMargin)

    // Adjust for competition
    const avgCompetitorPrice = competitorPrices.length
      ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
      : currentPrice

    // Adjust for inventory pressure
    const inventoryAdjustment = this.getInventoryPriceAdjustment(inventoryLevel)

    // Adjust for market trends
    const trendAdjustment = marketData.trend === 'growing' ? 0.05 : 
                           marketData.trend === 'declining' ? -0.05 : 0

    // Combine factors with weights
    let optimalPrice =
      markupPrice * 0.3 + 
      avgCompetitorPrice * 0.4 + 
      currentPrice * 0.3

    // Apply adjustments
    optimalPrice *= (1 + inventoryAdjustment + trendAdjustment)

    // Ensure minimum margin
    const minPrice = cost * 1.15 // 15% minimum margin
    optimalPrice = Math.max(optimalPrice, minPrice)

    // Round to pricing points
    return Math.round(optimalPrice * 100) / 100
  }

  private getInventoryPriceAdjustment(inventoryLevel: number): number {
    // High inventory = lower price, low inventory = higher price
    if (inventoryLevel > 1000) return -0.05 // 5% discount for high inventory
    if (inventoryLevel > 500) return -0.02 // 2% discount
    if (inventoryLevel < 50) return 0.05 // 5% premium for low inventory
    if (inventoryLevel < 100) return 0.02 // 2% premium
    return 0
  }

  private calculateInventoryPressure(product: any): number {
    const totalInventory = product.inventory?.reduce(
      (sum: number, i: any) => sum + i.quantity,
      0
    ) || 0
    
    // Estimate based on inventory levels
    if (totalInventory === 0) return 0.1 // Low pressure - out of stock
    if (totalInventory < 50) return 0.2 // Low pressure
    if (totalInventory < 200) return 0.5 // Medium pressure
    if (totalInventory < 500) return 0.7 // Higher pressure
    return 0.9 // High pressure to sell
  }

  private estimateRevenueImpact(
    product: any,
    currentPrice: number,
    newPrice: number,
    elasticity: number
  ): {
    revenueChange: number
    volumeChange: number
  } {
    const priceChange = (newPrice - currentPrice) / currentPrice
    const volumeChange = elasticity * priceChange
    const revenueChange = (1 + priceChange) * (1 + volumeChange) - 1

    return {
      revenueChange,
      volumeChange,
    }
  }

  private calculateConfidence(
    marketData: any,
    competitorPrices: number[]
  ): number {
    // Base confidence on data quality
    let confidence = 0.7

    if (competitorPrices.length >= 3) confidence += 0.1
    if (marketData.trend === 'stable') confidence += 0.1
    if (Math.abs(marketData.marketGrowth) < 0.2) confidence += 0.05

    return Math.min(confidence, 0.95)
  }

  private async generatePricingReasoning(params: any): Promise<string> {
    try {
      const { text } = await generateText({
        model: openai('gpt-4o'),
        system:
          'You are a pricing expert. Provide clear, concise reasoning for price recommendations.',
        prompt: `Explain this price recommendation:
                 Product: ${params.product.name}
                 Current Price: $${params.currentPrice.toFixed(2)}
                 Suggested Price: $${params.suggestedPrice.toFixed(2)}
                 Demand Elasticity: ${params.elasticity.toFixed(2)}
                 Competitor Average: $${params.competitorPrices.length > 0 
                   ? (params.competitorPrices.reduce((a: number, b: number) => a + b, 0) / params.competitorPrices.length).toFixed(2)
                   : 'N/A'}
                 Market Trend: ${params.marketData.trend}
                 
                 Provide a 2-3 sentence explanation for this pricing recommendation.`,
        temperature: 0.3,
        maxTokens: 150,
      })

      return text
    } catch (error) {
      // Fallback reasoning if AI fails
      const priceChange = ((params.suggestedPrice - params.currentPrice) / params.currentPrice * 100).toFixed(1)
      const direction = params.suggestedPrice > params.currentPrice ? 'increase' : 'decrease'
      
      return `Recommend ${direction} of ${Math.abs(Number(priceChange))}% based on market analysis. ` +
             `This optimization considers demand elasticity of ${params.elasticity.toFixed(2)} and current inventory levels.`
    }
  }

  private async storeRecommendations(
    organizationId: string,
    recommendations: PriceRecommendation[]
  ): Promise<void> {
    const predictions = recommendations.map((r) => ({
      organization_id: organizationId,
      prediction_type: 'price',
      entity_type: 'product',
      entity_id: r.productId,
      prediction_date: new Date().toISOString().split('T')[0],
      prediction_value: {
        currentPrice: r.currentPrice,
        suggestedPrice: r.suggestedPrice,
        estimatedImpact: r.estimatedImpact,
        factors: r.factors,
      },
      confidence_score: r.confidence,
      model_version: '1.0.0',
      prediction_start: new Date().toISOString().split('T')[0],
      prediction_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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