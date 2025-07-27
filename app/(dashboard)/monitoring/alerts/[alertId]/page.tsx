// PRP-016: Data Accuracy Monitor - Alert Detail Page
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AlertDetailView } from '@/components/features/monitoring/alert-detail-view'

export const metadata: Metadata = {
  title: 'Alert Details | TruthSource',
  description: 'View alert details and history',
}

interface AlertDetailPageProps {
  params: {
    alertId: string
  }
}

export default async function AlertDetailPage({ params }: AlertDetailPageProps) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get alert details with rule information
  const { data: alert } = await supabase
    .from('alerts')
    .select(`
      *,
      alert_rules!inner(
        id,
        name,
        description,
        notification_channels,
        auto_remediate
      ),
      accuracy_checks(
        id,
        scope,
        accuracy_score,
        records_checked,
        discrepancies_found,
        completed_at
      )
    `)
    .eq('id', params.alertId)
    .single()

  if (!alert) {
    notFound()
  }

  // Get notification history
  const { data: notifications } = await supabase
    .from('notification_log')
    .select('*')
    .eq('alert_id', params.alertId)
    .order('created_at', { ascending: false })

  // Get related discrepancies if there's an accuracy check
  let discrepancies = []
  if (alert.accuracy_check_id) {
    const { data } = await supabase
      .from('discrepancies')
      .select('*')
      .eq('accuracy_check_id', alert.accuracy_check_id)
      .order('severity', { ascending: false })
      .limit(20)
    
    discrepancies = data || []
  }

  return (
    <AlertDetailView
      alert={alert}
      notifications={notifications || []}
      discrepancies={discrepancies}
    />
  )
}