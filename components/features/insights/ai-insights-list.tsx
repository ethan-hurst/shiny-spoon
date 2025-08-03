// components/features/insights/ai-insights-list.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AlertTriangle, Brain, Lightbulb, TrendingUp, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { dismissInsight, markInsightAsRead } from '@/app/actions/ai-insights'
import type { AIInsight } from '@/types/ai.types'

interface AIInsightsListProps {
  insights: AIInsight[]
  showAllTypes?: boolean
}

const insightIcons = {
  summary: Brain,
  recommendation: Lightbulb,
  alert: AlertTriangle,
  trend: TrendingUp,
}

const severityColors = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
}

export function AIInsightsList({
  insights,
  showAllTypes = true,
}: AIInsightsListProps) {
  const router = useRouter()
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())

  const handleDismiss = async (insightId: string) => {
    setDismissingIds((prev) => new Set(prev).add(insightId))

    try {
      const result = await dismissInsight(insightId)
      if (result.success) {
        toast.success('Insight dismissed')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to dismiss insight')
      }
    } catch (error) {
      toast.error('Failed to dismiss insight')
    } finally {
      setDismissingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(insightId)
        return newSet
      })
    }
  }

  const handleMarkAsRead = async (insightId: string) => {
    if (insights.find((i) => i.id === insightId)?.is_read) return

    try {
      await markInsightAsRead(insightId)
      router.refresh()
    } catch (error) {
      // Silent fail for read marking
    }
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No insights found</h3>
          <p className="text-muted-foreground">
            Insights will appear here as AI analyzes your data.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {insights.map((insight) => {
        const Icon = insightIcons[insight.insight_type] || Brain
        const isDismissing = dismissingIds.has(insight.id)

        return (
          <Card
            key={insight.id}
            className={`relative ${!insight.is_read ? 'border-l-4 border-l-blue-500' : ''}`}
            onClick={() => handleMarkAsRead(insight.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={
                          severityColors[insight.severity] ||
                          severityColors.info
                        }
                      >
                        {insight.severity}
                      </Badge>
                      <Badge variant="outline">{insight.insight_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(insight.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDismiss(insight.id)
                  }}
                  disabled={isDismissing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <CardDescription className="text-sm">
                {insight.content}
              </CardDescription>

              {insight.related_entities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Related Items:</h4>
                  <div className="flex flex-wrap gap-1">
                    {insight.related_entities.map((entity, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {entity.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {insight.recommended_actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Recommended Actions:
                  </h4>
                  <ul className="text-sm space-y-1">
                    {insight.recommended_actions.map((action, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
