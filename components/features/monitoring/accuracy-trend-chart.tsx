// PRP-016: Data Accuracy Monitor - Accuracy Trend Chart Component
'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'
import { AccuracyTrendPoint } from '@/lib/monitoring/types'

interface AccuracyTrendChartProps {
  data: AccuracyTrendPoint[]
  height?: number
  showReference?: boolean
  referenceValue?: number
}

/**
 * Renders an interactive area chart visualizing accuracy trends over time.
 *
 * Displays accuracy scores with formatted tooltips, a responsive layout, and an optional reference line indicating a target threshold. If no data is provided, shows a placeholder message.
 *
 * @param data - Array of accuracy trend points to visualize
 * @param height - Optional chart height in pixels (default: 300)
 * @param showReference - Whether to display the reference line (default: true)
 * @param referenceValue - Value for the reference line (default: 95)
 */
export function AccuracyTrendChart({ 
  data, 
  height = 300,
  showReference = true,
  referenceValue = 95
}: AccuracyTrendChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Sort by date and format for chart
    return data
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(point => ({
        date: format(point.timestamp, 'MMM dd'),
        time: format(point.timestamp, 'HH:mm'),
        accuracy: point.accuracyScore,
        records: point.recordsChecked,
        discrepancies: point.discrepancyCount,
      }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No trend data available yet. Data will appear after accuracy checks are run.
      </div>
    )
  }

  interface TooltipPayload {
    value: number
    payload: {
      date: string
      time: string
      accuracy: number
      records: number
      discrepancies: number
    }
  }

  interface CustomTooltipProps {
    active?: boolean
    payload?: TooltipPayload[]
    label?: string
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length > 0 && payload[0]) {
      const data = payload[0]
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{data.payload.time}</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              Accuracy: <span className="font-medium">{data.value.toFixed(2)}%</span>
            </p>
            {data.payload.records && (
              <p className="text-sm text-muted-foreground">
                Records: {data.payload.records.toLocaleString()}
              </p>
            )}
            {data.payload.discrepancies !== undefined && (
              <p className="text-sm text-muted-foreground">
                Discrepancies: {data.payload.discrepancies}
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  const minAccuracy = Math.min(...chartData.map(d => d.accuracy))
  const yAxisDomain = [Math.max(0, minAccuracy - 5), 100]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart 
        data={chartData} 
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <defs>
          <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          className="text-xs"
          tick={{ fill: 'currentColor' }}
        />
        <YAxis 
          domain={yAxisDomain}
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {showReference && (
          <ReferenceLine 
            y={referenceValue} 
            stroke="hsl(var(--destructive))" 
            strokeDasharray="3 3"
            label={`Target: ${referenceValue}%`}
          />
        )}
        <Area
          type="monotone"
          dataKey="accuracy"
          name="Accuracy %"
          stroke="hsl(var(--primary))"
          fillOpacity={1}
          fill="url(#colorAccuracy)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}