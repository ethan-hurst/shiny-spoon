import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cancelSubscription, resumeSubscription, openBillingPortal } from '@/app/actions/billing'
import { SubscriptionData } from '@/lib/billing'
import { 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface CurrentPlanProps {
  subscription: SubscriptionData | null
  organization: any
}

export function CurrentPlan({ subscription, organization }: CurrentPlanProps) {
  const isFreePlan = subscription?.id === 'free'
  const isCanceling = subscription?.cancelAtPeriodEnd
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      case 'trialing':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Trial
        </Badge>
      case 'past_due':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Past Due
        </Badge>
      case 'canceled':
        return <Badge variant="outline" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Canceled
        </Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const daysUntilRenewal = subscription?.currentPeriodEnd 
    ? Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              {isFreePlan 
                ? 'You are currently on the free tier'
                : 'Your active subscription details'
              }
            </CardDescription>
          </div>
          {!isFreePlan && getStatusBadge(subscription?.status || 'active')}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold">
                {subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'Free'} Plan
              </h3>
              {!isFreePlan && subscription?.interval && (
                <p className="text-muted-foreground">
                  Billed {subscription.interval === 'year' ? 'annually' : 'monthly'}
                </p>
              )}
            </div>

            {!isFreePlan && subscription && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Next billing date: {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}
                  </span>
                </div>

                {subscription.interval && (
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>
                      ${subscription.plan === 'starter' ? 99 : subscription.plan === 'growth' ? 299 : 799}
                      /{subscription.interval === 'year' ? 'year' : 'month'}
                    </span>
                  </div>
                )}

                {!isCanceling && daysUntilRenewal <= 30 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Billing cycle progress</span>
                      <span className="font-medium">{30 - daysUntilRenewal} of 30 days</span>
                    </div>
                    <Progress value={((30 - daysUntilRenewal) / 30) * 100} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-3">Plan Limits</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {subscription?.limits.products === -1 
                    ? 'Unlimited products' 
                    : `${subscription?.limits.products.toLocaleString() || '1,000'} products`
                  }
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {subscription?.limits.warehouses === -1 
                    ? 'Unlimited warehouses' 
                    : `${subscription?.limits.warehouses || 2} warehouses`
                  }
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {subscription?.limits.apiCalls.toLocaleString() || '5,000'} API calls/month
                </li>
              </ul>
            </div>
          </div>
        </div>

        {isCanceling && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Subscription scheduled for cancellation
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your subscription will end on {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}. 
                  You'll retain access until then.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!isFreePlan && !isCanceling && (
            <>
              <form action={openBillingPortal}>
                <Button type="submit" variant="outline">
                  Manage Billing
                </Button>
              </form>
              <form action={cancelSubscription}>
                <Button type="submit" variant="outline" className="text-destructive">
                  Cancel Subscription
                </Button>
              </form>
            </>
          )}
          
          {!isFreePlan && isCanceling && (
            <form action={resumeSubscription}>
              <Button type="submit">
                Resume Subscription
              </Button>
            </form>
          )}

          {isFreePlan && (
            <Button>
              Upgrade to Pro
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}