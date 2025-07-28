// PRP-016: Data Accuracy Monitor - Monitoring Status API
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'
import { z } from 'zod'

export const runtime = 'edge'

const querySchema = z.object({
  integrationId: z.string().uuid().optional(),
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h')
})

export const GET = createRouteHandler(
  async ({ user, query }) => {
    const supabase = createClient()

    // Get user's organization (already validated by wrapper)
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { integrationId, timeRange } = query

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    switch (timeRange) {
      case '1h':
        startDate.setHours(now.getHours() - 1)
        break
      case '24h':
        startDate.setDate(now.getDate() - 1)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
    }

    // Get latest accuracy check
    const checkQuery = supabase
      .from('accuracy_checks')
      .select('*')
      .eq('organization_id', orgUser.organization_id)
      .order('started_at', { ascending: false })
      .limit(1)

    if (integrationId) {
      checkQuery.eq('integration_id', integrationId)
    }

    const { data: checkResult, error: checkError } = await checkQuery
    
    // Handle check query error
    if (checkError) {
      console.error('Failed to fetch accuracy check:', checkError)
      return NextResponse.json({ 
        error: 'Failed to fetch accuracy check data' 
      }, { status: 500 })
    }
    
    // Handle the case where no checks exist yet
    const latestCheck = checkResult && checkResult.length > 0 ? checkResult[0] : null

    // Get active alerts count
    const { count: activeAlerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgUser.organization_id)
      .eq('status', 'active')
      .gte('created_at', startDate.toISOString())
    
    // Handle alerts query error
    if (alertsError) {
      console.error('Failed to fetch alerts count:', alertsError)
      return NextResponse.json({ 
        error: 'Failed to fetch alerts data' 
      }, { status: 500 })
    }

    // Get recent discrepancies
    const { data: recentDiscrepancies, error: discrepanciesError } = await supabase
      .from('discrepancies')
      .select('*')
      .eq('organization_id', orgUser.organization_id)
      .gte('detected_at', startDate.toISOString())
      .order('detected_at', { ascending: false })
      .limit(10)
    
    // Handle discrepancies query error
    if (discrepanciesError) {
      console.error('Failed to fetch discrepancies:', discrepanciesError)
      return NextResponse.json({ 
        error: 'Failed to fetch discrepancies data' 
      }, { status: 500 })
    }

    // Get accuracy metrics
    const scorer = new AccuracyScorer()
    const accuracyBreakdown = await scorer.getAccuracyBreakdown({
      organizationId: orgUser.organization_id,
      integrationId: integrationId || undefined,
      startDate,
      endDate: now,
    })

    // Get trend analysis
    const trendAnalysis = await scorer.getTrendAnalysis({
      organizationId: orgUser.organization_id,
      integrationId: integrationId || undefined,
    })

    // Calculate health status
    let healthStatus: 'healthy' | 'warning' | 'critical'
    if (accuracyBreakdown.overall >= 98) {
      healthStatus = 'healthy'
    } else if (accuracyBreakdown.overall >= 95) {
      healthStatus = 'warning'
    } else {
      healthStatus = 'critical'
    }

    return NextResponse.json({
      status: 'success',
      data: {
        health: {
          status: healthStatus,
          score: accuracyBreakdown.overall,
          lastCheck: latestCheck?.completed_at || null,
        },
        metrics: {
          accuracy: accuracyBreakdown,
          trend: trendAnalysis,
          activeAlerts: activeAlerts || 0,
          recentDiscrepancies: recentDiscrepancies?.length || 0,
        },
        latestCheck: latestCheck ? {
          id: latestCheck.id,
          status: latestCheck.status,
          startedAt: latestCheck.started_at,
          completedAt: latestCheck.completed_at,
          recordsChecked: latestCheck.records_checked,
          discrepanciesFound: latestCheck.discrepancies_found,
          accuracyScore: latestCheck.accuracy_score,
        } : null,
        discrepancies: recentDiscrepancies?.map(d => ({
          id: d.id,
          entityType: d.entity_type,
          entityId: d.entity_id,
          field: d.field,
          severity: d.severity,
          detectedAt: d.detected_at,
        })) || [],
      },
    })
  },
  {
    schema: { query: querySchema },
    rateLimit: { requests: 100, window: '1m' }
  }
)