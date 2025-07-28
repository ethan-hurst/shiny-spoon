// PRP-018: Analytics Dashboard - Revenue Impact Card Component
'use client'

import { DollarSign, TrendingUp, Target, Calendar } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RevenueImpactMetrics } from '@/lib/analytics/calculate-metrics'

interface RevenueImpactCardProps {
  revenueImpact: RevenueImpactMetrics
}

export function RevenueImpactCard({ revenueImpact }: RevenueImpactCardProps) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}k`
    }
    return `$${amount.toFixed(0)}`
  }

  const impactLevel = revenueImpact.accuracyImprovement >= 5 
    ? 'High Impact' 
    : revenueImpact.accuracyImprovement >= 2 
    ? 'Medium Impact' 
    : 'Low Impact'

  const impactColor = revenueImpact.accuracyImprovement >= 5 
    ? 'bg-green-100 text-green-800' 
    : revenueImpact.accuracyImprovement >= 2 
    ? 'bg-yellow-100 text-yellow-800' 
    : 'bg-gray-100 text-gray-800'

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            <CardTitle className="text-green-900">Revenue Impact</CardTitle>
          </div>
          <Badge className={impactColor}>
            {impactLevel}
          </Badge>
        </div>
        <CardDescription className="text-green-700">
          Financial benefits from improved data accuracy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Total Saved */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-900">Total Saved</p>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(revenueImpact.totalSaved)}
            </p>
            <p className="text-sm text-green-700">
              From {revenueImpact.errorsPrevented} errors prevented
            </p>
          </div>

          {/* Accuracy Improvement */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-900">Accuracy Gain</p>
            </div>
            <p className="text-3xl font-bold text-green-600">
              +{revenueImpact.accuracyImprovement.toFixed(1)}%
            </p>
            <p className="text-sm text-green-700">
              Improvement over period
            </p>
          </div>

          {/* Projected Annual */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-900">Annual Projection</p>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(revenueImpact.projectedAnnualSavings)}
            </p>
            <p className="text-sm text-green-700">
              Estimated yearly savings
            </p>
          </div>
        </div>

        {/* Bottom summary */}
        <div className="mt-6 p-4 bg-white rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            <span className="font-semibold">ROI Highlight:</span> Your improved data accuracy is saving an average of{' '}
            <span className="font-bold">${(revenueImpact.totalSaved / Math.max(revenueImpact.errorsPrevented, 1)).toFixed(0)}</span>{' '}
            per error prevented. Keep up the excellent work!
          </p>
        </div>
      </CardContent>
    </Card>
  )
}