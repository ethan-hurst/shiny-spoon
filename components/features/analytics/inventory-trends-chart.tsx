// PRP-018: Analytics Dashboard - Inventory Trends Chart Component
'use client'

import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
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
import type { InventoryTrendMetrics } from '@/lib/analytics/calculate-metrics'

interface InventoryTrendsChartProps {
  data: InventoryTrendMetrics[]
}

export function InventoryTrendsChart({ data }: InventoryTrendsChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    date: format(new Date(item.date), 'MMM dd'),
    totalValueM: Number((item.totalValue / 1000000).toFixed(2)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Trends</CardTitle>
        <CardDescription>
          Total inventory value, low stock, and out-of-stock items over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
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
                label={{
                  value: 'Value ($M)',
                  angle: -90,
                  position: 'insideLeft',
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: 'Item Count',
                  angle: 90,
                  position: 'insideRight',
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{label}</p>
                        <p className="text-green-600">
                          Total Value: ${payload[0]?.value}M
                        </p>
                        <p className="text-yellow-600">
                          Low Stock: {payload[1]?.value}
                        </p>
                        <p className="text-red-600">
                          Out of Stock: {payload[2]?.value}
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
                dataKey="totalValueM"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                strokeWidth={2}
                name="Total Value ($M)"
              />

              <Bar
                yAxisId="right"
                dataKey="lowStockCount"
                fill="hsl(var(--chart-2))"
                name="Low Stock Items"
                opacity={0.7}
              />

              <Bar
                yAxisId="right"
                dataKey="outOfStockCount"
                fill="hsl(var(--destructive))"
                name="Out of Stock Items"
                opacity={0.8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
