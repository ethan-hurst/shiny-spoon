// PRP-018: Analytics Dashboard - Main Dashboard Page
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { endOfDay, subDays } from 'date-fns'
import { AnalyticsCalculator } from '@/lib/analytics/calculate-metrics'
import { MetricsCards } from '@/components/features/analytics/metrics-cards'
import { AccuracyChart } from '@/components/features/analytics/accuracy-chart'
import { SyncPerformanceChart } from '@/components/features/analytics/sync-performance-chart'
import { InventoryTrendsChart } from '@/components/features/analytics/inventory-trends-chart'
import { RevenueImpactCard } from '@/components/features/analytics/revenue-impact-card'
import { DateRangePicker } from '@/components/features/analytics/date-range-picker'
import { ExportAnalyticsButton } from '@/components/features/analytics/export-analytics-button'
import { AnalyticsSkeleton } from '@/components/features/analytics/analytics-skeleton'

interface AnalyticsPageProps {
  searchParams: {
    from?: string
    to?: string
  }
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const supabase = await createClient()

  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Parse date range from search params
  const dateRange = {
    from: searchParams.from ? new Date(searchParams.from) : subDays(new Date(), 30),
    to: searchParams.to ? new Date(searchParams.to) : endOfDay(new Date())
  }

  // Initialize calculator
  const calculator = new AnalyticsCalculator()

  // Fetch all metrics in parallel
  const [
    orderAccuracy,
    syncPerformance,
    inventoryTrends,
    revenueImpact
  ] = await Promise.all([
    calculator.calculateOrderAccuracy(profile.organization_id, dateRange),
    calculator.calculateSyncPerformance(profile.organization_id, dateRange),
    calculator.calculateInventoryTrends(profile.organization_id, dateRange),
    calculator.calculateRevenueImpact(profile.organization_id, dateRange)
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track your data accuracy improvements and business impact
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
          />
          <ExportAnalyticsButton
            dateRange={dateRange}
            organizationId={profile.organization_id}
          />
        </div>
      </div>

      <Suspense fallback={<AnalyticsSkeleton />}>
        {/* Key Metrics Cards */}
        <MetricsCards
          orderAccuracy={orderAccuracy}
          syncPerformance={syncPerformance}
          inventoryTrends={inventoryTrends}
          revenueImpact={revenueImpact}
        />

        {/* Revenue Impact Highlight */}
        <RevenueImpactCard revenueImpact={revenueImpact} />

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <AccuracyChart data={orderAccuracy} />
          <SyncPerformanceChart data={syncPerformance} />
        </div>

        {/* Full Width Inventory Trends */}
        <InventoryTrendsChart data={inventoryTrends} />
      </Suspense>
    </div>
  )
}