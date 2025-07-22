import { z } from 'zod'
import { Database } from '@/types/database.types'

// Database types
export type Inventory = Database['public']['Tables']['inventory']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Warehouse = Database['public']['Tables']['warehouses']['Row']

// Extended types with relations
export interface InventoryWithRelations extends Inventory {
  product: Product
  warehouse: Warehouse
}

export interface InventoryAdjustment {
  id: string
  inventory_id: string
  organization_id: string
  previous_quantity: number
  new_quantity: number
  adjustment: number
  reason: AdjustmentReason
  notes?: string | null
  created_at: string
  created_by: string
  user_full_name?: string
  user_email?: string
}

export type AdjustmentReason =
  | 'sale'
  | 'return'
  | 'damage'
  | 'theft'
  | 'found'
  | 'transfer_in'
  | 'transfer_out'
  | 'cycle_count'
  | 'other'

// Validation schemas
export const adjustmentReasonSchema = z.enum([
  'sale',
  'return',
  'damage',
  'theft',
  'found',
  'transfer_in',
  'transfer_out',
  'cycle_count',
  'other',
])

export const adjustmentSchema = z.object({
  inventory_id: z.string().uuid('Invalid inventory ID'),
  new_quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative')
    .max(999999, 'Quantity cannot exceed 999,999'),
  reason: adjustmentReasonSchema,
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .nullable(),
})

export const bulkUpdateItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  warehouse_code: z.string().min(1, 'Warehouse code is required'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative'),
  reason: z.enum(['cycle_count', 'other'] as const),
})

export const bulkUpdateSchema = z.object({
  updates: z
    .array(bulkUpdateItemSchema)
    .min(1, 'At least one update is required')
    .max(10000, 'Cannot process more than 10,000 items at once'),
})

// Filter types
export interface InventoryFilters {
  warehouse_id?: string
  search?: string
  low_stock_only?: boolean
  category?: string
  page?: number
  per_page?: number
}

// Stats types
export interface InventoryStats {
  total_value: number
  total_items: number
  low_stock_items: number
  out_of_stock_items: number
}

// CSV export types
export interface InventoryExportRow {
  sku: string
  product_name: string
  warehouse: string
  quantity: number
  reserved_quantity: number
  available_quantity: number
  reorder_point: number
  reorder_quantity: number
  last_updated: string
}

// CSV import types
export interface InventoryImportRow {
  sku: string
  warehouse_code: string
  quantity: number
  reason?: string
  notes?: string
}

// Helper functions
export function calculateAvailableQuantity(
  inventory: Pick<Inventory, 'quantity' | 'reserved_quantity'>
): number {
  return (inventory.quantity || 0) - (inventory.reserved_quantity || 0)
}

export function isLowStock(
  inventory: Pick<Inventory, 'quantity' | 'reserved_quantity' | 'reorder_point'>
): boolean {
  const available = calculateAvailableQuantity(inventory)
  return available <= (inventory.reorder_point || 0)
}

export function isOutOfStock(
  inventory: Pick<Inventory, 'quantity' | 'reserved_quantity'>
): boolean {
  return calculateAvailableQuantity(inventory) <= 0
}

// Reason labels for UI
export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  sale: 'Sale',
  return: 'Return',
  damage: 'Damage',
  theft: 'Theft',
  found: 'Found',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  cycle_count: 'Cycle Count',
  other: 'Other',
}

// Reason colors for UI badges
export const ADJUSTMENT_REASON_COLORS: Record<AdjustmentReason, string> = {
  sale: 'bg-blue-100 text-blue-800',
  return: 'bg-green-100 text-green-800',
  damage: 'bg-red-100 text-red-800',
  theft: 'bg-red-100 text-red-800',
  found: 'bg-green-100 text-green-800',
  transfer_in: 'bg-indigo-100 text-indigo-800',
  transfer_out: 'bg-purple-100 text-purple-800',
  cycle_count: 'bg-gray-100 text-gray-800',
  other: 'bg-gray-100 text-gray-800',
}
