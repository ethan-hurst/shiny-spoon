// app/(dashboard)/audit/page.tsx
import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { AuditTable } from '@/components/features/audit/audit-table'
import { AuditFilters } from '@/components/features/audit/audit-filters'
import { AuditExportButton } from '@/components/features/audit/audit-export-button'
import { RetentionPolicyDialog } from '@/components/features/audit/retention-policy-dialog'
import { AuditSkeleton } from '@/components/features/audit/audit-skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'
import { startOfDay, endOfDay, subDays } from 'date-fns'

interface AuditPageProps {
  searchParams: {
    user?: string
    action?: string
    entity?: string
    from?: string
    to?: string
    page?: string
  }
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const supabase = createServerClient()

  // Get user's organization and check permissions
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) throw new Error('No organization found')

  // Parse filters
  const filters = {
    user_id: searchParams.user,
    action: searchParams.action,
    entity_type: searchParams.entity,
    from: searchParams.from ? new Date(searchParams.from) : subDays(new Date(), 7),
    to: searchParams.to ? new Date(searchParams.to) : endOfDay(new Date()),
    page: parseInt(searchParams.page || '1', 10)
  }

  // Build query
  let query = supabase
    .from('audit_logs_with_details')
    .select('*', { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .gte('created_at', filters.from.toISOString())
    .lte('created_at', filters.to.toISOString())
    .order('created_at', { ascending: false })
    .range((filters.page - 1) * 50, filters.page * 50 - 1)

  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id)
  }
  if (filters.action) {
    query = query.eq('action', filters.action)
  }
  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type)
  }

  const { data: logs, count, error } = await query

  if (error) throw error

  // Get unique users for filter dropdown
  const { data: users } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, email')
    .eq('organization_id', profile.organization_id)
    .order('full_name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Audit Trail
          </h1>
          <p className="text-muted-foreground">
            Complete activity log for compliance and security monitoring
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AuditExportButton
            filters={filters}
            organizationId={profile.organization_id}
          />
          {profile.role === 'admin' || profile.role === 'owner' ? (
            <RetentionPolicyDialog organizationId={profile.organization_id} />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            All user actions are logged for security and compliance purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<AuditSkeleton />}>
            <AuditFilters
              users={users || []}
              currentFilters={filters}
            />

            <AuditTable
              logs={logs || []}
              totalCount={count || 0}
              currentPage={filters.page}
              filters={filters}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

export const metadata = {
  title: 'Audit Trail - TruthSource',
  description: 'Complete activity log for compliance and security monitoring',
}