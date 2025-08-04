import {
  BarChart3,
  Bell,
  DollarSign,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  Warehouse,
  Database,
  Activity,
  Shield,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: number
  disabled?: boolean
  external?: boolean
  roles?: ('owner' | 'admin' | 'member')[]
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    items: [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
      },
      {
        title: 'Inventory',
        href: '/inventory',
        icon: Package,
      },
      {
        title: 'Products',
        href: '/products',
        icon: Package,
      },
      {
        title: 'Warehouses',
        href: '/warehouses',
        icon: Warehouse,
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        title: 'Customers',
        href: '/customers',
        icon: Users,
      },
      {
        title: 'Pricing',
        href: '/pricing',
        icon: DollarSign,
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        title: 'Reports',
        href: '/reports',
        icon: FileText,
      },
      {
        title: 'Insights',
        href: '/insights',
        icon: BarChart3,
      },
      {
        title: 'Analytics',
        href: '/analytics',
        icon: Activity,
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        title: 'Integrations',
        href: '/integrations',
        icon: Database,
      },
      {
        title: 'Monitoring',
        href: '/monitoring',
        icon: Activity,
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
      },
    ],
  },
]
