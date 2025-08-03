// PRP-016: Data Accuracy Monitor - Server Actions
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AccuracyChecker } from '@/lib/monitoring/accuracy-checker'
import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'
import { AlertManager } from '@/lib/monitoring/alert-manager'
import { AutoRemediationService } from '@/lib/monitoring/auto-remediation'
import type {
  AccuracyCheckConfig,
  AlertRule,
  Discrepancy,
} from '@/lib/monitoring/types'
import { createClient } from '@/lib/supabase/server'

// Schema for accuracy check input
const accuracyCheckSchema = z.object({
  entityTypes: z.array(z.enum(['inventory', 'product', 'pricing'])).min(1),
  integrationId: z.string().optional(),
  sampleSize: z.number().min(1).max(1000).default(100),
})

// Schema for alert rule input
const alertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  entityType: z.enum(['inventory', 'product', 'pricing', 'order']),
  condition: z.enum(['threshold', 'trend', 'anomaly']),
  threshold: z.number().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  isActive: z.boolean().default(true),
})

// Trigger accuracy check
export async function triggerAccuracyCheck(
  input: z.infer<typeof accuracyCheckSchema>
) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    const checker = new AccuracyChecker()
    const config: AccuracyCheckConfig = {
      scope: 'full',
      integrationId: input.integrationId,
      sampleSize: input.sampleSize,
      checkDepth: 'deep',
    }

    const checkId = await checker.runCheck(config)

    revalidatePath('/monitoring/accuracy')

    return { success: true, data: { checkId } }
  } catch (error) {
    console.error('Failed to trigger accuracy check:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to trigger accuracy check',
    }
  }
}

// Upsert alert rule
export async function upsertAlertRule(
  ruleId: string | undefined,
  input: z.infer<typeof alertRuleSchema>
) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    const ruleData = {
      organization_id: orgUser.organization_id,
      name: input.name,
      description: input.description,
      entity_type: input.entityType,
      severity_threshold: input.severity,
      is_active: input.isActive,
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
      const { error } = await supabase.from('alert_rules').insert(ruleData)

      if (error) throw error
    }

    revalidatePath('/monitoring/alerts')

    return { success: true }
  } catch (error) {
    console.error('Failed to upsert alert rule:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to upsert alert rule',
    }
  }
}

// Delete alert rule
export async function deleteAlertRule(ruleId: string) {
  try {
    // Validate ruleId is a valid UUID
    const uuidSchema = z.string().uuid()
    const validationResult = uuidSchema.safeParse(ruleId)

    if (!validationResult.success) {
      return { success: false, error: 'Invalid rule ID format' }
    }

    const validatedRuleId = validationResult.data

    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    // Delete only if the rule belongs to the user's organization
    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', validatedRuleId)
      .eq('organization_id', orgUser.organization_id)

    if (error) throw error

    revalidatePath('/monitoring/alerts')

    return { success: true }
  } catch (error) {
    console.error('Failed to delete alert rule:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete alert rule',
    }
  }
}

// Acknowledge alert
export async function acknowledgeAlert(alertId: string) {
  try {
    // Validate alertId is a valid UUID
    const uuidSchema = z.string().uuid()
    const validationResult = uuidSchema.safeParse(alertId)

    if (!validationResult.success) {
      return { success: false, error: 'Invalid alert ID format' }
    }

    const validatedAlertId = validationResult.data

    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    // Fetch alert and verify it belongs to user's organization
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('id, organization_id')
      .eq('id', validatedAlertId)
      .single()

    if (alertError || !alert) {
      return { success: false, error: 'Alert not found' }
    }

    // Verify the alert belongs to the user's organization
    if (alert.organization_id !== orgUser.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    const alertManager = new AlertManager()
    const success = await alertManager.acknowledgeAlert(
      validatedAlertId,
      user.id
    )

    if (!success) {
      return { success: false, error: 'Failed to acknowledge alert' }
    }

    revalidatePath('/monitoring')

    return { success: true }
  } catch (error) {
    console.error('Failed to acknowledge alert:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to acknowledge alert',
    }
  }
}

// Resolve alert
export async function resolveAlert(alertId: string) {
  try {
    // Validate alertId is a valid UUID
    const uuidSchema = z.string().uuid()
    const validationResult = uuidSchema.safeParse(alertId)

    if (!validationResult.success) {
      return { success: false, error: 'Invalid alert ID format' }
    }

    const validatedAlertId = validationResult.data

    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    // Fetch alert and verify it belongs to user's organization
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('id, organization_id')
      .eq('id', validatedAlertId)
      .single()

    if (alertError || !alert) {
      return { success: false, error: 'Alert not found' }
    }

    // Verify the alert belongs to the user's organization
    if (alert.organization_id !== orgUser.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    const alertManager = new AlertManager()
    const success = await alertManager.resolveAlert(validatedAlertId)

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
    // Validate discrepancyId is a valid UUID
    const uuidSchema = z.string().uuid()
    const validationResult = uuidSchema.safeParse(discrepancyId)

    if (!validationResult.success) {
      return { success: false, error: 'Invalid discrepancy ID format' }
    }

    const validatedDiscrepancyId = validationResult.data

    // Validate resolution type
    const resolutionTypeSchema = z.enum([
      'manual_fixed',
      'false_positive',
      'ignored',
    ])
    const resolutionValidation = resolutionTypeSchema.safeParse(resolutionType)

    if (!resolutionValidation.success) {
      return { success: false, error: 'Invalid resolution type' }
    }

    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    // Fetch discrepancy and verify it belongs to user's organization
    const { data: discrepancy, error: discrepancyError } = await supabase
      .from('discrepancies')
      .select('id, organization_id')
      .eq('id', validatedDiscrepancyId)
      .single()

    if (discrepancyError || !discrepancy) {
      return { success: false, error: 'Discrepancy not found' }
    }

    // Verify the discrepancy belongs to the user's organization
    if (discrepancy.organization_id !== orgUser.organization_id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update discrepancy with resolution
    const { error: updateError } = await supabase
      .from('discrepancies')
      .update({
        resolution_type: resolutionType,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', validatedDiscrepancyId)

    if (updateError) {
      return { success: false, error: 'Failed to resolve discrepancy' }
    }

    revalidatePath('/monitoring/discrepancies')

    return { success: true }
  } catch (error) {
    console.error('Failed to resolve discrepancy:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to resolve discrepancy',
    }
  }
}

// Trigger auto-remediation for discrepancies
export async function triggerAutoRemediation(discrepancyIds: string[]) {
  try {
    // Validate all discrepancy IDs are valid UUIDs
    const uuidSchema = z.string().uuid()
    const validationResults = discrepancyIds.map((id) =>
      uuidSchema.safeParse(id)
    )

    const invalidIds = validationResults
      .map((result, index) => (!result.success ? discrepancyIds[index] : null))
      .filter((id): id is string => id !== null)

    if (invalidIds.length > 0) {
      return {
        success: false,
        error: `Invalid discrepancy ID format: ${invalidIds.join(', ')}`,
      }
    }

    const validatedIds = validationResults
      .map((result) => (result.success ? result.data : null))
      .filter((id): id is string => id !== null)

    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    // Fetch discrepancies and verify they belong to user's organization
    const { data: discrepancies, error: fetchError } = await supabase
      .from('discrepancies')
      .select('id, organization_id')
      .in('id', validatedIds)

    if (fetchError) {
      return { success: false, error: 'Failed to fetch discrepancies' }
    }

    // Filter out discrepancies that don't belong to the user's organization
    const foundIds =
      discrepancies
        ?.filter((d: any) => d.organization_id === orgUser.organization_id)
        .map((d: any) => d.id) || []

    if (foundIds.length === 0) {
      return { success: false, error: 'No valid discrepancies found' }
    }

    // Only remediate the verified discrepancies
    const remediationService = new AutoRemediationService()
    const result = await remediationService.batchRemediate(foundIds)

    revalidatePath('/monitoring/discrepancies')

    return {
      success: true,
      data: {
        processed: foundIds.length,
        successful: result.success,
        failed: result.failed,
      },
    }
  } catch (error) {
    console.error('Failed to trigger auto-remediation:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to trigger auto-remediation',
    }
  }
}

// Schema for accuracy report parameters
const accuracyReportSchema = z
  .object({
    startDate: z
      .date()
      .optional()
      .refine((date) => {
        if (!date) return true
        // Ensure date is not in the future
        return date <= new Date()
      }, 'Start date cannot be in the future'),
    endDate: z
      .date()
      .optional()
      .refine((date) => {
        if (!date) return true
        // Ensure date is not in the future
        return date <= new Date()
      }, 'End date cannot be in the future'),
    integrationId: z.string().uuid().optional(),
  })
  .refine((data) => {
    // If both dates are provided, ensure startDate is before endDate
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate
    }
    return true
  }, 'Start date must be before or equal to end date')

// Get accuracy report
export async function getAccuracyReport(
  startDate?: Date,
  endDate?: Date,
  integrationId?: string
) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      return { success: false, error: 'Organization not found' }
    }

    const scorer = new AccuracyScorer()
    const report = await scorer.getAccuracyReport({
      organizationId: orgUser.organization_id,
      integrationId: integrationId || undefined,
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
      endDate: endDate || new Date(),
    })

    return { success: true, data: report }
  } catch (error) {
    console.error('Failed to get accuracy report:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get accuracy report',
    }
  }
}
