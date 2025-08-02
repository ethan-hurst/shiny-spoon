// components/features/insights/reorder-suggestions.tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Package, TrendingUp, AlertTriangle, ShoppingCart } from 'lucide-react'
import type { AIPrediction } from '@/types/ai.types'

interface ReorderSuggestionsProps {
  predictions: AIPrediction[]
}

export function ReorderSuggestions({ predictions }: ReorderSuggestionsProps) {
  // Extract reorder suggestions from predictions
  const reorderSuggestions = predictions.map(pred => ({
    productId: pred.entity_id,
    ...pred.prediction_value,
    confidence: pred.confidence_score,
  }))

  const urgentReorders = reorderSuggestions.filter(s => {
    const stockLevel = s.currentStock / s.reorderPoint
    return stockLevel < 1.2 // Within 20% of reorder point
  })

  return (
    <div className="space-y-4">
      {urgentReorders.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-orange-800">Urgent Reorders Required</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700">
              {urgentReorders.length} product{urgentReorders.length !== 1 ? 's' : ''} approaching or below reorder point
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reorder Suggestions</CardTitle>
          <CardDescription>
            AI-optimized reorder points and quantities based on demand forecasts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reorderSuggestions.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No reorder suggestions available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reorderSuggestions.map((suggestion, index) => {
                const stockLevel = suggestion.currentStock / suggestion.reorderPoint
                const stockPercentage = Math.min(stockLevel * 100, 100)
                const isLow = stockLevel < 1.2
                const isCritical = stockLevel < 0.5

                return (
                  <div
                    key={`${suggestion.productId}-${index}`}
                    className={cn(
                      'p-4 border rounded-lg',
                      isCritical ? 'border-red-200 bg-red-50' :
                      isLow ? 'border-orange-200 bg-orange-50' :
                      'border-gray-200'
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            Product {suggestion.productId.slice(-6)}
                            {isCritical && <Badge variant="destructive">Critical</Badge>}
                            {isLow && !isCritical && <Badge variant="secondary">Low Stock</Badge>}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Warehouse {suggestion.warehouseId?.slice(-6) || 'Unknown'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Confidence</p>
                          <p className="font-medium">{Math.round(suggestion.confidence * 100)}%</p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Stock</p>
                          <p className="font-medium">{suggestion.currentStock} units</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Reorder Point</p>
                          <p className="font-medium text-orange-600">{suggestion.reorderPoint} units</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Reorder Quantity</p>
                          <p className="font-medium text-green-600">{suggestion.reorderQuantity} units</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Safety Stock</p>
                          <p className="font-medium">{suggestion.safetyStock} units</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Stock Level</span>
                          <span>{Math.round(stockPercentage)}% of reorder point</span>
                        </div>
                        <Progress 
                          value={stockPercentage} 
                          className={cn(
                            "h-2",
                            isCritical ? "[&>div]:bg-red-600" :
                            isLow ? "[&>div]:bg-orange-600" :
                            "[&>div]:bg-green-600"
                          )}
                        />
                      </div>

                      {suggestion.reasoning && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                        </div>
                      )}

                      {isLow && (
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" className="flex-1">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Create Purchase Order
                          </Button>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}