'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Calendar, Target, BarChart3 } from 'lucide-react'
import type { AIPredictionsPanelProps, AIPrediction } from '@/types/ai.types'

export function AIPredictionsPanel({ predictions, onPredictionClick }: AIPredictionsPanelProps) {
  if (predictions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Predictions Yet</h3>
          <p className="text-muted-foreground">
            AI predictions will appear here as they are generated based on your data.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {predictions.map((prediction) => (
        <AIPredictionCard
          key={prediction.id}
          prediction={prediction}
          onClick={() => onPredictionClick(prediction)}
        />
      ))}
    </div>
  )
}

function AIPredictionCard({ prediction, onClick }: { prediction: AIPrediction; onClick: () => void }) {
  const getPredictionIcon = (type: string) => {
    switch (type) {
      case 'demand':
        return TrendingUp
      case 'reorder':
        return Target
      case 'price':
        return BarChart3
      default:
        return TrendingUp
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const Icon = getPredictionIcon(prediction.prediction_type)

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Icon className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base capitalize">
                {prediction.prediction_type} Prediction
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(prediction.prediction_date).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="outline" className={getConfidenceColor(prediction.confidence_score)}>
              {(prediction.confidence_score * 100).toFixed(0)}% confidence
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Entity</p>
            <p className="text-sm text-muted-foreground">
              {prediction.entity_type}: {prediction.entity_id}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Prediction Period</p>
            <p className="text-sm text-muted-foreground">
              {new Date(prediction.prediction_start).toLocaleDateString()} - {new Date(prediction.prediction_end).toLocaleDateString()}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Model</p>
            <p className="text-sm text-muted-foreground">
              Version {prediction.model_version}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 