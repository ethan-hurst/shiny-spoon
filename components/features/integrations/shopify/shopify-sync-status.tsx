'use client'

// PRP-014: Shopify Sync Status Component
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Package, 
  Warehouse, 
  ShoppingCart, 
  Users, 
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ShopifySyncStatusProps {
  integrationId: string
}

interface SyncStatus {
  entity_type: 'products' | 'inventory' | 'orders' | 'customers' | 'b2b_catalogs'
  last_sync_at: string | null
  sync_status: 'completed' | 'in_progress' | 'failed' | 'pending'
  records_synced: number
  records_failed: number
  error_message: string | null
  next_sync_at: string | null
}

const entityConfig = {
  products: {
    icon: Package,
    label: 'Products',
    description: 'Product catalog and variants'
  },
  inventory: {
    icon: Warehouse,
    label: 'Inventory',
    description: 'Stock levels across locations'
  },
  orders: {
    icon: ShoppingCart,
    label: 'Orders',
    description: 'Order history and status'
  },
  customers: {
    icon: Users,
    label: 'Customers',
    description: 'Customer data and companies'
  },
  b2b_catalogs: {
    icon: Package,
    label: 'B2B Catalogs',
    description: 'Catalogs and price lists'
  }
}

export function ShopifySyncStatus({ integrationId }: ShopifySyncStatusProps) {
  const supabase = createBrowserClient()
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSyncStatus()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`shopify-sync-${integrationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopify_sync_state',
          filter: `integration_id=eq.${integrationId}`
        },
        () => {
          fetchSyncStatus()
        }
      )
      .subscribe()

    // Refresh every 30 seconds
    const interval = setInterval(fetchSyncStatus, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [integrationId])

  async function fetchSyncStatus() {
    try {
      const { data, error } = await supabase
        .from('shopify_sync_state')
        .select('*')
        .eq('integration_id', integrationId)
        .order('entity_type')

      if (error) throw error

      setSyncStatuses(data || [])
    } catch (error) {
      console.error('Failed to fetch sync status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  function getStatusColor(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'completed':
        return 'default'
      case 'in_progress':
        return 'secondary'
      case 'failed':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Object.entries(entityConfig).map(([entityType, config]) => {
        const status = syncStatuses.find(s => s.entity_type === entityType) || {
          entity_type: entityType as any,
          last_sync_at: null,
          sync_status: 'pending',
          records_synced: 0,
          records_failed: 0,
          error_message: null,
          next_sync_at: null
        }

        const Icon = config.icon

        return (
          <Card key={entityType}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">{config.label}</h3>
                </div>
                {getStatusIcon(status.sync_status)}
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                {config.description}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={getStatusColor(status.sync_status)}>
                    {status.sync_status}
                  </Badge>
                </div>

                {status.last_sync_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last sync</span>
                    <span>
                      {formatDistanceToNow(new Date(status.last_sync_at), { addSuffix: true })}
                    </span>
                  </div>
                )}

                {status.records_synced > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Records</span>
                    <span>
                      {status.records_synced.toLocaleString()}
                      {status.records_failed > 0 && (
                        <span className="text-red-500 ml-1">
                          ({status.records_failed} failed)
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {status.sync_status === 'in_progress' && (
                  <Progress className="h-1.5" value={75} />
                )}

                {status.error_message && (
                  <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    <p className="text-red-600 dark:text-red-400">
                      {status.error_message}
                    </p>
                  </div>
                )}

                {status.next_sync_at && status.sync_status !== 'in_progress' && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Next sync: {formatDistanceToNow(new Date(status.next_sync_at), { addSuffix: true })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}