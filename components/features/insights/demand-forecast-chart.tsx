'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, Package } from 'lucide-react'
import type { AIPrediction } from '@/types/ai.types'

interface DemandForecastChartProps {
  organizationId: string
  predictions: AIPrediction[]
}

export function DemandForecastChart({ organizationId, predictions }: DemandForecastChartProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  // Group predictions by product
  const productPredictions = predictions.reduce((acc, pred) => {
    if (!acc[pred.entity_id]) {
      acc[pred.entity_id] = []
    }
    acc[pred.entity_id].push(pred)
    return acc
  }, {} as Record<string, AIPrediction[]>)

  // Get unique products
  const products = Object.keys(productPredictions)

  // Get chart data
  const getChartData = () => {
    if (selectedProduct === 'all') {
      // Aggregate all predictions
      const aggregatedData: any[] = []
      const dateMap = new Map<string, number>()

      predictions.forEach(pred => {
        const forecast = pred.prediction_value?.forecast || []
        const startDate = new Date(pred.prediction_start)
        
        forecast.forEach((value: number, index: number) => {
          const date = new Date(startDate)
          date.setDate(date.getDate() + index)
          const dateStr = date.toISOString().split('T')[0]
          
          dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + value)
        })
      })

      dateMap.forEach((value, date) => {
        aggregatedData.push({
          date,
          displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          demand: Math.round(value),
        })
      })

      return aggregatedData.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 30)
    } else {
      // Get data for selected product
      const productPred = productPredictions[selectedProduct]?.[0]
      if (!productPred) return []

      const forecast = productPred.prediction_value?.forecast || []
      const startDate = new Date(productPred.prediction_start)

      return forecast.slice(0, 30).map((value: number, index: number) => {
        const date = new Date(startDate)
        date.setDate(date.getDate() + index)
        
        return {
          date: date.toISOString().split('T')[0],
          displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          demand: Math.round(value),
        }
      })
    }
  }

  const chartData = getChartData()
  const avgDemand = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.demand, 0) / chartData.length)
    : 0

  const Chart = chartType === 'line' ? LineChart : BarChart
  const DataComponent = chartType === 'line' ? Line : Bar

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Demand Forecast</CardTitle>
            <CardDescription>
              AI-powered demand predictions for the next 30 days
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={chartType} onValueChange={(v) => setChartType(v as 'line' | 'bar')}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map(productId => (
                  <SelectItem key={productId} value={productId}>
                    Product {productId.slice(-6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No demand forecasts available</p>
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Average Daily Demand</p>
                <p className="text-2xl font-bold">{avgDemand} units</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Forecast Period</p>
                <p className="text-2xl font-bold">30 days</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Confidence Level</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {Math.round((predictions[0]?.confidence_score || 0) * 100)}%
                  </p>
                  <Badge variant="secondary">
                    {predictions[0]?.confidence_score >= 0.8 ? 'High' : 
                     predictions[0]?.confidence_score >= 0.6 ? 'Medium' : 'Low'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <Chart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="displayDate" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <DataComponent 
                    type="monotone" 
                    dataKey="demand" 
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    name="Predicted Demand"
                  />
                </Chart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}