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
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get alert details with rule information
  try {
    const { data: alert, error: alertError } = await supabase
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

    if (alertError || !alert) {
      console.error('Error fetching alert:', alertError)
      notFound()
    }

    // Get notification history
    const { data: notifications, error: notifError } = await supabase
      .from('notification_log')
      .select('*')
      .eq('alert_id', params.alertId)
      .order('created_at', { ascending: false })

    if (notifError) {
      console.error('Error fetching notifications:', notifError)
    }

    // Get related discrepancies if there's an accuracy check
    let discrepancies = []
    if (alert.accuracy_check_id) {
      const { data, error: discrepError } = await supabase
        .from('discrepancies')
        .select('*')
        .eq('accuracy_check_id', alert.accuracy_check_id)
        .order('severity', { ascending: false })
        .limit(20)
      
      if (discrepError) {
        console.error('Error fetching discrepancies:', discrepError)
      }
      discrepancies = data || []
    }

    return (
      <AlertDetailView
        alert={alert}
        notifications={notifications || []}
        discrepancies={discrepancies}
      />
    )
  } catch (error) {
    console.error('Unexpected error in alert detail page:', error)
    notFound()
  }
}