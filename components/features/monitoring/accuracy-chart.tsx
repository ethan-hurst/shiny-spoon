// PRP-016: Data Accuracy Monitor - Accuracy Chart Component
'use client'

import { useMemo } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { format } from 'date-fns'
import type { AccuracyCheck } from '@/lib/monitoring/types'

interface AccuracyChartProps {
  data: Array<Omit<AccuracyCheck, 'startedAt' | 'completedAt' | 'createdAt'> & {
    startedAt: string | Date
    completedAt?: string | Date
    createdAt: string | Date
  }>
  height?: number
}

export function AccuracyChart({ data, height = 300 }: AccuracyChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Sort by date and format for chart
    return data
      .filter(check => check.status === 'completed' && check.accuracyScore !== null && check.accuracyScore !== undefined)
      .sort((a, b) => 
        new Date(a.completedAt || a.createdAt).getTime() - 
        new Date(b.completedAt || b.createdAt).getTime()
      )
      .map(check => ({
        date: format(new Date(check.completedAt || check.createdAt), 'MMM dd HH:mm'),
        accuracy: check.accuracyScore,
        records: check.recordsChecked,
        discrepancies: check.discrepanciesFound,
      }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No accuracy data available yet. Run a check to see trends.
      </div>
    )
  }

  interface CustomTooltipProps {
    active?: boolean
    payload?: Array<{
      value?: number
      payload?: {
        date: string
        accuracy: number
        records: number
        discrepancies: number
      }
    }>
    label?: string
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length && payload[0]?.value !== undefined) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          <p className="text-sm">
            Accuracy: <span className="font-medium">{payload[0].value.toFixed(2)}%</span>
          </p>
          {payload[0]?.payload?.records && (
            <p className="text-sm text-muted-foreground">
              Records: {payload[0].payload.records.toLocaleString()}
            </p>
          )}
          {payload[0]?.payload?.discrepancies !== undefined && (
            <p className="text-sm text-muted-foreground">
              Discrepancies: {payload[0].payload.discrepancies}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          className="text-xs"
          tick={{ fill: 'currentColor' }}
        />
        <YAxis 
          domain={[80, 100]}
          className="text-xs"
          tick={{ fill: 'currentColor' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="accuracy"
          name="Accuracy %"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}