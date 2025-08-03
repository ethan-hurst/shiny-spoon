import { format } from 'date-fns'
import { Building2, Calendar, Package, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { SubscriptionData, UsageStats } from '@/lib/billing'

interface UsageOverviewProps {
  usage: UsageStats
  subscription: SubscriptionData | null
}

export function UsageOverview({ usage, subscription }: UsageOverviewProps) {
  const billingPeriodEnd =
    subscription?.currentPeriodEnd ||
    new Date(new Date().setMonth(new Date().getMonth() + 1, 0))
  const daysRemaining = Math.ceil(
    (billingPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  const items = [
    {
      title: 'Products',
      icon: Package,
      current: usage.products.current,
      limit: usage.products.limit,
      percentage: usage.products.percentage,
      unit: 'products',
      color: 'blue',
    },
    {
      title: 'Warehouses',
      icon: Building2,
      current: usage.warehouses.current,
      limit: usage.warehouses.limit,
      percentage: usage.warehouses.percentage,
      unit: 'locations',
      color: 'green',
    },
    {
      title: 'API Calls',
      icon: Zap,
      current: usage.apiCalls.current,
      limit: usage.apiCalls.limit,
      percentage: usage.apiCalls.percentage,
      unit: 'calls',
      color: 'purple',
    },
  ]

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-destructive'
    if (percentage >= 80) return 'bg-amber-500'
    return ''
  }

  const getStatusBadge = (percentage: number, limit: number) => {
    if (limit === -1) {
      return <Badge variant="secondary">Unlimited</Badge>
    }
    if (percentage >= 100) {
      return <Badge variant="destructive">Limit Reached</Badge>
    }
    if (percentage >= 80) {
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        >
          {(100 - percentage).toFixed(0)}% remaining
        </Badge>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage Overview</CardTitle>
              <CardDescription>
                Current billing period ends{' '}
                {format(billingPeriodEnd, 'MMM d, yyyy')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{daysRemaining} days remaining</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {items.map((item) => {
              const isUnlimited = item.limit === -1

              return (
                <Card key={item.title}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">
                          {item.title}
                        </CardTitle>
                      </div>
                      {getStatusBadge(item.percentage, item.limit)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-2xl font-bold">
                            {item.current.toLocaleString()}
                          </span>
                          {!isUnlimited && (
                            <span className="text-sm text-muted-foreground">
                              / {item.limit.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.unit}
                        </p>
                      </div>

                      {!isUnlimited && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Usage</span>
                            <span className="font-medium">
                              {Math.min(item.percentage, 100).toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(item.percentage, 100)}
                            className={getProgressColor(item.percentage)}
                          />
                        </div>
                      )}

                      {item.title === 'API Calls' && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Daily average
                            </span>
                            <span className="font-medium">
                              {Math.round(
                                item.current / new Date().getDate()
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {subscription?.plan
                  ? subscription.plan.charAt(0).toUpperCase() +
                    subscription.plan.slice(1)
                  : 'Free'}{' '}
                Plan
              </p>
              <p className="text-xs text-muted-foreground">
                {subscription?.interval === 'year'
                  ? 'Billed annually'
                  : 'Billed monthly'}
              </p>
            </div>
            {subscription?.status && (
              <Badge
                variant={
                  subscription.status === 'active' ? 'default' : 'secondary'
                }
              >
                {subscription.status.charAt(0).toUpperCase() +
                  subscription.status.slice(1)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
