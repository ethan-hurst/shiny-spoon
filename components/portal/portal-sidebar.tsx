'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileText,
  Key,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  {
    name: 'Overview',
    href: '/portal',
    icon: LayoutDashboard,
  },
  {
    name: 'Subscription',
    href: '/portal/subscription',
    icon: Building2,
  },
  {
    name: 'Billing & Invoices',
    href: '/portal/billing',
    icon: CreditCard,
  },
  {
    name: 'Usage',
    href: '/portal/usage',
    icon: BarChart3,
  },
  {
    name: 'API Keys',
    href: '/portal/api-keys',
    icon: Key,
  },
  {
    name: 'Team',
    href: '/portal/team',
    icon: Users,
  },
  {
    name: 'Notifications',
    href: '/portal/notifications',
    icon: Bell,
  },
]

export function PortalSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-16 h-[calc(100vh-4rem)] w-64 border-r bg-background">
      <nav className="flex flex-col gap-1 p-4">
        <div className="mb-4 px-3">
          <h2 className="text-lg font-semibold">Customer Portal</h2>
          <p className="text-sm text-muted-foreground">
            Manage your account and billing
          </p>
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
