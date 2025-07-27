// PRP-016: Data Accuracy Monitor - Accuracy Comparison Chart Component
'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'

interface AccuracyComparisonChartProps {
  integrations: Array<{
    id: string
    platform: string
    name?: string
  }>
  organizationId: string
}

interface ComparisonData {
  integration: string
  accuracy: number
  checks: number
  discrepancies: number
}

export function AccuracyComparisonChart({ 
  integrations, 
  organizationId 
}: AccuracyComparisonChartProps) {
  const [data, setData] = useState<ComparisonData[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchComparisonData() {
      setLoading(true)
      try {
        // Fetch accuracy data for each integration
        const comparisonData = await Promise.all(
          integrations.map(async (integration) => {
            // Get latest accuracy metrics for this integration
            const { data: metrics } = await supabase
              .from('accuracy_metrics')
              .select('*')
              .eq('organization_id', organizationId)
              .eq('integration_id', integration.id)
              .order('calculated_at', { ascending: false })
              .limit(10)

            if (!metrics || metrics.length === 0) {
              return {
                integration: integration.name || integration.platform,
                accuracy: 100,
                checks: 0,
                discrepancies: 0,
              }
            }

            // Calculate average accuracy from recent metrics
            const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracy_score, 0) / metrics.length
            const totalChecks = metrics.reduce((sum, m) => sum + m.records_checked, 0)
            const totalDiscrepancies = metrics.reduce((sum, m) => sum + m.discrepancy_count, 0)

            return {
              integration: integration.name || integration.platform,
              accuracy: avgAccuracy,
              checks: totalChecks,
              discrepancies: totalDiscrepancies,
            }
          })
        )

        // Sort by accuracy score
        comparisonData.sort((a, b) => b.accuracy - a.accuracy)
        
        setData(comparisonData)
      } catch (error) {
        console.error('Failed to fetch comparison data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (integrations.length > 0) {
      fetchComparisonData()
    } else {
      setLoading(false)
    }
  }, [integrations, organizationId, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No integration data available for comparison
      </div>
    )
  }

  const getBarColor = (accuracy: number) => {
    if (accuracy >= 98) return 'hsl(142, 76%, 36%)' // green-600
    if (accuracy >= 95) return 'hsl(47, 96%, 53%)' // yellow-500
    if (accuracy >= 90) return 'hsl(25, 95%, 53%)' // orange-500
    return 'hsl(0, 84%, 60%)' // red-500
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              Accuracy: <span className="font-medium">{data.accuracy.toFixed(2)}%</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Checks: {data.checks.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              Discrepancies: {data.discrepancies.toLocaleString()}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart 
        data={data} 
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="integration" 
          angle={-45}
          textAnchor="end"
          height={100}
          interval={0}
          tick={{ fill: 'currentColor', fontSize: 12 }}
        />
        <YAxis 
          domain={[0, 100]}
          tick={{ fill: 'currentColor' }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          verticalAlign="top"
          height={36}
        />
        <Bar 
          dataKey="accuracy" 
          name="Accuracy Score"
          radius={[8, 8, 0, 0]}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}