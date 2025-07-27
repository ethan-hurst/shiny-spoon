// PRP-013: NetSuite OAuth API Route
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NetSuiteAuth } from '@/lib/integrations/netsuite/auth'
import { AuthManager } from '@/lib/integrations/auth-manager'
import { z } from 'zod'
import type { NetSuiteIntegrationConfig } from '@/types/netsuite.types'

// Shared UUID schema
const uuidSchema = z.string().uuid('Invalid integration ID format')

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get integration ID from query params
    const integrationId = request.nextUrl.searchParams.get('integration_id')
    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 })
    }

    // Validate UUID format using shared schema
    try {
      uuidSchema.parse(integrationId)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid integration ID format' }, { status: 400 })
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get integration and verify ownership
    const { data: integration } = await supabase
      .from('integrations')
      .select('*, netsuite_config (*)')
      .eq('id', integrationId)
      .eq('organization_id', profile.organization_id)
      .eq('platform', 'netsuite')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    const netsuiteConfig = integration.netsuite_config?.[0]
    if (!netsuiteConfig) {
      return NextResponse.json({ error: 'NetSuite configuration not found' }, { status: 404 })
    }

    // Generate state parameter
    const state = NetSuiteAuth.generateState()
    
    // Store state for verification
    await NetSuiteAuth.storeOAuthState(state, integrationId)

    // Initialize auth
    const auth = new NetSuiteAuth(
      integrationId,
      profile.organization_id,
      netsuiteConfig as NetSuiteIntegrationConfig
    )

    // Initialize with client credentials if available
    if (integration.credential_type === 'oauth2') {
      await auth.initialize()
    }

    // Build authorization URL
    const authUrl = auth.getAuthorizationUrl(state)

    // Log OAuth initiation
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integrationId,
      p_organization_id: profile.organization_id,
      p_log_type: 'auth',
      p_severity: 'info',
      p_message: 'NetSuite OAuth flow initiated',
    })

    // Redirect to NetSuite authorization page
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('NetSuite OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Define validation schema for credentials
    const credentialsSchema = z.object({
      integration_id: uuidSchema,
      client_id: z.string().min(1, 'Client ID cannot be empty').trim(),
      client_secret: z.string().min(1, 'Client secret cannot be empty').trim()
    })
    
    // Validate input
    let validatedData
    try {
      validatedData = credentialsSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => e.message).join(', ')
        return NextResponse.json({ error: errors }, { status: 400 })
      }
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }
    
    const { integration_id, client_id, client_secret } = validatedData

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Verify integration ownership
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('id', integration_id)
      .eq('organization_id', profile.organization_id)
      .eq('platform', 'netsuite')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Store OAuth client credentials
    const authManager = new AuthManager(integration_id, profile.organization_id)
    await authManager.storeCredentials('oauth2', {
      client_id,
      client_secret,
    })

    // Update integration
    await supabase
      .from('integrations')
      .update({ 
        credential_type: 'oauth2',
        status: 'configuring',
      })
      .eq('id', integration_id)

    // Log credential storage
    await supabase.rpc('log_integration_activity', {
      p_integration_id: integration_id,
      p_organization_id: profile.organization_id,
      p_log_type: 'auth',
      p_severity: 'info',
      p_message: 'OAuth client credentials stored',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('NetSuite OAuth credential storage error:', error)
    return NextResponse.json(
      { error: 'Failed to store OAuth credentials' },
      { status: 500 }
    )
  }
}