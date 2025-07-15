'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import type { InventoryWithRelations } from '@/types/inventory.types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface UseInventoryOptions {
  organizationId: string
  warehouseId?: string
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void
}

export function useInventoryRealtime({
  organizationId,
  warehouseId,
  onUpdate,
  onInsert,
  onDelete,
}: UseInventoryOptions) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createBrowserClient()

  const handleRealtimeUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      // Check if the update is for our organization
      if (payload.new?.organization_id !== organizationId) return

      // Check if warehouse filter is applied and matches
      if (warehouseId && payload.new?.warehouse_id !== warehouseId) return

      switch (payload.eventType) {
        case 'UPDATE':
          if (onUpdate) {
            onUpdate(payload)
          } else {
            // Default behavior: refresh the page
            router.refresh()
            toast({
              title: 'Inventory Updated',
              description: 'The inventory has been updated by another user.',
            })
          }
          break

        case 'INSERT':
          if (onInsert) {
            onInsert(payload)
          } else {
            router.refresh()
            toast({
              title: 'New Inventory Item',
              description: 'A new inventory item has been added.',
            })
          }
          break

        case 'DELETE':
          if (onDelete) {
            onDelete(payload)
          } else {
            router.refresh()
            toast({
              title: 'Inventory Item Removed',
              description: 'An inventory item has been removed.',
            })
          }
          break
      }
    },
    [organizationId, warehouseId, onUpdate, onInsert, onDelete, router, toast]
  )

  useEffect(() => {
    // Set up real-time subscription for inventory changes
    const inventoryChannel = supabase
      .channel(`inventory-changes-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `organization_id=eq.${organizationId}`,
        },
        handleRealtimeUpdate
      )
      .subscribe()

    // Set up subscription for adjustment changes (to track who's making changes)
    const adjustmentChannel = supabase
      .channel(`adjustment-changes-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_adjustments',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          // Refresh when adjustments are made
          router.refresh()
        }
      )
      .subscribe()

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(inventoryChannel)
      supabase.removeChannel(adjustmentChannel)
    }
  }, [organizationId, handleRealtimeUpdate, router, supabase])

  // Function to manually trigger a refresh
  const refreshInventory = useCallback(() => {
    router.refresh()
  }, [router])

  // Function to subscribe to a specific inventory item
  const subscribeToItem = useCallback(
    (inventoryId: string, callback: (payload: RealtimePostgresChangesPayload<any>) => void) => {
      const channel = supabase
        .channel(`inventory-item-${inventoryId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory',
            filter: `id=eq.${inventoryId}`,
          },
          callback
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    },
    [supabase]
  )

  return {
    refreshInventory,
    subscribeToItem,
  }
}

// Hook for optimistic updates
export function useOptimisticInventory(
  initialData: InventoryWithRelations[],
  organizationId: string
) {
  const router = useRouter()
  const { toast } = useToast()

  // This is a simplified version - in production you'd want to use React's useOptimistic
  // or a state management library like Zustand for more complex optimistic updates

  const updateInventoryOptimistically = useCallback(
    async (
      inventoryId: string,
      newQuantity: number,
      onSuccess?: () => void,
      onError?: (error: Error) => void
    ) => {
      try {
        // Optimistically update the UI
        router.refresh()

        // You would typically update local state here immediately
        // and then revert if the server update fails

        if (onSuccess) onSuccess()
      } catch (error) {
        console.error('Failed to update inventory:', error)
        toast({
          title: 'Update Failed',
          description: 'Failed to update inventory. Please try again.',
          variant: 'destructive',
        })
        
        // Revert optimistic update
        router.refresh()
        
        if (onError) onError(error as Error)
      }
    },
    [router, toast]
  )

  return {
    updateInventoryOptimistically,
  }
}