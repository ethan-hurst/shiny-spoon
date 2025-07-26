'use client'

import { useQuery } from '@tanstack/react-query'
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
  refetch: () => void
}

async function fetchProducts() {
  const supabase = createBrowserClient()
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_pricing (
        base_price
      )
    `)
    .eq('is_active', true)
    .order('name')

  if (error) {
    throw new Error(error.message || 'Failed to fetch products')
  }

  return data || []
}

export function useContractData(): UseContractDataReturn {
  const { data: products = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['contract-products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  return { 
    products, 
    loading, 
    error: error instanceof Error ? error : null,
    refetch: () => { refetch() }
  }
}