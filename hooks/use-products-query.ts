import { useQuery } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/supabase/types/database'

type ProductWithPricing = Database['public']['Tables']['products']['Row'] & {
  product_pricing: Database['public']['Tables']['product_pricing']['Row'][]
}

export interface ProductOption {
  id: string
  sku: string
  name: string
  base_price: number
}

/**
 * Fetches a list of products with their pricing information using React Query.
 *
 * Returns a query object that provides an array of product options, each containing the product's ID, SKU, name, and base price. The data is cached and managed according to specified query options for freshness and retry behavior.
 *
 * @returns A React Query result containing an array of product options with pricing details
 */
export function useProductsQuery() {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<ProductOption[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_pricing(*)')
        .order('sku', { ascending: true })

      if (error) {
        throw error
      }

      // Map to the format expected by contract-dialog.tsx
      return (data as ProductWithPricing[]).map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        base_price: product.product_pricing?.[0]?.base_price || 0
      }))
    },
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // Keep cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus for products
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  })
}