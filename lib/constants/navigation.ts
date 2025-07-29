import {
  BarChart3,
  DollarSign,
  FileText,
  FileUp,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Warehouse,
  TrendingUp,
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
        title: 'Orders',
        href: '/orders',
        icon: ShoppingCart,
      },
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
        title: 'Analytics Dashboard',
        href: '/analytics',
        icon: TrendingUp,
      },
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
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        title: 'Bulk Operations',
        href: '/bulk-operations',
        icon: FileUp,
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        title: 'Integrations',
        href: '/integrations',
        icon: Settings,
      },
      {
        title: 'Audit Trail',
        href: '/audit',
        icon: Shield,
        roles: ['owner', 'admin'],
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
      },
    ],
  },
]
