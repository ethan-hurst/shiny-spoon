// PRP-016: Data Accuracy Monitor - Alerts List API
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

export const runtime = 'edge'

const querySchema = z.object({
  status: z.enum(['all', 'active', 'acknowledged', 'resolved']).default('active'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  integrationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
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

    const { status, severity, integrationId, limit, offset } = query

    // Build query with org isolation (automatic from context)
    let alertQuery = supabase
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
      alertQuery = alertQuery.eq('status', status)
    }

    if (severity) {
      alertQuery = alertQuery.eq('severity', severity)
    }

    if (integrationId) {
      alertQuery = alertQuery.eq('integration_id', integrationId)
    }

    const { data: alerts, count, error } = await alertQuery

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
  },
  {
    schema: { query: querySchema },
    rateLimit: { requests: 100, window: '1m' }
  }
)