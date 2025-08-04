// PRP-021: AI-Powered Insights - Insights Dashboard
import { createServerClient } from '@/lib/supabase/server'
import { AIInsightsDashboard } from '@/components/features/ai/ai-insights-dashboard'
import type { AIDashboardData } from '@/types/ai.types'

export default async function InsightsPage() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Mock data for demonstration
  const mockData: AIDashboardData = {
    insights: [
      {
        id: '1',
        organization_id: '00000000-0000-0000-0000-000000000000',
        insight_type: 'summary',
        title: 'Weekly Business Summary',
        content: 'Your inventory accuracy improved by 2.3% this week. Low stock alerts decreased by 15%. Consider reviewing pricing strategy for top 5 products.',
        severity: 'info',
        related_entities: [{ type: 'product', id: '123', name: 'Product A' }],
        metrics: {},
        recommended_actions: ['Review pricing for top products', 'Check inventory levels'],
        is_read: false,
        is_dismissed: false,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        organization_id: '00000000-0000-0000-0000-000000000000',
        insight_type: 'recommendation',
        title: 'Reorder Point Optimization',
        content: 'Product "Widget X" has high demand variability. Consider increasing safety stock by 20% to prevent stockouts.',
        severity: 'info',
        related_entities: [{ type: 'product', id: '456', name: 'Widget X' }],
        metrics: {},
        recommended_actions: ['Increase safety stock', 'Monitor demand patterns'],
        is_read: true,
        is_dismissed: false,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    predictions: [
      {
        id: '1',
        organization_id: '00000000-0000-0000-0000-000000000000',
        prediction_type: 'demand',
        entity_type: 'product',
        entity_id: '123',
        prediction_date: new Date().toISOString().split('T')[0],
        prediction_value: { forecast: [100, 120, 140, 160], confidence: 0.85 },
        confidence_score: 0.85,
        model_version: '1.0.0',
        model_parameters: {},
        prediction_start: new Date().toISOString().split('T')[0],
        prediction_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      },
    ],
    anomalies: [
      {
        id: '1',
        type: 'stock_out',
        severity: 'critical',
        title: 'Product Out of Stock',
        description: 'Product "Widget X" is completely out of stock',
        detectedAt: new Date(),
        confidence: 1.0,
        relatedEntities: [{ type: 'product', id: '456', name: 'Widget X' }],
        suggestedActions: ['Place emergency reorder', 'Check for pending shipments'],
      },
      {
        id: '2',
        type: 'large_order',
        severity: 'info',
        title: 'Large Order Detected',
        description: 'Order #12345 for $50,000',
        detectedAt: new Date(),
        confidence: 1.0,
        relatedEntities: [{ type: 'order', id: '789', name: 'Order #12345' }],
        suggestedActions: ['Verify customer credit', 'Confirm inventory availability'],
      },
    ],
    recommendations: [
      {
        id: '1',
        type: 'inventory',
        title: 'Optimize Safety Stock Levels',
        description: 'Increase safety stock for high-demand products to prevent stockouts',
        impact: { revenue: 5, cost: -2, efficiency: 10 },
        confidence: 0.85,
        implementation: {
          effort: 'medium',
          timeline: '2-3 weeks',
          resources: ['Inventory Manager', 'Data Analysis'],
        },
        status: 'pending',
        created_at: new Date(),
      },
      {
        id: '2',
        type: 'pricing',
        title: 'Dynamic Pricing Strategy',
        description: 'Implement dynamic pricing based on demand patterns and competitor analysis',
        impact: { revenue: 8, cost: 0, efficiency: 5 },
        confidence: 0.78,
        implementation: {
          effort: 'high',
          timeline: '4-6 weeks',
          resources: ['Pricing Analyst', 'Software Development'],
        },
        status: 'pending',
        created_at: new Date(),
      },
    ],
    summary: {
      totalInsights: 2,
      unreadCount: 1,
      criticalAlerts: 1,
      recommendations: 2,
      trends: 1,
      lastGenerated: new Date(),
    },
    modelPerformance: [
      {
        modelType: 'demand_forecast',
        version: '1.0.0',
        metrics: {
          mae: 0.15,
          rmse: 0.22,
          r2: 0.85,
          accuracy: 0.78,
        },
        trainingDataSize: 10000,
        lastTrained: new Date(),
        nextRetrain: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  }

  return (
    <div className="container mx-auto py-6">
      <AIInsightsDashboard
        data={mockData}
        loading={false}
        onRefresh={() => {
          // Handle refresh
        }}
      />
    </div>
  )
}
