// PRP-016: Data Accuracy Monitor - Scheduled Accuracy Checks Cron Job
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { AccuracyChecker } from '@/lib/monitoring/accuracy-checker'
import { AlertManager } from '@/lib/monitoring/alert-manager'
import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'
import { NotificationService } from '@/lib/monitoring/notification-service'
import { AccuracyCheckConfig } from '@/lib/monitoring/types'

export const maxDuration = 300 // 5 minutes max

export async function GET(request: Request) {
  try {
    // Verify this is called by Vercel Cron
    const authHeader = headers().get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    console.log('Starting scheduled accuracy checks...')

    const supabase = createAdminClient()
    const accuracyChecker = new AccuracyChecker()
    const alertManager = new AlertManager()
    const notificationService = new NotificationService()

    // Get all active organizations with integrations
    const { data: organizations } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        integrations!inner(
          id,
          platform,
          is_active
        )
      `)
      .eq('integrations.is_active', true)

    if (!organizations || organizations.length === 0) {
      console.log('No organizations with active integrations found')
      return NextResponse.json({ 
        success: true, 
        message: 'No organizations to check',
        checks: 0 
      })
    }

    const checks: Array<{ organizationId: string; checkId: string }> = []

    // Start accuracy checks for each organization
    for (const org of organizations) {
      try {
        // Check if a scheduled check should run based on alert rules
        const shouldRun = await shouldRunScheduledCheck(supabase, org.id)
        
        if (!shouldRun) {
          console.log(`Skipping check for organization ${org.id} - not due yet`)
          continue
        }

        console.log(`Starting accuracy check for organization: ${org.name} (${org.id})`)

        // Configure check based on organization settings
        const config: AccuracyCheckConfig = {
          scope: 'full',
          checkDepth: 'shallow', // Use shallow for scheduled checks to save resources
          sampleSize: 1000, // Limit sample size for scheduled checks
        }

        // Create the accuracy check record
        const { data: checkRecord } = await supabase
          .from('accuracy_checks')
          .insert({
            organization_id: org.id,
            check_type: 'scheduled',
            scope: config.scope,
            status: 'running',
          })
          .select()
          .single()

        if (!checkRecord) {
          console.error(`Failed to create check record for org ${org.id}`)
          continue
        }

        // Start the check asynchronously
        accuracyChecker.runCheck(config).then(async (result) => {
          console.log(`Accuracy check completed for org ${org.id}`)
          
          // Process any triggered alerts
          const { data: completedCheck } = await supabase
            .from('accuracy_checks')
            .select('*')
            .eq('id', checkRecord.id)
            .single()

          if (completedCheck && completedCheck.status === 'completed') {
            // Get discrepancies for alert evaluation
            const { data: discrepancies } = await supabase
              .from('discrepancies')
              .select('*')
              .eq('accuracy_check_id', checkRecord.id)

            // Evaluate alert rules
            await alertManager.evaluateAlertRules(
              checkRecord.id,
              completedCheck.accuracy_score || 100,
              discrepancies || []
            )
          }
        }).catch(error => {
          console.error(`Accuracy check failed for org ${org.id}:`, error)
        })

        checks.push({
          organizationId: org.id,
          checkId: checkRecord.id,
        })

      } catch (error) {
        console.error(`Error processing organization ${org.id}:`, error)
      }
    }

    // Process notification queue
    try {
      await notificationService.processNotificationQueue()
    } catch (error) {
      console.error('Error processing notification queue:', error)
    }

    // Process expired alert snoozes
    try {
      await alertManager.processSnoozeExpirations()
    } catch (error) {
      console.error('Error processing snooze expirations:', error)
    }

    console.log(`Scheduled accuracy checks initiated: ${checks.length} checks started`)

    return NextResponse.json({
      success: true,
      message: `Started ${checks.length} accuracy checks`,
      checks: checks.length,
      organizations: checks.map(c => c.organizationId),
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// Determine if a scheduled check should run for an organization
async function shouldRunScheduledCheck(
  supabase: any,
  organizationId: string
): Promise<boolean> {
  // Get active alert rules for the organization
  const { data: alertRules } = await supabase
    .from('alert_rules')
    .select('check_frequency')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('check_frequency', { ascending: true })
    .limit(1)

  if (!alertRules || alertRules.length === 0) {
    // No active alert rules, use default frequency (1 hour)
    const defaultFrequency = 3600
    return await checkLastRunTime(supabase, organizationId, defaultFrequency)
  }

  // Use the most frequent check interval
  const minFrequency = alertRules[0].check_frequency
  return await checkLastRunTime(supabase, organizationId, minFrequency)
}

// Check if enough time has passed since the last run
async function checkLastRunTime(
  supabase: any,
  organizationId: string,
  frequencySeconds: number
): Promise<boolean> {
  const { data: lastCheck } = await supabase
    .from('accuracy_checks')
    .select('created_at')
    .eq('organization_id', organizationId)
    .eq('check_type', 'scheduled')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastCheck) {
    // No previous scheduled check, should run
    return true
  }

  const lastRunTime = new Date(lastCheck.created_at).getTime()
  const now = Date.now()
  const timeSinceLastRun = (now - lastRunTime) / 1000 // Convert to seconds

  return timeSinceLastRun >= frequencySeconds
}

// Optional: Add a POST endpoint for manual trigger (with auth)
export async function POST(request: Request) {
  try {
    // This endpoint could be used for manual triggers from the UI
    // Add proper authentication here
    
    const body = await request.json()
    const { organizationId } = body

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      )
    }

    // Trigger check for specific organization
    const accuracyChecker = new AccuracyChecker()
    const checkId = await accuracyChecker.runCheck({
      scope: 'full',
      checkDepth: 'deep',
    })

    return NextResponse.json({
      success: true,
      checkId,
    })

  } catch (error) {
    console.error('Manual trigger error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}