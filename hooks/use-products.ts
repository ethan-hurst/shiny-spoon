'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Product,
  ProductFilters,
  ProductWithStats,
} from '@/types/product.types'

// Define types for the inventory item structure from the database
interface InventoryItem {
  quantity: number
  reserved_quantity: number
}

// Define type for product with inventory relation
interface ProductWithInventory extends Product {
  inventory: InventoryItem[]
}

export function useProducts(initialData?: ProductWithStats[]) {
  const [products, setProducts] = useState<ProductWithStats[]>(
    initialData || []
  )
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
        query = query.or(
          `sku.ilike.%${filters.search}%,name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        )
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

      const { data, error } = await query.order('created_at', {
        ascending: false,
      })

      if (error) {
        toast.error('Failed to fetch products')
        console.error('Error fetching products:', error)
        return
      }

      // Transform products to include stats
      const productsWithStats = (data || []).map(
        (product: ProductWithInventory): ProductWithStats => {
          const inventoryItems = product.inventory || []
          const totalQuantity = inventoryItems.reduce(
            (sum: number, item: InventoryItem) => sum + (item.quantity || 0),
            0
          )
          const totalReserved = inventoryItems.reduce(
            (sum: number, item: InventoryItem) =>
              sum + (item.reserved_quantity || 0),
            0
          )
          const availableQuantity = totalQuantity - totalReserved

          return {
            ...product,
            inventory_count: inventoryItems.length,
            total_quantity: totalQuantity,
            available_quantity: availableQuantity,
            low_stock: totalQuantity < 10,
          }
        }
      )

      setProducts(productsWithStats)
    } catch (error) {
      toast.error('An error occurred while fetching products')
    } finally {
      setIsLoading(false)
    }
  }, [filters, supabase])

  const deleteProduct = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from('products')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', id)

        if (error) throw error

        toast.success('Product deleted successfully')

        // Update local state
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, active: false } : p))
        )

        router.refresh()
      } catch (error) {
        toast.error('Failed to delete product')
        console.error('Error deleting product:', error)
      }
    },
    [supabase, router]
  )

  const exportProducts = useCallback(async () => {
    try {
      const csvHeaders = [
        'SKU',
        'Name',
        'Description',
        'Category',
        'Base Price',
        'Cost',
        'Weight',
        'Status',
      ]
      const csvRows = products.map((product) => [
        product.sku,
        product.name,
        product.description || '',
        product.category || '',
        product.base_price || '0',
        product.cost || '0',
        product.weight || '0',
        product.active ? 'Active' : 'Inactive',
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
        ...csvRows.map((row) =>
          row.map((cell) => escapeCSVCell(String(cell))).join(',')
        ),
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
    // Subscribe to product changes
    const productChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        async (payload: RealtimePostgresChangesPayload<Product>) => {
          const { eventType, new: newRecord, old: oldRecord } = payload

          switch (eventType) {
            case 'INSERT': {
              if (newRecord) {
                // Fetch inventory data for the new product
                const { data: inventoryData } = await supabase
                  .from('inventory')
                  .select('quantity, reserved_quantity')
                  .eq('product_id', newRecord.id)

                const inventory = inventoryData || []
                const totalQuantity = inventory.reduce(
                  (sum: number, item: { quantity: number }) =>
                    sum + (item.quantity || 0),
                  0
                )
                const totalReserved = inventory.reduce(
                  (sum: number, item: { reserved_quantity: number }) =>
                    sum + (item.reserved_quantity || 0),
                  0
                )

                const newProductWithStats: ProductWithStats = {
                  ...newRecord,
                  inventory_count: inventory.length,
                  total_quantity: totalQuantity,
                  available_quantity: totalQuantity - totalReserved,
                  low_stock: totalQuantity < 10,
                }

                setProducts((prev) => [newProductWithStats, ...prev])
                toast.success(`Product "${newRecord.name}" added`)
              }
              break
            }

            case 'UPDATE': {
              if (newRecord) {
                setProducts((prev) =>
                  prev.map((product) => {
                    if (product.id === newRecord.id) {
                      // Preserve existing inventory stats, only update product fields
                      return {
                        ...product,
                        ...newRecord,
                        // Recalculate low_stock based on existing quantity
                        low_stock: product.total_quantity < 10,
                      }
                    }
                    return product
                  })
                )
              }
              break
            }

            case 'DELETE': {
              if (oldRecord) {
                setProducts((prev) =>
                  prev.filter((product) => product.id !== oldRecord.id)
                )
                toast.info(`Product "${oldRecord.name}" removed`)
              }
              break
            }
          }
        }
      )
      .subscribe()

    // Subscribe to inventory changes that affect product stats
    const inventoryChannel = supabase
      .channel('inventory-changes-for-products')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        async (
          payload: RealtimePostgresChangesPayload<{
            product_id: string
            quantity: number
            reserved_quantity: number
          }>
        ) => {
          const { new: newRecord, old: oldRecord } = payload

          // Type guard to ensure we have product_id
          const productId =
            newRecord && 'product_id' in newRecord
              ? newRecord.product_id
              : oldRecord && 'product_id' in oldRecord
                ? oldRecord.product_id
                : null

          if (productId) {
            // Recalculate stats for the affected product
            const { data: inventoryData } = await supabase
              .from('inventory')
              .select('quantity, reserved_quantity')
              .eq('product_id', productId)

            const inventory = inventoryData || []
            const totalQuantity = inventory.reduce(
              (sum: number, item: { quantity: number }) =>
                sum + (item.quantity || 0),
              0
            )
            const totalReserved = inventory.reduce(
              (sum: number, item: { reserved_quantity: number }) =>
                sum + (item.reserved_quantity || 0),
              0
            )

            setProducts((prev) =>
              prev.map((product) => {
                if (product.id === productId) {
                  return {
                    ...product,
                    inventory_count: inventory.length,
                    total_quantity: totalQuantity,
                    available_quantity: totalQuantity - totalReserved,
                    low_stock: totalQuantity < 10,
                  }
                }
                return product
              })
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(productChannel)
      supabase.removeChannel(inventoryChannel)
    }
  }, [supabase])

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
