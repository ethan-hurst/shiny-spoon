// PRP-016: Data Accuracy Monitor - Dashboard Page
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccuracyDashboard } from '@/components/features/monitoring/accuracy-dashboard'

export const metadata: Metadata = {
  title: 'Data Accuracy Monitor | TruthSource',
  description: 'Monitor data accuracy across all integrated systems',
}

export default async function MonitoringPage() {
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

  // Get initial data for the dashboard
  const [
    { data: currentAccuracy },
    { data: recentChecks },
    { data: activeAlerts },
    { data: discrepancies }
  ] = await Promise.all([
    // Get current accuracy score
    supabase
      .from('accuracy_checks')
      .select('accuracy_score')
      .eq('organization_id', orgUser.organization_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single(),
    
    // Get recent accuracy checks
    supabase
      .from('accuracy_checks')
      .select('*')
      .eq('organization_id', orgUser.organization_id)
      .order('created_at', { ascending: false })
      .limit(10),
    
    // Get active alerts
    supabase
      .from('alerts')
      .select(`
        *,
        alert_rules!inner(name)
      `)
      .eq('organization_id', orgUser.organization_id)
      .in('status', ['active', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(10),
    
    // Get recent discrepancies
    supabase
      .from('discrepancies')
      .select('*')
      .eq('organization_id', orgUser.organization_id)
      .order('detected_at', { ascending: false })
      .limit(50)
  ])

  return (
    <AccuracyDashboard
      organizationId={orgUser.organization_id}
      initialAccuracy={currentAccuracy?.accuracy_score || 100}
      initialChecks={recentChecks || []}
      initialAlerts={activeAlerts || []}
      initialDiscrepancies={discrepancies || []}
    />
  )
}