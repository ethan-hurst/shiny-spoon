'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'
import { OfflineQueue } from '@/lib/realtime/offline-queue'
import { OptimisticUpdate } from '@/lib/realtime/types'
import { createClient } from '@/lib/supabase/client'

interface InventoryItem {
  id: string
  product_id: string
  warehouse_id: string
  quantity: number
  reserved_quantity: number
  reorder_point?: number
  reorder_quantity?: number
  last_sync?: string
  sync_status?: string
  updated_at: string
  [key: string]: any
}

interface InventoryUpdate {
  id: string
  quantity?: number
  reserved_quantity?: number
  reorder_point?: number
  reorder_quantity?: number
  [key: string]: any
}

/**
 * React hook for managing inventory data with optimistic UI updates, offline queuing, rollback on failure, and real-time synchronization.
 *
 * Provides inventory state, update functions, and status helpers to enable seamless user experience even during network disruptions.
 *
 * @param initialData - Optional initial inventory data to populate the state
 * @returns An object containing the current inventory array, functions for updating inventory (single and batch), status helpers, and the list of pending optimistic updates
 */
export function useOptimisticInventory(initialData?: InventoryItem[]) {
  const [data, setData] = useState<InventoryItem[]>(initialData || [])
  const [pendingUpdates, setPendingUpdates] = useState<
    Map<string, OptimisticUpdate<InventoryItem>>
  >(new Map())
  const supabase = createClient()
  const connectionManager = RealtimeConnectionManager.getInstance()
  const offlineQueue = OfflineQueue.getInstance()
  const rollbackTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const applyOptimisticUpdate = useCallback(
    (
      itemId: string,
      updates: Partial<InventoryItem>
    ): OptimisticUpdate<InventoryItem> => {
      const originalItem = data.find((item) => item.id === itemId)
      if (!originalItem) {
        throw new Error('Item not found')
      }

      const optimisticItem = {
        ...originalItem,
        ...updates,
        updated_at: new Date().toISOString(),
      }
      const optimisticUpdate: OptimisticUpdate<InventoryItem> = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        originalValue: originalItem,
        optimisticValue: optimisticItem,
        status: 'pending',
      }

      // Apply update to state
      setData((prevData) =>
        prevData.map((item) => (item.id === itemId ? optimisticItem : item))
      )

      // Track pending update
      setPendingUpdates((prev) => {
        const newMap = new Map(prev)
        newMap.set(itemId, optimisticUpdate)
        return newMap
      })

      // Set rollback timeout (30 seconds)
      const timeoutId = setTimeout(() => {
        rollbackUpdate(itemId, optimisticUpdate.id)
      }, 30000)

      rollbackTimeouts.current.set(optimisticUpdate.id, timeoutId)

      return optimisticUpdate
    },
    [data]
  )

  const rollbackUpdate = useCallback(
    (itemId: string, updateId: string) => {
      const update = pendingUpdates.get(itemId)
      if (!update || update.id !== updateId) return

      // Rollback to original value
      setData((prevData) =>
        prevData.map((item) =>
          item.id === itemId ? update.originalValue : item
        )
      )

      // Remove from pending
      setPendingUpdates((prev) => {
        const newMap = new Map(prev)
        newMap.delete(itemId)
        return newMap
      })

      // Clear timeout
      const timeoutId = rollbackTimeouts.current.get(updateId)
      if (timeoutId) {
        clearTimeout(timeoutId)
        rollbackTimeouts.current.delete(updateId)
      }

      // Show error message
      toast.error('Update failed. Changes have been reverted.')
    },
    [pendingUpdates]
  )

  const confirmUpdate = useCallback(
    (itemId: string, updateId: string) => {
      const update = pendingUpdates.get(itemId)
      if (!update || update.id !== updateId) return

      // Mark as confirmed
      setPendingUpdates((prev) => {
        const newMap = new Map(prev)
        const confirmedUpdate = { ...update, status: 'confirmed' as const }
        newMap.set(itemId, confirmedUpdate)
        return newMap
      })

      // Clear timeout
      const timeoutId = rollbackTimeouts.current.get(updateId)
      if (timeoutId) {
        clearTimeout(timeoutId)
        rollbackTimeouts.current.delete(updateId)
      }

      // Remove from pending after a short delay
      setTimeout(() => {
        setPendingUpdates((prev) => {
          const newMap = new Map(prev)
          newMap.delete(itemId)
          return newMap
        })
      }, 1000)
    },
    [pendingUpdates]
  )

  const updateInventory = useCallback(
    async (itemId: string, updates: InventoryUpdate) => {
      const connectionStatus = connectionManager.getStatus()

      // Apply optimistic update immediately
      const optimisticUpdate = applyOptimisticUpdate(itemId, updates)

      try {
        if (connectionStatus.state === 'connected') {
          // Online - attempt direct update
          const { data: updatedItem, error } = await supabase
            .from('inventory')
            .update(updates)
            .eq('id', itemId)
            .select()
            .single()

          if (error) throw error

          // Confirm update
          confirmUpdate(itemId, optimisticUpdate.id)

          // Update with server response
          setData((prevData) =>
            prevData.map((item) => (item.id === itemId ? updatedItem : item))
          )

          toast.success('Inventory updated successfully')
        } else {
          // Offline - queue the operation
          const { id: _id, ...updatesWithoutId } = updates
          await offlineQueue.addToQueue({
            type: 'UPDATE',
            table: 'inventory',
            data: { id: itemId, ...updatesWithoutId },
          })

          // Mark as queued
          setPendingUpdates((prev) => {
            const newMap = new Map(prev)
            const queuedUpdate = {
              ...optimisticUpdate,
              status: 'pending' as const,
            }
            newMap.set(itemId, queuedUpdate)
            return newMap
          })

          toast.info('Update saved offline. Will sync when connected.')
        }
      } catch (error) {
        // Rollback on error
        rollbackUpdate(itemId, optimisticUpdate.id)

        const errorMessage =
          error instanceof Error ? error.message : 'Update failed'
        toast.error(errorMessage)

        throw error
      }
    },
    [
      applyOptimisticUpdate,
      confirmUpdate,
      rollbackUpdate,
      supabase,
      connectionManager,
      offlineQueue,
    ]
  )

  const batchUpdate = useCallback(
    async (updates: InventoryUpdate[]) => {
      const updatePromises = updates.map((update) =>
        updateInventory(update.id, update)
      )

      try {
        await Promise.all(updatePromises)
        toast.success(`${updates.length} items updated successfully`)
      } catch (error) {
        // Individual errors are already handled
        console.error('Batch update partially failed:', error)
      }
    },
    [updateInventory]
  )

  const getItemStatus = useCallback(
    (itemId: string): 'pending' | 'confirmed' | 'synced' => {
      const update = pendingUpdates.get(itemId)
      if (!update) return 'synced'
      return update.status === 'confirmed' ? 'confirmed' : 'pending'
    },
    [pendingUpdates]
  )

  const hasPendingUpdates = useCallback((): boolean => {
    return pendingUpdates.size > 0
  }, [pendingUpdates])

  const getPendingCount = useCallback((): number => {
    return pendingUpdates.size
  }, [pendingUpdates])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeout references to prevent memory leaks
      rollbackTimeouts.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      rollbackTimeouts.current.clear()
    }
  }, [])

  return {
    inventory: data,
    updateInventory,
    batchUpdate,
    getItemStatus,
    hasPendingUpdates,
    getPendingCount,
    pendingUpdates: Array.from(pendingUpdates.values()),
  }
}
