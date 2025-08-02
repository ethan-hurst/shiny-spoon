import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { ReportBuilder } from '@/components/features/reports/report-builder'
import { createReport, updateReport } from '@/app/actions/reports'
import { SYSTEM_REPORT_TEMPLATES } from '@/lib/reports/report-templates'
import type { ReportConfig } from '@/types/reports.types'

export const metadata: Metadata = {
  title: 'Report Builder',
  description: 'Create custom reports',
}

interface ReportBuilderPageProps {
  searchParams: {
    template?: string
    reportId?: string
  }
}

export default async function ReportBuilderPage({ searchParams }: ReportBuilderPageProps) {
  const supabase = createServerClient()
  const user = await getCurrentUser()
  
  if (!user?.organizationId) {
    redirect('/login')
  }

  let initialConfig: ReportConfig | undefined
  let reportId: string | undefined

  // Load from existing report
  if (searchParams.reportId) {
    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('id', searchParams.reportId)
      .eq('organization_id', user.organizationId)
      .single()

    if (report) {
      initialConfig = report.config
      reportId = report.id
    }
  }
  // Load from template
  else if (searchParams.template) {
    const template = SYSTEM_REPORT_TEMPLATES.find(t => t.id === searchParams.template)
    if (template) {
      initialConfig = template.config
    }
  }

  // Default config if nothing loaded
  if (!initialConfig) {
    initialConfig = {
      name: 'Untitled Report',
      layout: 'grid',
      components: [],
      dataSources: [],
      filters: [],
      style: {
        theme: 'light',
        spacing: 'normal'
      }
    }
  }

  async function handleSave(config: ReportConfig) {
    'use server'
    
    if (reportId) {
      // Update existing report
      const result = await updateReport(reportId, {
        name: config.name,
        config
      })
      
      if (result.success && result.data) {
        redirect(`/reports/${result.data.id}`)
      } else {
        throw new Error(result.error || 'Failed to update report')
      }
    } else {
      // Create new report
      const result = await createReport({
        name: config.name,
        config,
        organization_id: user!.organizationId,
        access_level: 'private'
      })
      
      if (result.success && result.data) {
        redirect(`/reports/${result.data.id}`)
      } else {
        throw new Error(result.error || 'Failed to create report')
      }
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ReportBuilder
        initialConfig={initialConfig}
        templateId={searchParams.template}
        onSave={handleSave}
      />
    </div>
  )
}