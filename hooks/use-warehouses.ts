'use client'

import { useState, useCallback, useEffect } from 'react'
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

  const fetchWarehouses = useCallback(async () => {
    setIsLoading(true)
    try {
      let query = supabase.from('warehouses').select(`
        *,
        inventory:inventory(count)
      `)

      // Apply filters
      if (filters.search) {
        query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
      }

      if (filters.active !== undefined) {
        query = query.eq('active', filters.active)
      }

      if (filters.state) {
        query = query.ilike('address->state', `%${filters.state}%`)
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
  }, [filters, supabase])

  const deleteWarehouse = useCallback(async (id: string) => {
    try {
      // Check if warehouse has inventory
      const { data: inventoryCount } = await supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('warehouse_id', id)

      if (inventoryCount && inventoryCount > 0) {
        toast.error('Cannot delete warehouse with existing inventory')
        return
      }

      // Soft delete by setting active to false
      const { error } = await supabase
        .from('warehouses')
        .update({ active: false, updated_at: new Date().toISOString() })
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
      // First, unset any existing default warehouse
      await supabase
        .from('warehouses')
        .update({ is_default: false })
        .eq('is_default', true)

      // Then set the new default
      const { error } = await supabase
        .from('warehouses')
        .update({ is_default: true })
        .eq('id', id)

      if (error) throw error

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
          // Refresh warehouses when changes occur
          fetchWarehouses()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchWarehouses])

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