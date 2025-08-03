import { format } from 'date-fns'
import { Building2, Calendar, CreditCard, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SubscriptionData } from '@/lib/billing'

interface AccountOverviewProps {
  organization: any
  subscription: SubscriptionData | null
}

export function AccountOverview({
  organization,
  subscription,
}: AccountOverviewProps) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'trialing':
        return 'secondary'
      case 'past_due':
      case 'unpaid':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getPlanDisplayName = (plan: string) => {
    return plan.charAt(0).toUpperCase() + plan.slice(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
        <CardDescription>
          Your organization and subscription details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Organization
              </h3>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{organization.name}</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Organization ID
              </h3>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {organization.id}
              </code>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Created
              </h3>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(new Date(organization.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Subscription Plan
              </h3>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {getPlanDisplayName(subscription?.plan || 'free')}
                </span>
                {subscription?.interval && (
                  <Badge variant="outline" className="text-xs">
                    {subscription.interval === 'year' ? 'Annual' : 'Monthly'}
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Status
              </h3>
              <Badge
                variant={getStatusBadgeVariant(
                  subscription?.status || 'active'
                )}
              >
                {subscription?.status || 'Active'}
              </Badge>
            </div>

            {subscription && subscription.id !== 'free' && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Billing Period
                </h3>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(subscription.currentPeriodStart, 'MMM d')} -{' '}
                    {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}
                  </span>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-sm text-destructive mt-1">
                    Subscription will cancel on{' '}
                    {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
