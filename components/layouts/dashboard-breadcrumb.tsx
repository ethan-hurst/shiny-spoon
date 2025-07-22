'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { navigation } from '@/lib/constants/navigation'

export function DashboardBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      <Link
        href="/dashboard"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1

        // Skip the 'dashboard' segment as we already have the home icon
        if (segment === 'dashboard' && index === 0) return null

        // Try to find a nice title from navigation
        const navItem = navigation
          .flatMap((section) => section.items)
          .find((item) => item.href === href)

        const title =
          navItem?.title || segment.charAt(0).toUpperCase() + segment.slice(1)

        return (
          <div key={href} className="flex items-center">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="ml-1 font-medium text-foreground">{title}</span>
            ) : (
              <Link
                href={href}
                className="ml-1 hover:text-foreground transition-colors"
              >
                {title}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}

