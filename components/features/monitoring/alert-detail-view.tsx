// PRP-016: Data Accuracy Monitor - Alert Detail View Component
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Webhook,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import type {
  Alert,
  Discrepancy,
  NotificationLog,
} from '@/lib/monitoring/types'
import { acknowledgeAlert, resolveAlert } from '@/app/actions/monitoring'
import { DiscrepancyTable } from './discrepancy-table'

interface AlertDetailViewProps {
  alert: Alert
  notifications: NotificationLog[]
  discrepancies: Discrepancy[]
}

export function AlertDetailView({
  alert,
  notifications,
  discrepancies,
}: AlertDetailViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAcknowledge = async () => {
    setIsProcessing(true)
    const result = await acknowledgeAlert(alert.id)

    if (result.success) {
      toast({
        title: 'Alert acknowledged',
        description: 'This alert has been marked as acknowledged.',
      })
      router.refresh()
    } else {
      toast({
        title: 'Failed to acknowledge alert',
        description: result.error,
        variant: 'destructive',
      })
    }
    setIsProcessing(false)
  }

  const handleResolve = async () => {
    setIsProcessing(true)
    const result = await resolveAlert(alert.id)

    if (result.success) {
      toast({
        title: 'Alert resolved',
        description: 'This alert has been marked as resolved.',
      })
      router.refresh()
    } else {
      toast({
        title: 'Failed to resolve alert',
        description: result.error,
        variant: 'destructive',
      })
    }
    setIsProcessing(false)
  }

  const getSeverityColor = (
    severity: string
  ): 'destructive' | 'secondary' | 'outline' | 'default' => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'acknowledged':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'resolved':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'sms':
        return <Phone className="h-4 w-4" />
      case 'in_app':
        return <Bell className="h-4 w-4" />
      case 'webhook':
        return <Webhook className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getNotificationStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'text-green-600'
      case 'sent':
        return 'text-blue-600'
      case 'pending':
        return 'text-yellow-600'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/monitoring/alerts')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Alerts
          </Button>
        </div>
        <div className="flex gap-2">
          {alert.status === 'active' && (
            <Button
              variant="secondary"
              onClick={handleAcknowledge}
              disabled={isProcessing}
            >
              Acknowledge
            </Button>
          )}
          {alert.status !== 'resolved' && (
            <Button
              variant="default"
              onClick={handleResolve}
              disabled={isProcessing}
            >
              Mark Resolved
            </Button>
          )}
        </div>
      </div>

      {/* Alert Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {getStatusIcon(alert.status)}
              <div>
                <CardTitle>{alert.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Rule: {alert.alert_rules?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getSeverityColor(alert.severity)}>
                {alert.severity}
              </Badge>
              <Badge variant="outline">{alert.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="whitespace-pre-wrap text-sm">{alert.message}</div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(new Date(alert.created_at), 'PPp')}
                </p>
              </div>
              {alert.acknowledged_at && (
                <div>
                  <p className="text-muted-foreground">Acknowledged</p>
                  <p className="font-medium">
                    {format(new Date(alert.acknowledged_at), 'PPp')}
                  </p>
                </div>
              )}
              {alert.resolved_at && (
                <div>
                  <p className="text-muted-foreground">Resolved</p>
                  <p className="font-medium">
                    {format(new Date(alert.resolved_at), 'PPp')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Triggered By</p>
                <p className="font-medium capitalize">{alert.triggered_by}</p>
              </div>
            </div>

            {alert.trigger_value && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">Trigger Details</p>
                <div className="text-sm space-y-1">
                  {alert.trigger_value.accuracy_score !== undefined && (
                    <p>
                      Accuracy Score:{' '}
                      {alert.trigger_value.accuracy_score.toFixed(2)}%
                    </p>
                  )}
                  {alert.trigger_value.discrepancy_count !== undefined && (
                    <p>
                      Discrepancy Count: {alert.trigger_value.discrepancy_count}
                    </p>
                  )}
                  {alert.trigger_value.reason && (
                    <p>Reason: {alert.trigger_value.reason}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Additional Information */}
      <Tabs defaultValue="notifications" className="w-full">
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy Check</TabsTrigger>
          {discrepancies.length > 0 && (
            <TabsTrigger value="discrepancies">
              Discrepancies ({discrepancies.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-muted-foreground">
                  No notifications sent yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        {getChannelIcon(notification.channel)}
                        <div>
                          <p className="font-medium capitalize">
                            {notification.channel}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {notification.recipient}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-medium ${getNotificationStatusColor(notification.status)}`}
                        >
                          {notification.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notification.sent_at
                            ? format(new Date(notification.sent_at), 'PPp')
                            : 'Pending'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Check Details</CardTitle>
            </CardHeader>
            <CardContent>
              {alert.accuracy_checks ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Scope</p>
                      <p className="font-medium capitalize">
                        {alert.accuracy_checks.scope}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Accuracy Score
                      </p>
                      <p className="font-medium">
                        {alert.accuracy_checks.accuracy_score?.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Records Checked
                      </p>
                      <p className="font-medium">
                        {alert.accuracy_checks.records_checked?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Discrepancies
                      </p>
                      <p className="font-medium">
                        {alert.accuracy_checks.discrepancies_found}
                      </p>
                    </div>
                  </div>
                  {alert.accuracy_checks.completed_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="font-medium">
                        {format(
                          new Date(alert.accuracy_checks.completed_at),
                          'PPp'
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No accuracy check data available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {discrepancies.length > 0 && (
          <TabsContent value="discrepancies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Related Discrepancies</CardTitle>
              </CardHeader>
              <CardContent>
                <DiscrepancyTable
                  discrepancies={discrepancies}
                  onResolve={async () => {
                    router.refresh()
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
