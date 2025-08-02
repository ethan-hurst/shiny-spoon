'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Percent } from 'lucide-react'
import type { AIPrediction } from '@/types/ai.types'

interface PriceRecommendationsProps {
  predictions: AIPrediction[]
}

export function PriceRecommendations({ predictions }: PriceRecommendationsProps) {
  // Extract price recommendations from predictions
  const priceRecommendations = predictions.map(pred => ({
    productId: pred.entity_id,
    confidence: pred.confidence_score,
    ...pred.prediction_value,
  }))

  const totalPotentialRevenue = priceRecommendations.reduce((sum, rec) => {
    const impact = rec.estimatedImpact?.revenueChange || 0
    return sum + (impact > 0 ? impact : 0)
  }, 0)

  return (
    <div className="space-y-4">
      {totalPotentialRevenue > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-800">Revenue Opportunity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-green-700">
              Potential revenue increase of up to {(totalPotentialRevenue * 100).toFixed(1)}% by implementing all recommendations
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Price Optimization</CardTitle>
          <CardDescription>
            AI-powered pricing recommendations based on demand elasticity and market analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priceRecommendations.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No price recommendations available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {priceRecommendations.map((recommendation, index) => {
                const priceChange = recommendation.suggestedPrice - recommendation.currentPrice
                const priceChangePercent = (priceChange / recommendation.currentPrice) * 100
                const isIncrease = priceChange > 0
                const revenueImpact = recommendation.estimatedImpact?.revenueChange || 0
                const volumeImpact = recommendation.estimatedImpact?.volumeChange || 0

                return (
                  <div
                    key={`${recommendation.productId}-${index}`}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">Product {recommendation.productId.slice(-6)}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={isIncrease ? 'default' : 'secondary'}>
                              {isIncrease ? (
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 mr-1" />
                              )}
                              {Math.abs(priceChangePercent).toFixed(1)}%
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Confidence: {Math.round(recommendation.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Suggested Price</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${recommendation.suggestedPrice.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground line-through">
                            ${recommendation.currentPrice.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Revenue Impact</p>
                          <p className={cn(
                            "font-medium flex items-center gap-1",
                            revenueImpact > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {revenueImpact > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(revenueImpact * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Volume Impact</p>
                          <p className={cn(
                            "font-medium flex items-center gap-1",
                            volumeImpact > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {volumeImpact > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(volumeImpact * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Elasticity</p>
                          <p className="font-medium">{recommendation.factors?.demandElasticity?.toFixed(2) || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Inventory</p>
                          <p className="font-medium">
                            {recommendation.factors?.inventoryPressure > 0.7 ? 'High' :
                             recommendation.factors?.inventoryPressure > 0.3 ? 'Medium' : 'Low'}
                          </p>
                        </div>
                      </div>

                      {recommendation.reasoning && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
                        </div>
                      )}

                      {recommendation.factors?.competitorAverage && (
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Competitor Avg: ${recommendation.factors.competitorAverage.toFixed(2)}</span>
                          <span>Target Margin: {(recommendation.factors.marginTarget * 100).toFixed(0)}%</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="flex-1">
                          <Percent className="h-4 w-4 mr-2" />
                          Apply Price Change
                        </Button>
                        <Button size="sm" variant="outline">
                          View Analysis
                        </Button>
                      </div>
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