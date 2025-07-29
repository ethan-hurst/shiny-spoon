// components/features/insights/reorder-suggestions.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, RefreshCw, TrendingUp } from 'lucide-react'
import { generateReorderSuggestions } from '@/app/actions/ai-insights'
import { toast } from 'sonner'
import type { AIInsight } from '@/types/ai.types'

interface ReorderSuggestionsProps {
  organizationId: string
  insights: AIInsight[]
}

export function ReorderSuggestions({ organizationId, insights }: ReorderSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadSuggestions = async () => {
    setIsLoading(true)
    try {
      const result = await generateReorderSuggestions(organizationId)
      if (result.success && result.data) {
        setSuggestions(result.data)
      } else {
        toast.error(result.error || 'Failed to load reorder suggestions')
      }
    } catch (error) {
      toast.error('Failed to load reorder suggestions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSuggestions()
  }, [organizationId])

  const getPriorityLevel = (currentQuantity: number, suggestedReorderPoint: number) => {
    if (currentQuantity <= 0) return { level: 'critical', color: 'bg-red-100 text-red-800', label: 'Out of Stock' }
    if (currentQuantity <= suggestedReorderPoint * 0.5) return { level: 'high', color: 'bg-orange-100 text-orange-800', label: 'Urgent' }
    if (currentQuantity <= suggestedReorderPoint) return { level: 'medium', color: 'bg-yellow-100 text-yellow-800', label: 'Soon' }
    return { level: 'low', color: 'bg-green-100 text-green-800', label: 'Normal' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reorder Suggestions</h2>
          <p className="text-muted-foreground">
            AI-powered recommendations for optimal inventory levels
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={loadSuggestions}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* AI Insight Recommendations */}
      {insights.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">AI Recommendations</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                    <Badge variant="outline">{insight.severity}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-3">
                    {insight.content}
                  </CardDescription>
                  {insight.recommended_actions.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-2">Actions:</p>
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
            ))}
          </div>
        </div>
      )}

      {/* Reorder Suggestions Table */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Reorder Analysis</h3>
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Analyzing inventory levels...</p>
            </CardContent>
          </Card>
        ) : suggestions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700 mb-2">Inventory Optimized</h3>
              <p className="text-muted-foreground">All products are at optimal stock levels</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => {
              const priority = getPriorityLevel(suggestion.current_quantity, suggestion.suggested_reorder_point)
              
              return (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{suggestion.product_name}</CardTitle>
                        <CardDescription>{suggestion.warehouse_name}</CardDescription>
                      </div>
                      <Badge className={priority.color}>
                        {priority.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Stock</p>
                        <p className="text-2xl font-bold">{suggestion.current_quantity}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Suggested Reorder Point</p>
                        <p className="text-2xl font-bold text-orange-600">{suggestion.suggested_reorder_point}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Order Quantity</p>
                        <p className="text-2xl font-bold text-blue-600">{suggestion.suggested_order_quantity}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Lead Time</p>
                        <p className="text-2xl font-bold">{suggestion.lead_time_days} days</p>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 p-3 rounded text-sm">
                      <p className="font-medium mb-1">AI Reasoning:</p>
                      <p>{suggestion.reasoning}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}