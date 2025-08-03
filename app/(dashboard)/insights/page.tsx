import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Brain, 
  TrendingUp, 
  Package, 
  DollarSign, 
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { NaturalLanguageChat } from '@/components/features/insights/nl-chat'
import { DemandForecastChart } from '@/components/features/insights/demand-forecast-chart'
import { ReorderSuggestions } from '@/components/features/insights/reorder-suggestions'
import { PriceRecommendations } from '@/components/features/insights/price-recommendations'
import { AnomalyAlerts } from '@/components/features/insights/anomaly-alerts'
import { refreshInsights } from '@/app/actions/insights'

export const metadata: Metadata = {
  title: 'AI Insights',
  description: 'AI-powered insights and recommendations',
}

async function getInsightsData(organizationId: string) {
  const supabase = createServerClient()

  const [insights, predictions, anomalies] = await Promise.all([
    supabase
      .from('ai_insights')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('ai_predictions')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),

    supabase
      .from('ai_insights')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('insight_type', 'alert')
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    insights: insights.data || [],
    predictions: predictions.data || [],
    anomalies: anomalies.data || [],
  }
}

function InsightsSummary({ insights, predictions }: { insights: any[], predictions: any[] }) {
  const summaryCards = [
    {
      title: 'Active Insights',
      value: insights.length,
      icon: Brain,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Demand Forecasts',
      value: predictions.filter(p => p.prediction_type === 'demand').length,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Reorder Suggestions',
      value: predictions.filter(p => p.prediction_type === 'reorder').length,
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Price Optimizations',
      value: predictions.filter(p => p.prediction_type === 'price').length,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {summaryCards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <div className={cn('p-2 rounded-lg', card.bgColor)}>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default async function InsightsPage() {
  const user = await getCurrentUser()
  
  if (!user?.organizationId) {
    redirect('/login')
  }

  const { insights, predictions, anomalies } = await getInsightsData(user.organizationId)

  async function handleRefresh() {
    'use server'
    await refreshInsights(user!.organizationId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI-Powered Insights</h1>
          <p className="text-muted-foreground">
            Intelligent predictions and recommendations powered by machine learning
          </p>
        </div>

        <form action={handleRefresh}>
          <Button type="submit" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Insights
          </Button>
        </form>
      </div>

      <Suspense fallback={<InsightsSkeleton />}>
        {/* Summary Cards */}
        <InsightsSummary insights={insights} predictions={predictions} />

        {/* Anomaly Alerts */}
        {anomalies.length > 0 && (
          <AnomalyAlerts alerts={anomalies} />
        )}

        {/* Detailed Insights Tabs */}
        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="forecast">Demand Forecast</TabsTrigger>
            <TabsTrigger value="reorder">Reorder Points</TabsTrigger>
            <TabsTrigger value="pricing">Price Optimization</TabsTrigger>
            <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
            <TabsTrigger value="chat">Ask AI</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-4">
            <DemandForecastChart
              organizationId={user.organizationId}
              predictions={predictions.filter(p => p.prediction_type === 'demand')}
            />
          </TabsContent>

          <TabsContent value="reorder" className="space-y-4">
            <ReorderSuggestions
              predictions={predictions.filter(p => p.prediction_type === 'reorder')}
            />
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <PriceRecommendations
              predictions={predictions.filter(p => p.prediction_type === 'price')}
            />
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trend Analysis</CardTitle>
                <CardDescription>
                  Identify patterns and trends in your business data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights
                    .filter(i => i.insight_type === 'trend')
                    .map((insight) => (
                      <div key={insight.id} className="p-4 border rounded-lg">
                        <h4 className="font-medium">{insight.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {insight.content}
                        </p>
                      </div>
                    ))}
                  {insights.filter(i => i.insight_type === 'trend').length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No trend insights available. Refresh to generate new insights.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <NaturalLanguageChat organizationId={user.organizationId} />
          </TabsContent>
        </Tabs>
      </Suspense>
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}