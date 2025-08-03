// app/(dashboard)/reports/builder/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { ReportBuilder } from '@/components/features/reports/report-builder'
import { redirect } from 'next/navigation'
import { saveReport } from '@/app/actions/reports'

interface ReportBuilderPageProps {
  searchParams: {
    template?: string
    reportId?: string
  }
}

export default async function ReportBuilderPage({
  searchParams
}: ReportBuilderPageProps) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  let initialConfig = undefined
  let templateId = searchParams.template

  // Load existing report
  if (searchParams.reportId) {
    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('id', searchParams.reportId)
      .single()

    if (report) {
      initialConfig = report.config
    }
  }
  // Load template
  else if (templateId) {
    const { data: template } = await supabase
      .from('report_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (template) {
      initialConfig = template.config
    }
  }

  const handleSave = async (config: any) => {
    'use server'

    const result = await saveReport(config, searchParams.reportId)

    if (result.success) {
      redirect(`/reports/${result.reportId}`)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ReportBuilder
        initialConfig={initialConfig}
        templateId={templateId}
        onSave={handleSave}
      />
    </div>
  )
}

export const metadata = {
  title: 'Report Builder | TruthSource',
  description: 'Create custom reports with drag-and-drop builder',
}
