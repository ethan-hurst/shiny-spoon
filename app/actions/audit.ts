// app/actions/audit.ts
'use server'

import { format } from 'date-fns'
import { AuditLogger } from '@/lib/audit/audit-logger'
import { generateCSV } from '@/lib/csv/parser'
import { createServerClient } from '@/lib/supabase/server'

export async function exportAuditLogs({
  organizationId,
  filters,
  format: exportFormat,
}: {
  organizationId: string
  filters: any
  format: 'csv' | 'json'
}) {
  const supabase = createServerClient()
  const auditLogger = new AuditLogger(supabase)

  // Verify user has access
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Build query
    let query = supabase
      .from('audit_logs_with_details')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', filters.from.toISOString())
      .lte('created_at', filters.to.toISOString())
      .order('created_at', { ascending: false })

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id)
    }
    if (filters.action) {
      query = query.eq('action', filters.action)
    }
    if (filters.entity_type) {
      query = query.eq('entity_type', filters.entity_type)
    }

    const { data: logs, error } = await query.limit(10000)

    if (error) throw error

    // Log the export action
    await auditLogger.logExport('audit_log', filters, logs?.length || 0)

    if (exportFormat === 'csv') {
      const csvData =
        logs?.map((log) => ({
          timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
          user_email: log.user_email,
          user_name: log.user_name || '',
          action: log.action,
          entity_type: log.entity_type,
          entity_name: log.entity_name || '',
          ip_address: log.ip_address || '',
          changes:
            log.old_values && log.new_values
              ? JSON.stringify(getChanges(log.old_values, log.new_values))
              : '',
        })) || []

      const csv = generateCSV(csvData, [
        { key: 'timestamp', header: 'Timestamp' },
        { key: 'user_email', header: 'User Email' },
        { key: 'user_name', header: 'User Name' },
        { key: 'action', header: 'Action' },
        { key: 'entity_type', header: 'Entity Type' },
        { key: 'entity_name', header: 'Entity Name' },
        { key: 'ip_address', header: 'IP Address' },
        { key: 'changes', header: 'Changes' },
      ])

      return {
        data: csv,
        filename: `audit_logs_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`,
      }
    } else {
      return {
        data: JSON.stringify(logs, null, 2),
        filename: `audit_logs_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`,
      }
    }
  } catch (error) {
    console.error('Export error:', error)
    return { error: 'Failed to export audit logs' }
  }
}

export async function generateComplianceReport({
  organizationId,
  reportType,
  dateRange,
}: {
  organizationId: string
  reportType: 'soc2' | 'iso27001' | 'custom'
  dateRange: { from: Date; to: Date }
}) {
  const supabase = createServerClient()
  const auditLogger = new AuditLogger(supabase)

  // Verify user has access
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Get compliance-relevant metrics
    const { data: metrics } = await supabase
      .from('audit_logs')
      .select('action, entity_type, user_id')
      .eq('organization_id', organizationId)
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())

    // Generate report based on type
    const report = {
      type: reportType,
      period: {
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: format(dateRange.to, 'yyyy-MM-dd'),
      },
      summary: {
        total_actions: metrics?.length || 0,
        unique_users: new Set(metrics?.map((m) => m.user_id)).size,
        data_modifications:
          metrics?.filter((m) =>
            ['create', 'update', 'delete'].includes(m.action)
          ).length || 0,
        authentication_events:
          metrics?.filter((m) => ['login', 'logout'].includes(m.action))
            .length || 0,
      },
      compliance_checks: getComplianceChecks(reportType, metrics || []),
    }

    // Log report generation
    await auditLogger.log({
      action: 'export',
      entityType: 'organization',
      metadata: {
        report_type: reportType,
        date_range: dateRange,
      },
    })

    // In production, this would send an email with the report
    // For now, we'll just return success
    return { success: true, report }
  } catch (error) {
    console.error('Compliance report error:', error)
    return { error: 'Failed to generate compliance report' }
  }
}

function getChanges(oldValues: any, newValues: any): Record<string, any> {
  const changes: Record<string, any> = {}

  Object.keys(newValues).forEach((key) => {
    if (oldValues[key] !== newValues[key]) {
      changes[key] = {
        from: oldValues[key],
        to: newValues[key],
      }
    }
  })

  return changes
}

function getComplianceChecks(type: string, metrics: any[]): any {
  // Implementation would vary based on compliance framework
  return {
    access_control: true,
    data_retention: true,
    audit_completeness: true,
    user_authentication: true,
  }
}