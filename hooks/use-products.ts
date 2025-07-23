'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Product, ProductFilters, ProductWithStats } from '@/types/product.types'
import { createClient } from '@/lib/supabase/client'

export function useProducts(initialData?: ProductWithStats[]) {
  const [products, setProducts] = useState<ProductWithStats[]>(initialData || [])
  const [isLoading, setIsLoading] = useState(!initialData)
  const [filters, setFilters] = useState<ProductFilters>({})
  const router = useRouter()
  const supabase = createClient()

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      let query = supabase.from('products').select(`
        *,
        inventory:inventory(
          quantity,
          reserved_quantity
        )
      `)

      // Apply filters
      if (filters.search) {
        query = query.or(`sku.ilike.%${filters.search}%,name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters.category) {
        query = query.eq('category', filters.category)
      }

      if (filters.active !== undefined) {
        query = query.eq('active', filters.active)
      }

      if (filters.priceRange) {
        if (filters.priceRange.min) {
          query = query.gte('base_price', filters.priceRange.min)
        }
        if (filters.priceRange.max) {
          query = query.lte('base_price', filters.priceRange.max)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        toast.error('Failed to fetch products')
        console.error('Error fetching products:', error)
        return
      }

      // Transform products to include stats
      const productsWithStats = (data || []).map((product: any) => {
        const inventoryItems = product.inventory || []
        const totalQuantity = inventoryItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
        const totalReserved = inventoryItems.reduce((sum: number, item: any) => sum + (item.reserved_quantity || 0), 0)
        const availableQuantity = totalQuantity - totalReserved
        
        return {
          ...product,
          inventory_count: inventoryItems.length,
          total_quantity: totalQuantity,
          available_quantity: availableQuantity,
          low_stock: totalQuantity < 10,
        }
      })

      setProducts(productsWithStats)
    } catch (error) {
      toast.error('An error occurred while fetching products')
    } finally {
      setIsLoading(false)
    }
  }, [filters, supabase])

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      toast.success('Product deleted successfully')
      
      // Update local state
      setProducts(prev => prev.map(p => 
        p.id === id ? { ...p, active: false } : p
      ))
      
      router.refresh()
    } catch (error) {
      toast.error('Failed to delete product')
      console.error('Error deleting product:', error)
    }
  }, [supabase, router])

  const exportProducts = useCallback(async () => {
    try {
      const csvHeaders = ['SKU', 'Name', 'Description', 'Category', 'Base Price', 'Cost', 'Weight', 'Status']
      const csvRows = products.map(product => [
        product.sku,
        product.name,
        product.description || '',
        product.category || '',
        product.base_price || '0',
        product.cost || '0',
        product.weight || '0',
        product.active ? 'Active' : 'Inactive'
      ])

      // Escape quotes in CSV cells
      const escapeCSVCell = (cell: string) => {
        // Replace double quotes with two double quotes
        const escaped = cell.toString().replace(/"/g, '""')
        // Wrap in quotes
        return `"${escaped}"`
      }

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => escapeCSVCell(String(cell))).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Products exported successfully')
    } catch (error) {
      toast.error('Failed to export products')
      console.error('Error exporting products:', error)
    }
  }, [products])

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload: any) => {
          // Refresh products when changes occur
          fetchProducts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchProducts])

  return {
    products,
    isLoading,
    filters,
    setFilters,
    fetchProducts,
    deleteProduct,
    exportProducts,
  }
}