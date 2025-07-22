import { z } from 'zod'

// Enums
export const PricingUnitEnum = z.enum(['EACH', 'CASE', 'PALLET', 'BOX', 'POUND', 'KILOGRAM'])
export const RuleTypeEnum = z.enum(['tier', 'quantity', 'promotion', 'override'])
export const DiscountTypeEnum = z.enum(['percentage', 'fixed', 'price'])

// Product Category Schema
export const productCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
  parent_id: z.string().uuid().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

// Product Pricing Schema
export const productPricingSchema = z.object({
  product_id: z.string().uuid(),
  cost: z.number().min(0, 'Cost cannot be negative'),
  base_price: z.number().min(0, 'Base price cannot be negative'),
  min_margin_percent: z.number().min(0).max(100).default(20),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/, 'Currency must be 3 uppercase letters').default('USD'),
  pricing_unit: PricingUnitEnum.default('EACH'),
  unit_quantity: z.number().int().positive().default(1),
  effective_date: z.string().optional(),
  expiry_date: z.string().optional(),
})

// Pricing Rule Conditions Schema
export const pricingConditionsSchema = z.object({
  min_quantity: z.number().int().min(0).optional(),
  max_quantity: z.number().int().positive().optional(),
  customer_tiers: z.array(z.string().uuid()).optional(),
  product_categories: z.array(z.string().uuid()).optional(),
  custom: z.record(z.any()).optional(),
})

// Pricing Rule Schema
export const pricingRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  rule_type: RuleTypeEnum,
  priority: z.number().int().min(0).default(100),
  conditions: pricingConditionsSchema.default({}),
  discount_type: DiscountTypeEnum.optional(),
  discount_value: z.number().min(0).optional(),
  product_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  customer_tier_id: z.string().uuid().optional(),
  is_exclusive: z.boolean().default(false),
  can_stack: z.boolean().default(true),
  is_active: z.boolean().default(true),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
}).refine(
  (data) => {
    // If discount_type is set, discount_value must be set
    if (data.discount_type && !data.discount_value) {
      return false
    }
    // If discount_value is set, discount_type must be set
    if (data.discount_value && !data.discount_type) {
      return false
    }
    return true
  },
  {
    message: 'Both discount type and value must be provided together',
  }
)

// Quantity Break Schema
export const quantityBreakSchema = z.object({
  min_quantity: z.number().int().min(0),
  max_quantity: z.number().int().positive().optional(),
  discount_type: DiscountTypeEnum,
  discount_value: z.number().min(0),
  sort_order: z.number().int().default(0),
}).refine(
  (data) => {
    if (data.max_quantity && data.max_quantity <= data.min_quantity) {
      return false
    }
    return true
  },
  {
    message: 'Max quantity must be greater than min quantity',
  }
)

// Customer Pricing Schema
export const customerPricingSchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  override_price: z.number().min(0).optional(),
  override_discount_percent: z.number().min(0).max(100).optional(),
  contract_number: z.string().optional(),
  contract_start: z.string().optional(),
  contract_end: z.string().optional(),
  requires_approval: z.boolean().default(false),
  notes: z.string().optional(),
}).refine(
  (data) => {
    // Can't have both price and discount
    if (data.override_price && data.override_discount_percent) {
      return false
    }
    return true
  },
  {
    message: 'Cannot set both override price and discount percent',
  }
)

// Price Calculation Request Schema
export const priceCalculationRequestSchema = z.object({
  product_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  quantity: z.number().int().positive().default(1),
  requested_date: z.string().optional(),
})

// Types derived from schemas
export type ProductCategory = z.infer<typeof productCategorySchema>
export type ProductPricing = z.infer<typeof productPricingSchema>
export type PricingConditions = z.infer<typeof pricingConditionsSchema>
export type PricingRule = z.infer<typeof pricingRuleSchema>
export type QuantityBreak = z.infer<typeof quantityBreakSchema>
export type CustomerPricing = z.infer<typeof customerPricingSchema>
export type PriceCalculationRequest = z.infer<typeof priceCalculationRequestSchema>

// Database types (including system fields)
export interface ProductCategoryRecord extends ProductCategory {
  id: string
  organization_id: string
  created_at: string
  updated_at: string
}

export interface ProductPricingRecord extends ProductPricing {
  id: string
  organization_id: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface PricingRuleRecord extends PricingRule {
  id: string
  organization_id: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface QuantityBreakRecord extends QuantityBreak {
  id: string
  pricing_rule_id: string
}

export interface CustomerPricingRecord extends CustomerPricing {
  id: string
  organization_id: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  created_by?: string
}

// Price calculation types
export interface AppliedRule {
  rule_id?: string
  type: string
  name?: string
  description?: string
  discount_type?: string
  discount_value?: number
  discount_amount: number
}

export interface PriceCalculationResult {
  base_price: number
  final_price: number
  discount_amount: number
  discount_percent: number
  margin_percent: number
  applied_rules: AppliedRule[]
}

export interface PriceCalculationRecord {
  id: string
  organization_id: string
  product_id: string
  customer_id?: string
  quantity: number
  requested_at: string
  requested_by?: string
  base_price: number
  final_price: number
  total_discount: number
  discount_percent: number
  margin_percent?: number
  applied_rules: AppliedRule[]
  calculation_details: Record<string, any>
  calculation_time_ms?: number
  cache_key?: string
  ttl_seconds?: number
}

// Cache types
export interface CachedPrice {
  response: PriceCalculationResult
  expiresAt: number
}

// Rule evaluation context
export interface PriceContext {
  productId: string
  customerId?: string
  customerTier?: string
  productCategory?: string
  quantity: number
  date: Date
  basePrice: number
  cost: number
  minMargin: number
  organizationId: string
  // Inventory context (optional)
  inventory?: {
    totalQuantity: number
    availableQuantity: number
    reservedQuantity: number
    warehouseId?: string
  }
}

// Import/Export types
export interface PricingRuleImport {
  name: string
  description?: string
  rule_type: string
  priority?: number
  discount_type?: string
  discount_value?: number
  product_sku?: string
  category_slug?: string
  customer_name?: string
  tier_name?: string
  is_active?: boolean
  start_date?: string
  end_date?: string
  // Quantity breaks as CSV within CSV
  quantity_breaks?: string
}

export interface ProductPricingImport {
  product_sku: string
  cost: number
  base_price: number
  min_margin_percent?: number
  currency?: string
  pricing_unit?: string
  unit_quantity?: number
  effective_date?: string
  expiry_date?: string
}

// Filter types
export interface PricingRuleFilters {
  search?: string
  rule_type?: z.infer<typeof RuleTypeEnum>
  is_active?: boolean
  product_id?: string
  category_id?: string
  customer_id?: string
  tier_id?: string
  date?: Date
}

export interface ProductPricingFilters {
  product_id?: string
  active_only?: boolean
  date?: Date
}

// Re-export validation schemas for convenience
export { createPricingRuleSchema } from '@/lib/pricing/validations'

// Utility functions
export function formatPricingUnit(unit: string, quantity: number): string {
  const unitLabels: Record<string, string> = {
    EACH: 'each',
    CASE: 'case',
    PALLET: 'pallet',
    BOX: 'box',
    POUND: 'lb',
    KILOGRAM: 'kg',
  }
  
  const label = unitLabels[unit] || unit.toLowerCase()
  
  if (quantity === 1) {
    return `per ${label}`
  }
  
  return `per ${quantity} ${label}${quantity > 1 && !['lb', 'kg'].includes(label) ? 's' : ''}`
}

export function formatDiscountDisplay(type: string, value: number): string {
  switch (type) {
    case 'percentage':
      return `${value}% off`
    case 'fixed':
      return `$${value.toFixed(2)} off`
    case 'price':
      return `$${value.toFixed(2)}`
    default:
      return ''
  }
}

export function getRuleTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    tier: '🏆',
    quantity: '📦',
    promotion: '🎯',
    override: '⚡',
  }
  return icons[type] || '📋'
}

export function getRuleTypeColor(type: string): string {
  const colors: Record<string, string> = {
    tier: 'text-purple-600 bg-purple-50',
    quantity: 'text-blue-600 bg-blue-50',
    promotion: 'text-green-600 bg-green-50',
    override: 'text-orange-600 bg-orange-50',
  }
  return colors[type] || 'text-gray-600 bg-gray-50'
}

export function calculateMargin(price: number, cost: number): number {
  if (price <= 0) return 0
  return ((price - cost) / price) * 100
}

export function calculatePriceWithMargin(cost: number, marginPercent: number): number {
  return cost / (1 - (marginPercent / 100))
}

export function isRuleActive(rule: PricingRuleRecord, date: Date = new Date()): boolean {
  if (!rule.is_active) return false
  
  const ruleStart = rule.start_date ? new Date(rule.start_date) : null
  const ruleEnd = rule.end_date ? new Date(rule.end_date) : null
  
  if (ruleStart && date < ruleStart) return false
  if (ruleEnd && date > ruleEnd) return false
  
  return true
}