'use client'

import { cn } from '@/lib/utils'
import { navigation } from '@/lib/constants/navigation'
import { NavItem } from '@/components/layout/nav-item'
import { useSidebar } from '@/hooks/use-sidebar'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface DashboardNavProps {
  user: {
    full_name?: string
    role?: string
  }
  organization: {
    name: string
    subscription_tier?: string
  }
}

export function DashboardNav({ user, organization }: DashboardNavProps) {
  const { isCollapsed, toggle } = useSidebar()

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">TruthSource</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn('h-8 w-8', isCollapsed && 'mx-auto')}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform',
              isCollapsed && 'rotate-180'
            )}
          />
        </Button>
      </div>

      {/* Organization Context */}
      {!isCollapsed && (
        <>
          <div className="border-b p-4">
            <p className="text-sm font-medium text-foreground">
              {organization.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {organization.subscription_tier || 'Starter'} plan
            </p>
          </div>
          <Separator />
        </>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-6 p-4">
        {navigation.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && !isCollapsed && (
              <h3 className="mb-2 px-2 text-xs font-medium uppercase text-muted-foreground">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isCollapsed={isCollapsed}
                userRole={user.role}
              />
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
} 