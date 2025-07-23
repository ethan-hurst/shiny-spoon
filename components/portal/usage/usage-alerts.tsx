import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, TrendingUp, AlertCircle } from 'lucide-react'
import { UsageStats, SubscriptionData } from '@/lib/billing'
import Link from 'next/link'

interface UsageAlertsProps {
  usage: UsageStats
  subscription: SubscriptionData | null
}

export function UsageAlerts({ usage, subscription }: UsageAlertsProps) {
  const alerts = []

  // Check for critical usage levels
  if (usage.products.percentage >= 100) {
    alerts.push({
      type: 'error',
      title: 'Product limit reached',
      description: `You've reached your limit of ${usage.products.limit.toLocaleString()} products. Upgrade your plan to add more products.`,
      action: 'Upgrade Plan',
      actionHref: '/portal/subscription',
    })
  } else if (usage.products.percentage >= 80) {
    alerts.push({
      type: 'warning',
      title: 'Approaching product limit',
      description: `You're using ${usage.products.percentage.toFixed(0)}% of your product limit. Consider upgrading soon.`,
      action: 'View Plans',
      actionHref: '/portal/subscription',
    })
  }

  if (usage.warehouses.percentage >= 100) {
    alerts.push({
      type: 'error',
      title: 'Warehouse limit reached',
      description: `You've reached your limit of ${usage.warehouses.limit} warehouses. Upgrade to add more locations.`,
      action: 'Upgrade Plan',
      actionHref: '/portal/subscription',
    })
  }

  if (usage.apiCalls.percentage >= 100) {
    alerts.push({
      type: 'error',
      title: 'API call limit exceeded',
      description: 'You\'ve exceeded your monthly API call limit. Additional calls may be rate limited or blocked.',
      action: 'Upgrade Plan',
      actionHref: '/portal/subscription',
    })
  } else if (usage.apiCalls.percentage >= 80) {
    alerts.push({
      type: 'warning',
      title: 'High API usage',
      description: `You've used ${usage.apiCalls.percentage.toFixed(0)}% of your monthly API calls. Consider upgrading for more capacity.`,
      action: 'View Usage',
      actionHref: '#api-usage',
    })
  }

  // Check for rapid growth
  const daysIntoMonth = new Date().getDate()
  const monthProgress = (daysIntoMonth / 30) * 100
  if (usage.apiCalls.percentage > monthProgress + 20) {
    alerts.push({
      type: 'info',
      title: 'Usage trending high',
      description: 'Your API usage is higher than expected for this point in the month. You may exceed your limit before the month ends.',
      action: 'View Trends',
      actionHref: '#usage-chart',
    })
  }

  if (alerts.length === 0) {
    return null
  }

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive'
      case 'warning':
        return 'default' 
      default:
        return 'default'
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <TrendingUp className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert, index) => (
        <Alert key={index} variant={getAlertVariant(alert.type)}>
          {getAlertIcon(alert.type)}
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex items-start justify-between gap-4">
              <p className="flex-1">{alert.description}</p>
              {alert.action && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={alert.actionHref}>{alert.action}</Link>
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}