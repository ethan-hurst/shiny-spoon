// PRP-016: Data Accuracy Monitor - Alert Configuration Page
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertRulesList } from '@/components/features/monitoring/alert-rules-list'
import { AlertConfigDialog } from '@/components/features/monitoring/alert-config-dialog'

export const metadata: Metadata = {
  title: 'Alert Configuration | TruthSource',
  description: 'Configure accuracy monitoring alert rules',
}

export default async function AlertsPage() {
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

  // Get alert rules
  const { data: alertRules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('organization_id', orgUser.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Alert Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Set up rules to get notified when data accuracy issues are detected
          </p>
        </div>
        <AlertConfigDialog>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Alert Rule
          </Button>
        </AlertConfigDialog>
      </div>

      <AlertRulesList 
        rules={alertRules || []} 
        organizationId={orgUser.organization_id}
      />
    </div>
  )
}