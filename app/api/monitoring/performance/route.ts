import { NextRequest, NextResponse } from 'next/server'
import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      )
    }

    // Get performance analytics
    const monitor = PerformanceMonitor.getInstance()
    const analytics = await monitor.getPerformanceAnalytics()

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Performance monitoring error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      metric_type,
      metric_name,
      duration_ms,
      success,
      error_message,
      metadata,
    } = body

    // Validate required fields
    if (!metric_type || !metric_name || typeof duration_ms !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      )
    }

    // Save metric
    const monitor = PerformanceMonitor.getInstance()

    if (metric_type === 'database_query') {
      await monitor.trackQuery(
        metadata?.query || metric_name,
        duration_ms,
        metadata?.row_count || 0,
        metadata?.table_name || 'unknown',
        metadata?.operation || 'SELECT'
      )
    } else if (metric_type === 'api_request') {
      await monitor.trackApiRequest(
        metric_name,
        metadata?.method || 'GET',
        duration_ms,
        success,
        error_message
      )
    } else if (metric_type === 'page_load') {
      await monitor.trackPageLoad(metric_name, duration_ms, success)
    } else if (metric_type === 'sync_job') {
      await monitor.trackSyncJob(
        metadata?.job_id || 'unknown',
        metric_name,
        duration_ms,
        success,
        metadata?.records_processed || 0
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Performance metric tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track performance metric' },
      { status: 500 }
    )
  }
}
