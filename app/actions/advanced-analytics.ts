'use server'

import { z } from 'zod'
import { PredictiveAnalytics } from '@/lib/analytics/predictive-analytics'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

// Validation schemas
const DemandForecastSchema = z.object({
  productIds: z.array(z.string()),
  forecastPeriod: z.number().min(1).max(365).default(30),
})

const PriceOptimizationSchema = z.object({
  productIds: z.array(z.string()),
})

const ChurnPredictionSchema = z.object({
  customerIds: z.array(z.string()),
})

const AnomalyDetectionSchema = z.object({
  dataType: z.enum(['price', 'demand', 'inventory', 'revenue']),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
})

const SeasonalityAnalysisSchema = z.object({
  productIds: z.array(z.string()),
})

/**
 * Generate demand forecast for products
 */
export async function generateDemandForecast(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      rateLimiters.analytics,
      user.id
    )
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    const parsed = DemandForecastSchema.parse(Object.fromEntries(formData))

    const analytics = new PredictiveAnalytics(supabase)
    const forecasts = await analytics.generateDemandForecast(
      parsed.productIds,
      parsed.forecastPeriod
    )

    return { success: true, data: forecasts }
  } catch (error) {
    console.error('Error generating demand forecast:', error)
    return { error: 'Failed to generate demand forecast' }
  }
}

/**
 * Optimize pricing for products
 */
export async function optimizePricing(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      rateLimiters.analytics,
      user.id
    )
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    const parsed = PriceOptimizationSchema.parse(Object.fromEntries(formData))

    const analytics = new PredictiveAnalytics(supabase)
    const optimizations = await analytics.optimizePricing(parsed.productIds)

    return { success: true, data: optimizations }
  } catch (error) {
    console.error('Error optimizing pricing:', error)
    return { error: 'Failed to optimize pricing' }
  }
}

/**
 * Predict customer churn risk
 */
export async function predictChurnRisk(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      rateLimiters.analytics,
      user.id
    )
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    const parsed = ChurnPredictionSchema.parse(Object.fromEntries(formData))

    const analytics = new PredictiveAnalytics(supabase)
    const predictions = await analytics.predictChurnRisk(parsed.customerIds)

    return { success: true, data: predictions }
  } catch (error) {
    console.error('Error predicting churn risk:', error)
    return { error: 'Failed to predict churn risk' }
  }
}

/**
 * Detect anomalies in data
 */
export async function detectAnomalies(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      rateLimiters.analytics,
      user.id
    )
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    const parsed = AnomalyDetectionSchema.parse(Object.fromEntries(formData))

    const analytics = new PredictiveAnalytics(supabase)
    const anomalies = await analytics.detectAnomalies(
      parsed.dataType,
      parsed.timeRange
    )

    return { success: true, data: anomalies }
  } catch (error) {
    console.error('Error detecting anomalies:', error)
    return { error: 'Failed to detect anomalies' }
  }
}

/**
 * Analyze seasonality patterns
 */
export async function analyzeSeasonality(formData: FormData) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      rateLimiters.analytics,
      user.id
    )
    if (!rateLimitResult.success) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    const parsed = SeasonalityAnalysisSchema.parse(Object.fromEntries(formData))

    const analytics = new PredictiveAnalytics(supabase)
    const analyses = await analytics.analyzeSeasonality(parsed.productIds)

    return { success: true, data: analyses }
  } catch (error) {
    console.error('Error analyzing seasonality:', error)
    return { error: 'Failed to analyze seasonality' }
  }
}

/**
 * Get predictive metrics for dashboard
 */
export async function getPredictiveMetrics() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get organization products
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', user.organization_id)

    if (!products || products.length === 0) {
      return { error: 'No products found' }
    }

    const productIds = products.map((p) => p.id)
    const analytics = new PredictiveAnalytics(supabase)

    // Generate various predictions
    const [demandForecasts, priceOptimizations, churnPredictions] =
      await Promise.all([
        analytics.generateDemandForecast(productIds.slice(0, 10)), // Limit for performance
        analytics.optimizePricing(productIds.slice(0, 10)),
        analytics.predictChurnRisk([]), // Will be populated with customer IDs
      ])

    // Calculate aggregate metrics
    const demandForecast =
      demandForecasts.length > 0
        ? demandForecasts.reduce((sum, f) => sum + f.predictedDemand, 0) /
          demandForecasts.length
        : 0

    const stockoutRisk =
      demandForecasts.length > 0
        ? (demandForecasts.filter((f) => f.predictedDemand > 100).length /
            demandForecasts.length) *
          100
        : 0

    const revenuePrediction =
      priceOptimizations.length > 0
        ? priceOptimizations.reduce((sum, p) => sum + p.revenueImpact, 0) /
          priceOptimizations.length
        : 0

    const customerChurnRisk =
      churnPredictions.length > 0
        ? churnPredictions.reduce((sum, p) => sum + p.churnRisk, 0) /
          churnPredictions.length
        : 0

    const priceOptimization =
      priceOptimizations.length > 0
        ? priceOptimizations.reduce((sum, p) => sum + p.revenueImpact, 0) /
          priceOptimizations.length
        : 0

    // Calculate seasonality score
    const seasonalityAnalyses = await analytics.analyzeSeasonality(
      productIds.slice(0, 10)
    )
    const seasonalityScore =
      seasonalityAnalyses.length > 0
        ? seasonalityAnalyses.reduce((sum, s) => sum + s.seasonalityScore, 0) /
          seasonalityAnalyses.length
        : 0

    return {
      success: true,
      data: {
        demandForecast: Math.round(demandForecast),
        stockoutRisk: Math.round(stockoutRisk),
        revenuePrediction: Math.round(revenuePrediction),
        customerChurnRisk: Math.round(customerChurnRisk),
        priceOptimization: Math.round(priceOptimization),
        seasonalityScore: Math.round(seasonalityScore * 100) / 100,
      },
    }
  } catch (error) {
    console.error('Error getting predictive metrics:', error)
    return { error: 'Failed to get predictive metrics' }
  }
}

/**
 * Get business insights
 */
export async function getBusinessInsights() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // Get top performing products
    const { data: topProducts } = await supabase
      .from('products')
      .select(
        `
        id,
        name,
        base_price,
        current_price,
        order_items!inner(quantity, unit_price)
      `
      )
      .eq('organization_id', user.organization_id)
      .order('current_price', { ascending: false })
      .limit(5)

    // Get customer segments
    const { data: customerSegments } = await supabase
      .from('customers')
      .select(
        `
        id,
        segment,
        orders!inner(total_amount)
      `
      )
      .eq('organization_id', user.organization_id)

    // Generate insights
    const insights = {
      topPerformingProducts:
        topProducts?.map((p) => ({
          id: p.id,
          name: p.name,
          revenue:
            (p.order_items?.[0]?.quantity || 0) *
            (p.order_items?.[0]?.unit_price || 0),
          growth: 15, // Mock growth rate
        })) || [],
      customerSegments:
        customerSegments?.map((c) => ({
          segment: c.segment || 'General',
          count: 1,
          revenue: c.orders?.[0]?.total_amount || 0,
          growth: 8, // Mock growth rate
        })) || [],
      marketTrends: [
        {
          trend: 'Increasing demand for premium products',
          impact: 'positive' as const,
          confidence: 85,
        },
        {
          trend: 'Seasonal price fluctuations',
          impact: 'neutral' as const,
          confidence: 72,
        },
        {
          trend: 'Competitive pricing pressure',
          impact: 'negative' as const,
          confidence: 68,
        },
      ],
      recommendations: [
        {
          type: 'pricing',
          title: 'Optimize pricing for high-demand products',
          description:
            'Increase prices for products with low price elasticity to maximize revenue',
          impact: 'high' as const,
          priority: 9,
        },
        {
          type: 'inventory',
          title: 'Adjust inventory levels based on seasonality',
          description:
            'Increase stock for products with strong seasonal patterns',
          impact: 'medium' as const,
          priority: 7,
        },
        {
          type: 'customer',
          title: 'Implement customer retention program',
          description:
            'Focus on customers with high churn risk to improve retention',
          impact: 'high' as const,
          priority: 8,
        },
      ],
    }

    return { success: true, data: insights }
  } catch (error) {
    console.error('Error getting business insights:', error)
    return { error: 'Failed to get business insights' }
  }
}

/**
 * Get anomaly detection results
 */
export async function getAnomalyDetection() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    const analytics = new PredictiveAnalytics(supabase)

    // Detect anomalies for different data types
    const timeRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    }

    const [
      priceAnomalies,
      demandAnomalies,
      inventoryAnomalies,
      revenueAnomalies,
    ] = await Promise.all([
      analytics.detectAnomalies('price', timeRange),
      analytics.detectAnomalies('demand', timeRange),
      analytics.detectAnomalies('inventory', timeRange),
      analytics.detectAnomalies('revenue', timeRange),
    ])

    const allAnomalies = [
      ...priceAnomalies,
      ...demandAnomalies,
      ...inventoryAnomalies,
      ...revenueAnomalies,
    ]

    // Generate patterns (simplified)
    const patterns = [
      {
        pattern: 'Weekly demand cycles',
        frequency: 7,
        trend: 'stable' as const,
      },
      {
        pattern: 'Monthly revenue fluctuations',
        frequency: 30,
        trend: 'increasing' as const,
      },
    ]

    return {
      success: true,
      data: {
        anomalies: allAnomalies,
        patterns,
      },
    }
  } catch (error) {
    console.error('Error getting anomaly detection:', error)
    return { error: 'Failed to get anomaly detection' }
  }
}
