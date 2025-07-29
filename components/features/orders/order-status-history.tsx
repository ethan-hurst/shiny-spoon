import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, User, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import type { OrderStatusHistory as StatusHistory } from '@/types/order.types'

interface OrderStatusHistoryProps {
  history: StatusHistory[]
}

export function OrderStatusHistory({ history }: OrderStatusHistoryProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((item, index) => (
            <div
              key={item.id}
              className={`relative pb-4 ${
                index < history.length - 1 ? 'border-l-2 border-gray-200 ml-2' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`absolute -left-2 w-4 h-4 rounded-full border-2 border-white ${
                    index === 0 ? 'bg-primary' : 'bg-gray-400'
                  }`}
                />
                <div className="ml-6 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {item.previous_status && (
                      <>
                        <Badge className={getStatusColor(item.previous_status)}>
                          {item.previous_status.charAt(0).toUpperCase() + item.previous_status.slice(1)}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </>
                    )}
                    <Badge className={getStatusColor(item.status)}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'MMM d, yyyy at h:mm a')}
                  </p>
                  {item.reason && (
                    <p className="text-sm mt-1">{item.reason}</p>
                  )}
                  {item.changed_by && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Updated by system</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}