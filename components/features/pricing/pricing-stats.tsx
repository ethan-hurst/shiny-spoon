'use client'

import { useEffect, useState } from 'react'
import { endOfDay, format, startOfDay, subDays } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export function PricingStats() {
  const [loading, setLoading] = useState(true)
  const [discountTrends, setDiscountTrends] = useState<any[]>([])
  const [marginDistribution, setMarginDistribution] = useState<any[]>([])
  const [rulePerformance, setRulePerformance] = useState<any[]>([])
  const [topDiscountedProducts, setTopDiscountedProducts] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchAnalytics()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAnalytics() {
    try {
      const last30Days = subDays(new Date(), 30)

      // Fetch price calculations for analytics
      const { data: calculations, error } = await supabase
        .from('price_calculations')
        .select(
          `
          *,
          products!inner(name, sku)
        `
        )
        .gte('requested_at', last30Days.toISOString())
        .order('requested_at', { ascending: true })

      if (error) throw error

      // Process discount trends by day
      const trendsByDay = calculations?.reduce((acc: any, calc) => {
        const day = format(new Date(calc.requested_at), 'MMM dd')
        if (!acc[day]) {
          acc[day] = { day, totalDiscount: 0, avgDiscount: 0, count: 0 }
        }
        acc[day].totalDiscount += calc.total_discount || 0
        acc[day].avgDiscount =
          (acc[day].avgDiscount * acc[day].count +
            (calc.discount_percent || 0)) /
          (acc[day].count + 1)
        acc[day].count++
        return acc
      }, {})

      setDiscountTrends(Object.values(trendsByDay || {}))

      // Process margin distribution
      const marginRanges = [
        { range: '0-10%', min: 0, max: 10, count: 0 },
        { range: '10-20%', min: 10, max: 20, count: 0 },
        { range: '20-30%', min: 20, max: 30, count: 0 },
        { range: '30-40%', min: 30, max: 40, count: 0 },
        { range: '40%+', min: 40, max: 100, count: 0 },
      ]

      calculations?.forEach((calc) => {
        const margin = calc.margin_percent || 0
        const range = marginRanges.find(
          (r) => margin >= r.min && margin < r.max
        )
        if (range) range.count++
      })

      setMarginDistribution(marginRanges)

      // Process rule performance
      const ruleStats: any = {}
      calculations?.forEach((calc) => {
        calc.applied_rules?.forEach((rule: any) => {
          if (!ruleStats[rule.type]) {
            ruleStats[rule.type] = {
              type: rule.type,
              count: 0,
              totalDiscount: 0,
              avgDiscount: 0,
            }
          }
          ruleStats[rule.type].count++
          ruleStats[rule.type].totalDiscount += rule.discount_amount || 0
        })
      })

      Object.values(ruleStats).forEach((stat: any) => {
        stat.avgDiscount = stat.count > 0 ? stat.totalDiscount / stat.count : 0
      })

      setRulePerformance(Object.values(ruleStats))

      // Get top discounted products
      const productStats: any = {}
      calculations?.forEach((calc) => {
        const productId = calc.product_id
        if (!productStats[productId]) {
          productStats[productId] = {
            name: calc.products.name,
            sku: calc.products.sku,
            totalDiscount: 0,
            avgDiscount: 0,
            count: 0,
          }
        }
        productStats[productId].totalDiscount += calc.total_discount || 0
        productStats[productId].avgDiscount =
          (productStats[productId].avgDiscount * productStats[productId].count +
            (calc.discount_percent || 0)) /
          (productStats[productId].count + 1)
        productStats[productId].count++
      })

      const topProducts = Object.values(productStats)
        .sort((a: any, b: any) => b.totalDiscount - a.totalDiscount)
        .slice(0, 10)

      setTopDiscountedProducts(topProducts)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>
  }

  return (
    <div className="space-y-6">
      {/* Discount Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Discount Trends</CardTitle>
          <CardDescription>
            Average discount percentage over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={discountTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgDiscount"
                stroke="#8b5cf6"
                name="Avg Discount %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Margin Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Margin Distribution</CardTitle>
            <CardDescription>Product margins after discounts</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={marginDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.range}: ${entry.count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {marginDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rule Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Rule Performance</CardTitle>
            <CardDescription>Discounts by rule type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rulePerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="avgDiscount" fill="#3b82f6" name="Avg Discount" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Discounted Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Discounted Products</CardTitle>
          <CardDescription>
            Products with the highest total discounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topDiscountedProducts.map((product, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    SKU: {product.sku}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatCurrency(product.totalDiscount)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Avg: {product.avgDiscount.toFixed(1)}% ({product.count}{' '}
                    orders)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
