import { z } from 'zod'
import { Database } from '@/types/database.types'

export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export interface ProductFilters {
  search?: string
  category?: string
  active?: boolean
  priceRange?: {
    min: number
    max: number
  }
}

export interface ProductWithStats extends Product {
  inventory_count: number
  total_quantity: number
  available_quantity: number
  low_stock: boolean
}
