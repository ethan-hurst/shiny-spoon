import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Package, Building2, Zap } from 'lucide-react'
import { UsageStats } from '@/lib/billing'

interface UsageSummaryProps {
  usage: UsageStats
  limits?: {
    products: number
    warehouses: number
    apiCalls: number
  }
}

export function UsageSummary({ usage, limits }: UsageSummaryProps) {
  const items = [
    {
      name: 'Products',
      icon: Package,
      current: usage.products.current,
      limit: usage.products.limit,
      percentage: usage.products.percentage,
      unit: 'products',
    },
    {
      name: 'Warehouses',
      icon: Building2,
      current: usage.warehouses.current,
      limit: usage.warehouses.limit,
      percentage: usage.warehouses.percentage,
      unit: 'locations',
    },
    {
      name: 'API Calls',
      icon: Zap,
      current: usage.apiCalls.current,
      limit: usage.apiCalls.limit,
      percentage: usage.apiCalls.percentage,
      unit: 'calls this month',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Summary</CardTitle>
        <CardDescription>Current usage against your plan limits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {items.map((item) => {
          const isNearLimit = item.percentage > 80
          const isAtLimit = item.percentage >= 100
          const isUnlimited = item.limit === -1

          return (
            <div key={item.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{item.name}</span>
                </div>
                {isNearLimit && !isUnlimited && (
                  <Badge 
                    variant={isAtLimit ? 'destructive' : 'secondary'}
                    className="flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {isAtLimit ? 'Limit reached' : 'Near limit'}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-2xl font-bold">
                    {item.current.toLocaleString()}
                  </span>
                  {!isUnlimited && (
                    <span className="text-muted-foreground">
                      / {item.limit.toLocaleString()} {item.unit}
                    </span>
                  )}
                  {isUnlimited && (
                    <span className="text-muted-foreground">Unlimited</span>
                  )}
                </div>
                {!isUnlimited && (
                  <Progress 
                    value={Math.min(item.percentage, 100)} 
                    className={isAtLimit ? 'bg-destructive/20' : ''}
                  />
                )}
              </div>
            </div>
          )
        })}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Usage resets on the first day of each month. 
            {usage.apiCalls.percentage > 80 && (
              <span className="text-amber-600 dark:text-amber-500">
                {' '}Consider upgrading your plan to avoid service interruptions.
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}