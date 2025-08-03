import { Activity, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface UsageBreakdownProps {
  topEndpoints: Array<{ endpoint: string; count: number }>
  totalApiCalls: number
}

export function UsageBreakdown({
  topEndpoints,
  totalApiCalls,
}: UsageBreakdownProps) {
  const getMethodBadge = (endpoint: string) => {
    const method = endpoint.split(' ')[0]
    const variants: Record<string, any> = {
      GET: 'secondary',
      POST: 'default',
      PUT: 'outline',
      DELETE: 'destructive',
      PATCH: 'outline',
    }

    return (
      <Badge
        variant={variants[method] || 'outline'}
        className="font-mono text-xs"
      >
        {method}
      </Badge>
    )
  }

  const getEndpointPath = (endpoint: string) => {
    return endpoint.split(' ').slice(1).join(' ')
  }

  const getPercentage = (count: number) => {
    return totalApiCalls > 0 ? (count / totalApiCalls) * 100 : 0
  }

  // Mock trend data - in production, compare with previous period
  const getTrend = (index: number) => {
    const trends = [
      '+12%',
      '-5%',
      '+3%',
      '0%',
      '+8%',
      '-2%',
      '+15%',
      '+1%',
      '-8%',
      '+4%',
    ]
    return trends[index] || '0%'
  }

  const getTrendIcon = (trend: string) => {
    if (trend.startsWith('+')) {
      return <TrendingUp className="h-3 w-3 text-green-500" />
    } else if (trend.startsWith('-')) {
      return <TrendingDown className="h-3 w-3 text-red-500" />
    }
    return <Minus className="h-3 w-3 text-muted-foreground" />
  }

  return (
    <Card id="api-usage">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Usage Breakdown</CardTitle>
            <CardDescription>
              Most frequently used API endpoints this month
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>{totalApiCalls.toLocaleString()} total calls</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {topEndpoints.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No API usage data available yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              API calls will appear here once you start using the API
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEndpoints.map((item, index) => {
                    const percentage = getPercentage(item.count)
                    const trend = getTrend(index)

                    return (
                      <TableRow key={item.endpoint}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMethodBadge(item.endpoint)}
                            <span className="font-mono text-sm">
                              {getEndpointPath(item.endpoint)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm text-muted-foreground">
                              {percentage.toFixed(1)}%
                            </span>
                            <div className="w-24">
                              <Progress value={percentage} className="h-2" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {getTrendIcon(trend)}
                            <span className="text-sm font-medium">{trend}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Response Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Average
                      </span>
                      <span className="text-sm font-medium">142ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        95th percentile
                      </span>
                      <span className="text-sm font-medium">312ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        99th percentile
                      </span>
                      <span className="text-sm font-medium">523ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Successful
                      </span>
                      <span className="text-sm font-medium text-green-600">
                        99.8%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Client errors (4xx)
                      </span>
                      <span className="text-sm font-medium">0.1%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Server errors (5xx)
                      </span>
                      <span className="text-sm font-medium">0.1%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
