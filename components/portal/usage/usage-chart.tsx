'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UsageStats } from '@/lib/billing'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { format, startOfDay, eachDayOfInterval, subDays } from 'date-fns'

interface UsageChartProps {
  historicalUsage: any[]
  currentUsage: UsageStats
}

export function UsageChart({ historicalUsage, currentUsage }: UsageChartProps) {
  // Process historical data into daily aggregates
  const last30Days = eachDayOfInterval({
    start: subDays(new Date(), 29),
    end: new Date(),
  })

  const dailyData = last30Days.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayData = historicalUsage.filter(
      item => format(new Date(item.created_at), 'yyyy-MM-dd') === dateStr
    )

    // Aggregate data for the day
    const apiCalls = dayData
      .filter(item => item.metric_type === 'api_calls')
      .reduce((sum, item) => sum + (item.metric_value || 0), 0)

    const products = dayData
      .filter(item => item.metric_type === 'products_count')
      .reduce((max, item) => Math.max(max, item.metric_value || 0), 0)

    const warehouses = dayData
      .filter(item => item.metric_type === 'warehouses_count')
      .reduce((max, item) => Math.max(max, item.metric_value || 0), 0)

    return {
      date: format(date, 'MMM d'),
      apiCalls,
      products: products || (format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? currentUsage.products.current : null),
      warehouses: warehouses || (format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? currentUsage.warehouses.current : null),
    }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{entry.value?.toLocaleString() || 'N/A'}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card id="usage-chart">
      <CardHeader>
        <CardTitle>Usage Trends</CardTitle>
        <CardDescription>
          Track your usage patterns over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="api" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="api">API Calls</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="apiCalls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="API Calls"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">
                  {dailyData[dailyData.length - 1]?.apiCalls.toLocaleString() || '0'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">7-day avg</p>
                <p className="text-2xl font-bold">
                  {Math.round(
                    dailyData.slice(-7).reduce((sum, d) => sum + d.apiCalls, 0) / 7
                  ).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">30-day total</p>
                <p className="text-2xl font-bold">
                  {currentUsage.apiCalls.current.toLocaleString()}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="stepAfter"
                    dataKey="products"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Products"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Current product count</p>
              <p className="text-3xl font-bold mt-1">
                {currentUsage.products.current.toLocaleString()}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="warehouses" className="space-y-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="stepAfter"
                    dataKey="warehouses"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Warehouses"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Active warehouse locations</p>
              <p className="text-3xl font-bold mt-1">
                {currentUsage.warehouses.current}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}