import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { IntegrationsList } from '@/components/features/integrations/integrations-list'
import { IntegrationStats } from '@/components/features/integrations/integration-stats'
import { IntegrationsListSkeleton } from '@/components/features/integrations/integrations-list-skeleton'

export const metadata = {
  title: 'Integrations | TruthSource',
  description: 'Manage your external system integrations',
}

export default async function IntegrationsPage() {
  const supabase = createClient()

  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Fetch integrations with related data
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select(`
      *,
      integration_logs!integration_logs_integration_id_fkey(
        count
      ),
      sync_jobs!sync_jobs_integration_id_fkey(
        count,
        status
      )
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Failed to load integrations')
  }

  // Calculate stats
  const stats = {
    total: integrations?.length || 0,
    active: integrations?.filter(i => i.status === 'active').length || 0,
    error: integrations?.filter(i => i.status === 'error').length || 0,
    syncing: integrations?.filter(i => 
      i.sync_jobs?.some((j: any) => j.status === 'running')
    ).length || 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect TruthSource with your external systems
          </p>
        </div>
        <Link href="/integrations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Integration
          </Button>
        </Link>
      </div>

      <IntegrationStats stats={stats} />

      <div className="rounded-md border">
        <Suspense fallback={<IntegrationsListSkeleton />}>
          <IntegrationsList integrations={integrations || []} />
        </Suspense>
      </div>
    </div>
  )
}