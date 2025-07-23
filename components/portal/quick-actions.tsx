import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, Key, Users, FileText, Settings, Package } from 'lucide-react'
import { SubscriptionData } from '@/lib/billing'

interface QuickActionsProps {
  subscription: SubscriptionData | null
}

export function QuickActions({ subscription }: QuickActionsProps) {
  const actions = [
    {
      title: 'Manage Subscription',
      description: subscription?.id === 'free' ? 'Upgrade your plan' : 'Change or cancel plan',
      icon: Package,
      href: '/portal/subscription',
      variant: subscription?.id === 'free' ? 'default' : 'outline',
    },
    {
      title: 'Payment Methods',
      description: 'Update billing information',
      icon: CreditCard,
      href: '/portal/billing',
      variant: 'outline',
    },
    {
      title: 'API Keys',
      description: 'Manage API access',
      icon: Key,
      href: '/portal/api-keys',
      variant: 'outline',
    },
    {
      title: 'Team Members',
      description: 'Invite and manage users',
      icon: Users,
      href: '/portal/team',
      variant: 'outline',
    },
    {
      title: 'Invoices',
      description: 'Download billing history',
      icon: FileText,
      href: '/portal/billing#invoices',
      variant: 'outline',
    },
    {
      title: 'Settings',
      description: 'Account preferences',
      icon: Settings,
      href: '/portal/settings',
      variant: 'outline',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant={action.variant as any}
                className="w-full h-auto flex-col items-start justify-start p-4 space-y-2"
              >
                <div className="flex items-center gap-2 w-full">
                  <action.icon className="h-4 w-4" />
                  <span className="font-medium">{action.title}</span>
                </div>
                <span className="text-xs text-muted-foreground font-normal">
                  {action.description}
                </span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}