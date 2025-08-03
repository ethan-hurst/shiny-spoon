import { createServerClient } from '@/lib/supabase/server'
import type { AnomalyAlert } from '@/types/ai.types'

export class AnomalyDetector {
  private supabase: ReturnType<typeof createServerClient>

  constructor() {
    this.supabase = createServerClient()
  }

  async detectAnomalies(
    organizationId: string,
    scope: 'all' | 'inventory' | 'orders' | 'pricing' = 'all'
  ): Promise<AnomalyAlert[]> {
    const anomalies: AnomalyAlert[] = []

    if (scope === 'all' || scope === 'inventory') {
      const inventoryAnomalies =
        await this.detectInventoryAnomalies(organizationId)
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

    // Store anomalies as insights
    await this.storeAnomalies(organizationId, anomalies)

    return anomalies
  }

  private async detectInventoryAnomalies(
    organizationId: string
  ): Promise<AnomalyAlert[]> {
    const anomalies: AnomalyAlert[] = []

    // Get recent inventory adjustments
    const { data: adjustments } = await this.supabase
      .from('inventory_adjustments')
      .select(
        `
        *,
        inventory!inner(
          product_id,
          warehouse_id,
          products(id, name, sku)
        )
      `
      )
      .eq('organization_id', organizationId)
      .gte(
        'created_at',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order('created_at', { ascending: false })

    if (adjustments) {
      // Detect unusual adjustments
      for (const adjustment of adjustments) {
        // Large single adjustment
        if (Math.abs(adjustment.adjustment) > 100) {
          anomalies.push({
            id: `inv-anomaly-${adjustment.id}`,
            type: 'inventory_spike',
            severity: Math.abs(adjustment.adjustment) > 500 ? 'critical' : 'warning',
            title: 'Unusual Inventory Adjustment',
            description: `Large ${adjustment.adjustment > 0 ? 'increase' : 'decrease'} of ${Math.abs(adjustment.adjustment)} units for ${adjustment.inventory?.products?.name || 'Unknown Product'}`,
            detectedAt: new Date(),
            confidence: 0.9,
            relatedEntities: adjustment.inventory?.product_id ? [
              {
                type: 'product',
                id: adjustment.inventory.product_id,
                name: adjustment.inventory.products?.name || 'Unknown',
              },
            ] : [],
            suggestedActions: [
              'Verify the adjustment was intentional',
              'Check for data entry errors',
              'Review security logs for unauthorized access',
            ],
          })
        }
      }

      // Detect repeated adjustments
      const adjustmentsByProduct = new Map<string, any[]>()
      adjustments.forEach(adj => {
        if (adj.inventory?.product_id) {
          const key = `${adj.inventory.product_id}-${adj.warehouse_id}`
          if (!adjustmentsByProduct.has(key)) {
            adjustmentsByProduct.set(key, [])
          }
          adjustmentsByProduct.get(key)!.push(adj)
        }
      })

      adjustmentsByProduct.forEach((productAdjustments, key) => {
        if (productAdjustments.length > 5) {
          const product = productAdjustments[0].inventory?.products
          anomalies.push({
            id: `inv-pattern-${key}`,
            type: 'adjustment_pattern',
            severity: 'warning',
            title: 'Frequent Inventory Adjustments',
            description: `${productAdjustments.length} adjustments in the last 7 days for ${product?.name || 'Unknown Product'}`,
            detectedAt: new Date(),
            confidence: 0.85,
            relatedEntities: product ? [
              {
                type: 'product',
                id: product.id,
                name: product.name,
              },
            ] : [],
            suggestedActions: [
              'Investigate root cause of frequent adjustments',
              'Consider cycle count accuracy',
              'Review warehouse procedures',
            ],
          })
        }
      })
    }

    // Detect stock level anomalies
    const { data: inventory } = await this.supabase
      .from('inventory')
      .select('*, products(*)')
      .eq('organization_id', organizationId)

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

        // Excess inventory
        const monthsOfSupply = await this.calculateMonthsOfSupply(item)
        if (monthsOfSupply > 12) {
          anomalies.push({
            id: `excess-${item.id}`,
            type: 'excess_inventory',
            severity: 'warning',
            title: 'Excess Inventory Detected',
            description: `${item.products?.name} has ${monthsOfSupply.toFixed(1)} months of supply`,
            detectedAt: new Date(),
            confidence: 0.8,
            relatedEntities: [
              {
                type: 'product',
                id: item.product_id,
                name: item.products?.name || 'Unknown',
              },
            ],
            suggestedActions: [
              'Consider promotional pricing',
              'Review demand forecast',
              'Evaluate storage costs',
            ],
          })
        }
      }
    }

    return anomalies
  }

  private async detectOrderAnomalies(
    organizationId: string
  ): Promise<AnomalyAlert[]> {
    const anomalies: AnomalyAlert[] = []

    // Get recent orders
    const { data: recentOrders } = await this.supabase
      .from('orders')
      .select('*')
      .eq('organization_id', organizationId)
      .gte(
        'created_at',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )

    if (!recentOrders) return anomalies

    // Get historical orders for comparison
    const { data: historicalOrders } = await this.supabase
      .from('orders')
      .select('created_at, total')
      .eq('organization_id', organizationId)
      .gte(
        'created_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      )

    if (historicalOrders) {
      const dailyOrderCounts = this.aggregateByDay(historicalOrders)
      const stats = this.calculateStats(dailyOrderCounts)
      const todayCount = recentOrders.length

      // Check if today's orders are anomalous
      if (todayCount > stats.mean + 2 * stats.stdDev) {
        anomalies.push({
          id: `order-spike-${new Date().toISOString()}`,
          type: 'order_spike',
          severity: 'info',
          title: 'Unusual Order Volume',
          description: `Today's order count (${todayCount}) is significantly higher than average (${stats.mean.toFixed(1)})`,
          detectedAt: new Date(),
          confidence: 0.85,
          relatedEntities: [],
          suggestedActions: [
            'Verify inventory availability',
            'Check for promotional campaigns',
            'Ensure fulfillment capacity',
          ],
        })
      }

      // Check for unusual drop in orders
      if (todayCount < stats.mean - 2 * stats.stdDev && stats.mean > 5) {
        anomalies.push({
          id: `order-drop-${new Date().toISOString()}`,
          type: 'order_drop',
          severity: 'warning',
          title: 'Significant Drop in Orders',
          description: `Today's order count (${todayCount}) is significantly lower than average (${stats.mean.toFixed(1)})`,
          detectedAt: new Date(),
          confidence: 0.85,
          relatedEntities: [],
          suggestedActions: [
            'Check website functionality',
            'Review recent pricing changes',
            'Verify integration status',
          ],
        })
      }
    }

    // Detect unusual order patterns
    const largeOrders = recentOrders.filter((o) => o.total > 10000)
    if (largeOrders.length > 0) {
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

  private async detectPricingAnomalies(
    organizationId: string
  ): Promise<AnomalyAlert[]> {
    const anomalies: AnomalyAlert[] = []

    // Get recent price changes
    const { data: priceChanges } = await this.supabase
      .from('product_pricing_history')
      .select(
        `
        *,
        product:products(*)
      `
      )
      .eq('organization_id', organizationId)
      .gte(
        'created_at',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order('created_at', { ascending: false })

    if (!priceChanges) return anomalies

    // Group by product
    const productPriceChanges = new Map<string, any[]>()
    priceChanges.forEach((change) => {
      const changes = productPriceChanges.get(change.product_id) || []
      changes.push(change)
      productPriceChanges.set(change.product_id, changes)
    })

    // Detect anomalies
    for (const [productId, changes] of productPriceChanges) {
      // Multiple price changes
      if (changes.length > 3) {
        anomalies.push({
          id: `price-volatility-${productId}`,
          type: 'price_volatility',
          severity: 'warning',
          title: 'High Price Volatility',
          description: `${changes[0].product?.name} has had ${changes.length} price changes in 7 days`,
          detectedAt: new Date(),
          confidence: 0.9,
          relatedEntities: [
            {
              type: 'product',
              id: productId,
              name: changes[0].product?.name || 'Unknown',
            },
          ],
          suggestedActions: [
            'Review pricing strategy',
            'Check competitor pricing',
            'Stabilize pricing to avoid customer confusion',
          ],
        })
      }

      // Large price changes
      for (let i = 1; i < changes.length; i++) {
        const priceChange =
          (changes[i].price - changes[i - 1].price) / changes[i - 1].price
        if (Math.abs(priceChange) > 0.2) {
          anomalies.push({
            id: `large-price-change-${changes[i].id}`,
            type: 'large_price_change',
            severity: 'warning',
            title: 'Significant Price Change',
            description: `${changes[0].product?.name} price ${priceChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(priceChange * 100).toFixed(0)}%`,
            detectedAt: new Date(),
            confidence: 1.0,
            relatedEntities: [
              {
                type: 'product',
                id: productId,
                name: changes[0].product?.name || 'Unknown',
              },
            ],
            suggestedActions: [
              'Verify price change was intentional',
              'Monitor sales impact',
              'Communicate change to sales team',
            ],
          })
        }
      }
    }

    return anomalies
  }

  private async calculateMonthsOfSupply(inventoryItem: any): Promise<number> {
    // Get average monthly demand
    const { data: orders } = await this.supabase
      .from('order_items')
      .select('quantity, created_at')
      .eq('product_id', inventoryItem.product_id)
      .gte(
        'created_at',
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      )

    if (!orders || orders.length === 0) return 999 // No sales data

    const totalDemand = orders.reduce((sum, order) => sum + order.quantity, 0)
    const monthlyDemand = totalDemand / 3 // 3 months of data

    if (monthlyDemand === 0) return 999

    return inventoryItem.quantity / monthlyDemand
  }

  private aggregateByDay(data: any[]): number[] {
    const dailyCounts = new Map<string, number>()

    data.forEach((item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0]
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
    })

    return Array.from(dailyCounts.values())
  }

  private calculateStats(values: number[]): {
    mean: number
    stdDev: number
    min: number
    max: number
  } {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0 }
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length
    const stdDev = Math.sqrt(variance)

    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }

  private async storeAnomalies(
    organizationId: string,
    anomalies: AnomalyAlert[]
  ): Promise<void> {
    const insights = anomalies.map((a) => ({
      organization_id: organizationId,
      insight_type: 'alert',
      title: a.title,
      content: a.description,
      severity: a.severity,
      related_entities: a.relatedEntities,
      recommended_actions: a.suggestedActions,
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      metrics: {
        anomaly_type: a.type,
        confidence: a.confidence,
      },
    }))

    if (insights.length > 0) {
      await this.supabase.from('ai_insights').insert(insights)
    }
  }
}