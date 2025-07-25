import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalSidebar } from '@/components/portal/portal-sidebar'
import { PortalHeader } from '@/components/portal/portal-header'

/**
 * Asynchronous layout component that enforces authentication and organization association for user portal pages.
 *
 * Redirects unauthenticated users to the login page and users without a valid organization to the dashboard. Renders the portal header, sidebar, and main content area for authenticated users with an associated organization.
 *
 * @param children - The content to display within the portal layout
 */
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