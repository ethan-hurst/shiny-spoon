import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Authentication check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get user profile to verify organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return new NextResponse('No organization found', { status: 403 })
    }

    // Gather all user data
    const [profileData, apiKeysData, activityData, organizationData] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('api_keys')
        .select('name, created_at, last_used_at, permissions, is_active')
        .eq('created_by', user.id)
        .eq('organization_id', profile.organization_id),
      supabase
        .from('api_call_logs')
        .select('endpoint, method, created_at, status_code')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('organizations')
        .select('name, created_at')
        .eq('id', profile.organization_id)
        .single(),
    ])

    const userData = {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile: profileData.data,
      organization: organizationData.data,
      apiKeys: apiKeysData.data,
      recentActivity: activityData.data,
      exportedAt: new Date().toISOString(),
    }

    // Return as JSON download
    return new NextResponse(JSON.stringify(userData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="truthsource-data-${user.id}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return new NextResponse('Failed to export data', { status: 500 })
  }
}