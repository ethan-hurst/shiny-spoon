import React from 'react'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/layouts/dashboard-layout-client'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider } from '@/hooks/use-sidebar'

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

