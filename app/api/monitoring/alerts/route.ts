// PRP-016: Data Accuracy Monitor - Alerts List API
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
    const status = searchParams.get('status') || 'active'
    const severity = searchParams.get('severity')
    const integrationId = searchParams.get('integrationId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('alerts')
      .select(`
        *,
        alert_rules (
          id,
          name,
          entity_type,
          threshold_value,
          threshold_type
        ),
        integrations (
          id,
          platform,
          name
        )
      `, { count: 'exact' })
      .eq('organization_id', orgUser.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (integrationId) {
      query = query.eq('integration_id', integrationId)
    }

    const { data: alerts, count, error } = await query

    if (error) {
      throw error
    }

    // Get summary statistics
    const { data: stats } = await supabase
      .from('alerts')
      .select('status, severity')
      .eq('organization_id', orgUser.organization_id)

    const summary = {
      total: stats?.length || 0,
      byStatus: {
        active: 0,
        acknowledged: 0,
        resolved: 0,
      },
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    }

    stats?.forEach(alert => {
      summary.byStatus[alert.status as keyof typeof summary.byStatus]++
      summary.bySeverity[alert.severity as keyof typeof summary.bySeverity]++
    })

    return NextResponse.json({
      status: 'success',
      data: {
        alerts: alerts || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
        summary,
      },
    })
  } catch (error) {
    console.error('Alerts list API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}