import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportsTable, ReportsTableSkeleton } from '@/components/features/reports/reports-table'
import { Plus, FileText, BarChart3, Calendar, Share2 } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { runReport, deleteReport, shareReport, exportReport } from '@/app/actions/reports'
import { toast } from 'sonner'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/reports/report-templates'

export const metadata: Metadata = {
  title: 'Reports',
  description: 'Create and manage custom reports',
}

async function getUserReports() {
  const supabase = createServerClient()
  const user = await getCurrentUser()
  
  if (!user?.organizationId) {
    return []
  }

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('organization_id', user.organizationId)
    .order('updated_at', { ascending: false })

  return reports || []
}

function TemplateCard({ template }: { template: typeof SYSTEM_REPORT_TEMPLATES[0] }) {
  const Icon = template.category === 'inventory' ? FileText : 
                template.category === 'orders' ? BarChart3 :
                template.category === 'performance' ? Calendar : Share2

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <Icon className="h-8 w-8 text-primary" />
          <Link href={`/reports/builder?template=${template.id}`}>
            <Button size="sm">Use Template</Button>
          </Link>
        </div>
        <CardTitle className="mt-4">{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>{template.config.components.length} components</p>
          <p>{template.config.dataSources.length} data sources</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function ReportsPage() {
  const reports = await getUserReports()

  async function handleRunReport(reportId: string) {
    'use server'
    const result = await runReport(reportId, 'pdf')
    if (!result.success) {
      throw new Error(result.error || 'Failed to run report')
    }
    return result
  }

  async function handleDeleteReport(reportId: string) {
    'use server'
    const result = await deleteReport(reportId)
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete report')
    }
    return result
  }

  async function handleShareReport(reportId: string) {
    'use server'
    const result = await shareReport(reportId, true, 168) // 7 days
    if (!result.success) {
      throw new Error(result.error || 'Failed to share report')
    }
    return result
  }

  async function handleExportReport(reportId: string, format: 'csv' | 'excel' | 'pdf') {
    'use server'
    const result = await exportReport(reportId, format)
    if (!result.success) {
      throw new Error(result.error || 'Failed to export report')
    }
    return result
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Create custom reports with drag-and-drop components
          </p>
        </div>
        <Link href="/reports/builder">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Report
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="my-reports" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-reports">My Reports</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="my-reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Reports</CardTitle>
              <CardDescription>
                Reports you've created or have access to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<ReportsTableSkeleton />}>
                <ReportsTable
                  reports={reports}
                  showSchedule={true}
                  onRun={handleRunReport}
                  onSchedule={(id) => window.location.href = `/reports/${id}/schedule`}
                  onShare={handleShareReport}
                  onExport={handleExportReport}
                  onDelete={handleDeleteReport}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_REPORT_TEMPLATES.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}