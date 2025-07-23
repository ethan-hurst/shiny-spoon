'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Warehouse, WarehouseFilters } from '@/types/warehouse.types'

export function useWarehouses(initialData?: Warehouse[]) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialData || [])
  const [isLoading, setIsLoading] = useState(!initialData)
  const [filters, setFilters] = useState<WarehouseFilters>({})
  const router = useRouter()
  const supabase = createClient()
  const debounceTimerRef = useRef<number | null>(null)

  const fetchWarehouses = useCallback(async (currentFilters?: WarehouseFilters) => {
    setIsLoading(true)
    try {
      const filtersToUse = currentFilters || filters
      let query = supabase.from('warehouses').select(`
        *,
        inventory:inventory(count)
      `)

      // Apply filters
      if (filtersToUse.search) {
        query = query.or(`code.ilike.%${filtersToUse.search}%,name.ilike.%${filtersToUse.search}%`)
      }

      if (filtersToUse.active !== undefined) {
        query = query.eq('active', filtersToUse.active)
      }

      if (filtersToUse.state) {
        query = query.ilike('address->state', `%${filtersToUse.state}%`)
      }

      const { data, error } = await query
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Failed to fetch warehouses')
        console.error('Error fetching warehouses:', error)
        return
      }

      setWarehouses(data || [])
    } catch (error) {
      toast.error('An error occurred while fetching warehouses')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, filters])

  const deleteWarehouse = useCallback(async (id: string) => {
    try {
      // Check if warehouse has inventory
      const { count, error: countError } = await supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('warehouse_id', id)

      if (countError) {
        toast.error('Failed to check inventory')
        return
      }

      if (count && count > 0) {
        toast.error('Cannot delete warehouse with existing inventory')
        return
      }

      // Soft delete by setting active to false
      const { error } = await supabase
        .from('warehouses')
        .update({ active: false })
        .eq('id', id)

      if (error) throw error

      toast.success('Warehouse deactivated successfully')
      
      // Update local state
      setWarehouses(prev => prev.map(w => 
        w.id === id ? { ...w, active: false } : w
      ))
      
      router.refresh()
    } catch (error) {
      toast.error('Failed to deactivate warehouse')
      console.error('Error deactivating warehouse:', error)
    }
  }, [supabase, router])

  const setDefaultWarehouse = useCallback(async (id: string) => {
    try {
      // Get user's organization ID for the RPC call
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthorized')

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (!profile) throw new Error('User profile not found')

      // Use RPC for atomic operation (assuming the function exists)
      // If RPC doesn't exist, use transaction-like approach
      const { error: rpcError } = await supabase
        .rpc('set_default_warehouse', {
          warehouse_id: id,
          org_id: profile.organization_id
        })

      if (rpcError) {
        // Fallback to sequential updates with proper error handling
        const { error: unsetError } = await supabase
          .from('warehouses')
          .update({ is_default: false })
          .eq('organization_id', profile.organization_id)
          .eq('is_default', true)

        if (unsetError) {
          throw new Error('Failed to unset current default warehouse')
        }

        // Then set the new default
        const { error: setError } = await supabase
          .from('warehouses')
          .update({ is_default: true })
          .eq('id', id)
          .eq('organization_id', profile.organization_id)

        if (setError) {
          // Try to restore the previous state
          toast.error('Failed to set new default warehouse')
          console.error('Error setting default warehouse:', setError)
          return
        }
      }

      toast.success('Default warehouse updated')
      
      // Update local state
      setWarehouses(prev => prev.map(w => ({
        ...w,
        is_default: w.id === id
      })))
      
      router.refresh()
    } catch (error) {
      toast.error('Failed to set default warehouse')
      console.error('Error setting default warehouse:', error)
    }
  }, [supabase, router])

  // Fetch warehouses when filters change
  useEffect(() => {
    fetchWarehouses(filters)
  }, [filters, fetchWarehouses])

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('warehouses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warehouses'
        },
        (payload) => {
          // Handle different event types efficiently
          const { eventType, new: newRecord, old: oldRecord } = payload

          // Clear any existing debounce timer
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current)
          }

          // Update local state directly for simple changes
          if (eventType === 'UPDATE' && newRecord) {
            setWarehouses(prev => prev.map(w => 
              w.id === newRecord.id ? { ...w, ...newRecord } : w
            ))
          } else if (eventType === 'INSERT' && newRecord) {
            setWarehouses(prev => [...prev, newRecord as Warehouse])
          } else if (eventType === 'DELETE' && oldRecord) {
            setWarehouses(prev => prev.filter(w => w.id !== oldRecord.id))
          } else {
            // For complex changes or when unsure, debounce the full refresh
            debounceTimerRef.current = window.setTimeout(() => {
              fetchWarehouses()
            }, 500)
          }
        }
      )
      .subscribe()

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return {
    warehouses,
    isLoading,
    filters,
    setFilters,
    fetchWarehouses,
    deleteWarehouse,
    setDefaultWarehouse,
  }
}