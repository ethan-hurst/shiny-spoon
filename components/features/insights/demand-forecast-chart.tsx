// components/features/insights/demand-forecast-chart.tsx
'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  generateDemandForecasts,
  getHistoricalDemand,
} from '@/app/actions/ai-insights'
import type { AIPrediction } from '@/types/ai.types'

interface DemandForecastChartProps {
  organizationId: string
  predictions: AIPrediction[]
}

export function DemandForecastChart({
  organizationId,
  predictions,
}: DemandForecastChartProps) {
  const [forecasts, setForecasts] = useState<any[]>([])
  const [selectedForecast, setSelectedForecast] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadForecasts = async () => {
    setIsLoading(true)
    try {
      const result = await generateDemandForecasts(organizationId)
      if (result.success && result.data) {
        setForecasts(result.data)
        if (result.data.length > 0) {
          setSelectedForecast(result.data[0])
        }
      } else {
        toast.error(result.error || 'Failed to load forecasts')
      }
    } catch (error) {
      toast.error('Failed to load forecasts')
    } finally {
      setIsLoading(false)
    }
  }

  const loadHistoricalData = async (productId: string, warehouseId: string) => {
    try {
      const result = await getHistoricalDemand(productId, warehouseId, 30)
      if (result.success && result.data) {
        return result.data
      }
    } catch (error) {
      console.error('Failed to load historical data:', error)
    }
    return []
  }

  useEffect(() => {
    loadForecasts()
  }, [organizationId])

  useEffect(() => {
    if (!selectedForecast) return

    const prepareChartData = async () => {
      const historical = await loadHistoricalData(
        selectedForecast.productId,
        selectedForecast.warehouseId
      )

      // Combine historical and forecast data
      const combined = []

      // Add historical data
      if (historical && historical.length > 0) {
        historical.slice(-14).forEach((point: any) => {
          combined.push({
            date: point.date,
            historical: point.quantity,
            forecast: null,
            type: 'historical',
          })
        })
      }

      // Add forecast data
      if (selectedForecast.forecast && selectedForecast.forecast.length > 0) {
        selectedForecast.forecast.forEach((point: any, index: number) => {
          const forecastDate = new Date()
          forecastDate.setDate(forecastDate.getDate() + index + 1)

          combined.push({
            date: forecastDate.toISOString().split('T')[0],
            historical: null,
            forecast: Math.round(point.predicted_quantity * 100) / 100,
            type: 'forecast',
          })
        })
      }

      setChartData(combined)
    }

    prepareChartData()
  }, [selectedForecast])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Demand Forecasting</h2>
          <p className="text-muted-foreground">
            AI-powered demand predictions for inventory planning
          </p>
        </div>
        <Button variant="outline" onClick={loadForecasts} disabled={isLoading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Generating demand forecasts...</p>
          </CardContent>
        </Card>
      ) : forecasts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Forecast Data</h3>
            <p className="text-muted-foreground">
              Insufficient historical data to generate demand forecasts. More
              sales data is needed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Product Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Select Product for Forecast</CardTitle>
              <CardDescription>
                Choose a product to view its demand forecast
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedForecast?.productId || ''}
                onValueChange={(value) => {
                  const forecast = forecasts.find((f) => f.productId === value)
                  setSelectedForecast(forecast)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {forecasts.map((forecast) => (
                    <SelectItem
                      key={forecast.productId}
                      value={forecast.productId}
                    >
                      {forecast.productName} - {forecast.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Forecast Chart */}
          {selectedForecast && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedForecast.productName}</CardTitle>
                <CardDescription>
                  30-day demand forecast using {selectedForecast.method} method
                  (Confidence: {Math.round(selectedForecast.confidence * 100)}%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: 400 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return `${date.getMonth() + 1}/${date.getDate()}`
                        }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => `Date: ${value}`}
                        formatter={(value, name) => [
                          value ? Math.round(value * 100) / 100 : 'N/A',
                          name === 'historical'
                            ? 'Historical Demand'
                            : 'Forecast',
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="historical"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Historical"
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 4 }}
                        name="Forecast"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
