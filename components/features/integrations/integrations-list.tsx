'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
        {integrations.map((integration) => (
          <IntegrationItem
            key={integration.id}
            integration={integration}
            onSync={handleSync}
            onToggleStatus={handleToggleStatus}
            onDelete={setDeleteId}
            isLoading={loading === integration.id}
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