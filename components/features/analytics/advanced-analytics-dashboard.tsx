'use client'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Filter,
  Lightbulb,
  PieChart,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'

interface PredictiveMetrics {
  demandForecast: number
  stockoutRisk: number
  revenuePrediction: number
  customerChurnRisk: number
  priceOptimization: number
  seasonalityScore: number
}

interface BusinessInsights {
  topPerformingProducts: Array<{
    id: string
    name: string
    revenue: number
    growth: number
  }>
  customerSegments: Array<{
    segment: string
    count: number
    revenue: number
    growth: number
  }>
  marketTrends: Array<{
    trend: string
    impact: 'positive' | 'negative' | 'neutral'
    confidence: number
  }>
  recommendations: Array<{
    type: string
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
    priority: number
  }>
}

interface AnomalyDetection {
  anomalies: Array<{
    id: string
    type: 'price' | 'inventory' | 'demand' | 'revenue'
    severity: 'critical' | 'warning' | 'info'
    description: string
    detectedAt: Date
    confidence: number
  }>
  patterns: Array<{
    pattern: string
    frequency: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }>
}

export function AdvancedAnalyticsDashboard() {
  const [predictiveMetrics, setPredictiveMetrics] =
    useState<PredictiveMetrics | null>(null)
  const [businessInsights, setBusinessInsights] =
    useState<BusinessInsights | null>(null)
  const [anomalyDetection, setAnomalyDetection] =
    useState<AnomalyDetection | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const supabase = createClient()

  useEffect(() => {
    loadAdvancedAnalytics()
    const interval = setInterval(loadAdvancedAnalytics, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const loadAdvancedAnalytics = async () => {
    try {
      setLoading(true)

      // Get predictive metrics
      const { data: metricsData } = await supabase
        .rpc('get_predictive_metrics')
        .single()
      setPredictiveMetrics(metricsData)

      // Get business insights
      const { data: insightsData } = await supabase
        .rpc('get_business_insights')
        .single()
      setBusinessInsights(insightsData)

      // Get anomaly detection
      const { data: anomalyData } = await supabase
        .rpc('get_anomaly_detection')
        .single()
      setAnomalyDetection(anomalyData)

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load advanced analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'text-green-600'
      case 'negative':
        return 'text-red-600'
      case 'neutral':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'warning'
      case 'info':
        return 'default'
      default:
        return 'default'
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-600'
    if (priority >= 5) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (loading && !predictiveMetrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">
            Predictive analytics and business intelligence insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={loadAdvancedAnalytics} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Badge variant="outline">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Badge>
        </div>
      </div>

      {/* Predictive Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Demand Forecast
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {predictiveMetrics?.demandForecast || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Predicted demand growth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stockout Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  predictiveMetrics?.stockoutRisk &&
                  predictiveMetrics.stockoutRisk > 20
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {predictiveMetrics?.stockoutRisk || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Risk of stockout in next 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue Prediction
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${predictiveMetrics?.revenuePrediction?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Predicted revenue next month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Risk</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span
                className={
                  predictiveMetrics?.customerChurnRisk &&
                  predictiveMetrics.customerChurnRisk > 15
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {predictiveMetrics?.customerChurnRisk || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Customer churn risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Price Optimization
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {predictiveMetrics?.priceOptimization || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Potential revenue increase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seasonality</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {predictiveMetrics?.seasonalityScore || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Seasonality strength score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Business Insights</TabsTrigger>
          <TabsTrigger value="anomalies">Anomaly Detection</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
                <CardDescription>
                  Products with highest revenue and growth
                </CardDescription>
              </CardHeader>
              <CardContent>
                {businessInsights?.topPerformingProducts?.map(
                  (product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          ${product.revenue.toLocaleString()}
                        </div>
                      </div>
                      <Badge
                        variant={product.growth > 0 ? 'default' : 'secondary'}
                      >
                        {product.growth > 0 ? '+' : ''}
                        {product.growth}%
                      </Badge>
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Segments</CardTitle>
                <CardDescription>Revenue by customer segment</CardDescription>
              </CardHeader>
              <CardContent>
                {businessInsights?.customerSegments?.map((segment) => (
                  <div
                    key={segment.segment}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <div className="font-medium">{segment.segment}</div>
                      <div className="text-sm text-muted-foreground">
                        {segment.count} customers
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${segment.revenue.toLocaleString()}
                      </div>
                      <Badge
                        variant={segment.growth > 0 ? 'default' : 'secondary'}
                      >
                        {segment.growth > 0 ? '+' : ''}
                        {segment.growth}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detected Anomalies</CardTitle>
              <CardDescription>
                AI-detected unusual patterns and anomalies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomalyDetection?.anomalies?.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No anomalies detected</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anomalyDetection?.anomalies?.map((anomaly) => (
                    <Alert
                      key={anomaly.id}
                      variant={getSeverityColor(anomaly.severity)}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>
                        {anomaly.type.toUpperCase()} Anomaly
                      </AlertTitle>
                      <AlertDescription>
                        {anomaly.description}
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Confidence:</span>{' '}
                          {anomaly.confidence}%
                          <br />
                          <span className="font-medium">Detected:</span>{' '}
                          {anomaly.detectedAt.toLocaleString()}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>
                Actionable insights and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {businessInsights?.recommendations?.map((rec, index) => (
                <div key={index} className="border rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Lightbulb className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">{rec.title}</span>
                    </div>
                    <Badge
                      variant={
                        rec.impact === 'high'
                          ? 'destructive'
                          : rec.impact === 'medium'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {rec.impact} priority
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {rec.description}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>Priority: {rec.priority}/10</span>
                    <span>•</span>
                    <span>Type: {rec.type}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Market Trends</CardTitle>
              <CardDescription>
                AI-analyzed market trends and their impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              {businessInsights?.marketTrends?.map((trend, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 border-b last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        trend.impact === 'positive'
                          ? 'bg-green-500'
                          : trend.impact === 'negative'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                      }`}
                    />
                    <div>
                      <div className="font-medium">{trend.trend}</div>
                      <div className="text-sm text-muted-foreground">
                        Confidence: {trend.confidence}%
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      trend.impact === 'positive'
                        ? 'default'
                        : trend.impact === 'negative'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {trend.impact}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
