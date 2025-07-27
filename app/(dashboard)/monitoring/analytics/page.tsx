// PRP-016: Data Accuracy Monitor - Analytics Page
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccuracyAnalyticsDashboard } from '@/components/features/monitoring/accuracy-analytics-dashboard'
import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'

export const metadata: Metadata = {
  title: 'Accuracy Analytics | TruthSource',
  description: 'Analyze data accuracy trends and patterns',
}

export default async function AnalyticsPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) {
    redirect('/onboarding')
  }

  const scorer = new AccuracyScorer()

  // Get accuracy report data
  const [
    accuracyBreakdown,
    trendAnalysis,
    historicalData,
    benchmarkData
  ] = await Promise.all([
    scorer.getAccuracyBreakdown({
      organizationId: orgUser.organization_id,
    }),
    scorer.getTrendAnalysis({
      organizationId: orgUser.organization_id,
    }),
    scorer.getHistoricalTrend({
      organizationId: orgUser.organization_id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    }),
    scorer.getBenchmarkComparison(orgUser.organization_id),
  ])

  // Get integrations for filtering
  const { data: integrations } = await supabase
    .from('integrations')
    .select('id, platform, name')
    .eq('organization_id', orgUser.organization_id)
    .eq('is_active', true)

  return (
    <AccuracyAnalyticsDashboard
      organizationId={orgUser.organization_id}
      accuracyBreakdown={accuracyBreakdown}
      trendAnalysis={trendAnalysis}
      historicalData={historicalData}
      benchmarkData={benchmarkData}
      integrations={integrations || []}
    />
  )
}