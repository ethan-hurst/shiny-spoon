import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { openBillingPortal } from '@/app/actions/billing'
import { SubscriptionData } from '@/lib/billing'
import { 
  Building2, 
  CreditCard, 
  Calendar, 
  Receipt,
  ExternalLink
} from 'lucide-react'

interface BillingDetailsProps {
  subscription: SubscriptionData
  organization: any
}

export function BillingDetails({ subscription, organization }: BillingDetailsProps) {
  const getPlanPrice = () => {
    const prices: Record<string, Record<string, number>> = {
      starter: { month: 99, year: 990 },
      growth: { month: 299, year: 2990 },
      scale: { month: 799, year: 7990 },
    }

    return prices[subscription.plan]?.[subscription.interval] || 0
  }

  const nextBillingAmount = getPlanPrice()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Billing Details</CardTitle>
            <CardDescription>
              Your current billing information and next payment
            </CardDescription>
          </div>
          <form action={openBillingPortal}>
            <Button type="submit" variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage in Stripe
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Billing Organization
              </h3>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{organization.name}</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Tax ID
              </h3>
              <p className="text-sm">
                {organization.tax_id || (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Billing Email
              </h3>
              <p className="text-sm">
                {organization.billing_email || organization.contact_email}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Current Plan
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan
                </span>
                <Badge variant="outline">
                  {subscription.interval === 'year' ? 'Annual' : 'Monthly'}
                </Badge>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Next Payment
              </h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    ${(nextBillingAmount / (subscription.interval === 'year' ? 1 : 100)).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Due {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Billing Address
              </h3>
              <address className="text-sm not-italic">
                {organization.billing_address ? (
                  <>
                    {organization.billing_address.line1}<br />
                    {organization.billing_address.line2 && (
                      <>{organization.billing_address.line2}<br /></>
                    )}
                    {organization.billing_address.city}, {organization.billing_address.state} {organization.billing_address.postal_code}<br />
                    {organization.billing_address.country}
                  </>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </address>
            </div>
          </div>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-900 dark:text-amber-200">
                Your subscription will end on {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}. 
                No further charges will be made.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}