import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check if this is a valid cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cleanupResults = {
      performanceMetrics: 0,
      securityEvents: 0,
      accessLogs: 0,
      apiKeyUsage: 0,
      oldAlerts: 0
    }

    // Clean up old performance metrics (keep 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: metricsDeleted } = await supabase
      .from('performance_metrics')
      .delete()
      .lt('timestamp', thirtyDaysAgo.toISOString())
      .select('count')

    cleanupResults.performanceMetrics = metricsDeleted || 0

    // Clean up old security events (keep 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { count: eventsDeleted } = await supabase
      .from('security_events')
      .delete()
      .lt('timestamp', ninetyDaysAgo.toISOString())
      .select('count')

    cleanupResults.securityEvents = eventsDeleted || 0

    // Clean up old access logs (keep 30 days)
    const { count: logsDeleted } = await supabase
      .from('access_logs')
      .delete()
      .lt('timestamp', thirtyDaysAgo.toISOString())
      .select('count')

    cleanupResults.accessLogs = logsDeleted || 0

    // Clean up old API key usage (keep 30 days)
    const { count: usageDeleted } = await supabase
      .from('api_key_usage')
      .delete()
      .lt('timestamp', thirtyDaysAgo.toISOString())
      .select('count')

    cleanupResults.apiKeyUsage = usageDeleted || 0

    // Clean up old non-critical security alerts (keep 30 days)
    const { count: alertsDeleted } = await supabase
      .from('security_alerts')
      .delete()
      .lt('timestamp', thirtyDaysAgo.toISOString())
      .neq('severity', 'critical')
      .select('count')

    cleanupResults.oldAlerts = alertsDeleted || 0

    // Log cleanup summary
    console.log('Performance cleanup completed:', cleanupResults)

    return NextResponse.json({
      success: true,
      cleanupResults,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Performance cleanup cron error:', error)
    return NextResponse.json(
      { error: 'Performance cleanup failed' },
      { status: 500 }
    )
  }
} 