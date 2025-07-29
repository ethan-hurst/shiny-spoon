// app/actions/reports.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { AuditLogger } from '@/lib/audit/audit-logger'
import type { ReportConfig, ExportFormat, ReportSchedule, AccessLevel } from '@/types/reports.types'

export async function saveReport(config: ReportConfig, reportId?: string) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { success: false, error: 'No organization found' }
  }

  try {
    if (reportId) {
      // Update existing report
      const { data: oldReport } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .eq('created_by', user.id)
        .single()

      if (!oldReport) {
        return { success: false, error: 'Report not found or access denied' }
      }

      const { data, error } = await supabase
        .from('reports')
        .update({
          name: config.name,
          config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .select()
        .single()

      if (error) throw error

      // Log the update
      await auditLogger.logUpdate('report', reportId, oldReport, data)

      return { success: true, reportId: data.id }
    } else {
      // Create new report
      const { data, error } = await supabase
        .from('reports')
        .insert({
          organization_id: profile.organization_id,
          name: config.name,
          config,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      // Log the creation
      await auditLogger.logCreate('report', data)

      return { success: true, reportId: data.id }
    }
  } catch (error) {
    console.error('Save report error:', error)
    return { success: false, error: 'Failed to save report' }
  } finally {
    revalidatePath('/reports')
  }
}

export async function deleteReport(reportId: string) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    // Get the report first for audit logging
    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('created_by', user.id)
      .single()

    if (!report) {
      return { success: false, error: 'Report not found or access denied' }
    }

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId)
      .eq('created_by', user.id)

    if (error) throw error

    // Log the deletion
    await auditLogger.logDelete('report', report)

    return { success: true }
  } catch (error) {
    console.error('Delete report error:', error)
    return { success: false, error: 'Failed to delete report' }
  } finally {
    revalidatePath('/reports')
  }
}

export async function duplicateReport(reportId: string) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { success: false, error: 'No organization found' }
  }

  try {
    // Get the original report
    const { data: originalReport } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (!originalReport) {
      return { success: false, error: 'Report not found' }
    }

    // Check access - can duplicate if user can view the report
    const canAccess = 
      originalReport.created_by === user.id ||
      originalReport.access_level === 'organization' ||
      (originalReport.access_level === 'team' && originalReport.organization_id === profile.organization_id)

    if (!canAccess) {
      return { success: false, error: 'Access denied' }
    }

    // Create duplicate
    const { data, error } = await supabase
      .from('reports')
      .insert({
        organization_id: profile.organization_id,
        name: `${originalReport.name} (Copy)`,
        description: originalReport.description,
        config: originalReport.config,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Log the creation
    await auditLogger.logCreate('report', data, { duplicated_from: reportId })

    return { success: true, reportId: data.id }
  } catch (error) {
    console.error('Duplicate report error:', error)
    return { success: false, error: 'Failed to duplicate report' }
  } finally {
    revalidatePath('/reports')
  }
}

export async function runReport(
  reportId: string,
  format: ExportFormat = 'pdf',
  parameters?: Record<string, any>
) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

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

    // Check access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    const canAccess = 
      report.created_by === user.id ||
      report.access_level === 'organization' ||
      (report.access_level === 'team' && report.organization_id === profile?.organization_id)

    if (!canAccess) {
      return { success: false, error: 'Access denied' }
    }

    // Create report run record
    const { data: reportRun } = await supabase
      .from('report_runs')
      .insert({
        report_id: reportId,
        status: 'running',
        parameters: parameters || {},
      })
      .select()
      .single()

    // Generate report (simplified for now)
    const reportData = await generateReportData(report.config, parameters || {}, profile?.organization_id)
    
    // For now, return the data directly
    // In production, this would generate actual files and store them
    const filename = `${report.name}_${new Date().toISOString().split('T')[0]}.${format}`

    // Update report run status
    await supabase
      .from('report_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        record_count: reportData.recordCount,
      })
      .eq('id', reportRun!.id)

    // Update report last run
    await supabase
      .from('reports')
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (report.run_count || 0) + 1,
      })
      .eq('id', reportId)

    // Log the action
    await auditLogger.log({
      action: 'export',
      entityType: 'report',
      entityId: reportId,
      entityName: report.name,
      metadata: { format, recordCount: reportData.recordCount },
    })

    return {
      success: true,
      data: reportData.data,
      filename,
      format,
    }
  } catch (error) {
    console.error('Run report error:', error)
    return { success: false, error: 'Failed to run report' }
  }
}

async function generateReportData(
  config: ReportConfig,
  parameters: Record<string, any>,
  organizationId?: string
): Promise<{ data: any; recordCount: number }> {
  const supabase = createClient()

  // This is a simplified implementation
  // In production, this would process the report config and generate actual data
  
  // Find table components and generate their data
  const tableComponents = config.components.filter(c => c.type === 'table')
  const chartComponents = config.components.filter(c => c.type === 'chart')
  
  let allData: any = {}
  let totalRecords = 0

  // Process data sources
  for (const dataSource of config.dataSources) {
    if (dataSource.type === 'query' && dataSource.query) {
      try {
        const { data, error } = await supabase.rpc('execute_report_query', {
          query: dataSource.query,
          parameters: { ...parameters, orgId: organizationId }
        })

        if (!error && data) {
          allData[dataSource.id] = data.map((row: any) => row.result)
          totalRecords += data.length
        }
      } catch (err) {
        console.error(`Error executing query for data source ${dataSource.id}:`, err)
        allData[dataSource.id] = []
      }
    }
  }

  return {
    data: allData,
    recordCount: totalRecords
  }
}

export async function scheduleReport(
  reportId: string,
  schedule: ReportSchedule
) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

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
      .eq('created_by', user.id)
      .select()
      .single()

    if (error) throw error

    // Log the scheduling change
    await auditLogger.log({
      action: 'update',
      entityType: 'report',
      entityId: reportId,
      entityName: data.name,
      metadata: { 
        action: 'schedule_updated',
        schedule_enabled: schedule.enabled,
        cron: schedule.cron
      },
    })

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
    accessLevel?: AccessLevel
  }
) {
  const supabase = createClient()
  const auditLogger = new AuditLogger()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    const updates: any = {
      is_shared: options.enabled,
      access_level: options.accessLevel || 'private',
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
      .eq('created_by', user.id)
      .select()
      .single()

    if (error) throw error

    // Log the sharing change
    await auditLogger.log({
      action: 'update',
      entityType: 'report',
      entityId: reportId,
      entityName: data.name,
      metadata: { 
        action: 'sharing_updated',
        is_shared: options.enabled,
        access_level: options.accessLevel
      },
    })

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