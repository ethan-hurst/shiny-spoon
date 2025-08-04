'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Check,
  X,
  Eye,
  Clock,
} from 'lucide-react'
import type { AIInsightsPanelProps, AIInsight, InsightType } from '@/types/ai.types'

const INSIGHT_ICONS = {
  summary: Brain,
  recommendation: Lightbulb,
  alert: AlertTriangle,
  trend: TrendingUp,
}

const INSIGHT_COLORS = {
  summary: 'text-blue-600',
  recommendation: 'text-yellow-600',
  alert: 'text-orange-600',
  trend: 'text-green-600',
}

const SEVERITY_COLORS = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export function AIInsightsPanel({ insights, onInsightAction }: AIInsightsPanelProps) {
  const [filter, setFilter] = useState<InsightType | 'all'>('all')
  const [showRead, setShowRead] = useState(true)

  const filteredInsights = insights.filter(insight => {
    if (filter !== 'all' && insight.insight_type !== filter) return false
    if (!showRead && insight.is_read) return false
    return true
  })

  const getInsightIcon = (type: InsightType) => {
    const Icon = INSIGHT_ICONS[type] || Brain
    return <Icon className={`h-4 w-4 ${INSIGHT_COLORS[type]}`} />
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Insights Yet</h3>
          <p className="text-muted-foreground">
            AI insights will appear here as they are generated based on your data.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter:</span>
          <div className="flex gap-1">
            {(['all', 'summary', 'recommendation', 'alert', 'trend'] as const).map((type) => (
              <Button
                key={type}
                variant={filter === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(type)}
              >
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Show:</span>
          <Button
            variant={showRead ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowRead(!showRead)}
          >
            {showRead ? 'All' : 'Unread Only'}
          </Button>
        </div>
      </div>

      {/* Insights List */}
      <div className="space-y-4">
        {filteredInsights.map((insight) => (
          <AIInsightCard
            key={insight.id}
            insight={insight}
            onAction={(action) => onInsightAction(action, insight.id)}
          />
        ))}
      </div>

      {filteredInsights.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No insights match the current filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AIInsightCard({ insight, onAction }: { insight: AIInsight; onAction: (action: string) => void }) {
  const Icon = INSIGHT_ICONS[insight.insight_type] || Brain

  return (
    <Card className={`${!insight.is_read ? 'ring-2 ring-blue-200 bg-blue-50/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white ${INSIGHT_COLORS[insight.insight_type]}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base">{insight.title}</CardTitle>
                <Badge variant="secondary" className={SEVERITY_COLORS[insight.severity]}>
                  {insight.severity}
                </Badge>
                {!insight.is_read && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    New
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="capitalize">{insight.insight_type}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(insight.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!insight.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction('markAsRead')}
                title="Mark as read"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('dismiss')}
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4">{insight.content}</p>

        {/* Related Entities */}
        {insight.related_entities && insight.related_entities.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Related:</p>
            <div className="flex flex-wrap gap-2">
              {insight.related_entities.map((entity, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {entity.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {insight.recommended_actions && insight.recommended_actions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recommended Actions:</p>
            <div className="space-y-2">
              {insight.recommended_actions.map((action, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-3 w-3 text-green-600" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 