import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import config from '@/config'
import DashboardSideBar from './_components/dashboard-side-bar'
import DashboardTopNav from './_components/dashboard-top-nav'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  // Use Supabase auth if configured
  if (!config.auth.provider || config.auth.provider === 'supabase') {
    const supabase = createClient()

    // Check if user is authenticated
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      redirect('/login')
    }

    // Get user profile and organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select(
        `
        *,
        organizations (*)
      `
      )
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      // User exists but no profile - shouldn't happen with trigger
      redirect('/login')
    }
  } else if (config.auth.provider === 'clerk') {
    // Existing Clerk logic
    const { currentUser } = await import('@clerk/nextjs/server')
    const { isAuthorized } = await import('@/utils/data/user/isAuthorized')

    const user = await currentUser()

    if (!user || !user.id) {
      redirect('/login')
    }

    const { authorized } = await isAuthorized(user.id)

    if (!authorized) {
      redirect('/login')
    }
  }
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      <DashboardSideBar />
      <DashboardTopNav>
        <main className="flex flex-col gap-4 p-4 lg:gap-6">{children}</main>
      </DashboardTopNav>
    </div>
  )
}
