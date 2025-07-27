// PRP-016: Data Accuracy Monitor - Server Actions
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AccuracyChecker } from '@/lib/monitoring/accuracy-checker'
import { AlertManager } from '@/lib/monitoring/alert-manager'
import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'
import { AutoRemediationService } from '@/lib/monitoring/auto-remediation'
import { createClient } from '@/lib/supabase/server'

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
    // Validate ruleId is a valid UUID
    const uuidSchema = z.string().uuid()
    const validationResult = uuidSchema.safeParse(ruleId)
    
    if (!validationResult.success) {
      return { success: false, error: 'Invalid rule ID format' }
    }
    
    const validatedRuleId = validationResult.data
    
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
      error: error instanceof Error ? error.message : 'Failed to delete alert rule',
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
    const success = await alertManager.acknowledgeAlert(validatedAlertId, user.id)

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
    // Validate alertId is a valid UUID
    const uuidSchema = z.string().uuid()
    const validationResult = uuidSchema.safeParse(alertId)
    
    if (!validationResult.success) {
      return { success: false, error: 'Invalid alert ID format' }
    }
    
    const validatedAlertId = validationResult.data
    
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
    const resolutionTypeSchema = z.enum(['manual_fixed', 'false_positive', 'ignored'])
    const resolutionValidation = resolutionTypeSchema.safeParse(resolutionType)
    
    if (!resolutionValidation.success) {
      return { success: false, error: 'Invalid resolution type' }
    }
    
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

    // Update the discrepancy
    const { error } = await supabase
      .from('discrepancies')
      .update({
        status: 'resolved',
        resolution_type: resolutionType,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', validatedDiscrepancyId)
      .eq('organization_id', orgUser.organization_id) // Extra safety check

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
    // Validate input is a non-empty array
    if (!Array.isArray(discrepancyIds) || discrepancyIds.length === 0) {
      return { success: false, error: 'No discrepancy IDs provided' }
    }

    // Validate all IDs are valid UUIDs
    const uuidSchema = z.string().uuid()
    const validatedIds: string[] = []
    
    for (const id of discrepancyIds) {
      const validationResult = uuidSchema.safeParse(id)
      if (!validationResult.success) {
        return { success: false, error: `Invalid discrepancy ID format: ${id}` }
      }
      validatedIds.push(validationResult.data)
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 100
    if (validatedIds.length > MAX_BATCH_SIZE) {
      return { success: false, error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items` }
    }

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
      return { success: false, error: 'Organization not found' }
    }

    // Verify all discrepancies belong to the user's organization
    const { data: discrepancies, error: queryError } = await supabase
      .from('discrepancies')
      .select('id, organization_id')
      .in('id', validatedIds)

    if (queryError) {
      throw new Error('Failed to verify discrepancies')
    }

    if (!discrepancies || discrepancies.length === 0) {
      return { success: false, error: 'No valid discrepancies found' }
    }

    // Check if all discrepancies belong to the user's organization
    const unauthorizedIds = discrepancies
      .filter(d => d.organization_id !== orgUser.organization_id)
      .map(d => d.id)

    if (unauthorizedIds.length > 0) {
      return { 
        success: false, 
        error: 'Unauthorized: Some discrepancies belong to other organizations' 
      }
    }

    // Check if all requested IDs were found
    const foundIds = discrepancies.map(d => d.id)
    const notFoundIds = validatedIds.filter(id => !foundIds.includes(id))
    
    if (notFoundIds.length > 0) {
      return {
        success: false,
        error: `Discrepancies not found: ${notFoundIds.join(', ')}`
      }
    }

    // Only remediate the verified discrepancies
    const remediationService = new AutoRemediationService()
    const result = await remediationService.batchRemediate(foundIds)

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