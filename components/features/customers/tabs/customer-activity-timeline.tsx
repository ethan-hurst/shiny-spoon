'use client'

import { Clock, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CustomerActivity, getActivityTypeIcon } from '@/types/customer.types'

// Helper function to format distance to now
function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffMins > 0) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  return 'just now'
}

interface CustomerActivityTimelineProps {
  customerId: string
  activities: CustomerActivity[]
}

/**
 * Displays a vertical timeline of customer activities, showing recent interactions, notes, and related metadata.
 *
 * Renders a scrollable list of activity entries, each with an icon, title, description, type badge, optional metadata, related resource link, and a relative timestamp. If no activities are present, displays a placeholder message.
 *
 * @param activities - The list of customer activity objects to display in the timeline.
 */
export function CustomerActivityTimeline({
  customerId: _customerId,
  activities,
}: CustomerActivityTimelineProps) {
  const getActivityColor = (type: CustomerActivity['type']) => {
    const colors: Record<CustomerActivity['type'], string> = {
      order: 'text-blue-600 bg-blue-50',
      payment: 'text-green-600 bg-green-50',
      contact: 'text-purple-600 bg-purple-50',
      note: 'text-gray-600 bg-gray-50',
      email: 'text-indigo-600 bg-indigo-50',
      phone: 'text-teal-600 bg-teal-50',
      meeting: 'text-orange-600 bg-orange-50',
      tier_change: 'text-yellow-600 bg-yellow-50',
      status_change: 'text-red-600 bg-red-50',
      contact_added: 'text-green-600 bg-green-50',
      contact_removed: 'text-red-600 bg-red-50',
      settings_update: 'text-gray-600 bg-gray-50',
    }
    return colors[type] || 'text-gray-600 bg-gray-50'
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>No activities recorded yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Activities will appear here as you interact with this customer
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>
              Recent activities and interactions
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id} className="relative">
                {/* Timeline line */}
                {index < activities.length - 1 && (
                  <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getActivityColor(activity.type)}`}
                  >
                    <span className="text-xl">
                      {getActivityTypeIcon(activity.type)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {activity.type.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Metadata */}
                    {activity.metadata &&
                      Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 rounded bg-muted p-3">
                          <dl className="space-y-1 text-sm">
                            {Object.entries(activity.metadata).map(
                              ([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <dt className="font-medium capitalize">
                                    {key.replace('_', ' ')}:
                                  </dt>
                                  <dd className="text-muted-foreground">
                                    {typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : String(value)}
                                  </dd>
                                </div>
                              )
                            )}
                          </dl>
                        </div>
                      )}

                    {/* Related link */}
                    {activity.related_type && activity.related_id && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        asChild
                      >
                        <a
                          href={`/${activity.related_type}s/${activity.related_id}`}
                        >
                          View {activity.related_type} →
                        </a>
                      </Button>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activity.created_at))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
