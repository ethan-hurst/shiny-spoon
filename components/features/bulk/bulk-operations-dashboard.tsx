'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  FileUp,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createBrowserClient } from '@/lib/supabase/client'
import { BulkProgressTracker } from './bulk-progress-tracker'
import { BulkUploadDialog } from './bulk-upload-dialog'
import type { BulkOperation } from '@/types/bulk-operations.types'
import type { Row } from '@tanstack/react-table'

interface ErrorLogEntry {
  message: string
  timestamp?: string
  details?: any
}

/**
 * Displays a dashboard for managing and monitoring bulk data operations.
 *
 * Provides a user interface to view the status and history of bulk operations, initiate new uploads, cancel or rollback operations, and inspect or download error logs. Integrates with a Supabase backend and supports real-time updates and user feedback.
 */
export function BulkOperationsDashboard() {
  const [selectedOperation, setSelectedOperation] = useState<string | null>(
    null
  )
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [selectedErrorLog, setSelectedErrorLog] = useState<ErrorLogEntry[]>([])
  const [selectedOperationId, setSelectedOperationId] = useState<string>('')
  const supabase = createBrowserClient()

  const { data: operations, refetch } = useQuery({
    queryKey: ['bulk-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulk_operations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (operationId: string) => {
      const response = await fetch(`/api/bulk/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId }),
      })

      if (!response.ok) {
        // Parse error response
        let errorMessage = 'Failed to cancel operation'
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage)
      }
    },
    onSuccess: () => {
      toast.success('Operation cancelled')
      refetch()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const rollbackMutation = useMutation({
    mutationFn: async (operationId: string) => {
      const response = await fetch(`/api/bulk/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId }),
      })

      if (!response.ok) {
        // Parse error response
        let errorMessage = 'Failed to rollback operation'
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage)
      }
    },
    onSuccess: () => {
      toast.success('Rollback initiated')
      refetch()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

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

  const getStatusVariant = (status: string) => {
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

  const columns = [
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }: { row: Row<BulkOperation> }) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(row.original.status)}
          <Badge variant={getStatusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        </div>
      ),
    },
    {
      header: 'Type',
      cell: ({ row }: { row: Row<BulkOperation> }) => (
        <div>
          <div className="font-medium capitalize">
            {row.original.operation_type} {row.original.entity_type}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.original.file_name}
          </div>
        </div>
      ),
    },
    {
      header: 'Progress',
      cell: ({ row }: { row: Row<BulkOperation> }) => {
        const total = row.original.total_records || 0
        const processed = row.original.processed_records || 0
        const percentage = total > 0 ? (processed / total) * 100 : 0

        return (
          <div className="space-y-1">
            <Progress value={percentage} className="w-[100px]" />
            <div className="text-xs text-muted-foreground">
              {processed} / {total}
            </div>
          </div>
        )
      },
    },
    {
      header: 'Results',
      cell: ({ row }: { row: Row<BulkOperation> }) => (
        <div className="text-sm">
          <div className="text-green-600">
            ✓ {row.original.successful_records || 0}
          </div>
          {(row.original.failed_records || 0) > 0 && (
            <div className="text-red-600">✗ {row.original.failed_records}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Created',
      cell: ({ row }: { row: Row<BulkOperation> }) => (
        <div className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.created_at), {
            addSuffix: true,
          })}
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: ({ row }: { row: Row<BulkOperation> }) => (
        <div className="flex items-center gap-2">
          {row.original.status === 'processing' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelMutation.mutate(row.original.id)}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
          )}
          {row.original.status === 'completed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => rollbackMutation.mutate(row.original.id)}
              disabled={rollbackMutation.isPending}
            >
              Rollback
            </Button>
          )}
          {row.original.error_log?.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedErrorLog(row.original.error_log || [])
                setSelectedOperationId(row.original.id)
                setErrorDialogOpen(true)
              }}
              title="View error details"
            >
              <AlertCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk Operations</h2>
          <p className="text-muted-foreground">
            Import, export, and update data in bulk
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <FileUp className="mr-2 h-4 w-4" />
          New Bulk Operation
        </Button>
      </div>

      {/* Active Operations */}
      {operations?.some((op) => op.status === 'processing') && (
        <Card>
          <CardHeader>
            <CardTitle>Active Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {operations
              .filter((op) => op.status === 'processing')
              .map((op) => (
                <BulkProgressTracker
                  key={op.id}
                  operationId={op.id}
                  onComplete={() => refetch()}
                />
              ))}
          </CardContent>
        </Card>
      )}

      {/* Operations History */}
      <Card>
        <CardHeader>
          <CardTitle>Operation History</CardTitle>
          <CardDescription>
            Recent bulk operations and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operations && operations.length > 0 ? (
            <DataTable 
              columns={columns} 
              data={operations || []}
              searchKey="file_name"
            />
          ) : (
            <div className="text-center py-8">
              <FileUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No operations yet</h3>
              <p className="text-muted-foreground">
                Start your first bulk operation to see it here.
              </p>
              <Button 
                onClick={() => setUploadDialogOpen(true)} 
                className="mt-4"
              >
                <FileUp className="mr-2 h-4 w-4" />
                New Bulk Operation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <BulkUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => {
          refetch()
          setUploadDialogOpen(false)
        }}
      />

      {/* Error Details Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Error Log Details</DialogTitle>
            <DialogDescription>
              Operation ID: {selectedOperationId}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            <div className="space-y-2">
              {selectedErrorLog.map((error, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-3 text-sm space-y-1"
                >
                  <div className="font-medium text-destructive">
                    {error.message}
                  </div>
                  {error.timestamp && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(error.timestamp).toLocaleString()}
                    </div>
                  )}
                  {error.details && (
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setErrorDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                // Download error log as JSON
                const dataStr = JSON.stringify(selectedErrorLog, null, 2)
                const dataBlob = new Blob([dataStr], { type: 'application/json' })
                const url = URL.createObjectURL(dataBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = `error-log-${selectedOperationId}.json`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
                toast.success('Error log downloaded')
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Log
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}