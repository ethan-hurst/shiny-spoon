'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { RealtimePerformanceMonitor } from '@/lib/realtime/performance-monitor'
import { PerformanceMetrics } from '@/lib/realtime/types'
import { 
  Activity, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Zap,
  TrendingDown,
  TrendingUp,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function PerformanceWidget() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [recommendations, setRecommendations] = useState<string[]>([])

  useEffect(() => {
    const monitor = RealtimePerformanceMonitor.getInstance()
    
    const unsubscribe = monitor.subscribe('performance-widget', (newMetrics) => {
      setMetrics(newMetrics)
      setRecommendations(monitor.getRecommendations())
    })

    return unsubscribe
  }, [])

  if (!metrics) return null

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, text: 'Excellent' }
    if (score >= 60) return { variant: 'secondary' as const, text: 'Good' }
    if (score >= 40) return { variant: 'outline' as const, text: 'Fair' }
    return { variant: 'destructive' as const, text: 'Poor' }
  }

  const healthBadge = getHealthBadge(metrics.healthScore)

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle className="text-lg">Real-time Performance</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={healthBadge.variant}>
                  {healthBadge.text}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Health Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Health Score</span>
                <span className={cn('font-medium', getHealthColor(metrics.healthScore))}>
                  {metrics.healthScore}%
                </span>
              </div>
              <Progress value={metrics.healthScore} className="h-2" />
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  <span>Avg Latency</span>
                </div>
                <p className="text-2xl font-semibold">
                  {metrics.avgLatency}
                  <span className="text-sm font-normal text-muted-foreground">ms</span>
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  <span>Reconnections</span>
                </div>
                <p className="text-2xl font-semibold">
                  {metrics.reconnectionCount}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingDown className="h-3 w-3" />
                  <span>Drop Rate</span>
                </div>
                <p className="text-2xl font-semibold">
                  {metrics.messageDropRate.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">%</span>
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  <span>Subscriptions</span>
                </div>
                <p className="text-2xl font-semibold">
                  {metrics.subscriptionCount}
                </p>
              </div>
            </div>

            {/* Latency Distribution */}
            {metrics.messageLatency.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Latency Distribution</h4>
                <div className="flex items-end gap-1 h-16">
                  {metrics.messageLatency.slice(-20).map((latency, index) => {
                    const height = Math.min(100, (latency / 1000) * 100)
                    const color = latency > 500 ? 'bg-red-500' : latency > 200 ? 'bg-yellow-500' : 'bg-green-500'
                    
                    return (
                      <div
                        key={index}
                        className={cn('flex-1 rounded-t transition-all', color)}
                        style={{ height: `${height}%` }}
                        title={`${latency}ms`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Older</span>
                  <span>Recent</span>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <h4 className="text-sm font-medium">Recommendations</h4>
                </div>
                <ul className="space-y-1">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const monitor = RealtimePerformanceMonitor.getInstance()
                  const report = monitor.getDetailedReport()
                  // In production, send to analytics service instead of console
                  if (process.env.NODE_ENV === 'development') {
                    console.log('Performance Report:', report)
                  } else {
                    // TODO: Send to analytics service
                    toast.success('Performance report generated')
                  }
                }}
              >
                View Detailed Report
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}