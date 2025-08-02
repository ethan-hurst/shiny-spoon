'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { AIService } from '@/lib/ai/ai-service'
import { DemandForecaster } from '@/lib/ai/demand-forecasting'
import { ReorderPointCalculator } from '@/lib/ai/reorder-suggestions'
import { PriceOptimizer } from '@/lib/ai/price-optimization'
import { AnomalyDetector } from '@/lib/ai/anomaly-detection'
import { z } from 'zod'
import {
  demandForecastSchema,
  priceOptimizationSchema,
  anomalyDetectionSchema,
} from '@/types/ai.types'

export async function refreshInsights(organizationId: string) {
  try {
    const user = await getCurrentUser()
    if (!user || user.organizationId !== organizationId) {
      throw new Error('Unauthorized')
    }

    const aiService = new AIService()
    const anomalyDetector = new AnomalyDetector()

    // Generate new insights
    const [insights, anomalies] = await Promise.all([
      aiService.generateInsights(organizationId, {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
      anomalyDetector.detectAnomalies(organizationId, 'all'),
    ])

    revalidatePath('/insights')
    return { success: true, insights, anomalies }
  } catch (error) {
    console.error('Error refreshing insights:', error)
    return { success: false, error: 'Failed to refresh insights' }
  }
}

export async function dismissInsight(insightId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = createServerClient()
    
    // Verify the insight belongs to the user's organization
    const { data: insight } = await supabase
      .from('ai_insights')
      .select('organization_id')
      .eq('id', insightId)
      .single()

    if (!insight || insight.organization_id !== user.organizationId) {
      throw new Error('Unauthorized')
    }

    // Update the insight
    const { error } = await supabase
      .from('ai_insights')
      .update({ is_dismissed: true })
      .eq('id', insightId)

    if (error) throw error

    revalidatePath('/insights')
    return { success: true }
  } catch (error) {
    console.error('Error dismissing insight:', error)
    return { success: false, error: 'Failed to dismiss insight' }
  }
}

export async function generateDemandForecast(input: z.infer<typeof demandForecastSchema>) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.organizationId) {
      throw new Error('Unauthorized')
    }

    const forecaster = new DemandForecaster()
    const forecast = await forecaster.forecastDemand(
      input.productId,
      input.warehouseId,
      user.organizationId,
      input.horizonDays
    )

    revalidatePath('/insights')
    return { success: true, forecast }
  } catch (error) {
    console.error('Error generating demand forecast:', error)
    return { success: false, error: 'Failed to generate forecast' }
  }
}

export async function calculateReorderPoints() {
  try {
    const user = await getCurrentUser()
    if (!user || !user.organizationId) {
      throw new Error('Unauthorized')
    }

    const calculator = new ReorderPointCalculator()
    const suggestions = await calculator.calculateReorderPoints(user.organizationId)

    revalidatePath('/insights')
    return { success: true, suggestions }
  } catch (error) {
    console.error('Error calculating reorder points:', error)
    return { success: false, error: 'Failed to calculate reorder points' }
  }
}

export async function optimizePricing(input: z.infer<typeof priceOptimizationSchema>) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.organizationId) {
      throw new Error('Unauthorized')
    }

    const optimizer = new PriceOptimizer()
    const recommendations = await optimizer.optimizePricing(
      user.organizationId,
      input.productIds
    )

    revalidatePath('/insights')
    return { success: true, recommendations }
  } catch (error) {
    console.error('Error optimizing pricing:', error)
    return { success: false, error: 'Failed to optimize pricing' }
  }
}

export async function detectAnomalies(input: z.infer<typeof anomalyDetectionSchema>) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.organizationId) {
      throw new Error('Unauthorized')
    }

    const detector = new AnomalyDetector()
    const anomalies = await detector.detectAnomalies(
      user.organizationId,
      input.scope
    )

    revalidatePath('/insights')
    return { success: true, anomalies }
  } catch (error) {
    console.error('Error detecting anomalies:', error)
    return { success: false, error: 'Failed to detect anomalies' }
  }
}

export async function markInsightAsRead(insightId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const supabase = createServerClient()
    
    // Verify the insight belongs to the user's organization
    const { data: insight } = await supabase
      .from('ai_insights')
      .select('organization_id')
      .eq('id', insightId)
      .single()

    if (!insight || insight.organization_id !== user.organizationId) {
      throw new Error('Unauthorized')
    }

    // Update the insight
    const { error } = await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('id', insightId)

    if (error) throw error

    revalidatePath('/insights')
    return { success: true }
  } catch (error) {
    console.error('Error marking insight as read:', error)
    return { success: false, error: 'Failed to mark insight as read' }
  }
}