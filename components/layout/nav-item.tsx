'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { type NavItem } from '@/lib/constants/navigation'

interface NavItemProps {
  item: NavItem
  isCollapsed: boolean
  userRole?: string
}

export function NavItem({ item, isCollapsed, userRole }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === item.href

  // Check if user has permission to see this item
  if (item.roles && userRole && !item.roles.includes(userRole as any)) {
    return null
  }

  const content = (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn(
        'w-full justify-start',
        isCollapsed ? 'h-10 w-10 p-0' : 'h-10 px-3',
        isActive && 'bg-secondary text-secondary-foreground'
      )}
      disabled={item.disabled}
      asChild
    >
      <Link href={item.href}>
        <item.icon className={cn('h-4 w-4', isCollapsed ? 'mx-auto' : 'mr-2')} />
        {!isCollapsed && (
          <>
            <span className="truncate">{item.title}</span>
            {item.badge && (
              <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    </Button>
  )

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{item.title}</span>
            {item.badge && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {item.badge}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
} 