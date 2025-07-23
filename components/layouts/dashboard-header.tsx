'use client'

import { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { DashboardBreadcrumb } from '@/components/layouts/dashboard-breadcrumb'
import ModeToggle from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { UserProfile } from '@/components/user-profile'
import { useSidebar } from '@/hooks/use-sidebar'

interface DashboardHeaderProps {
  rightExtras?: ReactNode
}

export function DashboardHeader({ rightExtras }: DashboardHeaderProps) {
  const { setOpenMobile } = useSidebar()

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpenMobile(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>

      <DashboardBreadcrumb />

      <div className="ml-auto flex items-center gap-2">
        {rightExtras}
        <ModeToggle />
        <UserProfile />
      </div>
    </header>
  )
}

