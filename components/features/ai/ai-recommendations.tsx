'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, TrendingUp, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react'
import type { AIRecommendationsProps, AIRecommendation } from '@/types/ai.types'

export function AIRecommendations({ recommendations, onRecommendationAction }: AIRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Recommendations Yet</h3>
          <p className="text-muted-foreground">
            AI recommendations will appear here as they are generated based on your data.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {recommendations.map((recommendation) => (
        <AIRecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          onAction={onRecommendationAction}
        />
      ))}
    </div>
  )
}

function AIRecommendationCard({ recommendation, onAction }: { recommendation: AIRecommendation; onAction: (action: string) => void }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'inventory':
        return '📦'
      case 'pricing':
        return '💰'
      case 'demand':
        return '📈'
      case 'efficiency':
        return '⚡'
      default:
        return '💡'
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-blue-100 text-blue-800'
      case 'dismissed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getTypeIcon(recommendation.type)}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base">{recommendation.title}</CardTitle>
                <Badge className={getStatusColor(recommendation.status)}>
                  {recommendation.status}
                </Badge>
                <Badge className={getEffortColor(recommendation.implementation.effort)}>
                  {recommendation.implementation.effort} effort
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {recommendation.created_at.toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {recommendation.status === 'pending' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction('implement')}
                  title="Mark as implemented"
                >
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction('dismiss')}
                  title="Dismiss"
                >
                  <XCircle className="h-4 w-4 text-red-600" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4">{recommendation.description}</p>

        {/* Impact Metrics */}
        {recommendation.impact && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Expected Impact:</p>
            <div className="grid grid-cols-3 gap-2">
              {recommendation.impact.revenue && (
                <div className="text-center p-2 bg-green-50 rounded">
                  <DollarSign className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Revenue</p>
                  <p className="text-sm font-bold text-green-600">
                    +{recommendation.impact.revenue}%
                  </p>
                </div>
              )}
              {recommendation.impact.cost && (
                <div className="text-center p-2 bg-red-50 rounded">
                  <TrendingUp className="h-4 w-4 text-red-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Cost</p>
                  <p className="text-sm font-bold text-red-600">
                    -{recommendation.impact.cost}%
                  </p>
                </div>
              )}
              {recommendation.impact.efficiency && (
                <div className="text-center p-2 bg-blue-50 rounded">
                  <Lightbulb className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-medium">Efficiency</p>
                  <p className="text-sm font-bold text-blue-600">
                    +{recommendation.impact.efficiency}%
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Implementation Details */}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Implementation:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>Timeline: {recommendation.implementation.timeline}</span>
            </div>
            {recommendation.implementation.resources.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Resources needed:</p>
                <div className="flex flex-wrap gap-1">
                  {recommendation.implementation.resources.map((resource, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {resource}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confidence */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Confidence:</span>
          <Badge variant="outline" className="text-xs">
            {(recommendation.confidence * 100).toFixed(0)}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
} 