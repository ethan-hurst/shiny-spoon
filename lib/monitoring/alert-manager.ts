// PRP-016: Data Accuracy Monitor - Alert Manager
import { createAdminClient } from '@/lib/supabase/admin'
import { AlertConfig, AlertRule, Alert, DiscrepancyResult } from './types'

export class AlertManager {
  private supabase = createAdminClient()

  async createAlert(config: AlertConfig): Promise<string | null> {
    try {
      const { data: rule } = await this.supabase
        .from('alert_rules')
        .select('*')
        .eq('id', config.ruleId)
        .single()

      if (!rule) {
        console.error('Alert rule not found:', config.ruleId)
        return null
      }

      // Create alert record
      const { data: alert, error } = await this.supabase
        .from('alerts')
        .insert({
          alert_rule_id: config.ruleId,
          organization_id: rule.organization_id,
          title: `Data Accuracy Alert: ${rule.name}`,
          message: this.buildAlertMessage(config, rule),
          severity: this.calculateSeverity(config, rule),
          triggered_by: 'threshold',
          trigger_value: {
            accuracy_score: config.accuracyScore,
            discrepancy_count: config.discrepancyCount,
            reason: config.triggerReason,
            metadata: config.metadata || {}
          },
          accuracy_check_id: config.checkId,
          status: 'active',
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create alert:', error)
        return null
      }

      if (!alert) return null

      // Schedule notifications (will be handled by notification service)
      await this.scheduleNotifications(alert.id, rule)

      // Check for auto-remediation
      if (rule.auto_remediate) {
        await this.scheduleAutoRemediation(alert.id, config.checkId)
      }

      return alert.id
    } catch (error) {
      console.error('Error creating alert:', error)
      return null
    }
  }

  private buildAlertMessage(config: AlertConfig, rule: AlertRule): string {
    const lines = [
      `Accuracy check detected issues that match your alert rule "${rule.name}".`,
      '',
      `**Details:**`,
      `- Accuracy Score: ${config.accuracyScore.toFixed(2)}%`,
      `- Discrepancies Found: ${config.discrepancyCount}`,
      `- Trigger: ${config.triggerReason}`,
    ]

    if (config.metadata) {
      lines.push('')
      lines.push('**Additional Information:**')
      
      for (const [key, value] of Object.entries(config.metadata)) {
        lines.push(`- ${this.formatMetadataKey(key)}: ${value}`)
      }
    }

    lines.push('')
    lines.push('Please review the monitoring dashboard for complete details.')

    return lines.join('\n')
  }

  private formatMetadataKey(key: string): string {
    // Convert snake_case to Title Case
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private calculateSeverity(config: AlertConfig, rule: AlertRule): string {
    // Severity based on multiple factors
    const factors = []

    // Accuracy score factor
    if (config.accuracyScore < 80) {
      factors.push('critical')
    } else if (config.accuracyScore < 90) {
      factors.push('high')
    } else if (config.accuracyScore < 95) {
      factors.push('medium')
    }

    // Discrepancy count factor
    if (config.discrepancyCount > 100) {
      factors.push('critical')
    } else if (config.discrepancyCount > 50) {
      factors.push('high')
    } else if (config.discrepancyCount > 20) {
      factors.push('medium')
    }

    // Rule severity threshold
    factors.push(rule.severity_threshold)

    // Return highest severity found
    if (factors.includes('critical')) return 'critical'
    if (factors.includes('high')) return 'high'
    if (factors.includes('medium')) return 'medium'
    return 'low'
  }

  private async scheduleNotifications(alertId: string, rule: AlertRule) {
    const channels = rule.notification_channels || ['in_app']

    // Create notification records for each channel
    const notificationRecords = channels.map(channel => ({
      alert_id: alertId,
      channel,
      recipient: this.getRecipientForChannel(channel, rule),
      status: 'pending' as const,
    }))

    if (notificationRecords.length > 0) {
      await this.supabase
        .from('notification_log')
        .insert(notificationRecords)
    }
  }

  private getRecipientForChannel(
    channel: string,
    rule: AlertRule
  ): string {
    // This would be enhanced to get actual recipients from organization settings
    switch (channel) {
      case 'email':
        return 'alerts@organization.com' // Would fetch from org settings
      case 'sms':
        return '+1234567890' // Would fetch from org settings
      case 'webhook':
        return 'https://example.com/webhook' // Would fetch from integration settings
      default:
        return 'organization'
    }
  }

  private async scheduleAutoRemediation(alertId: string, checkId: string) {
    // Create a task for the auto-remediation service
    // This will be picked up by the auto-remediation processor
    await this.supabase
      .from('remediation_queue')
      .insert({
        alert_id: alertId,
        accuracy_check_id: checkId,
        status: 'pending',
        priority: 'high',
      })
  }

  async evaluateAlertRules(
    checkId: string,
    accuracyScore: number,
    discrepancies: DiscrepancyResult[]
  ): Promise<string[]> {
    const createdAlertIds: string[] = []

    try {
      // Get organization ID from the check
      const { data: check } = await this.supabase
        .from('accuracy_checks')
        .select('organization_id')
        .eq('id', checkId)
        .single()

      if (!check) return createdAlertIds

      // Get active alert rules for the organization
      const { data: rules } = await this.supabase
        .from('alert_rules')
        .select('*')
        .eq('organization_id', check.organization_id)
        .eq('is_active', true)

      if (!rules || rules.length === 0) return createdAlertIds

      for (const rule of rules) {
        const shouldAlert = await this.shouldTriggerAlert(
          rule,
          accuracyScore,
          discrepancies
        )

        if (shouldAlert.trigger) {
          const alertId = await this.createAlert({
            ruleId: rule.id,
            checkId,
            triggerReason: shouldAlert.reason,
            accuracyScore,
            discrepancyCount: discrepancies.length,
            metadata: shouldAlert.metadata,
          })

          if (alertId) {
            createdAlertIds.push(alertId)
          }
        }
      }
    } catch (error) {
      console.error('Error evaluating alert rules:', error)
    }

    return createdAlertIds
  }

  private async shouldTriggerAlert(
    rule: AlertRule,
    accuracyScore: number,
    discrepancies: DiscrepancyResult[]
  ): Promise<{ trigger: boolean; reason: string; metadata?: Record<string, any> }> {
    // Check if we're within the evaluation window
    const { data: recentAlerts } = await this.supabase
      .from('alerts')
      .select('created_at')
      .eq('alert_rule_id', rule.id)
      .gte('created_at', new Date(Date.now() - rule.evaluationWindow * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    // Prevent alert fatigue - don't trigger if we already alerted recently
    if (recentAlerts && recentAlerts.length > 0) {
      const lastAlertTime = new Date(recentAlerts[0].created_at).getTime()
      const timeSinceLastAlert = Date.now() - lastAlertTime
      
      if (timeSinceLastAlert < rule.checkFrequency * 1000) {
        return { trigger: false, reason: 'Alert suppressed due to frequency limit' }
      }
    }

    // Check accuracy threshold
    if (accuracyScore < rule.accuracyThreshold) {
      return {
        trigger: true,
        reason: `Accuracy ${accuracyScore.toFixed(2)}% is below threshold ${rule.accuracyThreshold}%`,
        metadata: {
          threshold_type: 'accuracy',
          threshold_value: rule.accuracyThreshold,
          actual_value: accuracyScore,
        }
      }
    }

    // Check discrepancy count
    if (discrepancies.length > rule.discrepancyCountThreshold) {
      return {
        trigger: true,
        reason: `${discrepancies.length} discrepancies exceed threshold of ${rule.discrepancyCountThreshold}`,
        metadata: {
          threshold_type: 'count',
          threshold_value: rule.discrepancyCountThreshold,
          actual_value: discrepancies.length,
        }
      }
    }

    // Check entity type filters
    if (rule.entityType && rule.entityType.length > 0) {
      const filteredDiscrepancies = discrepancies.filter(
        d => rule.entityType!.includes(d.entityType)
      )
      
      if (filteredDiscrepancies.length > rule.discrepancyCountThreshold) {
        return {
          trigger: true,
          reason: `${filteredDiscrepancies.length} discrepancies in monitored entity types exceed threshold`,
          metadata: {
            threshold_type: 'entity_count',
            monitored_entities: rule.entityType,
            threshold_value: rule.discrepancyCountThreshold,
            actual_value: filteredDiscrepancies.length,
          }
        }
      }
    }

    // Check severity threshold
    const severityLevels = ['low', 'medium', 'high', 'critical']
    const thresholdIndex = severityLevels.indexOf(rule.severityThreshold)
    
    const severityCount = discrepancies.filter(
      d => severityLevels.indexOf(d.severity) >= thresholdIndex
    ).length

    if (severityCount > 0) {
      const criticalCount = discrepancies.filter(d => d.severity === 'critical').length
      const highCount = discrepancies.filter(d => d.severity === 'high').length
      
      return {
        trigger: true,
        reason: `${severityCount} discrepancies at or above ${rule.severityThreshold} severity detected`,
        metadata: {
          threshold_type: 'severity',
          severity_threshold: rule.severityThreshold,
          critical_count: criticalCount,
          high_count: highCount,
          total_severity_count: severityCount,
        }
      }
    }

    return { trigger: false, reason: 'No alert conditions met' }
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId)

    return !error
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId)

    return !error
  }

  async snoozeAlert(alertId: string, until: Date): Promise<boolean> {
    const { error } = await this.supabase
      .from('alerts')
      .update({
        status: 'snoozed',
        metadata: { snoozed_until: until.toISOString() },
      })
      .eq('id', alertId)

    return !error
  }

  async getActiveAlerts(organizationId: string): Promise<Alert[]> {
    const { data } = await this.supabase
      .from('alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'acknowledged'])
      .order('created_at', { ascending: false })

    return data || []
  }

  async getAlertHistory(
    organizationId: string,
    limit = 50,
    offset = 0
  ): Promise<{ alerts: Alert[]; total: number }> {
    // Get total count
    const { count } = await this.supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // Get paginated results
    const { data } = await this.supabase
      .from('alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return {
      alerts: data || [],
      total: count || 0,
    }
  }

  async processSnoozeExpirations(): Promise<void> {
    // Find all snoozed alerts where snooze has expired
    const { data: expiredAlerts } = await this.supabase
      .from('alerts')
      .select('*')
      .eq('status', 'snoozed')
      .lte('metadata->snoozed_until', new Date().toISOString())

    if (!expiredAlerts || expiredAlerts.length === 0) return

    // Reactivate expired alerts
    const alertIds = expiredAlerts.map(alert => alert.id)
    
    await this.supabase
      .from('alerts')
      .update({
        status: 'active',
        metadata: {},
      })
      .in('id', alertIds)
  }
}