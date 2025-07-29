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
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: orgUser, error: orgError } = await supabase
    .from('organization_users')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (orgError || !orgUser) {
    console.error('Error fetching organization:', orgError)
    redirect('/onboarding')
  }

  const scorer = new AccuracyScorer()

  // Get accuracy report data
  let accuracyBreakdown, trendAnalysis, historicalData: any[], benchmarkData
  
  try {
    [accuracyBreakdown, trendAnalysis, historicalData, benchmarkData] = await Promise.all([
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
  } catch (error) {
    console.error('Error fetching accuracy data:', error)
    // Provide fallback values
    accuracyBreakdown = { overall: 100, byEntityType: {}, bySeverity: {} }
    trendAnalysis = { trend: 'stable', changeRate: 0, forecast: 100, volatility: 0 }
    historicalData = []
    benchmarkData = { organizationScore: 100, industryAverage: 95, percentile: 75 }
  }

  // Get integrations for filtering
  const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('id, platform, name')
    .eq('organization_id', orgUser.organization_id)
    .eq('is_active', true)

  if (intError) {
    console.error('Error fetching integrations:', intError)
  }

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