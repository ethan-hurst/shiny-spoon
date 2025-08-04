'use client'

import { Suspense, useState } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardNav } from '@/components/layout/dashboard-nav'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { DashboardSkeleton } from '@/components/layouts/dashboard-skeleton'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useIsMobile } from '@/hooks/use-breakpoint'
import { useSidebar } from '@/hooks/use-sidebar'
import { useEffect } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [organization, setOrganization] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  const { setCollapsed } = useSidebar()

  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = createClient()
      
      // Get authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        redirect('/login')
        return
      }

      setUser(authUser)

      // Get user profile with organization
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', authUser.id)
        .single()

      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        redirect('/login')
        return
      }

      setProfile(userProfile)
      setOrganization(userProfile.organization)
      setLoading(false)
    }

    fetchUserData()
  }, [])

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true)
    }
  }, [isMobile, setCollapsed])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!user || !profile || !organization) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex">
        <DashboardNav user={profile} organization={organization} />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader 
          user={user} 
          organization={organization}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary>
            <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={profile}
        organization={organization}
      />
    </div>
  )
}
