// PRP-016: Data Accuracy Monitor - Analytics Dashboard Component
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Download,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Info,
} from 'lucide-react'
import {
  AccuracyBreakdown,
  TrendAnalysis,
  AccuracyTrendPoint,
} from '@/lib/monitoring/types'
import { AccuracyTrendChart } from './accuracy-trend-chart'
import { AccuracyHeatmap } from './accuracy-heatmap'
import { AccuracyComparisonChart } from './accuracy-comparison-chart'
import { getAccuracyReport } from '@/app/actions/monitoring'
import { useToast } from '@/components/ui/use-toast'

interface AccuracyAnalyticsDashboardProps {
  organizationId: string
  accuracyBreakdown: AccuracyBreakdown
  trendAnalysis: TrendAnalysis
  historicalData: AccuracyTrendPoint[]
  benchmarkData: {
    organizationScore: number
    industryAverage: number
    percentile: number
  }
  integrations: any[]
}

/**
 * Renders a comprehensive analytics dashboard for monitoring and visualizing data accuracy metrics across an organization's integrations.
 *
 * Displays current accuracy, trends, forecasts, industry benchmarks, and detailed breakdowns by entity type and severity. Includes interactive charts, AI-generated insights, volatility analysis, and export functionality for downloading accuracy reports as CSV files. Supports filtering analytics by integration.
 *
 * @param organizationId - The unique identifier for the organization whose data is displayed.
 * @param accuracyBreakdown - Object containing overall accuracy and breakdowns by entity type and severity.
 * @param trendAnalysis - Object describing trend direction, rate of change, forecasted accuracy, and volatility.
 * @param historicalData - Array of historical accuracy data points for trend visualization.
 * @param benchmarkData - Object with organization score, industry average, and percentile rank for benchmarking.
 * @param integrations - Array of integration objects available for filtering dashboard data.
 *
 * @returns A React component rendering the accuracy analytics dashboard UI.
 */
export function AccuracyAnalyticsDashboard({
  organizationId,
  accuracyBreakdown,
  trendAnalysis,
  historicalData,
  benchmarkData,
  integrations,
}: AccuracyAnalyticsDashboardProps) {
  const { toast } = useToast()
  const [selectedIntegration, setSelectedIntegration] = useState<string>('all')
  const [isExporting, setIsExporting] = useState(false)

  const handleExportReport = async () => {
    setIsExporting(true)
    try {
      const result = await getAccuracyReport(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        new Date(),
        selectedIntegration === 'all' ? undefined : selectedIntegration
      )

      if (result.success && result.report) {
        // Convert report to CSV or PDF
        const csv = convertReportToCSV(result.report)
        downloadCSV(csv, 'accuracy-report.csv')
        
        toast({
          title: 'Report exported',
          description: 'Your accuracy report has been downloaded.',
        })
      } else {
        throw new Error(result.error || 'Failed to generate report')
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export report',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const getTrendIcon = () => {
    if (trendAnalysis.trend === 'improving') {
      return <TrendingUp className="h-5 w-5 text-green-500" />
    } else if (trendAnalysis.trend === 'declining') {
      return <TrendingDown className="h-5 w-5 text-red-500" />
    }
    return <BarChart className="h-5 w-5 text-gray-500" />
  }

  const getScoreColor = (score: number) => {
    if (score >= 98) return 'text-green-600'
    if (score >= 95) return 'text-yellow-600'
    if (score >= 90) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Accuracy Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Analyze data accuracy trends and patterns across your integrations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All integrations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All integrations</SelectItem>
              {integrations.map(integration => (
                <SelectItem key={integration.id} value={integration.id}>
                  {integration.name || integration.platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExportReport} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(accuracyBreakdown.overall)}`}>
              {accuracyBreakdown.overall.toFixed(1)}%
            </div>
            <Progress
              value={accuracyBreakdown.overall}
              className="mt-2"
              indicatorClassName={
                accuracyBreakdown.overall >= 95 ? 'bg-green-500' : 'bg-yellow-500'
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <div>
                <p className="text-2xl font-bold capitalize">{trendAnalysis.trend}</p>
                <p className="text-sm text-muted-foreground">
                  {Math.abs(trendAnalysis.changeRate).toFixed(1)}% change
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {trendAnalysis.forecast.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Next period prediction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Industry Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {benchmarkData.percentile.toFixed(0)}th
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Percentile vs. industry
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Trend</CardTitle>
              <CardDescription>
                Historical accuracy scores over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccuracyTrendChart
                data={historicalData}
                height={400}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Entity Type</CardTitle>
                <CardDescription>
                  Accuracy scores broken down by data type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(accuracyBreakdown.byEntityType).map(([type, score]) => (
                    <div key={type}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{type}</span>
                        <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                          {score.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={score} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Severity</CardTitle>
                <CardDescription>
                  Impact of different severity levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(accuracyBreakdown.bySeverity).map(([severity, score]) => (
                    <div key={severity}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{severity}</span>
                        <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                          {score.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={score} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cross-Integration Comparison</CardTitle>
              <CardDescription>
                Compare accuracy across different integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccuracyComparisonChart
                integrations={integrations}
                organizationId={organizationId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Patterns</CardTitle>
              <CardDescription>
                Identify when accuracy issues typically occur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccuracyHeatmap
                data={historicalData}
                height={400}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volatility Analysis</CardTitle>
              <CardDescription>
                Stability of accuracy scores over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Volatility Score</p>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min(100, trendAnalysis.volatility * 10)} 
                      className="flex-1"
                    />
                    <span className="text-sm font-bold">
                      {trendAnalysis.volatility.toFixed(2)}
                    </span>
                  </div>
                </div>
                {trendAnalysis.volatility > 5 && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-900">High Volatility Detected</p>
                      <p className="text-yellow-700">
                        Your accuracy scores are fluctuating significantly. Consider implementing more frequent sync schedules.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Insights</CardTitle>
              <CardDescription>
                Recommendations based on your accuracy patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {generateInsights(accuracyBreakdown, trendAnalysis, benchmarkData).map((insight, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-900">{insight}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Industry Benchmark</CardTitle>
              <CardDescription>
                How you compare to industry standards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Your Score</span>
                  <span className={`text-2xl font-bold ${getScoreColor(benchmarkData.organizationScore)}`}>
                    {benchmarkData.organizationScore.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Industry Average</span>
                  <span className="text-2xl font-bold">
                    {benchmarkData.industryAverage.toFixed(1)}%
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    You're performing better than {benchmarkData.percentile.toFixed(0)}% of similar organizations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Generates a list of actionable insights based on accuracy breakdown, trend analysis, and industry benchmark percentile.
 *
 * Insights highlight significant declines, high volatility, low entity accuracy, benchmark standing, and critical severity issues.
 *
 * @returns An array of insight strings relevant to the provided accuracy metrics.
 */
function generateInsights(
  breakdown: AccuracyBreakdown,
  trend: TrendAnalysis,
  benchmark: { percentile: number }
): string[] {
  const insights: string[] = []

  // Trend-based insights
  if (trend.trend === 'declining' && trend.changeRate < -5) {
    insights.push(
      'Your accuracy has declined by more than 5% recently. Review recent system changes and integration configurations.'
    )
  }

  if (trend.volatility > 5) {
    insights.push(
      'High volatility in accuracy scores detected. This may indicate inconsistent sync schedules or intermittent connection issues.'
    )
  }

  // Entity-based insights
  for (const [entity, score] of Object.entries(breakdown.byEntityType)) {
    if (score < 90) {
      insights.push(
        `${entity} accuracy is below 90%. Focus on improving data quality for ${entity} records.`
      )
    }
  }

  // Benchmark insights
  if (benchmark.percentile < 50) {
    insights.push(
      'Your accuracy is below industry average. Consider implementing automated validation rules and more frequent sync schedules.'
    )
  } else if (benchmark.percentile > 90) {
    insights.push(
      'Excellent! Your accuracy is in the top 10% of the industry. Keep up the great work!'
    )
  }

  // Severity insights
  if (breakdown.bySeverity.critical && breakdown.bySeverity.critical < 100) {
    insights.push(
      'Critical severity discrepancies detected. These should be addressed immediately to prevent business impact.'
    )
  }

  return insights
}

/**
 * Converts a report object containing accuracy analytics data into a CSV string.
 *
 * The CSV includes summary, entity breakdown, and historical data sections if present. Fields are safely escaped for CSV format. Returns an error row if the input is invalid or processing fails.
 *
 * @param report - The report object to convert to CSV format
 * @returns The CSV string representation of the report data
 */
function convertReportToCSV(report: any): string {
  if (!report || typeof report !== 'object') {
    return 'Error,No data available\n'
  }

  const rows: string[] = []
  
  // Add header row
  rows.push('Date,Entity Type,Accuracy Score,Total Records,Discrepancies,Error Rate')
  
  try {
    // Process report data sections
    if (report.summary) {
      const summary = report.summary
      rows.push(`Summary,Overall,${summary.overall_accuracy || 0},${summary.total_records || 0},${summary.total_discrepancies || 0},${summary.error_rate || 0}`)
    }
    
    // Process entity-specific data
    if (report.entity_breakdown && Array.isArray(report.entity_breakdown)) {
      report.entity_breakdown.forEach((entity: any) => {
        const date = entity.date || new Date().toISOString().split('T')[0]
        const entityType = entity.entity_type || 'Unknown'
        const accuracy = entity.accuracy_score || 0
        const totalRecords = entity.total_records || 0
        const discrepancies = entity.discrepancies_count || 0
        const errorRate = entity.error_rate || 0
        
        // Escape and quote fields that might contain commas
        const escapedEntityType = `"${String(entityType).replace(/"/g, '""')}"`
        rows.push(`${date},${escapedEntityType},${accuracy},${totalRecords},${discrepancies},${errorRate}`)
      })
    }
    
    // Process historical data if available
    if (report.historical_data && Array.isArray(report.historical_data)) {
      report.historical_data.forEach((entry: any) => {
        const date = entry.date || new Date().toISOString().split('T')[0]
        const entityType = entry.entity_type || 'Historical'
        const accuracy = entry.accuracy || entry.accuracy_score || 0
        const totalRecords = entry.total_records || 0
        const discrepancies = entry.discrepancies || 0
        const errorRate = entry.error_rate || 0
        
        const escapedEntityType = `"${String(entityType).replace(/"/g, '""')}"`
        rows.push(`${date},${escapedEntityType},${accuracy},${totalRecords},${discrepancies},${errorRate}`)
      })
    }
    
    // If no data was processed, add a fallback row
    if (rows.length === 1) {
      rows.push(`${new Date().toISOString().split('T')[0]},No Data,0,0,0,0`)
    }
    
  } catch (error) {
    console.error('Error converting report to CSV:', error)
    rows.push(`Error,Failed to process data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return rows.join('\n')
}

/**
 * Initiates a browser download of a CSV file with the specified filename.
 *
 * @param csv - The CSV data as a string
 * @param filename - The desired name for the downloaded file
 */
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}