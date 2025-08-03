import { Job } from 'bullmq'
import { TenantJob } from '@/lib/queue/distributed-queue'
import { createServerClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/reports/generator'
import { uploadToStorage } from '@/lib/storage/upload'
import { sendEmail } from '@/lib/email/send'

export async function processReportExport(job: Job<TenantJob>) {
  const { tenantId, data } = job.data
  const { reportId, format, email } = data

  try {
    // Update job progress
    await job.updateProgress(10)

    // Get report configuration
    const supabase = createServerClient()
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('organization_id', tenantId)
      .single()

    if (error || !report) {
      throw new Error('Report not found')
    }

    await job.updateProgress(20)

    // Generate report
    const reportData = await generateReport({
      query: report.query,
      parameters: report.parameters,
      format: format || 'pdf',
      organizationId: tenantId,
    })

    await job.updateProgress(60)

    // Upload to storage
    const fileName = `reports/${tenantId}/${reportId}-${Date.now()}.${format}`
    const fileUrl = await uploadToStorage({
      bucket: 'reports',
      path: fileName,
      file: reportData.buffer,
      contentType: reportData.contentType,
    })

    await job.updateProgress(80)

    // Save export record
    await supabase.from('report_exports').insert({
      report_id: reportId,
      organization_id: tenantId,
      format,
      file_url: fileUrl,
      file_size: reportData.buffer.length,
      exported_at: new Date().toISOString(),
    })

    // Send email if requested
    if (email) {
      await sendEmail({
        to: email,
        subject: `Your report "${report.name}" is ready`,
        template: 'report-ready',
        data: {
          reportName: report.name,
          downloadUrl: fileUrl,
          format,
        },
      })
    }

    await job.updateProgress(100)

    return {
      success: true,
      fileUrl,
      format,
      size: reportData.buffer.length,
    }
  } catch (error) {
    console.error('Report export error:', error)
    throw error
  }
}