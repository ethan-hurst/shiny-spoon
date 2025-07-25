import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { PendingInvites } from '@/components/portal/team/pending-invites'
import { TeamMembersList } from '@/components/portal/team/team-members-list'
import { TeamStats } from '@/components/portal/team/team-stats'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  getPendingInvites,
  getSubscription,
  getTeamMembers,
} from '@/lib/billing'
import { createClient } from '@/lib/supabase/server'

interface TeamMember {
  role: string
  auth?: {
    users?: {
      last_sign_in_at?: string
    }
  }
}

/**
 * Renders the team management page for the authenticated user's organization.
 *
 * Redirects unauthenticated users to the login page and users without an organization to the dashboard. Fetches team members, pending invites, and subscription details for the user's organization. Computes team statistics and determines access permissions based on the user's role. Displays team information, member list, pending invites (for admins), and relevant alerts.
 *
 * @returns The JSX layout for the team management interface.
 */
export default async function TeamPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const [members, pendingInvites, subscription] = await Promise.all([
    getTeamMembers(profile.organization_id),
    getPendingInvites(profile.organization_id),
    getSubscription(profile.organization_id),
  ])

  // Get team limits based on subscription
  const teamLimits: Record<string, number> = {
    starter: 3,
    growth: 10,
    scale: 50,
  }

  const teamLimit = teamLimits[subscription?.plan || 'starter'] || 3
  const currentTeamSize = members.length
  const canInviteMore = currentTeamSize < teamLimit

  // Calculate team stats
  const stats = {
    totalMembers: members.length,
    admins: members.filter((m: TeamMember) => m.role === 'admin').length,
    activeToday: members.filter((m: TeamMember) => {
      if (!m.auth?.users?.last_sign_in_at) return false
      const lastSignIn = new Date(m.auth.users.last_sign_in_at)
      const today = new Date()
      return lastSignIn.toDateString() === today.toDateString()
    }).length,
    pendingInvites: pendingInvites.length,
  }

  const isAdmin = profile.role === 'admin'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage your team members and their permissions
        </p>
      </div>

      {!isAdmin && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            You have view-only access to team management. Contact an admin to
            make changes.
          </AlertDescription>
        </Alert>
      )}

      <TeamStats stats={stats} />

      <div className="grid gap-6">
        <TeamMembersList
          members={members}
          currentUserId={user.id}
          isAdmin={isAdmin}
          canInviteMore={canInviteMore}
          teamLimit={teamLimit}
        />

        {isAdmin && pendingInvites.length > 0 && (
          <PendingInvites invites={pendingInvites} />
        )}
      </div>
    </div>
  )
}
