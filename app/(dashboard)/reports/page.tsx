// PRP-019: Custom Reports Builder - Reports Dashboard
import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportsTable } from '@/components/features/reports/reports-table'
import { ReportTemplates } from '@/components/features/reports/report-templates'

export const metadata = {
  title: 'Reports | TruthSource',
  description: 'Custom reports and scheduled reports',
}

// Loading skeleton for reports
function ReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-lg space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function ReportsContent() {
  const supabase = await createClient()

  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
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

  // Fetch user's reports
  const { data: reports } = await supabase
    .from('reports')
    .select(`
      *,
      report_runs(count)
    `)
    .or(`created_by.eq.${user.id},organization_id.eq.${profile.organization_id}`)
    .order('created_at', { ascending: false })

  // Fetch available templates
  const { data: templates } = await supabase
    .from('report_templates')
    .select('*')
    .or(`is_public.eq.true,organization_id.eq.${profile.organization_id}`)
    .order('category, name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Create and manage custom reports with automated scheduling
          </p>
        </div>
        <Button asChild>
          <Link href="/reports/builder">
            <Plus className="mr-2 h-4 w-4" />
            Create Report
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="my-reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-reports">My Reports</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>

        <TabsContent value="my-reports" className="space-y-4">
          <ReportsTable reports={reports || []} />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <ReportTemplates templates={templates || []} />
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <ReportsTable
            reports={reports?.filter((r: any) => r.schedule_enabled) || []}
            showSchedule
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsPageSkeleton />}>
      <ReportsContent />
    </Suspense>
  )
}