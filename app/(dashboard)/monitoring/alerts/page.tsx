// PRP-016: Data Accuracy Monitor - Alert Configuration Page
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertRulesList } from '@/components/features/monitoring/alert-rules-list'
import { AlertConfigDialog } from '@/components/features/monitoring/alert-config-dialog'
import { RefreshButton } from '@/components/features/monitoring/refresh-button'

export const metadata: Metadata = {
  title: 'Alert Configuration | TruthSource',
  description: 'Configure accuracy monitoring alert rules',
}

/**
 * Server component for the Alert Configuration page, displaying and managing alert rules for the authenticated user's organization.
 *
 * Redirects unauthenticated users to the login page and users without an organization to onboarding. Fetches and displays alert rules for the user's organization, or shows an error message if loading fails.
 */
export default async function AlertsPage() {
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

  // Get alert rules
  const { data: alertRules, error: rulesError } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('organization_id', orgUser.organization_id)
    .order('created_at', { ascending: false })

  if (rulesError) {
    console.error('Error fetching alert rules:', rulesError)
  }

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

      {rulesError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Failed to load alert rules</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            We encountered an error while loading your alert rules. Please try refreshing the page.
          </p>
          <RefreshButton className="mt-3" />
        </div>
      ) : (
        <AlertRulesList 
          rules={alertRules || []} 
          organizationId={orgUser.organization_id}
        />
      )}
    </div>
  )
}