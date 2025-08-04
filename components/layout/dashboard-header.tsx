'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/layout/user-menu'

interface DashboardHeaderProps {
  user: {
    email?: string
    full_name?: string
    avatar_url?: string
  }
  organization: {
    name: string
  }
  onMobileMenuOpen: () => void
}

export function DashboardHeader({ user, organization, onMobileMenuOpen }: DashboardHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMobileMenuOpen}
        aria-label="Open mobile menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Organization Name - Hidden on mobile, shown on desktop */}
      <div className="hidden md:flex md:items-center md:gap-2">
        <h1 className="text-lg font-semibold text-foreground">{organization.name}</h1>
      </div>

      {/* Spacer for mobile */}
      <div className="md:hidden" />

      {/* User Menu */}
      <div className="flex items-center gap-2">
        <UserMenu user={user} />
      </div>
    </header>
  )
} 