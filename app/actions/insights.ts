'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { AIService } from '@/lib/ai/ai-service'
import { DemandForecaster } from '@/lib/ai/demand-forecasting'
import { ReorderPointCalculator } from '@/lib/ai/reorder-suggestions'
import { PriceOptimizer } from '@/lib/ai/price-optimization'
import { AnomalyDetector } from '@/lib/ai/anomaly-detection'

export async function refreshInsights(organizationId: string) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.organizationId !== organizationId) {
      return { success: false, error: 'Unauthorized' }
    }

    // Initialize AI services
    const aiService = new AIService()
    const anomalyDetector = new AnomalyDetector()
    const reorderCalculator = new ReorderPointCalculator()
    const priceOptimizer = new PriceOptimizer()

    // Generate insights in parallel
    const [generalInsights, anomalies, reorderPoints, priceOptimizations] = await Promise.all([
      // General AI insights
      aiService.generateInsights(organizationId, {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date()
      }),
      
      // Anomaly detection
      anomalyDetector.detectAnomalies(organizationId),
      
      // Reorder suggestions
      reorderCalculator.calculateReorderPoints(organizationId),
      
      // Price optimizations (limit to 10 products)
      priceOptimizer.optimizePricing(organizationId)
    ])

    revalidatePath('/insights')
    
    return { 
      success: true, 
      data: {
        generalInsights: generalInsights.summary,
        anomaliesDetected: anomalies.length,
        reorderSuggestions: reorderPoints.length,
        priceRecommendations: priceOptimizations.length
      }
    }
  } catch (error) {
    console.error('Error refreshing insights:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to refresh insights' 
    }
  }
}

export async function dismissInsight(insightId: string) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()
    
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify the insight belongs to the user's organization
    const { data: insight } = await supabase
      .from('ai_insights')
      .select('organization_id')
      .eq('id', insightId)
      .single()

    if (!insight || insight.organization_id !== user.organizationId) {
      return { success: false, error: 'Insight not found' }
    }

    // Update the insight
    const { error } = await supabase
      .from('ai_insights')
      .update({ is_dismissed: true })
      .eq('id', insightId)

    if (error) {
      console.error('Failed to dismiss insight:', error)
      return { success: false, error: 'Failed to dismiss insight' }
    }

    revalidatePath('/insights')
    return { success: true }
  } catch (error) {
    console.error('Error dismissing insight:', error)
    return { success: false, error: 'Failed to dismiss insight' }
  }
}

export async function markInsightAsRead(insightId: string) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()
    
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify the insight belongs to the user's organization
    const { data: insight } = await supabase
      .from('ai_insights')
      .select('organization_id')
      .eq('id', insightId)
      .single()

    if (!insight || insight.organization_id !== user.organizationId) {
      return { success: false, error: 'Insight not found' }
    }

    // Update the insight
    const { error } = await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('id', insightId)

    if (error) {
      console.error('Failed to mark insight as read:', error)
      return { success: false, error: 'Failed to update insight' }
    }

    revalidatePath('/insights')
    return { success: true }
  } catch (error) {
    console.error('Error marking insight as read:', error)
    return { success: false, error: 'Failed to update insight' }
  }
}

export async function generateDemandForecast(
  productId: string,
  warehouseId: string,
  horizonDays: number = 30
) {
  try {
    const user = await getCurrentUser()
    
    if (!user?.organizationId) {
      return { success: false, error: 'Unauthorized' }
    }

    const forecaster = new DemandForecaster()
    const forecast = await forecaster.forecastDemand(
      productId,
      warehouseId,
      user.organizationId,
      horizonDays
    )

    return { success: true, data: forecast }
  } catch (error) {
    console.error('Error generating demand forecast:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate forecast' 
    }
  }
}

export async function optimizeProductPricing(productIds?: string[]) {
  try {
    const user = await getCurrentUser()
    
    if (!user?.organizationId) {
      return { success: false, error: 'Unauthorized' }
    }

    const optimizer = new PriceOptimizer()
    const recommendations = await optimizer.optimizePricing(
      user.organizationId,
      productIds
    )

    return { success: true, data: recommendations }
  } catch (error) {
    console.error('Error optimizing pricing:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to optimize pricing' 
    }
  }
}