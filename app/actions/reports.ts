'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { ReportGenerator } from '@/lib/reports/report-generator'
import { getReportScheduler } from '@/lib/reports/report-scheduler'
import { reportConfigSchema, reportScheduleSchema, reportShareSchema } from '@/types/reports.types'
import type { ReportConfig, Report, ExportFormat } from '@/types/reports.types'
import { z } from 'zod'
import { nanoid } from 'nanoid'

const createReportSchema = z.object({
  name: z.string().min(1).max(255),
  config: reportConfigSchema,
  organization_id: z.string().uuid(),
  template_id: z.string().uuid().optional(),
  access_level: z.enum(['private', 'team', 'organization'])
})

const updateReportSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: reportConfigSchema.optional(),
  access_level: z.enum(['private', 'team', 'organization']).optional()
})

export async function createReport(data: z.infer<typeof createReportSchema>) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()

    if (!user?.id || user.organizationId !== data.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = createReportSchema.parse(data)

    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        ...validated,
        created_by: user.id,
        is_shared: false,
        schedule_enabled: false,
        run_count: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create report:', error)
      return { success: false, error: 'Failed to create report' }
    }

    revalidatePath('/reports')
    return { success: true, data: report }
  } catch (error) {
    console.error('Error creating report:', error)
    return { 
      success: false, 
      error: error instanceof z.ZodError ? 'Invalid report data' : 'Failed to create report' 
    }
  }
}

export async function updateReport(reportId: string, data: z.infer<typeof updateReportSchema>) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()

    if (!user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = updateReportSchema.parse(data)

    // Check ownership
    const { data: existingReport } = await supabase
      .from('reports')
      .select('created_by, organization_id')
      .eq('id', reportId)
      .single()

    if (!existingReport || 
        (existingReport.created_by !== user.id && existingReport.organization_id !== user.organizationId)) {
      return { success: false, error: 'Report not found or unauthorized' }
    }

    const { data: report, error } = await supabase
      .from('reports')
      .update({
        ...validated,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update report:', error)
      return { success: false, error: 'Failed to update report' }
    }

    revalidatePath('/reports')
    revalidatePath(`/reports/${reportId}`)
    return { success: true, data: report }
  } catch (error) {
    console.error('Error updating report:', error)
    return { 
      success: false, 
      error: error instanceof z.ZodError ? 'Invalid report data' : 'Failed to update report' 
    }
  }
}

export async function deleteReport(reportId: string) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()

    if (!user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check ownership
    const { data: report } = await supabase
      .from('reports')
      .select('created_by')
      .eq('id', reportId)
      .single()

    if (!report || report.created_by !== user.id) {
      return { success: false, error: 'Report not found or unauthorized' }
    }

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId)

    if (error) {
      console.error('Failed to delete report:', error)
      return { success: false, error: 'Failed to delete report' }
    }

    revalidatePath('/reports')
    return { success: true }
  } catch (error) {
    console.error('Error deleting report:', error)
    return { success: false, error: 'Failed to delete report' }
  }
}

export async function runReport(reportId: string, format: ExportFormat = 'pdf') {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()

    if (!user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get report
    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (!report || 
        (report.access_level === 'private' && report.created_by !== user.id) ||
        (report.organization_id !== user.organizationId)) {
      return { success: false, error: 'Report not found or unauthorized' }
    }

    // Create run record
    const { data: run, error: runError } = await supabase
      .from('report_runs')
      .insert({
        report_id: reportId,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (runError || !run) {
      return { success: false, error: 'Failed to start report run' }
    }

    try {
      // Generate report
      const generator = new ReportGenerator()
      const result = await generator.generate(report.config, format, {
        organizationId: report.organization_id,
        reportId,
        runId: run.id
      })

      // Upload to storage
      const filename = `${reportId}/${run.id}/${report.name}-${new Date().toISOString()}.${format}`
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(filename, result.data, {
          contentType: result.mimeType
        })

      if (uploadError) {
        throw new Error(`Failed to upload: ${uploadError.message}`)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('reports')
        .getPublicUrl(filename)

      // Update run as completed
      await supabase
        .from('report_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_url: publicUrl,
          result_size_bytes: Buffer.byteLength(result.data)
        })
        .eq('id', run.id)

      // Update report stats
      await supabase
        .from('reports')
        .update({
          last_run_at: new Date().toISOString(),
          run_count: report.run_count + 1
        })
        .eq('id', reportId)

      revalidatePath(`/reports/${reportId}`)
      return { 
        success: true, 
        data: result.data,
        url: publicUrl,
        filename: `${report.name}.${format}`
      }
    } catch (error) {
      // Mark run as failed
      await supabase
        .from('report_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', run.id)

      throw error
    }
  } catch (error) {
    console.error('Error running report:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to run report' 
    }
  }
}

export async function scheduleReport(reportId: string, schedule: z.infer<typeof reportScheduleSchema>) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()

    if (!user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = reportScheduleSchema.parse(schedule)

    // Check ownership
    const { data: report } = await supabase
      .from('reports')
      .select('created_by')
      .eq('id', reportId)
      .single()

    if (!report || report.created_by !== user.id) {
      return { success: false, error: 'Report not found or unauthorized' }
    }

    const { error } = await supabase
      .from('reports')
      .update({
        schedule_enabled: validated.enabled,
        schedule_cron: validated.cron,
        schedule_timezone: validated.timezone,
        schedule_recipients: validated.recipients,
        schedule_format: validated.format
      })
      .eq('id', reportId)

    if (error) {
      console.error('Failed to update schedule:', error)
      return { success: false, error: 'Failed to update schedule' }
    }

    // Update scheduler
    const scheduler = getReportScheduler()
    await scheduler.updateSchedule(reportId)

    revalidatePath(`/reports/${reportId}`)
    return { success: true }
  } catch (error) {
    console.error('Error scheduling report:', error)
    return { 
      success: false, 
      error: error instanceof z.ZodError ? 'Invalid schedule data' : 'Failed to schedule report' 
    }
  }
}

export async function shareReport(reportId: string, enabled: boolean, expiresInHours: number = 168) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()

    if (!user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check ownership
    const { data: report } = await supabase
      .from('reports')
      .select('created_by')
      .eq('id', reportId)
      .single()

    if (!report || report.created_by !== user.id) {
      return { success: false, error: 'Report not found or unauthorized' }
    }

    const updates: any = {
      is_shared: enabled
    }

    if (enabled) {
      updates.share_token = nanoid(32)
      updates.share_expires_at = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
    } else {
      updates.share_token = null
      updates.share_expires_at = null
    }

    const { data: updated, error } = await supabase
      .from('reports')
      .update(updates)
      .eq('id', reportId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update sharing:', error)
      return { success: false, error: 'Failed to update sharing' }
    }

    revalidatePath(`/reports/${reportId}`)
    return { 
      success: true, 
      shareUrl: enabled ? `${process.env.NEXT_PUBLIC_APP_URL}/reports/shared/${updated.share_token}` : null 
    }
  } catch (error) {
    console.error('Error sharing report:', error)
    return { success: false, error: 'Failed to share report' }
  }
}

export async function exportReport(reportId: string, format: ExportFormat) {
  // This is essentially the same as runReport but without creating a run record
  return runReport(reportId, format)
}

export async function duplicateReport(reportId: string) {
  try {
    const supabase = createServerClient()
    const user = await getCurrentUser()

    if (!user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get original report
    const { data: original } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (!original || 
        (original.access_level === 'private' && original.created_by !== user.id) ||
        (original.organization_id !== user.organizationId)) {
      return { success: false, error: 'Report not found or unauthorized' }
    }

    // Create duplicate
    const { data: duplicate, error } = await supabase
      .from('reports')
      .insert({
        name: `${original.name} (Copy)`,
        config: original.config,
        organization_id: original.organization_id,
        created_by: user.id,
        access_level: 'private',
        is_shared: false,
        schedule_enabled: false,
        run_count: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to duplicate report:', error)
      return { success: false, error: 'Failed to duplicate report' }
    }

    revalidatePath('/reports')
    return { success: true, data: duplicate }
  } catch (error) {
    console.error('Error duplicating report:', error)
    return { success: false, error: 'Failed to duplicate report' }
  }
}