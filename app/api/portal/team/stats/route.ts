import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { createClient } from '@/lib/supabase/server'

export const GET = createRouteHandler(
  async ({ user }) => {
    const supabase = await createClient()

    // Get team member stats (auto-filtered by user's organization via wrapper)
    const [members, invites, activity] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('role, created_at, auth.users(last_sign_in_at)')
        .eq('organization_id', user.organizationId),
      supabase
        .from('team_invitations')
        .select('id')
        .eq('organization_id', user.organizationId)
        .is('accepted_at', null)
        .gte('expires_at', new Date().toISOString()),
      supabase
        .from('api_call_logs')
        .select('user_id, created_at')
        .eq('organization_id', user.organizationId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ])

    // Calculate stats
    const today = new Date()
    const activeToday = members.data?.filter((m: any) => {
      if (!m.auth?.users?.last_sign_in_at) return false
      const lastSignIn = new Date(m.auth.users.last_sign_in_at)
      return lastSignIn.toDateString() === today.toDateString()
    }).length || 0

    const stats = {
      totalMembers: members.data?.length || 0,
      admins: members.data?.filter((m: any) => m.role === 'admin').length || 0,
      activeToday,
      pendingInvites: invites.data?.length || 0,
      apiCallsToday: activity.data?.length || 0,
      newMembersThisMonth: members.data?.filter((m: any) => {
        const createdAt = new Date(m.created_at)
        return createdAt.getMonth() === today.getMonth() && 
               createdAt.getFullYear() === today.getFullYear()
      }).length || 0,
    }

    return NextResponse.json({ stats })
  },
  {
    rateLimit: { requests: 50, window: '1m' }
  }
)