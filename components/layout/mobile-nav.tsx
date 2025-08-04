'use client'

import { useSidebar } from '@/hooks/use-sidebar'
import { navigation } from '@/lib/constants/navigation'
import { NavItem } from '@/components/layout/nav-item'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  user: {
    full_name?: string
    role?: string
  }
  organization: {
    name: string
    subscription_tier?: string
  }
}

export function MobileNav({ isOpen, onClose, user, organization }: MobileNavProps) {
  const { setCollapsed } = useSidebar()

  const handleNavItemClick = () => {
    onClose()
    // Auto-collapse sidebar on mobile when navigating
    setCollapsed(true)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">TruthSource</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Organization Context */}
        <div className="border-b p-4">
          <p className="text-sm font-medium text-foreground">{organization.name}</p>
          <p className="text-xs text-muted-foreground">
            {organization.subscription_tier || 'Starter'} plan
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 p-4">
          {navigation.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {section.title && (
                <h3 className="mb-2 px-2 text-xs font-medium uppercase text-muted-foreground">
                  {section.title}
                </h3>
              )}
              {section.items.map((item) => (
                <div key={item.href} onClick={handleNavItemClick}>
                  <NavItem
                    item={item}
                    isCollapsed={false}
                    userRole={user.role}
                  />
                </div>
              ))}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
} 