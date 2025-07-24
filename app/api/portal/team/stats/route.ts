import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get team member stats
    const [members, invites, activity] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('role, created_at, auth.users(last_sign_in_at)')
        .eq('organization_id', profile.organization_id),
      supabase
        .from('team_invitations')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .is('accepted_at', null)
        .gte('expires_at', new Date().toISOString()),
      supabase
        .from('api_call_logs')
        .select('user_id, created_at')
        .eq('organization_id', profile.organization_id)
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
  } catch (error) {
    console.error('Error fetching team stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team statistics' },
      { status: 500 }
    )
  }
}