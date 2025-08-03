// app/actions/reports.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { ReportConfig } from '@/types/reports.types'

export async function saveReport(config: ReportConfig, reportId?: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    if (reportId) {
      // Update existing report
      const { data, error } = await supabase
        .from('reports')
        .update({
          config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .select()
        .single()

      if (error) throw error

      return { success: true, reportId: data.id }
    } else {
      // Create new report
      const { data, error } = await supabase
        .from('reports')
        .insert({
          name: config.name,
          config,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      return { success: true, reportId: data.id }
    }
  } catch (error) {
    console.error('Save report error:', error)
    return { success: false, error: 'Failed to save report' }
  } finally {
    revalidatePath('/reports')
  }
}

export async function runReport(
  reportId: string,
  format: 'csv' | 'excel' | 'pdf' = 'pdf'
) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    // Get report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError) throw reportError

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    // Create report run record
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .insert({
        report_id: reportId,
        status: 'running',
        parameters: { format },
      })
      .select()
      .single()

    if (runError) throw runError

    // Generate report (simplified for now)
    const result = {
      data: 'Report data placeholder',
      mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
      filename: `${report.name}_${new Date().toISOString()}.${format}`,
    }

    // Update report run as completed
    await supabase
      .from('report_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_url: 'placeholder-url',
        record_count: 0,
      })
      .eq('id', reportRun.id)

    // Update last run timestamp
    await supabase
      .from('reports')
      .update({
        last_run_at: new Date().toISOString(),
        run_count: report.run_count + 1,
      })
      .eq('id', reportId)

    return {
      success: true,
      data: result.data,
      mimeType: result.mimeType,
      filename: result.filename,
    }
  } catch (error) {
    console.error('Run report error:', error)
    return { success: false, error: 'Failed to run report' }
  }
}

export async function scheduleReport(
  reportId: string,
  schedule: {
    enabled: boolean
    cron: string
    timezone: string
    recipients: string[]
    formats: string[]
  }
) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    const { data, error } = await supabase
      .from('reports')
      .update({
        schedule_enabled: schedule.enabled,
        schedule_cron: schedule.cron,
        schedule_timezone: schedule.timezone,
        schedule_recipients: schedule.recipients,
        schedule_format: schedule.formats,
      })
      .eq('id', reportId)
      .select()
      .single()

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Schedule report error:', error)
    return { success: false, error: 'Failed to schedule report' }
  } finally {
    revalidatePath('/reports')
  }
}

export async function shareReport(
  reportId: string,
  options: {
    enabled: boolean
    expiresIn?: number // hours
  }
) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    const updates: any = {
      is_shared: options.enabled,
    }

    if (options.enabled) {
      updates.share_token = crypto.randomUUID()
      if (options.expiresIn) {
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + options.expiresIn)
        updates.share_expires_at = expiresAt.toISOString()
      }
    } else {
      updates.share_token = null
      updates.share_expires_at = null
    }

    const { data, error } = await supabase
      .from('reports')
      .update(updates)
      .eq('id', reportId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      shareUrl: data.share_token
        ? `${process.env.NEXT_PUBLIC_APP_URL}/reports/shared/${data.share_token}`
        : null,
    }
  } catch (error) {
    console.error('Share report error:', error)
    return { success: false, error: 'Failed to share report' }
  }
}

export async function deleteReport(reportId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId)
      .eq('created_by', user.id)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Delete report error:', error)
    return { success: false, error: 'Failed to delete report' }
  } finally {
    revalidatePath('/reports')
  }
}

export async function duplicateReport(reportId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    // Get original report
    const { data: originalReport, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (fetchError) throw fetchError

    // Create duplicate
    const { data: newReport, error: createError } = await supabase
      .from('reports')
      .insert({
        name: `${originalReport.name} (Copy)`,
        description: originalReport.description,
        config: originalReport.config,
        created_by: user.id,
      })
      .select()
      .single()

    if (createError) throw createError

    return { success: true, reportId: newReport.id }
  } catch (error) {
    console.error('Duplicate report error:', error)
    return { success: false, error: 'Failed to duplicate report' }
  } finally {
    revalidatePath('/reports')
  }
}
