'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row'] & {
  product_pricing: Array<{
    base_price: number
  }>
}

interface UseContractDataReturn {
  products: Product[]
  loading: boolean
  error: Error | null
}

export function useContractData(): UseContractDataReturn {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('products')
          .select(`
            *,
            product_pricing (
              base_price
            )
          `)
          .eq('is_active', true)
          .order('name')

        if (fetchError) throw fetchError

        setProducts(data || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch products'))
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [supabase])

  return { products, loading, error }
}