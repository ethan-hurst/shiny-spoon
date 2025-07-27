'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
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
import type { IntegrationFull } from '@/types/integration.types'
import { IntegrationItem } from './integration-item'

interface IntegrationsListProps {
  integrations: IntegrationFull[]
}

// Helper to get CSRF token
const getCSRFToken = () => {
  // Get CSRF token from cookie
  const match = document.cookie.match(/csrf-token=([^;]+)/)
  return match ? match[1] : null
}

// API functions
const syncIntegration = async (id: string, signal?: AbortSignal) => {
  const csrfToken = getCSRFToken()
  const response = await fetch(`/api/integrations/${id}/sync`, {
    method: 'POST',
    headers: {
      'x-csrf-token': csrfToken || '',
    },
    signal, // Add abort signal support
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

  return response.json()
}

const updateIntegrationStatus = async ({ id, status }: { id: string; status: string }) => {
  const csrfToken = getCSRFToken()
  const response = await fetch(`/api/integrations/${id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken || '',
    },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    throw new Error('Failed to update status')
  }

  return response.json()
}

const deleteIntegration = async (id: string) => {
  const csrfToken = getCSRFToken()
  const response = await fetch(`/api/integrations/${id}`, {
    method: 'DELETE',
    headers: {
      'x-csrf-token': csrfToken || '',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to delete integration')
  }

  return response.json()
}

/**
 * Displays a list of integrations with options to sync, activate/pause, and delete each integration.
 *
 * Provides UI controls and confirmation dialogs for managing integrations, including starting a sync process, toggling activation status, and deleting integrations. Handles API interactions, loading states, and user feedback for each action.
 *
 * @param integrations - The array of integration objects to display and manage
 */
export function IntegrationsList({ integrations }: IntegrationsListProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  // Ref to store abort controller for sync requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any in-flight sync request when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: ({ id, signal }: { id: string; signal: AbortSignal }) => 
      syncIntegration(id, signal),
    onSuccess: (data) => {
      toast.success(data.message || 'Sync started successfully')
      // Invalidate and refetch integrations
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      router.refresh()
    },
    onError: (error: Error) => {
      // Don't show error toast for aborted requests
      if (error.name !== 'AbortError') {
        toast.error(error.message || 'Failed to start sync')
      }
    },
    onSettled: () => {
      // Clear the abort controller reference
      abortControllerRef.current = null
    },
  })

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: updateIntegrationStatus,
    onSuccess: (_, variables) => {
      const newStatus = variables.status
      toast.success(`Integration ${newStatus === 'active' ? 'activated' : 'paused'}`)
      // Invalidate and refetch integrations
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      router.refresh()
    },
    onError: () => {
      toast.error('Failed to update status')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => {
      toast.success('Integration deleted successfully')
      setDeleteId(null)
      // Invalidate and refetch integrations
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      router.refresh()
    },
    onError: () => {
      toast.error('Failed to delete integration')
    },
    onSettled: () => {
      setDeleteId(null)
    },
  })

  const handleSync = (id: string) => {
    // Cancel any existing sync request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    // Start the sync with the abort signal
    syncMutation.mutate({ id, signal: abortController.signal })
  }

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    statusMutation.mutate({ id, status: newStatus })
  }

  const handleDelete = () => {
    if (!deleteId) return
    deleteMutation.mutate(deleteId)
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
        {integrations.map((integration) => (
          <IntegrationItem
            key={integration.id}
            integration={integration}
            onSync={handleSync}
            onToggleStatus={handleToggleStatus}
            onDelete={setDeleteId}
            isLoading={
              (syncMutation.isPending && syncMutation.variables?.id === integration.id) ||
              (statusMutation.isPending && statusMutation.variables?.id === integration.id) ||
              (deleteMutation.isPending && deleteMutation.variables === integration.id)
            }
          />
        ))}
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