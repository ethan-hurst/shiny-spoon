// app/(dashboard)/reports/builder/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ReportBuilder } from '@/components/features/reports/report-builder'
import { redirect } from 'next/navigation'
import { saveReport } from '@/app/actions/reports'

interface ReportBuilderPageProps {
  searchParams: {
    template?: string
  }
}

export default async function ReportBuilderPage({
  searchParams
}: ReportBuilderPageProps) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  let initialConfig = undefined
  let templateId = searchParams.template

  // Load template if specified
  if (templateId) {
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

    const result = await saveReport(config)

    if (result.success) {
      redirect(`/reports`)
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