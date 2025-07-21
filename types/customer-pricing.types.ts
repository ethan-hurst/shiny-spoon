import { z } from 'zod'

// Base types - These will be replaced with database types once migrations are applied
interface CustomerPricingRow {
  id: string
  customer_id: string
  product_id: string
  organization_id: string
  override_price: number | null
  override_discount_percent: number | null
  contract_number: string | null
  contract_start: string | null
  contract_end: string | null
  requires_approval: boolean
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected'
  approval_requested_at: string | null
  approval_requested_by: string | null
  rejection_reason: string | null
  version: number
  previous_price: number | null
  bulk_update_id: string | null
  import_notes: string | null
}

interface CustomerPriceHistoryRow {
  id: string
  customer_pricing_id: string | null
  customer_id: string
  product_id: string
  organization_id: string
  old_price: number | null
  new_price: number | null
  old_discount_percent: number | null
  new_discount_percent: number | null
  change_type: 'manual' | 'bulk' | 'contract' | 'tier_change'
  change_reason: string | null
  requires_approval: boolean
  approval_status: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  created_by: string | null
}

interface CustomerContractRow {
  id: string
  customer_id: string
  organization_id: string
  contract_number: string
  contract_name: string
  description: string | null
  start_date: string
  end_date: string
  signed_date: string | null
  status: 'draft' | 'active' | 'expired' | 'cancelled'
  auto_renew: boolean
  renewal_period_months: number | null
  expiry_notification_days: number
  notified_30_days: boolean
  notified_7_days: boolean
  document_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

interface ContractItemRow {
  id: string
  contract_id: string | null
  product_id: string | null
  contract_price: number | null
  min_quantity: number
  max_quantity: number | null
  price_locked: boolean
  notes: string | null
}

interface PriceApprovalRow {
  id: string
  organization_id: string
  customer_pricing_id: string | null
  customer_id: string
  product_id: string
  current_price: number | null
  requested_price: number | null
  discount_percent: number | null
  margin_percent: number | null
  change_reason: string
  requested_by: string
  requested_at: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  escalated: boolean
  escalated_at: string | null
  escalated_to: string | null
  expires_at: string | null
  created_at: string
}

interface PricingApprovalRuleRow {
  id: string
  organization_id: string
  discount_threshold_percent: number | null
  price_reduction_threshold: number | null
  margin_threshold_percent: number | null
  requires_manager_approval: boolean
  requires_finance_approval: boolean
  auto_approve_under_threshold: boolean
  created_at: string
  updated_at: string
}

// Enums
export const ApprovalStatus = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export const ChangeType = {
  MANUAL: 'manual',
  BULK: 'bulk',
  CONTRACT: 'contract',
  TIER_CHANGE: 'tier_change',
} as const

export const ContractStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const

export type ApprovalStatus = typeof ApprovalStatus[keyof typeof ApprovalStatus]
export type ChangeType = typeof ChangeType[keyof typeof ChangeType]
export type ContractStatus = typeof ContractStatus[keyof typeof ContractStatus]

// Validation schemas
export const customerPriceSchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  override_price: z.number().min(0).optional().nullable(),
  override_discount_percent: z.number().min(0).max(100).optional().nullable(),
  contract_number: z.string().optional().nullable(),
  contract_start: z.string().optional().nullable(),
  contract_end: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  approval_status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('approved'),
})

export const bulkPriceUpdateSchema = z.object({
  customer_id: z.string().uuid(),
  updates: z.array(z.object({
    sku: z.string().min(1, 'SKU is required'),
    price: z.number().min(0, 'Price must be positive').optional(),
    discount_percent: z.number().min(0).max(100).optional(),
    reason: z.string().min(1, 'Reason is required'),
  })).min(1, 'At least one update is required'),
  apply_to_all_warehouses: z.boolean().default(true),
})

export const contractSchema = z.object({
  customer_id: z.string().uuid(),
  contract_number: z.string().min(1, 'Contract number is required'),
  contract_name: z.string().min(1, 'Contract name is required'),
  description: z.string().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  signed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['draft', 'active', 'expired', 'cancelled']).default('draft'),
  auto_renew: z.boolean().default(false),
  renewal_period_months: z.number().min(1).max(60).optional().nullable(),
  expiry_notification_days: z.number().min(1).max(365).default(30),
  document_url: z.string().url().optional().nullable(),
})

export const contractItemSchema = z.object({
  contract_id: z.string().uuid(),
  product_id: z.string().uuid(),
  contract_price: z.number().min(0, 'Price must be positive'),
  min_quantity: z.number().min(0).default(0),
  max_quantity: z.number().min(0).optional().nullable(),
  price_locked: z.boolean().default(true),
  notes: z.string().optional().nullable(),
})

export const priceApprovalSchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  current_price: z.number().min(0),
  requested_price: z.number().min(0),
  discount_percent: z.number().min(0).max(100),
  margin_percent: z.number(),
  change_reason: z.string().min(1, 'Reason is required'),
})

export const approvalRulesSchema = z.object({
  discount_threshold_percent: z.number().min(0).max(100).optional().nullable(),
  price_reduction_threshold: z.number().min(0).optional().nullable(),
  margin_threshold_percent: z.number().min(0).max(100).optional().nullable(),
  requires_manager_approval: z.boolean().default(true),
  requires_finance_approval: z.boolean().default(false),
  auto_approve_under_threshold: z.boolean().default(true),
})

// Derived types from schemas
export type CustomerPrice = z.infer<typeof customerPriceSchema>
export type BulkPriceUpdate = z.infer<typeof bulkPriceUpdateSchema>
export type Contract = z.infer<typeof contractSchema>
export type ContractItem = z.infer<typeof contractItemSchema>
export type PriceApproval = z.infer<typeof priceApprovalSchema>
export type ApprovalRules = z.infer<typeof approvalRulesSchema>

// Extended types with relationships
export interface CustomerPriceWithProduct extends CustomerPricingRow {
  products?: {
    id: string
    sku: string
    name: string
    category_id?: string
  }
  product_pricing?: {
    base_price: number
    cost: number
    currency: string
  }
}

export interface ContractWithItems extends CustomerContractRow {
  contract_items?: Array<ContractItemRow & {
    products?: {
      id: string
      sku: string
      name: string
    }
  }>
  customers?: {
    id: string
    company_name: string
    display_name?: string
  }
}

export interface PriceChangeRequest {
  customer_id: string
  product_id: string
  organization_id: string
  current_price: number
  new_price: number
  change_reason: string
  change_type: ChangeType
  requires_approval: boolean
  discount_percent: number
  margin_percent: number
  bulk_update_id?: string
}

export interface PriceApprovalWithDetails extends PriceApprovalRow {
  customers?: {
    id: string
    company_name: string
    display_name?: string
  }
  products?: {
    id: string
    sku: string
    name: string
  }
  requested_by_user?: {
    id: string
    email: string
    full_name?: string
  }
  approved_by_user?: {
    id: string
    email: string
    full_name?: string
  }
}

export interface PriceHistoryEntry extends CustomerPriceHistoryRow {
  products?: {
    id: string
    sku: string
    name: string
  }
  created_by_user?: {
    id: string
    email: string
    full_name?: string
  }
  approved_by_user?: {
    id: string
    email: string
    full_name?: string
  }
}

// Helper types
export interface PriceCalculationResult {
  base_price: number
  customer_price: number
  discount_amount: number
  discount_percent: number
  margin_amount: number
  margin_percent: number
  price_source: 'base' | 'tier' | 'customer' | 'contract' | 'promotion'
  requires_approval: boolean
  approval_reason?: string
  contract_id?: string
  contract_number?: string
}

export interface BulkUpdateResult {
  total: number
  succeeded: number
  failed: number
  pending_approval: number
  errors: Array<{
    sku: string
    error: string
  }>
  bulk_update_id: string
}

export interface CustomerPricingStats {
  total_products: number
  custom_prices: number
  contract_prices: number
  average_discount: number
  pending_approvals: number
  expiring_contracts: number
}

// Filter and sort types
export interface CustomerPriceFilters {
  search?: string
  category_id?: string
  has_custom_price?: boolean
  approval_status?: ApprovalStatus
  contract_id?: string
  min_discount?: number
  max_discount?: number
  price_source?: Array<'manual' | 'contract' | 'tier'>
}

export interface PriceHistoryFilters {
  product_id?: string
  date_from?: Date
  date_to?: Date
  change_type?: ChangeType
  created_by?: string
  min_change_percent?: number
}

// Export/Import types
export interface CustomerPriceExport {
  sku: string
  product_name: string
  category: string
  base_price: number
  customer_price: number
  discount_percent: number
  price_source: string
  contract_number?: string
  contract_expiry?: string
  last_updated: string
  updated_by: string
}

export interface CustomerPriceImport {
  sku: string
  price?: number
  discount_percent?: number
  reason: string
  contract_number?: string
  effective_date?: string
  expiry_date?: string
}

// Utility functions
export function calculateDiscount(basePrice: number, customerPrice: number): number {
  if (basePrice <= 0) return 0
  return ((basePrice - customerPrice) / basePrice) * 100
}

export function calculateMargin(price: number, cost: number): number {
  if (price <= 0) return 0
  return ((price - cost) / price) * 100
}

export function formatPriceSource(source: string, contractNumber?: string): string {
  switch (source) {
    case 'contract':
      return contractNumber ? `Contract ${contractNumber}` : 'Contract'
    case 'tier':
      return 'Customer Tier'
    case 'customer':
      return 'Custom Price'
    case 'promotion':
      return 'Promotion'
    default:
      return 'Base Price'
  }
}

export function getApprovalStatusColor(status: ApprovalStatus): string {
  switch (status) {
    case 'approved':
      return 'text-green-600 bg-green-50'
    case 'pending':
      return 'text-yellow-600 bg-yellow-50'
    case 'rejected':
      return 'text-red-600 bg-red-50'
    case 'draft':
      return 'text-gray-600 bg-gray-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function getContractStatusColor(status: ContractStatus): string {
  switch (status) {
    case 'active':
      return 'text-green-600 bg-green-50'
    case 'expired':
      return 'text-red-600 bg-red-50'
    case 'cancelled':
      return 'text-gray-600 bg-gray-50'
    case 'draft':
      return 'text-blue-600 bg-blue-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function isContractExpiring(endDate: string, notificationDays: number = 30): boolean {
  const end = new Date(endDate)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry > 0 && daysUntilExpiry <= notificationDays
}

export function getChangeTypeIcon(type: ChangeType): string {
  switch (type) {
    case 'manual':
      return '✏️'
    case 'bulk':
      return '📦'
    case 'contract':
      return '📄'
    case 'tier_change':
      return '🎖️'
    default:
      return '📌'
  }
}

// Validation helpers
export function validatePriceChange(
  newPrice: number,
  basePrice: number,
  cost: number,
  rules?: ApprovalRules
): { valid: boolean; reason?: string; requiresApproval: boolean } {
  // Basic validation
  if (newPrice < 0) {
    return { valid: false, reason: 'Price cannot be negative', requiresApproval: false }
  }

  // Calculate metrics
  const discount = calculateDiscount(basePrice, newPrice)
  const margin = calculateMargin(newPrice, cost)

  // Check if below cost
  if (newPrice < cost) {
    return { 
      valid: true, 
      reason: 'Price is below cost', 
      requiresApproval: true 
    }
  }

  // Check approval rules
  if (rules) {
    if (rules.discount_threshold_percent && discount >= rules.discount_threshold_percent) {
      return { 
        valid: true, 
        reason: `Discount ${discount.toFixed(1)}% exceeds threshold`, 
        requiresApproval: true 
      }
    }

    if (rules.margin_threshold_percent && margin <= rules.margin_threshold_percent) {
      return { 
        valid: true, 
        reason: `Margin ${margin.toFixed(1)}% below threshold`, 
        requiresApproval: true 
      }
    }
  }

  return { valid: true, requiresApproval: false }
}