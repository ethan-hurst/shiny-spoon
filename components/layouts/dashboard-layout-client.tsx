'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { DashboardHeader } from '@/components/layouts/dashboard-header'
import { DashboardSidebar } from '@/components/layouts/dashboard-sidebar'
import { RealtimeIndicatorWrapper } from '@/components/features/inventory/realtime-indicator-wrapper'

interface DashboardLayoutClientProps {
  children: ReactNode
}

export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const pathname = usePathname()
  
  // Determine which extras to show based on the current route
  const rightExtras = pathname?.startsWith('/inventory') ? (
    <RealtimeIndicatorWrapper />
  ) : null

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader rightExtras={rightExtras} />
        <main className="flex-1 overflow-y-auto bg-muted/10 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}