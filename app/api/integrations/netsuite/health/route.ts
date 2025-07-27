// PRP-013: NetSuite Integration Health Check
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { timingSafeEqual } from 'crypto'

interface HealthMetrics {
  integration_id: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  last_check: string
  metrics: {
    api_availability: boolean
    auth_status: 'valid' | 'expired' | 'invalid'
    sync_health: {
      last_successful_sync: string | null
      consecutive_failures: number
      error_rate_24h: number
      avg_sync_duration: number
    }
    data_quality: {
      orphaned_records: number
      sync_discrepancies: number
      validation_errors_24h: number
    }
    performance: {
      api_response_time_ms: number
      rate_limit_usage: number
      queue_depth: number
    }
  }
  issues: Array<{
    severity: 'critical' | 'warning' | 'info'
    category: string
    message: string
    timestamp: string
  }>
  recommendations: string[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get integration ID from query params
    const integrationId = request.nextUrl.searchParams.get('integration_id')
    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 })
    }

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*, netsuite_config(*), netsuite_sync_state(*)')
      .eq('id', integrationId)
      .eq('platform', 'netsuite')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Verify user has access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile || integration.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const healthMetrics: HealthMetrics = {
      integration_id: integrationId,
      status: 'healthy',
      last_check: new Date().toISOString(),
      metrics: {
        api_availability: true,
        auth_status: 'valid',
        sync_health: {
          last_successful_sync: null,
          consecutive_failures: 0,
          error_rate_24h: 0,
          avg_sync_duration: 0,
        },
        data_quality: {
          orphaned_records: 0,
          sync_discrepancies: 0,
          validation_errors_24h: 0,
        },
        performance: {
          api_response_time_ms: 0,
          rate_limit_usage: 0,
          queue_depth: 0,
        },
      },
      issues: [],
      recommendations: [],
    }

    // Check auth status
    const hasCredentials = integration.credential_type !== null
    if (!hasCredentials) {
      healthMetrics.metrics.auth_status = 'invalid'
      healthMetrics.issues.push({
        severity: 'critical',
        category: 'authentication',
        message: 'No authentication credentials configured',
        timestamp: new Date().toISOString(),
      })
      healthMetrics.recommendations.push('Configure OAuth 2.0 credentials to enable sync')
    }

    // Analyze sync health
    const syncStates = integration.netsuite_sync_state || []
    
    for (const state of syncStates) {
      if (state.last_successful_sync_at) {
        const lastSync = new Date(state.last_successful_sync_at)
        if (!healthMetrics.metrics.sync_health.last_successful_sync || 
            lastSync > new Date(healthMetrics.metrics.sync_health.last_successful_sync)) {
          healthMetrics.metrics.sync_health.last_successful_sync = state.last_successful_sync_at
        }
      }

      // Check for sync failures
      if (state.error_count > 0) {
        healthMetrics.metrics.sync_health.consecutive_failures = Math.max(
          healthMetrics.metrics.sync_health.consecutive_failures,
          state.error_count
        )

        if (state.last_error) {
          healthMetrics.issues.push({
            severity: state.error_count > 5 ? 'critical' : 'warning',
            category: 'sync',
            message: `${state.entity_type} sync error: ${state.last_error}`,
            timestamp: state.updated_at,
          })
        }
      }

      // Add sync duration to average
      if (state.sync_duration) {
        healthMetrics.metrics.sync_health.avg_sync_duration += state.sync_duration
      }
    }

    // Calculate average sync duration
    if (syncStates.length > 0) {
      healthMetrics.metrics.sync_health.avg_sync_duration /= syncStates.length
    }

    // Get error logs from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: errorLogs } = await supabase
      .from('integration_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('severity', 'error')
      .gte('created_at', yesterday)

    if (errorLogs) {
      healthMetrics.metrics.sync_health.error_rate_24h = errorLogs.length
      
      // Group errors by type
      const errorTypes: Record<string, number> = {}
      errorLogs.forEach(log => {
        const type = log.details?.error_type || 'unknown'
        errorTypes[type] = (errorTypes[type] || 0) + 1
      })

      // Add frequent error types as issues
      Object.entries(errorTypes).forEach(([type, count]) => {
        if (count > 5) {
          healthMetrics.issues.push({
            severity: 'warning',
            category: 'errors',
            message: `${count} ${type} errors in last 24 hours`,
            timestamp: new Date().toISOString(),
          })
        }
      })
    }

    // Check sync frequency
    if (healthMetrics.metrics.sync_health.last_successful_sync) {
      const hoursSinceSync = (Date.now() - new Date(healthMetrics.metrics.sync_health.last_successful_sync).getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceSync > 24) {
        healthMetrics.issues.push({
          severity: 'warning',
          category: 'sync',
          message: `No successful sync in ${Math.round(hoursSinceSync)} hours`,
          timestamp: new Date().toISOString(),
        })
        healthMetrics.recommendations.push('Check sync schedule and error logs')
      }
    }

    // Check for data quality issues
    const { data: orphanedProducts, count: orphanedCount } = await supabase
      .from('products')
      .select('id', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .is('external_id', null)

    if (orphanedCount && orphanedCount > 0) {
      healthMetrics.metrics.data_quality.orphaned_records = orphanedCount
      healthMetrics.issues.push({
        severity: 'info',
        category: 'data_quality',
        message: `${orphanedCount} products not linked to NetSuite`,
        timestamp: new Date().toISOString(),
      })
    }

    // Get rate limit information from recent logs
    const { data: rateLimitLogs } = await supabase
      .from('integration_logs')
      .select('details')
      .eq('integration_id', integrationId)
      .eq('log_type', 'sync')
      .gte('created_at', yesterday)
      .like('details->rate_limit_remaining', '%')
      .order('created_at', { ascending: false })
      .limit(1)

    if (rateLimitLogs && rateLimitLogs.length > 0) {
      const remaining = rateLimitLogs[0].details?.rate_limit_remaining || 100
      const limit = rateLimitLogs[0].details?.rate_limit_total || 100
      healthMetrics.metrics.performance.rate_limit_usage = Math.round((1 - remaining / limit) * 100)
      
      if (healthMetrics.metrics.performance.rate_limit_usage > 80) {
        healthMetrics.issues.push({
          severity: 'warning',
          category: 'performance',
          message: `Rate limit usage at ${healthMetrics.metrics.performance.rate_limit_usage}%`,
          timestamp: new Date().toISOString(),
        })
        healthMetrics.recommendations.push('Consider reducing sync frequency or batch size')
      }
    }

    // Determine overall health status
    const criticalIssues = healthMetrics.issues.filter(i => i.severity === 'critical').length
    const warningIssues = healthMetrics.issues.filter(i => i.severity === 'warning').length

    if (criticalIssues > 0) {
      healthMetrics.status = 'unhealthy'
    } else if (warningIssues > 2) {
      healthMetrics.status = 'degraded'
    }

    // Add general recommendations
    if (healthMetrics.metrics.sync_health.avg_sync_duration > 300000) { // 5 minutes
      healthMetrics.recommendations.push('Consider optimizing sync queries or reducing batch size')
    }

    if (healthMetrics.metrics.sync_health.consecutive_failures > 3) {
      healthMetrics.recommendations.push('Review error logs and verify NetSuite permissions')
    }

    // Store health check result
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integrationId,
      p_organization_id: profile.organization_id,
      p_log_type: 'health_check',
      p_severity: healthMetrics.status === 'healthy' ? 'info' : 'warning',
      p_message: `Health check: ${healthMetrics.status}`,
      p_details: healthMetrics,
    })

    return NextResponse.json(healthMetrics)

  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { 
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Monitor endpoint for automated health checks
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Authentication required - verify API key or user session
    const authHeader = request.headers.get('authorization')
    const apiKey = request.headers.get('x-api-key')
    
    // Method 1: API Key authentication for monitoring systems
    if (apiKey) {
      const validApiKey = process.env.MONITORING_API_KEY
      if (!validApiKey) {
        return NextResponse.json(
          { error: 'API key not configured' },
          { status: 500 }
        )
      }
      
      // Use timing-safe comparison to prevent timing attacks
      const apiKeyBuffer = Buffer.from(apiKey)
      const validApiKeyBuffer = Buffer.from(validApiKey)
      
      // Ensure buffers are same length for timingSafeEqual
      if (apiKeyBuffer.length !== validApiKeyBuffer.length) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        )
      }
      
      const isValid = timingSafeEqual(apiKeyBuffer, validApiKeyBuffer)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        )
      }
    }
    // Method 2: Bearer token authentication for authenticated users
    else if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        )
      }
      
      // Verify user has monitoring permissions (admin role)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      
      if (!profile || profile.role !== 'admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }
    // No authentication provided
    else {
      return NextResponse.json(
        { error: 'Authentication required. Provide X-API-Key or Authorization header.' },
        { status: 401 }
      )
    }
    
    // This endpoint is meant to be called by monitoring systems
    // It checks all active NetSuite integrations
    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, organization_id')
      .eq('platform', 'netsuite')
      .eq('status', 'active')

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ 
        status: 'ok',
        message: 'No active NetSuite integrations to monitor'
      })
    }

    const results: any[] = []

    // Process health checks in parallel for better performance
    const healthCheckPromises = integrations.map(async (integration) => {
      try {
        // Perform basic health check for each integration
        const { data: recentLogs } = await supabase
          .from('integration_logs')
          .select('severity')
          .eq('integration_id', integration.id)
          .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
          .eq('severity', 'error')

        const errorCount = recentLogs?.length || 0
        const status = errorCount > 10 ? 'unhealthy' : errorCount > 5 ? 'degraded' : 'healthy'

        // Alert if unhealthy
        if (status === 'unhealthy') {
          await supabase.rpc('log_integration_activity', {
            p_integration_id: integration.id,
            p_organization_id: integration.organization_id,
            p_log_type: 'alert',
            p_severity: 'critical',
            p_message: 'Integration health check failed',
            p_details: { error_count_1h: errorCount },
          })
        }

        return {
          integration_id: integration.id,
          status,
          error_count_1h: errorCount,
          checked_at: new Date().toISOString(),
        }
      } catch (error) {
        return {
          integration_id: integration.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Check failed',
          checked_at: new Date().toISOString(),
        }
      }
    })

    // Wait for all health checks to complete
    results = await Promise.all(healthCheckPromises)

    return NextResponse.json({
      status: 'ok',
      checked: results.length,
      results,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Monitor error:', error)
    return NextResponse.json(
      { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Monitor failed'
      },
      { status: 500 }
    )
  }
}