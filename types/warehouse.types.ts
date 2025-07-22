import { z } from 'zod'
import { Database } from '@/types/database.types'

export type Warehouse = Database['public']['Tables']['warehouses']['Row']
export type WarehouseInsert =
  Database['public']['Tables']['warehouses']['Insert']
export type WarehouseUpdate =
  Database['public']['Tables']['warehouses']['Update']

// Address structure
export interface Address {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
}

// Contact structure
export interface Contact {
  name: string
  role: string
  email?: string
  phone?: string
  isPrimary: boolean
}

// Extended warehouse type with parsed JSON
export interface WarehouseWithDetails
  extends Omit<Warehouse, 'address' | 'contact'> {
  address: Address
  contact: Contact[]
  inventory_count?: number
}

export interface WarehouseFilters {
  search?: string
  active?: boolean
  state?: string
}
