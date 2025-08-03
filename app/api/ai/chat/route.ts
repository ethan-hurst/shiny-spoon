import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'

export async function POST(req: Request) {
  try {
    const { messages, organizationId } = await req.json()

    const supabase = createServerClient()
    const user = await getCurrentUser()

    // Verify user has access
    if (!user || user.organizationId !== organizationId) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Get context data
    const context = await getBusinessContext(supabase, organizationId)

    // Stream AI response
    const result = await streamText({
      model: openai('gpt-4o'),
      system: `You are an AI assistant for a B2B e-commerce business intelligence platform.
               You have access to the following business data:
               ${JSON.stringify(context)}
               
               Provide helpful, specific insights and recommendations based on this data.
               Be concise and actionable in your responses.
               Format numbers nicely (e.g. $1,234.56 or 1.2K units).
               When discussing trends, be specific about timeframes and percentages.`,
      messages,
      temperature: 0.7,
      maxTokens: 500,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('AI chat error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

async function getBusinessContext(supabase: any, organizationId: string) {
  // Fetch relevant context for AI
  const [inventory, recentOrders, insights, predictions] = await Promise.all([
    // Low stock items
    supabase
      .from('inventory')
      .select('quantity, products(name, sku)')
      .eq('organization_id', organizationId)
      .lt('quantity', 50)
      .order('quantity', { ascending: true })
      .limit(10),

    // Recent orders summary
    supabase
      .from('orders')
      .select('total, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10),

    // Recent AI insights
    supabase
      .from('ai_insights')
      .select('title, content, severity')
      .eq('organization_id', organizationId)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(5),

    // Latest predictions
    supabase
      .from('ai_predictions')
      .select('prediction_type, prediction_value, confidence_score, entity_id')
      .eq('organization_id', organizationId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Calculate summary metrics
  const orderTotal = recentOrders.data?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0
  const avgOrderValue = recentOrders.data?.length ? orderTotal / recentOrders.data.length : 0

  return {
    lowStockItems: inventory.data?.map((item: any) => ({
      product: item.products?.name,
      quantity: item.quantity
    })) || [],
    recentOrdersSummary: {
      count: recentOrders.data?.length || 0,
      totalValue: orderTotal,
      averageValue: avgOrderValue,
    },
    activeInsights: insights.data?.map((i: any) => ({
      title: i.title,
      severity: i.severity,
      summary: i.content.substring(0, 100) + '...'
    })) || [],
    latestPredictions: predictions.data?.map((p: any) => ({
      type: p.prediction_type,
      confidence: p.confidence_score,
      summary: getPredictionSummary(p)
    })) || [],
  }
}

function getPredictionSummary(prediction: any): string {
  switch (prediction.prediction_type) {
    case 'demand':
      const forecast = prediction.prediction_value?.forecast || []
      const avg = forecast.length > 0 
        ? forecast.reduce((a: number, b: number) => a + b, 0) / forecast.length
        : 0
      return `Average demand: ${avg.toFixed(1)} units/day`
    
    case 'reorder':
      return `Reorder point: ${prediction.prediction_value?.reorderPoint || 0} units`
    
    case 'price':
      const current = prediction.prediction_value?.currentPrice || 0
      const suggested = prediction.prediction_value?.suggestedPrice || 0
      const change = ((suggested - current) / current * 100).toFixed(1)
      return `Price change: ${change}% suggested`
    
    default:
      return 'Prediction available'
  }
}