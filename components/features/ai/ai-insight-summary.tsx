'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Clock } from 'lucide-react'
import type { AIInsightSummary } from '@/types/ai.types'

export function AIInsightSummary({ summary }: { summary: AIInsightSummary }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium">Total Insights</p>
              <p className="text-2xl font-bold">{summary.totalInsights}</p>
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
              <p className="text-2xl font-bold">{summary.criticalAlerts}</p>
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
              <p className="text-2xl font-bold">{summary.recommendations}</p>
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
              <p className="text-2xl font-bold">{summary.trends}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 