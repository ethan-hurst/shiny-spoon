import {
  BarChart3,
  DollarSign,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  Warehouse,
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
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Inventory',
        href: '/dashboard/inventory',
        icon: Package,
      },
      {
        title: 'Products',
        href: '/dashboard/products',
        icon: Package,
      },
      {
        title: 'Warehouses',
        href: '/dashboard/warehouses',
        icon: Warehouse,
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        title: 'Customers',
        href: '/dashboard/customers',
        icon: Users,
      },
      {
        title: 'Pricing',
        href: '/dashboard/pricing',
        icon: DollarSign,
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        title: 'Reports',
        href: '/dashboard/reports',
        icon: FileText,
      },
      {
        title: 'Insights',
        href: '/dashboard/insights',
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        title: 'Integrations',
        href: '/dashboard/integrations',
        icon: Settings,
      },
      {
        title: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
      },
    ],
  },
]
