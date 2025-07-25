import React from 'react'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/layouts/dashboard-layout-client'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider } from '@/hooks/use-sidebar'

/**
 * Asynchronous layout component that wraps dashboard pages, enforcing user authentication.
 *
 * Redirects unauthenticated users to the login page. Authenticated users see the dashboard layout with sidebar context.
 *
 * @param children - The content to render within the dashboard layout
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <SidebarProvider>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </SidebarProvider>
  )
}

