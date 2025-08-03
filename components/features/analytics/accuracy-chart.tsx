// PRP-018: Analytics Dashboard - Order Accuracy Chart Component
'use client'

import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { OrderAccuracyMetrics } from '@/lib/analytics/calculate-metrics'

interface AccuracyChartProps {
  data: OrderAccuracyMetrics[]
}

export function AccuracyChart({ data }: AccuracyChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    date: format(new Date(item.date), 'MMM dd'),
    accuracyRate: Number(item.accuracyRate.toFixed(1)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Accuracy Trend</CardTitle>
        <CardDescription>
          Daily order accuracy rate and error count
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
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
                domain={[90, 100]}
                ticks={[90, 92, 94, 96, 98, 100]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{label}</p>
                        <p className="text-green-600">
                          Accuracy: {payload[0]?.value}%
                        </p>
                        <p className="text-red-600">
                          Errors: {payload[1]?.value || 0}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />

              <Area
                yAxisId="left"
                type="monotone"
                dataKey="accuracyRate"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
                name="Accuracy %"
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="errorCount"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="Error Count"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
