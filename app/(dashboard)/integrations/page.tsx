import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { IntegrationStats } from '@/components/features/integrations/integration-stats'
import { IntegrationsList } from '@/components/features/integrations/integrations-list'
import { IntegrationsListSkeleton } from '@/components/features/integrations/integrations-list-skeleton'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/supabase/types/database'

type SyncJob = {
  count: number
  status: Database['public']['Tables']['sync_jobs']['Row']['status']
}

type IntegrationWithRelations =
  Database['public']['Tables']['integrations']['Row'] & {
    integration_logs?: { count: number }[]
    sync_jobs?: SyncJob[]
  }

export const metadata = {
  title: 'Integrations | TruthSource',
  description: 'Manage your external system integrations',
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string }
}) {
  const supabase = await createClient()

  // Get user's organization
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  // Pagination settings
  const page = parseInt(searchParams.page || '1', 10)
  const limit = parseInt(searchParams.limit || '20', 10)
  const offset = (page - 1) * limit

  // Fetch integrations with related data
  const {
    data: integrations,
    error,
    count,
  } = await supabase
    .from('integrations')
    .select(
      `
      *,
      integration_logs!integration_logs_integration_id_fkey(
        count
      ),
      sync_jobs!sync_jobs_integration_id_fkey(
        count,
        status
      )
    `,
      { count: 'exact' }
    )
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to load integrations:', error.message)
    throw new Error(`Failed to load integrations: ${error.message}`)
  }

  // Type-safe integrations
  const typedIntegrations = (integrations || []) as IntegrationWithRelations[]

  // Calculate stats
  const stats = {
    total: count || 0,
    active: typedIntegrations.filter((i) => i.status === 'active').length,
    error: typedIntegrations.filter((i) => i.status === 'error').length,
    syncing: typedIntegrations.filter((i) =>
      i.sync_jobs?.some((j: SyncJob) => j.status === 'running')
    ).length,
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
          <IntegrationsList integrations={typedIntegrations} />
        </Suspense>
      </div>
    </div>
  )
}
