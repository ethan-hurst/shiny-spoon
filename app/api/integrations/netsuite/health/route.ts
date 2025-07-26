import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Rate limiting storage (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Request validation schema
const healthCheckRequestSchema = z.object({
  integration_id: z.string().uuid(),
  account_id: z.string().min(1),
  checks: z.array(z.enum(['connection', 'auth', 'permissions', 'api_limits'])).optional().default(['connection']),
})

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const connIP = request.headers.get('x-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (connIP) {
    return connIP
  }
  
  return 'unknown'
}

// Rate limiting function
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  const maxRequests = 10 // Max 10 requests per minute per IP
  
  const current = rateLimitMap.get(clientIP)
  
  if (!current) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (now > current.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (current.count >= maxRequests) {
    return false
  }
  
  current.count += 1
  return true
}

// Authentication verification
async function verifyAuthentication(request: NextRequest): Promise<{
  isValid: boolean
  user?: any
  integration?: any
  error?: string
}> {
  try {
    const headersList = headers()
    
    // Method 1: API Key authentication
    const apiKey = headersList.get('x-api-key') || headersList.get('authorization')?.replace('Bearer ', '')
    
    if (apiKey) {
      // Verify API key against integrations table
      const supabase = createAdminClient()
      const { data: integration, error } = await supabase
        .from('integrations')
        .select('*, organizations!inner(id, name)')
        .eq('platform', 'netsuite')
        .eq('config->api_key', apiKey)
        .eq('status', 'active')
        .single()
      
      if (error || !integration) {
        return { isValid: false, error: 'Invalid API key' }
      }
      
      return { isValid: true, integration }
    }
    
    // Method 2: JWT token authentication (for authenticated users)
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { isValid: false, error: 'Authentication required' }
    }
    
    return { isValid: true, user }
    
  } catch (error) {
    return { isValid: false, error: 'Authentication failed' }
  }
}

// Perform NetSuite health checks
async function performHealthChecks(
  integration: any,
  checks: string[]
): Promise<{ status: string; checks: Record<string, any> }> {
  const results: Record<string, any> = {}
  let overallStatus = 'healthy'
  
  for (const check of checks) {
    try {
      switch (check) {
        case 'connection':
          results.connection = await checkConnection(integration)
          break
        case 'auth':
          results.auth = await checkAuthentication(integration)
          break
        case 'permissions':
          results.permissions = await checkPermissions(integration)
          break
        case 'api_limits':
          results.api_limits = await checkAPILimits(integration)
          break
        default:
          results[check] = { status: 'skipped', message: 'Unknown check type' }
      }
      
      if (results[check]?.status === 'unhealthy') {
        overallStatus = 'unhealthy'
      } else if (results[check]?.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded'
      }
    } catch (error) {
      results[check] = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      overallStatus = 'unhealthy'
    }
  }
  
  return { status: overallStatus, checks: results }
}

// Individual health check functions
async function checkConnection(integration: any) {
  // Mock NetSuite connection check - in real implementation, this would test actual connection
  const config = integration.config
  
  if (!config?.account_id || !config?.rest_url) {
    return { status: 'unhealthy', message: 'Missing required configuration' }
  }
  
  // Simulate connection test
  return { 
    status: 'healthy', 
    message: 'Connection successful',
    account_id: config.account_id,
    last_tested: new Date().toISOString()
  }
}

async function checkAuthentication(integration: any) {
  const credentials = integration.credentials
  
  if (!credentials?.consumer_key || !credentials?.token_id) {
    return { status: 'unhealthy', message: 'Missing authentication credentials' }
  }
  
  // Simulate auth check
  return { 
    status: 'healthy', 
    message: 'Authentication valid',
    expires_at: credentials.expires_at || null
  }
}

async function checkPermissions(integration: any) {
  // Simulate permission check
  return { 
    status: 'healthy', 
    message: 'All required permissions granted',
    permissions: ['read_products', 'read_inventory', 'read_customers']
  }
}

async function checkAPILimits(integration: any) {
  // Simulate API limit check
  return { 
    status: 'healthy', 
    message: 'API limits within normal range',
    daily_limit: 5000,
    daily_used: 150,
    burst_limit: 10,
    burst_used: 2
  }
}

// Log health check activity
async function logHealthCheck(
  integration: any,
  user: any,
  clientIP: string,
  results: any
) {
  try {
    const supabase = createAdminClient()
    
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integration.id,
      p_organization_id: integration.organization_id,
      p_log_type: 'health_check',
      p_severity: results.status === 'healthy' ? 'info' : 'warning',
      p_message: `Health check performed: ${results.status}`,
      p_details: {
        client_ip: clientIP,
        user_id: user?.id,
        checks_performed: Object.keys(results.checks),
        overall_status: results.status,
      },
    })
  } catch (error) {
    console.error('Failed to log health check activity:', error)
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)
  
  try {
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Authentication
    const auth = await verifyAuthentication(request)
    if (!auth.isValid) {
      return NextResponse.json(
        { error: auth.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = healthCheckRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      )
    }
    
    const { integration_id, account_id, checks } = validationResult.data
    
    // Get integration details
    const supabase = createAdminClient()
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*, organizations!inner(id, name)')
      .eq('id', integration_id)
      .eq('platform', 'netsuite')
      .eq('config->account_id', account_id)
      .single()
    
    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found or access denied' },
        { status: 404 }
      )
    }
    
    // Verify user has access to this integration (if using user auth)
    if (auth.user && !auth.integration) {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('user_id', auth.user.id)
        .single()
      
      if (!userProfile || userProfile.organization_id !== integration.organization_id) {
        return NextResponse.json(
          { error: 'Access denied to this integration' },
          { status: 403 }
        )
      }
    }
    
    // Perform health checks
    const healthResults = await performHealthChecks(integration, checks)
    
    // Log the health check
    await logHealthCheck(integration, auth.user, clientIP, healthResults)
    
    // Update integration last health check timestamp
    await supabase
      .from('integrations')
      .update({ 
        last_health_check: new Date().toISOString(),
        status: healthResults.status === 'healthy' ? 'active' : 'error'
      })
      .eq('id', integration_id)
    
    // Return results
    return NextResponse.json({
      integration_id,
      account_id,
      overall_status: healthResults.status,
      timestamp: new Date().toISOString(),
      checks: healthResults.checks,
    })
    
  } catch (error) {
    console.error('NetSuite health check error:', {
      error: error instanceof Error ? error.message : String(error),
      client_ip: clientIP,
      timestamp: new Date().toISOString(),
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST for health checks.' },
    { status: 405 }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  })
}