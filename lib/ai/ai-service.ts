import { openai } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'
import { OpenAI } from 'openai'
import { createServerClient } from '@/lib/supabase/server'
import type {
  AnomalyAlert,
  DemandForecast,
  PriceRecommendation,
  ReorderSuggestion,
  TrendAnalysis,
  AIInsight,
} from '@/types/ai.types'

export class AIService {
  private supabase: ReturnType<typeof createServerClient>
  private openai: OpenAI

  constructor() {
    this.supabase = createServerClient()
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
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

    // Generate insights using AI
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: `You are an expert business analyst for a B2B e-commerce company. 
               Analyze the provided data and generate actionable insights.
               Focus on inventory optimization, pricing opportunities, and anomalies.`,
      prompt: `Analyze this business data and provide insights:
               
               Inventory Summary:
               ${JSON.stringify(inventory.summary)}
               
               Order Patterns:
               ${JSON.stringify(orders.patterns)}
               
               Pricing Data:
               ${JSON.stringify(pricing.overview)}
               
               Provide:
               1. Executive summary (2-3 sentences)
               2. Top 3-5 actionable recommendations
               3. Any critical alerts or anomalies`,
      temperature: 0.7,
      maxTokens: 1000,
    })

    // Parse AI response
    const insights = this.parseAIResponse(text)

    // Store insights
    await this.storeInsights(organizationId, insights)

    return insights
  }

  async streamInsights(
    organizationId: string,
    context: any
  ): Promise<ReadableStream> {
    const result = await streamText({
      model: openai('gpt-4o'),
      system:
        'You are an AI assistant helping with inventory and pricing decisions.',
      messages: context.messages,
      temperature: 0.7,
      maxTokens: 500,
    })

    return result.toTextStreamResponse()
  }

  private async getInventoryData(
    organizationId: string,
    dateRange: { from: Date; to: Date }
  ) {
    const { data } = await this.supabase
      .from('inventory_snapshots')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('snapshot_date', dateRange.from.toISOString())
      .lte('snapshot_date', dateRange.to.toISOString())

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

    // Calculate patterns
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
      .from('product_pricing_history')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())

    return {
      overview: {
        priceChanges: data?.length || 0,
        averageMargin: this.calculateAverageMargin(data || []),
      },
      data,
    }
  }

  private parseAIResponse(text: string): {
    summary: string
    recommendations: string[]
    alerts: AnomalyAlert[]
  } {
    // Parse structured response from AI
    // This is a simplified version - in production, use more robust parsing
    const lines = text.split('\n').filter(line => line.trim())
    
    // Find sections
    const summaryIndex = lines.findIndex(line => line.toLowerCase().includes('summary'))
    const recommendationsIndex = lines.findIndex(line => line.toLowerCase().includes('recommendation'))
    const alertsIndex = lines.findIndex(line => line.toLowerCase().includes('alert') || line.toLowerCase().includes('anomal'))
    
    const summary = summaryIndex >= 0 && summaryIndex + 1 < lines.length 
      ? lines[summaryIndex + 1] 
      : lines[0] || 'No summary available'
    
    const recommendations: string[] = []
    if (recommendationsIndex >= 0) {
      for (let i = recommendationsIndex + 1; i < lines.length && i < recommendationsIndex + 6; i++) {
        if (lines[i] && !lines[i].toLowerCase().includes('alert')) {
          recommendations.push(lines[i].replace(/^\d+\.\s*/, ''))
        }
      }
    }

    // For now, alerts are parsed separately by anomaly detection
    const alerts: AnomalyAlert[] = []

    return {
      summary,
      recommendations: recommendations.filter(r => r.length > 0),
      alerts,
    }
  }

  private async storeInsights(
    organizationId: string,
    insights: any
  ): Promise<void> {
    const insightRecords: Partial<AIInsight>[] = [
      {
        organization_id: organizationId,
        insight_type: 'summary',
        title: 'Daily Business Summary',
        content: insights.summary,
        severity: 'info',
        related_entities: [],
        metrics: {},
        recommended_actions: [],
        is_read: false,
        is_dismissed: false,
      },
      ...insights.recommendations.map((rec: string) => ({
        organization_id: organizationId,
        insight_type: 'recommendation' as const,
        title: 'AI Recommendation',
        content: rec,
        severity: 'info' as const,
        related_entities: [],
        metrics: {},
        recommended_actions: [],
        is_read: false,
        is_dismissed: false,
      })),
    ]

    await this.supabase.from('ai_insights').insert(insightRecords)
  }

  private identifyPeakDays(orders: any[]): string[] {
    if (!orders || orders.length === 0) return []
    
    // Group orders by day of week
    const dayGroups = new Map<number, number>()
    orders.forEach(order => {
      const day = new Date(order.created_at).getDay()
      dayGroups.set(day, (dayGroups.get(day) || 0) + 1)
    })
    
    // Find days with above average orders
    const avgCount = Array.from(dayGroups.values()).reduce((a, b) => a + b, 0) / dayGroups.size
    const peakDays: string[] = []
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    
    dayGroups.forEach((count, day) => {
      if (count > avgCount * 1.2) {
        peakDays.push(dayNames[day])
      }
    })
    
    return peakDays
  }

  private calculateAverageMargin(pricingData: any[]): number {
    if (!pricingData || pricingData.length === 0) return 0
    
    const margins = pricingData
      .filter(p => p.price && p.cost)
      .map(p => (p.price - p.cost) / p.price)
    
    return margins.length > 0
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0
  }
}