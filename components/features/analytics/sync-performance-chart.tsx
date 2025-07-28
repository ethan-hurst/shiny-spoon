// PRP-018: Analytics Dashboard - Sync Performance Chart Component
'use client'

import { format } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SyncPerformanceMetrics } from '@/lib/analytics/calculate-metrics'

interface SyncPerformanceChartProps {
  data: SyncPerformanceMetrics[]
}

export function SyncPerformanceChart({ data }: SyncPerformanceChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    date: format(new Date(item.date), 'MMM dd'),
    avgDurationSeconds: Number((item.avgDuration / 1000).toFixed(2)),
    successRate: Number(item.successRate.toFixed(1)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Performance</CardTitle>
        <CardDescription>
          Daily sync count, duration, and success rates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Duration (s)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{label}</p>
                        <p className="text-blue-600">
                          Sync Count: {payload[0]?.value}
                        </p>
                        <p className="text-green-600">
                          Avg Duration: {payload[1]?.value}s
                        </p>
                        <p className="text-purple-600">
                          Success Rate: {payload[2]?.value}%
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />

              <Bar
                yAxisId="left"
                dataKey="syncCount"
                fill="hsl(var(--primary))"
                name="Sync Count"
                opacity={0.7}
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgDurationSeconds"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="Avg Duration (s)"
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="successRate"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="Success Rate %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}