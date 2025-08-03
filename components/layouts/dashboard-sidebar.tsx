'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { navigation } from '@/lib/constants/navigation'
import { cn } from '@/lib/utils'
import {
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_MINIMIZED,
  SIDEBAR_WIDTH_MOBILE,
  useSidebar,
} from '@/hooks/use-sidebar'

export function DashboardSidebar() {
  const pathname = usePathname()
  const {
    isOpen,
    isMinimized,
    openMobile,
    setOpenMobile,
    toggle,
    setIsMinimized,
  } = useSidebar()

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="p-0"
          style={{ width: SIDEBAR_WIDTH_MOBILE }}
        >
          <SidebarContent pathname={pathname} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex h-screen flex-col border-r bg-card transition-all duration-300',
          {
            'w-64': isOpen && !isMinimized,
            'w-12': !isOpen || isMinimized,
          }
        )}
        style={{
          width:
            isOpen && !isMinimized ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_MINIMIZED,
        }}
      >
        <div className="flex h-14 items-center border-b px-3">
          {isOpen && !isMinimized ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-semibold"
              >
                <span className="text-lg">Inventory Pro</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8"
                onClick={() => setIsMinimized(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto h-8 w-8"
              onClick={() => {
                setIsMinimized(false)
                if (!isOpen) toggle()
              }}
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>
        <SidebarContent pathname={pathname} isMinimized={isMinimized} />
      </aside>
    </>
  )
}

function SidebarContent({
  pathname,
  isMinimized = false,
}: {
  pathname: string
  isMinimized?: boolean
}) {
  return (
    <ScrollArea className="flex-1 px-3">
      <div className="space-y-4 py-4">
        {navigation.map((section, sectionIdx) => (
          <div key={sectionIdx} className="space-y-1">
            {section.title && !isMinimized && (
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    {
                      'bg-secondary text-secondary-foreground': isActive,
                      'hover:bg-secondary/50': !isActive,
                    }
                  )}
                  title={isMinimized ? item.title : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!isMinimized && (
                    <>
                      <span className="flex-1">{item.title}</span>
                      {item.badge && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
