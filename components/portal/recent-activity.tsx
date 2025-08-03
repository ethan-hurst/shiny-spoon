import { format, formatDistanceToNow } from 'date-fns'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Key,
  Package,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ActivityItem {
  id: string
  type: string
  description: string
  timestamp: string
  metadata?: any
}

interface RecentActivityProps {
  activity: ActivityItem[]
}

export function RecentActivity({ activity }: RecentActivityProps) {
  const getActivityIcon = (type: string, metadata?: any) => {
    switch (type) {
      case 'api_call':
        const status = metadata?.status_code
        if (status >= 200 && status < 300) {
          return <CheckCircle className="h-4 w-4 text-green-500" />
        } else if (status >= 400) {
          return <XCircle className="h-4 w-4 text-destructive" />
        }
        return <Activity className="h-4 w-4 text-muted-foreground" />
      case 'api_key_created':
        return <Key className="h-4 w-4 text-blue-500" />
      case 'team_member_added':
        return <UserPlus className="h-4 w-4 text-green-500" />
      case 'subscription_updated':
        return <CreditCard className="h-4 w-4 text-purple-500" />
      case 'plan_upgraded':
        return <Package className="h-4 w-4 text-green-500" />
      case 'usage_limit_warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActivityBadge = (type: string, metadata?: any) => {
    if (type === 'api_call' && metadata?.status_code) {
      const status = metadata.status_code
      if (status >= 200 && status < 300) {
        return (
          <Badge variant="outline" className="text-green-600">
            Success
          </Badge>
        )
      } else if (status >= 400 && status < 500) {
        return (
          <Badge variant="outline" className="text-amber-600">
            Client Error
          </Badge>
        )
      } else if (status >= 500) {
        return <Badge variant="destructive">Server Error</Badge>
      }
    }
    return null
  }

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`
    }
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (activity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your organization's latest events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Activity will appear here as you use the platform
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your organization's latest events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activity.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 pb-4 last:pb-0 last:border-b-0 border-b"
            >
              <div className="mt-0.5">
                {getActivityIcon(item.type, item.metadata)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-none">
                    {item.description}
                  </p>
                  {getActivityBadge(item.type, item.metadata)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {formatDistanceToNow(new Date(item.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                  {item.metadata?.response_time_ms && (
                    <>
                      <span>•</span>
                      <span>
                        {formatResponseTime(item.metadata.response_time_ms)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {activity.length >= 10 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Showing last 10 activities
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
