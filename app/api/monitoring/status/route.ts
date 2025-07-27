// PRP-016: Data Accuracy Monitor - Monitoring Status API
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integrationId')
    const timeRange = searchParams.get('timeRange') || '24h'

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
      default:
        startDate.setDate(now.getDate() - 1)
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
    
    // Handle the case where no checks exist yet
    const latestCheck = checkResult && checkResult.length > 0 ? checkResult[0] : null

    // Get active alerts count
    const { count: activeAlerts } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgUser.organization_id)
      .eq('status', 'active')
      .gte('created_at', startDate.toISOString())

    // Get recent discrepancies
    const { data: recentDiscrepancies } = await supabase
      .from('discrepancies')
      .select('*')
      .eq('organization_id', orgUser.organization_id)
      .gte('detected_at', startDate.toISOString())
      .order('detected_at', { ascending: false })
      .limit(10)

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
  } catch (error) {
    console.error('Monitoring status API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring status' },
      { status: 500 }
    )
  }
}