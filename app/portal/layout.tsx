import { redirect } from 'next/navigation'
import { PortalHeader } from '@/components/portal/portal-header'
import { PortalSidebar } from '@/components/portal/portal-sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile with organization
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  // Handle query errors or missing profile
  if (error || !profile) {
    console.error('Error fetching user profile:', error)
    redirect('/dashboard')
  }

  // Ensure user has organization association
  if (!profile.organization_id || !profile.organizations) {
    console.error('User profile missing organization association')
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} organization={profile.organizations} />
      <div className="flex">
        <PortalSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
