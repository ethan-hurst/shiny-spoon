import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { createClient } from '@/lib/supabase/server'

export const GET = createRouteHandler(
  async ({ user }) => {
    const supabase = await createClient()

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
        .eq('organization_id', user.organizationId),
      supabase
        .from('api_call_logs')
        .select('endpoint, method, created_at, status_code')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('organizations')
        .select('name, created_at')
        .eq('id', user.organizationId)
        .single(),
    ])

    const userData = {
      user: {
        id: user.id,
        email: user.email,
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
  },
  {
    rateLimit: { 
      requests: 5, 
      window: '1h',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)