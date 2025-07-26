// PRP-016: Data Accuracy Monitor - Server Actions
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AccuracyChecker } from '@/lib/monitoring/accuracy-checker'
import { AlertManager } from '@/lib/monitoring/alert-manager'
import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'
import { AutoRemediationService } from '@/lib/monitoring/auto-remediation'

// Schemas for validation
const accuracyCheckSchema = z.object({
  scope: z.enum(['full', 'inventory', 'pricing', 'products']),
  checkDepth: z.enum(['shallow', 'deep']),
  integrationId: z.string().uuid().optional(),
  sampleSize: z.number().min(1).max(10000).optional(),
})

const alertRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  entityType: z.array(z.string()).optional(),
  severityThreshold: z.enum(['low', 'medium', 'high', 'critical']),
  accuracyThreshold: z.number().min(0).max(100),
  discrepancyCountThreshold: z.number().min(1),
  checkFrequency: z.number().min(300), // minimum 5 minutes
  evaluationWindow: z.number().min(300),
  notificationChannels: z.array(z.enum(['email', 'sms', 'in_app', 'webhook'])),
  autoRemediate: z.boolean(),
})

// Trigger accuracy check
export async function triggerAccuracyCheck(input: z.infer<typeof accuracyCheckSchema>) {
  try {
    const validated = accuracyCheckSchema.parse(input)
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Initialize accuracy checker
    const accuracyChecker = new AccuracyChecker()
    
    // Start the check
    const checkId = await accuracyChecker.runCheck({
      scope: validated.scope,
      checkDepth: validated.checkDepth,
      integrationId: validated.integrationId,
      sampleSize: validated.sampleSize,
    })

    revalidatePath('/monitoring')

    return { success: true, checkId }
  } catch (error) {
    console.error('Failed to trigger accuracy check:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start accuracy check',
    }
  }
}

// Create or update alert rule
export async function upsertAlertRule(
  ruleId: string | undefined,
  input: z.infer<typeof alertRuleSchema>
) {
  try {
    const validated = alertRuleSchema.parse(input)
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get user's organization
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return { success: false, error: 'No organization found' }
    }

    const ruleData = {
      ...validated,
      organization_id: orgUser.organization_id,
      updated_at: new Date().toISOString(),
      created_by: ruleId ? undefined : user.id,
      entity_type: validated.entityType,
      severity_threshold: validated.severityThreshold,
      accuracy_threshold: validated.accuracyThreshold,
      discrepancy_count_threshold: validated.discrepancyCountThreshold,
      check_frequency: validated.checkFrequency,
      evaluation_window: validated.evaluationWindow,
      notification_channels: validated.notificationChannels,
      auto_remediate: validated.autoRemediate,
    }

    if (ruleId) {
      // Update existing rule
      const { error } = await supabase
        .from('alert_rules')
        .update(ruleData)
        .eq('id', ruleId)
        .eq('organization_id', orgUser.organization_id)

      if (error) throw error
    } else {
      // Create new rule
      const { error } = await supabase
        .from('alert_rules')
        .insert(ruleData)

      if (error) throw error
    }

    revalidatePath('/monitoring/alerts')

    return { success: true }
  } catch (error) {
    console.error('Failed to save alert rule:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save alert rule',
    }
  }
}

// Delete alert rule
export async function deleteAlertRule(ruleId: string) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', ruleId)

    if (error) throw error

    revalidatePath('/monitoring/alerts')

    return { success: true }
  } catch (error) {
    console.error('Failed to delete alert rule:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete alert rule',
    }
  }
}

// Acknowledge alert
export async function acknowledgeAlert(alertId: string) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const alertManager = new AlertManager()
    const success = await alertManager.acknowledgeAlert(alertId, user.id)

    if (!success) {
      return { success: false, error: 'Failed to acknowledge alert' }
    }

    revalidatePath('/monitoring')

    return { success: true }
  } catch (error) {
    console.error('Failed to acknowledge alert:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge alert',
    }
  }
}

// Resolve alert
export async function resolveAlert(alertId: string) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const alertManager = new AlertManager()
    const success = await alertManager.resolveAlert(alertId)

    if (!success) {
      return { success: false, error: 'Failed to resolve alert' }
    }

    revalidatePath('/monitoring')

    return { success: true }
  } catch (error) {
    console.error('Failed to resolve alert:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve alert',
    }
  }
}

// Resolve discrepancy
export async function resolveDiscrepancy(
  discrepancyId: string,
  resolutionType: 'manual_fixed' | 'false_positive' | 'ignored'
) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('discrepancies')
      .update({
        status: 'resolved',
        resolution_type: resolutionType,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', discrepancyId)

    if (error) throw error

    revalidatePath('/monitoring')

    return { success: true }
  } catch (error) {
    console.error('Failed to resolve discrepancy:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve discrepancy',
    }
  }
}

// Trigger auto-remediation
export async function triggerAutoRemediation(discrepancyIds: string[]) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const remediationService = new AutoRemediationService()
    const result = await remediationService.batchRemediate(discrepancyIds)

    revalidatePath('/monitoring')

    return {
      success: true,
      total: result.total,
      successful: result.success,
      failed: result.failed,
    }
  } catch (error) {
    console.error('Failed to trigger auto-remediation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger remediation',
    }
  }
}

// Get accuracy report
export async function getAccuracyReport(
  startDate?: Date,
  endDate?: Date,
  integrationId?: string
) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get user's organization
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return { success: false, error: 'No organization found' }
    }

    const scorer = new AccuracyScorer()
    const report = await scorer.getAccuracyReport({
      organizationId: orgUser.organization_id,
      integrationId,
      startDate,
      endDate,
    })

    return { success: true, report }
  } catch (error) {
    console.error('Failed to get accuracy report:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get report',
    }
  }
}