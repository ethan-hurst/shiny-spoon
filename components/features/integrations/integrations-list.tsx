'use client'

import { useState } from 'react'
import { MoreHorizontal, Play, Pause, RefreshCw, Settings, Trash } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { IntegrationFull, SyncJob } from '@/types/integration.types'

interface IntegrationsListProps {
  integrations: IntegrationFull[]
}

const platformIcons: Record<string, string> = {
  shopify: '🛍️',
  netsuite: '📊',
  quickbooks: '💰',
  sap: '🏢',
  dynamics365: '💼',
  custom: '🔧',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  error: 'bg-red-100 text-red-800',
  configuring: 'bg-blue-100 text-blue-800',
  suspended: 'bg-yellow-100 text-yellow-800',
}

export function IntegrationsList({ integrations }: IntegrationsListProps) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const handleSync = async (id: string) => {
    const abortController = new AbortController()
    setLoading(id)
    
    try {
      const response = await fetch(`/api/integrations/${id}/sync`, {
        method: 'POST',
        signal: abortController.signal,
      })

      if (!response.ok) {
        let errorMessage = 'Failed to start sync'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      toast.success(data.message || 'Sync started successfully')
      router.refresh()
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('Sync request was cancelled')
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('Failed to start sync')
      }
    } finally {
      setLoading(null)
    }
    
    // Return abort controller for cleanup if needed
    return () => abortController.abort()
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setLoading(id)
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      const response = await fetch(`/api/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      toast.success(`Integration ${newStatus === 'active' ? 'activated' : 'paused'}`)
      router.refresh()
    } catch (error) {
      toast.error('Failed to update status')
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setLoading(deleteId)
    try {
      const response = await fetch(`/api/integrations/${deleteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete integration')
      }

      toast.success('Integration deleted successfully')
      router.refresh()
    } catch (error) {
      toast.error('Failed to delete integration')
    } finally {
      setLoading(null)
      setDeleteId(null)
    }
  }

  if (integrations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          No integrations configured yet
        </p>
        <Link href="/integrations/new">
          <Button>Add your first integration</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y">
        {integrations.map((integration) => {
          const isLoading = loading === integration.id
          const lastSyncDate = integration.last_sync_at
            ? new Date(integration.last_sync_at)
            : null
          const hasError = integration.status === 'error'
          const runningJobs = integration.sync_jobs?.filter(
            (job) => (job as SyncJob).status === 'running'
          ).length || 0

          return (
            <div
              key={integration.id}
              className="p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-xl">
                      {platformIcons[integration.platform] || '🔗'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/integrations/${integration.id}`}
                        className="font-medium hover:underline"
                      >
                        {integration.name}
                      </Link>
                      <Badge
                        variant="secondary"
                        className={statusColors[integration.status]}
                      >
                        {integration.status}
                      </Badge>
                      {runningJobs > 0 && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          Syncing
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="capitalize">{integration.platform}</span>
                      {lastSyncDate && (
                        <>
                          <span>•</span>
                          <span>
                            Last sync: {format(lastSyncDate, 'MMM d, h:mm a')}
                          </span>
                        </>
                      )}
                      {hasError && integration.error_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600">
                            {integration.error_count} errors
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSync(integration.id)}
                    disabled={isLoading || integration.status !== 'active'}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Sync Now
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isLoading}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(integration.id, integration.status)}
                      >
                        {integration.status === 'active' ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause Integration
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Activate Integration
                          </>
                        )}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem asChild>
                        <Link href={`/integrations/${integration.id}/settings`}>
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem asChild>
                        <Link href={`/integrations/${integration.id}/logs`}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          View Logs
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setDeleteId(integration.id)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the integration and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}