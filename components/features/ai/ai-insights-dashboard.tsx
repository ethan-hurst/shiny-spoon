'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIInsightsPanel } from './ai-insights-panel'
import { AIPredictionsPanel } from './ai-predictions-panel'
import { AIAnomalyAlerts } from './ai-anomaly-alerts'
import { AIRecommendations } from './ai-recommendations'
import { AIInsightSummary } from './ai-insight-summary'
import { RefreshCw, Brain, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'
import type { AIDashboardProps, AIInsight, AIPrediction, AnomalyAlert } from '@/types/ai.types'

export function AIInsightsDashboard({
  data,
  loading = false,
  error,
  onRefresh,
}: AIDashboardProps) {
  const [activeTab, setActiveTab] = useState('insights')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const unread = data.insights.filter(insight => !insight.is_read).length
    setUnreadCount(unread)
  }, [data.insights])

  const handleInsightAction = async (action: string, insightId: string) => {
    // Handle insight actions (mark as read, dismiss, etc.)
    console.log('Insight action:', action, insightId)
  }

  const handlePredictionClick = (prediction: AIPrediction) => {
    // Handle prediction click
    console.log('Prediction clicked:', prediction)
  }

  const handleAlertAction = async (action: string, alertId: string) => {
    // Handle alert actions
    console.log('Alert action:', action, alertId)
  }

  const handleRecommendationAction = async (action: string, recommendationId: string) => {
    // Handle recommendation actions
    console.log('Recommendation action:', action, recommendationId)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Insights</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={onRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Insights</h1>
          <p className="text-muted-foreground">
            Intelligent analysis and predictions for your business
          </p>
        </div>
        <Button onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Insights</p>
                <p className="text-2xl font-bold">{data.summary.totalInsights}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Critical Alerts</p>
                <p className="text-2xl font-bold">{data.summary.criticalAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Predictions</p>
                <p className="text-2xl font-bold">{data.predictions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Recommendations</p>
                <p className="text-2xl font-bold">{data.recommendations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Insights
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Predictions
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
            {data.anomalies.filter(a => a.severity === 'critical').length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {data.anomalies.filter(a => a.severity === 'critical').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <AIInsightsPanel
            insights={data.insights}
            onInsightAction={handleInsightAction}
          />
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <AIPredictionsPanel
            predictions={data.predictions}
            onPredictionClick={handlePredictionClick}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AIAnomalyAlerts
            anomalies={data.anomalies}
            onAlertAction={handleAlertAction}
          />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <AIRecommendations
            recommendations={data.recommendations}
            onRecommendationAction={handleRecommendationAction}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
} 