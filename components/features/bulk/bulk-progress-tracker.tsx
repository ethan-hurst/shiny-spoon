'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface BulkProgressTrackerProps {
  operationId: string
  onComplete?: () => void
  showRollbackButton?: boolean
}

interface ProgressData {
  operationId: string
  type?: string
  status: string
  totalRecords: number
  processedRecords: number
  successfulRecords: number
  failedRecords: number
  estimatedTimeRemaining?: number
  percentage?: number
  rollbackProgress?: {
    total: number
    processed: number
    successful: number
    failed: number
    percentage: number
  }
}

/**
 * Displays and tracks the real-time progress of a bulk operation, including rollback support and error handling.
 *
 * Subscribes to server-sent events for live updates on the operation's status, progress, and rollback state. Provides a UI with progress indicators, status badges, and a rollback button when applicable. Handles connection errors with automatic reconnection attempts and displays error messages if the connection fails.
 *
 * @param operationId - The unique identifier for the bulk operation to track.
 * @param onComplete - Optional callback invoked when the operation or rollback completes, fails, or is cancelled.
 * @param showRollbackButton - Whether to display the rollback button when eligible (default: true).
 *
 * @returns A React component rendering the progress tracker UI for the specified bulk operation.
 */
export function BulkProgressTracker({
  operationId,
  onComplete,
  showRollbackButton = true,
}: BulkProgressTrackerProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [rollbackProgress, setRollbackProgress] = useState<ProgressData | null>(
    null
  )
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!operationId) return

    let eventSource: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let isMounted = true
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    const reconnectDelay = 3000 // 3 seconds

    const createEventSource = () => {
      if (!isMounted) return

      eventSource = new EventSource(`/api/bulk/progress/${operationId}`)

      eventSource.onmessage = (event) => {
        if (!isMounted) return

        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case 'initial':
            case 'progress':
              setProgress(data.progress)
              setError(null) // Clear error on successful message
              reconnectAttempts = 0 // Reset reconnect attempts on success
              if (
                data.progress.status === 'completed' ||
                data.progress.status === 'failed' ||
                data.progress.status === 'cancelled'
              ) {
                onComplete?.()
              }
              break

            case 'rollback-progress':
              setRollbackProgress(data.progress)
              setIsRollingBack(true)
              if (data.progress.status === 'rolled_back') {
                setIsRollingBack(false)
                onComplete?.()
              }
              break
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err)
          if (isMounted) {
            setError('Failed to parse progress data')
          }
        }
      }

      eventSource.onerror = (err) => {
        console.error('SSE error:', err)
        eventSource?.close()
        
        if (!isMounted) return

        // Attempt reconnection if not at max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          setError(`Connection lost. Reconnecting... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)
          
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              createEventSource()
            }
          }, reconnectDelay)
        } else {
          setError('Connection lost. Please refresh the page.')
        }
      }

      eventSource.onopen = () => {
        if (isMounted && reconnectAttempts > 0) {
          setError(null) // Clear error on successful reconnection
        }
      }
    }

    createEventSource()

    return () => {
      isMounted = false
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [operationId, onComplete])

  const handleRollback = async () => {
    // Guard against multiple rollback requests
    if (isRollingBack) {
      return
    }

    try {
      setIsRollingBack(true)
      
      const response = await fetch('/api/bulk/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId }),
      })

      if (!response.ok) {
        throw new Error('Failed to start rollback')
      }
    } catch (err) {
      setIsRollingBack(false)
      setError(err instanceof Error ? err.message : 'Failed to start rollback')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />
      case 'rolled_back':
        return <RotateCcw className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusVariant = (status: string, isRollback: boolean = false) => {
    if (isRollback) return 'destructive' as const
    
    switch (status) {
      case 'completed':
        return 'success' as const
      case 'failed':
        return 'destructive' as const
      case 'processing':
        return 'default' as const
      case 'cancelled':
        return 'secondary' as const
      case 'rolled_back':
        return 'outline' as const
      default:
        return 'secondary' as const
    }
  }

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Calculating...'
    if (seconds < 60) return `${Math.ceil(seconds)}s remaining`
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m remaining`
    return `${Math.ceil(seconds / 3600)}h remaining`
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentProgress = rollbackProgress || progress
  if (!currentProgress) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const percentage =
    rollbackProgress?.percentage ||
    (currentProgress.totalRecords > 0
      ? (currentProgress.processedRecords / currentProgress.totalRecords) * 100
      : 0)

  return (
    <Card className={rollbackProgress ? 'border-orange-200' : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(currentProgress.status)}
            <CardTitle className="text-base">
              Operation {operationId.slice(0, 8)}...
            </CardTitle>
            <Badge variant={getStatusVariant(currentProgress.status, !!rollbackProgress)}>
              {rollbackProgress ? 'Rolling Back' : currentProgress.status}
            </Badge>
          </div>

          {showRollbackButton &&
            progress?.status === 'completed' &&
            !rollbackProgress && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRollback}
                disabled={isRollingBack}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                {isRollingBack ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rollback
                  </>
                )}
              </Button>
            )}
        </div>

        {rollbackProgress && (
          <CardDescription>
            Rolling back changes from completed operation
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(percentage)}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {currentProgress.processedRecords.toLocaleString()} /{' '}
              {currentProgress.totalRecords.toLocaleString()} records
            </span>
            {currentProgress.estimatedTimeRemaining && currentProgress.status === 'processing' && (
              <span>
                {formatTimeRemaining(currentProgress.estimatedTimeRemaining)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-green-600">
              ✓ {currentProgress.successfulRecords.toLocaleString()} successful
            </div>
            {currentProgress.failedRecords > 0 && (
              <div className="text-red-600">
                ✗ {currentProgress.failedRecords.toLocaleString()} failed
              </div>
            )}
          </div>

          {currentProgress.status === 'processing' && (
            <div className="text-xs text-muted-foreground">
              {rollbackProgress 
                ? 'Undoing changes in reverse order for data integrity'
                : 'Processing in batches for optimal performance'
              }
            </div>
          )}
        </div>

        {currentProgress.status === 'completed' && !rollbackProgress && (
          <div className="text-xs text-muted-foreground bg-green-50 p-2 rounded">
            ✅ Operation completed successfully. All changes have been applied.
          </div>
        )}

        {currentProgress.status === 'failed' && (
          <div className="text-xs text-muted-foreground bg-red-50 p-2 rounded">
            ❌ Operation failed. Check the error log for details.
          </div>
        )}

        {currentProgress.status === 'rolled_back' && (
          <div className="text-xs text-muted-foreground bg-orange-50 p-2 rounded">
            ↩️ Operation rolled back successfully. All changes have been undone.
          </div>
        )}
      </CardContent>
    </Card>
  )
}