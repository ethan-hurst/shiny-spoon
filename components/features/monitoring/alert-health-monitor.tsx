'use client'

import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function AlertHealthMonitor() {
  // This is a placeholder component - in a real implementation,
  // this would fetch alert data from the API
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Alert Health Monitor</h2>
        <p className="text-muted-foreground">
          Monitor system alerts and their health status
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">3</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">2</div>
            <p className="text-xs text-muted-foreground">Under review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">15</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">1</div>
            <p className="text-xs text-muted-foreground">
              Immediate action required
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>
            Latest system alerts and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Critical:</strong> Sync job failed for Shopify
                integration
                <Badge variant="outline" className="ml-2">
                  2 hours ago
                </Badge>
              </AlertDescription>
            </Alert>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> High error rate detected in API
                endpoints
                <Badge variant="outline" className="ml-2">
                  4 hours ago
                </Badge>
              </AlertDescription>
            </Alert>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Info:</strong> Database connection pool at 80% capacity
                <Badge variant="outline" className="ml-2">
                  6 hours ago
                </Badge>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
