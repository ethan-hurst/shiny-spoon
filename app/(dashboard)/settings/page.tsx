import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Building2, 
  CreditCard, 
  Users, 
  Shield, 
  Package, 
  ExternalLink,
  Settings2,
  Bell,
  Key,
  BarChart3
} from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/login')

  const settingsCards = [
    {
      title: 'Organization',
      description: 'Manage your organization details and branding',
      icon: Building2,
      href: '/portal/settings',
      external: true,
    },
    {
      title: 'Billing & Subscription',
      description: 'Manage your subscription plan and payment methods',
      icon: CreditCard,
      href: '/portal/subscription',
      external: true,
    },
    {
      title: 'Team Management',
      description: 'Invite team members and manage permissions',
      icon: Users,
      href: '/portal/team',
      external: true,
    },
    {
      title: 'API Keys',
      description: 'Create and manage API keys for integrations',
      icon: Key,
      href: '/portal/api-keys',
      external: true,
    },
    {
      title: 'Usage & Analytics',
      description: 'Monitor your usage and API consumption',
      icon: BarChart3,
      href: '/portal/usage',
      external: true,
    },
    {
      title: 'Pricing Tiers',
      description: 'Configure customer pricing tiers and rules',
      icon: Package,
      href: '/settings/tiers',
      external: false,
    },
    {
      title: 'Notifications',
      description: 'Configure email and alert preferences',
      icon: Bell,
      href: '/portal/settings#notifications',
      external: true,
    },
    {
      title: 'Security',
      description: 'Password, two-factor authentication, and sessions',
      icon: Shield,
      href: '/portal/settings#security',
      external: true,
    },
  ]

  const isAdmin = profile.role === 'admin'

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Portal</CardTitle>
            <CardDescription>
              Access advanced settings, billing, and team management in the customer portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/portal" target="_blank">
                <Settings2 className="h-4 w-4 mr-2" />
                Open Customer Portal
                <ExternalLink className="h-3 w-3 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settingsCards.map((card) => {
          // Hide admin-only cards for non-admins
          if (!isAdmin && ['Organization', 'Team Management', 'API Keys'].includes(card.title)) {
            return null
          }

          return (
            <Link 
              key={card.title} 
              href={card.href}
              target={card.external ? '_blank' : undefined}
              className="block"
            >
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <card.icon className="h-8 w-8 text-primary" />
                    {card.external && (
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <CardTitle className="mt-4">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      {!isAdmin && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Need Admin Access?</CardTitle>
              <CardDescription>
                Some settings require admin permissions. Contact your organization admin to request access.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  )
}