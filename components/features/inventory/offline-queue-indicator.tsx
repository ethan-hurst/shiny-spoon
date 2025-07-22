'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'
import { OfflineQueue } from '@/lib/realtime/offline-queue'
import { ConnectionStatus } from '@/lib/realtime/types'
import { cn } from '@/lib/utils'

export function OfflineQueueIndicator() {
  const [queueSize, setQueueSize] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>()
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const queue = OfflineQueue.getInstance()
    const connectionManager = RealtimeConnectionManager.getInstance()

    // Subscribe to queue size changes
    const unsubscribeQueue = queue.subscribe('queue-indicator', (size) => {
      setQueueSize(size)
    })

    // Subscribe to connection status
    const unsubscribeConnection = connectionManager.subscribe(
      'queue-indicator',
      (status) => {
        setConnectionStatus(status)
      }
    )

    return () => {
      unsubscribeQueue()
      unsubscribeConnection()
    }
  }, [])

  const handleManualSync = async () => {
    if (connectionStatus?.state !== 'connected' || queueSize === 0) return

    setIsSyncing(true)
    try {
      const queue = OfflineQueue.getInstance()
      const result = await queue.processQueue()

      if (result.conflicts.length > 0) {
        // TODO: Show conflict resolution dialog
        console.log('Conflicts detected:', result.conflicts)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  if (queueSize === 0) return null

  const isOffline = connectionStatus?.state !== 'connected'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge
              variant={isOffline ? 'destructive' : 'secondary'}
              className={cn(
                'flex items-center gap-1.5',
                !isOffline && 'animate-pulse'
              )}
            >
              {isOffline ? (
                <CloudOff className="h-3 w-3" />
              ) : isSyncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              <span>{queueSize} pending</span>
            </Badge>
            {!isOffline && !isSyncing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManualSync}
                className="h-7 px-2 text-xs"
              >
                Sync Now
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">
              {isOffline ? 'Working Offline' : 'Syncing Changes'}
            </p>
            <p className="text-sm text-muted-foreground">
              {queueSize} operation{queueSize !== 1 ? 's' : ''} will sync when
              connected
            </p>
            {isOffline && (
              <p className="text-xs text-muted-foreground">
                Changes are saved locally and will sync automatically
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
