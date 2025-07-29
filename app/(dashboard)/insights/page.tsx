// PRP-021: AI-Powered Insights - Insights Dashboard
import { Suspense } from 'react'
import { Brain, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIInsightsList } from '@/components/features/insights/ai-insights-list'
import { DemandForecastChart } from '@/components/features/insights/demand-forecast-chart'
import { ReorderSuggestions } from '@/components/features/insights/reorder-suggestions'
import { AnomalyAlerts } from '@/components/features/insights/anomaly-alerts'
import { RefreshInsightsButton } from '@/components/features/insights/refresh-insights-button'

export const metadata = {
  title: 'AI Insights | TruthSource',
  description: 'AI-powered business insights and recommendations',
}

// Loading skeleton for insights
function InsightsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-lg space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-lg space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

async function InsightsContent() {
  const supabase = await createClient()

  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  // Fetch real AI insights
  const { data: insights } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch predictions
  const { data: predictions } = await supabase
    .from('ai_predictions')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  // Calculate summary stats
  const totalInsights = insights?.length || 0
  const unreadInsights = insights?.filter((i: any) => !i.is_read).length || 0
  const criticalAlerts = insights?.filter((i: any) => i.severity === 'critical').length || 0
  const recommendations = insights?.filter((i: any) => i.insight_type === 'recommendation').length || 0

  // Group insights by type
  const alertInsights = insights?.filter((i: any) => i.insight_type === 'alert') || []
  const recommendationInsights = insights?.filter((i: any) => i.insight_type === 'recommendation') || []
  const trendInsights = insights?.filter((i: any) => i.insight_type === 'trend') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Insights</h1>
          <p className="text-muted-foreground">
            AI-powered insights to optimize your inventory and pricing
          </p>
        </div>
        <RefreshInsightsButton organizationId={profile.organization_id} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInsights}</div>
            <p className="text-xs text-muted-foreground">
              {unreadInsights} unread
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
            <Lightbulb className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recommendations}</div>
            <p className="text-xs text-muted-foreground">
              Action items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predictions</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{predictions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active forecasts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner for Critical Issues */}
      {criticalAlerts > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <CardTitle className="text-red-800">Critical Issues Detected</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">
              {criticalAlerts} critical issue{criticalAlerts !== 1 ? 's' : ''} require{criticalAlerts === 1 ? 's' : ''} immediate attention. 
              Check the alerts tab for details.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {alertInsights.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {alertInsights.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <AIInsightsList 
            insights={insights?.slice(0, 10) || []}
            showAllTypes={true}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AnomalyAlerts
            organizationId={profile.organization_id}
            insights={alertInsights}
          />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <ReorderSuggestions
            organizationId={profile.organization_id}
            insights={recommendationInsights}
          />
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-4">
          <DemandForecastChart
            organizationId={profile.organization_id}
            predictions={predictions || []}
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <AIInsightsList 
            insights={trendInsights}
            showAllTypes={false}
          />
        </TabsContent>
      </Tabs>

      {totalInsights === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No insights yet</h3>
            <p className="text-muted-foreground mb-4">
              AI insights will appear here as your data is analyzed. Click refresh to generate initial insights.
            </p>
            <RefreshInsightsButton organizationId={profile.organization_id} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<InsightsPageSkeleton />}>
      <InsightsContent />
    </Suspense>
  )
}