// app/actions/ai-insights.ts
'use server'

import { revalidatePath } from 'next/cache'
import { AuditLogger } from '@/lib/audit/audit-logger'
import { createClient } from '@/lib/supabase/server'
import type {
  AIInsight,
  AnomalyAlert,
  DemandForecast,
  PriceRecommendation,
  ReorderSuggestion,
} from '@/types/ai.types'

export async function generateInsights(organizationId: string) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    // Generate different types of insights
    const [anomalies, reorderSuggestions, forecastData] = await Promise.all([
      detectAnomalies(organizationId),
      generateReorderSuggestions(organizationId),
      generateDemandForecasts(organizationId),
    ])

    // Store insights in the database
    const insights: Partial<AIInsight>[] = []

    // Add anomaly insights
    if (anomalies.success && anomalies.data && anomalies.data.length > 0) {
      insights.push({
        organization_id: organizationId,
        insight_type: 'alert',
        title: 'Inventory Anomalies Detected',
        content: `Found ${anomalies.data.length} inventory anomalies requiring attention`,
        severity: 'warning',
        related_entities: anomalies.data.map((a: any) => ({
          type: 'product',
          id: a.product_id,
          name: a.product_name,
        })),
        recommended_actions: [
          'Review inventory levels',
          'Address out-of-stock items',
          'Optimize reorder points',
        ],
      })
    }

    // Add reorder insights
    if (
      reorderSuggestions.success &&
      reorderSuggestions.data &&
      reorderSuggestions.data.length > 0
    ) {
      const urgentReorders = reorderSuggestions.data.filter(
        (r: any) => r.current_quantity <= 10
      )
      if (urgentReorders.length > 0) {
        insights.push({
          organization_id: organizationId,
          insight_type: 'recommendation',
          title: 'Urgent Reorder Required',
          content: `${urgentReorders.length} products need immediate reordering to avoid stockouts`,
          severity: 'warning',
          related_entities: urgentReorders.map((r: any) => ({
            type: 'product',
            id: r.product_id,
            name: r.product_name,
          })),
          recommended_actions: [
            'Place immediate orders',
            'Review lead times',
            'Update safety stock levels',
          ],
        })
      }
    }

    // Add forecast insights
    if (forecastData.success && forecastData.data) {
      insights.push({
        organization_id: organizationId,
        insight_type: 'trend',
        title: 'Demand Forecast Updated',
        content: `Generated demand forecasts for key products. Overall demand trend shows potential growth opportunities.`,
        severity: 'info',
        related_entities: [],
        recommended_actions: [
          'Review forecast accuracy',
          'Adjust inventory planning',
          'Consider demand drivers',
        ],
      })
    }

    // Store insights using RPC
    if (insights.length > 0) {
      const { error: insertError } = await supabase
        .from('ai_insights')
        .insert(insights)

      if (insertError) {
        console.error('Error storing insights:', insertError)
      }
    }

    // Log the action
    await auditLogger.log({
      action: 'create',
      entityType: 'ai_insight',
      metadata: {
        insights_generated: insights.length,
        anomalies_found: anomalies.data?.length || 0,
        reorder_suggestions: reorderSuggestions.data?.length || 0,
      },
    })

    return {
      success: true,
      data: {
        insights: insights.length,
        anomalies: anomalies.data?.length || 0,
        reorderSuggestions: reorderSuggestions.data?.length || 0,
        forecastsGenerated: forecastData.success,
      },
    }
  } catch (error) {
    console.error('Generate insights error:', error)
    return { success: false, error: 'Failed to generate insights' }
  } finally {
    revalidatePath('/insights')
  }
}

export async function detectAnomalies(organizationId: string) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.rpc('detect_inventory_anomalies', {
      p_organization_id: organizationId,
    })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Detect anomalies error:', error)
    return { success: false, error: 'Failed to detect anomalies' }
  }
}

export async function generateReorderSuggestions(organizationId: string) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.rpc('generate_reorder_suggestions', {
      p_organization_id: organizationId,
    })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Generate reorder suggestions error:', error)
    return { success: false, error: 'Failed to generate reorder suggestions' }
  }
}

export async function generateDemandForecasts(organizationId: string) {
  const supabase = createClient()

  try {
    // Get top products by recent activity
    const { data: topProducts, error: productsError } = await supabase
      .from('inventory')
      .select(
        `
        product_id,
        warehouse_id,
        products!inner(name, is_active),
        warehouses!inner(name)
      `
      )
      .eq('organization_id', organizationId)
      .eq('products.is_active', true)
      .gt('quantity', 0)
      .limit(10)

    if (productsError) throw productsError

    const forecasts = []

    // Generate forecasts for each product
    for (const item of topProducts || []) {
      try {
        const { data: forecast, error: forecastError } = await supabase.rpc(
          'calculate_moving_average_forecast',
          {
            p_product_id: item.product_id,
            p_warehouse_id: item.warehouse_id,
            p_days_forecast: 30,
            p_window_size: 7,
          }
        )

        if (!forecastError && forecast) {
          forecasts.push({
            productId: item.product_id,
            warehouseId: item.warehouse_id,
            productName: item.products.name,
            warehouseName: item.warehouses.name,
            forecast: forecast,
            confidence: 0.7, // Simple moving average has moderate confidence
            method: 'moving_average',
            generatedAt: new Date(),
          })
        }
      } catch (err) {
        console.error(
          `Error generating forecast for product ${item.product_id}:`,
          err
        )
      }
    }

    return { success: true, data: forecasts }
  } catch (error) {
    console.error('Generate demand forecasts error:', error)
    return { success: false, error: 'Failed to generate demand forecasts' }
  }
}

export async function dismissInsight(insightId: string) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    const { data, error } = await supabase
      .from('ai_insights')
      .update({ is_dismissed: true })
      .eq('id', insightId)
      .select()
      .single()

    if (error) throw error

    // Log the action
    await auditLogger.log({
      action: 'update',
      entityType: 'ai_insight',
      entityId: insightId,
      entityName: data.title,
      metadata: { action: 'dismissed' },
    })

    return { success: true }
  } catch (error) {
    console.error('Dismiss insight error:', error)
    return { success: false, error: 'Failed to dismiss insight' }
  } finally {
    revalidatePath('/insights')
  }
}

export async function markInsightAsRead(insightId: string) {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('id', insightId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Mark insight as read error:', error)
    return { success: false, error: 'Failed to mark insight as read' }
  }
}

export async function getHistoricalDemand(
  productId: string,
  warehouseId: string,
  daysBack: number = 90
) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.rpc('get_historical_demand', {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_days_back: daysBack,
    })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Get historical demand error:', error)
    return { success: false, error: 'Failed to get historical demand' }
  }
}

export async function generatePriceRecommendations(organizationId: string) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    // Get products with recent pricing activity
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(
        `
        id,
        name,
        unit_price,
        unit_cost,
        inventory(quantity)
      `
      )
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(20)

    if (productsError) throw productsError

    const recommendations: PriceRecommendation[] = []

    for (const product of products || []) {
      // Simple price optimization logic
      const currentPrice = product.unit_price || 0
      const cost = product.unit_cost || 0
      const currentMargin = cost > 0 ? (currentPrice - cost) / currentPrice : 0

      // Target 30% margin
      const targetMargin = 0.3
      const suggestedPrice = cost / (1 - targetMargin)

      // Calculate inventory pressure
      const totalInventory =
        product.inventory?.reduce(
          (sum: number, inv: any) => sum + inv.quantity,
          0
        ) || 0
      const inventoryPressure =
        totalInventory > 1000 ? -0.05 : totalInventory < 50 ? 0.05 : 0

      const finalSuggestedPrice = suggestedPrice * (1 + inventoryPressure)

      // Only recommend if change is significant (>5%)
      if (Math.abs(finalSuggestedPrice - currentPrice) / currentPrice > 0.05) {
        recommendations.push({
          productId: product.id,
          currentPrice,
          suggestedPrice: Math.round(finalSuggestedPrice * 100) / 100,
          estimatedImpact: {
            revenueChange:
              ((finalSuggestedPrice - currentPrice) / currentPrice) * 0.8, // Assume some demand elasticity
            volumeChange:
              (-(finalSuggestedPrice - currentPrice) / currentPrice) * 0.5,
          },
          confidence: 0.6,
          reasoning: `Optimize margin from ${(currentMargin * 100).toFixed(1)}% to ${targetMargin * 100}%`,
          factors: {
            demandElasticity: -0.5,
            competitorAverage: currentPrice * 1.02,
            inventoryPressure: inventoryPressure,
            marginTarget: targetMargin,
          },
        })
      }
    }

    // Log the action
    await auditLogger.log({
      action: 'create',
      entityType: 'price_recommendation',
      metadata: {
        products_analyzed: products?.length || 0,
        recommendations_generated: recommendations.length,
      },
    })

    return { success: true, data: recommendations }
  } catch (error) {
    console.error('Generate price recommendations error:', error)
    return { success: false, error: 'Failed to generate price recommendations' }
  }
}
