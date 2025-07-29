import { z } from 'zod'
import {
  customerPricingSchema,
  customerPricingBaseSchema,
  pricingRuleSchema,
  pricingRuleBaseSchema,
  productPricingSchema,
  QuantityBreak,
  quantityBreakSchema,
  PricingRule,
  ProductPricing,
  PricingRuleRecord,
} from '@/types/pricing.types'

// Extended schemas for creation/update operations
export const createProductPricingSchema = productPricingSchema
  .extend({
    // Ensure base price is greater than cost for positive margin
  })
  .refine(
    (data) => {
      if (data.base_price <= data.cost) {
        return false
      }
      return true
    },
    {
      message: 'Base price must be greater than cost',
    }
  )

export const updateProductPricingSchema = productPricingSchema
  .partial()
  .extend({
    id: z.string().uuid(),
  })

export const createPricingRuleSchema = z.object({
  ...pricingRuleSchema,
  quantity_breaks: z.array(quantityBreakSchema).optional(),
})

export const updatePricingRuleSchema = z.object({
  ...pricingRuleBaseSchema.partial(),
  id: z.string().uuid(),
  quantity_breaks: z
    .array(
      z.object({
        ...quantityBreakSchema,
        id: z.string().uuid().optional(),
        _action: z.enum(['create', 'update', 'delete']).optional(),
      })
    )
    .optional(),
})

export const createCustomerPricingSchema = customerPricingSchema

export const updateCustomerPricingSchema = z.object({
  ...customerPricingBaseSchema.partial(),
  id: z.string().uuid(),
})

// Bulk import schemas
export const pricingRuleImportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  rule_type: z.enum(['tier', 'quantity', 'promotion', 'override']),
  priority: z.number().optional(),
  discount_type: z.enum(['percentage', 'fixed', 'price']).optional(),
  discount_value: z.number().optional(),
  product_sku: z.string().optional(),
  category_slug: z.string().optional(),
  customer_name: z.string().optional(),
  tier_name: z.string().optional(),
  is_active: z.boolean().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  quantity_breaks: z.string().optional(), // CSV format: "1-10:5%;11-50:10%;51+:15%"
})

export const productPricingImportSchema = z.object({
  product_sku: z.string().min(1),
  cost: z.number().min(0),
  base_price: z.number().min(0),
  min_margin_percent: z.number().min(0).max(100).optional(),
  currency: z.string().length(3).optional(),
  pricing_unit: z
    .enum(['EACH', 'CASE', 'PALLET', 'BOX', 'POUND', 'KILOGRAM'])
    .optional(),
  unit_quantity: z.number().int().positive().optional(),
  effective_date: z.string().optional(),
  expiry_date: z.string().optional(),
})

// Price calculation request schema
export const priceCalculationRequestSchema = z.object({
  product_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  quantity: z.number().int().positive().default(1),
  requested_date: z.string().optional(),
})

// Filter validation schemas
export const pricingRuleFiltersSchema = z.object({
  search: z.string().optional(),
  rule_type: z.enum(['tier', 'quantity', 'promotion', 'override']).optional(),
  is_active: z.boolean().optional(),
  product_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  tier_id: z.string().uuid().optional(),
  date: z.string().datetime().optional(),
})

// Validation helper functions
export function validatePriceGreaterThanCost(
  price: number,
  cost: number
): boolean {
  return price > cost
}

export function validateMargin(
  price: number,
  cost: number,
  minMargin: number
): boolean {
  const margin = ((price - cost) / price) * 100
  return margin >= minMargin
}

export function validateDateRange(
  startDate?: string,
  endDate?: string
): boolean {
  if (!startDate || !endDate) return true
  return new Date(startDate) <= new Date(endDate)
}

export function validateQuantityBreaks(breaks: QuantityBreak[]): string[] {
  const errors: string[] = []

  // Sort breaks by min_quantity
  const sortedBreaks = [...breaks].sort(
    (a, b) => a.min_quantity - b.min_quantity
  )

  // Check for gaps and overlaps
  for (let i = 0; i < sortedBreaks.length; i++) {
    const current = sortedBreaks[i]
    const next = sortedBreaks[i + 1]

    // Check if max_quantity is set and valid
    if (current && current.max_quantity && current.max_quantity <= current.min_quantity) {
      errors.push(
        `Break ${i + 1}: Max quantity must be greater than min quantity`
      )
    }

    // Check for gaps between breaks
    if (next && current) {
      if (current.max_quantity) {
        if (next.min_quantity > current.max_quantity) {
          errors.push(
            `Gap between quantities ${current.max_quantity} and ${next.min_quantity}`
          )
        }
        if (next.min_quantity < current.max_quantity) {
          errors.push(`Overlap between breaks at quantity ${next.min_quantity}`)
        }
      }
    }
  }

  return errors
}

// Parse quantity breaks from CSV format
export function parseQuantityBreaksCSV(csv: string): QuantityBreak[] {
  const breaks: QuantityBreak[] = []

  // Format: "1-10:5%;11-50:10%;51+:15%"
  const parts = csv
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)

  for (let i = 0; i < parts.length; i++) {
    const partStr = parts[i]
    if (!partStr) continue
    const [range, discount] = partStr.split(':')
    if (!range || !discount) continue

    const [min, max] = range.split('-')
    const minQty = parseInt(min || '0')
    const maxQty = max === '+' ? undefined : parseInt(max || '0')

    // Parse discount
    let discountType: 'percentage' | 'fixed' | 'price' = 'percentage'
    let discountValue = 0

    if (discount.endsWith('%')) {
      discountType = 'percentage'
      discountValue = parseFloat(discount.slice(0, -1))
    } else if (discount.startsWith('$')) {
      if (discount.includes('off')) {
        discountType = 'fixed'
        discountValue = parseFloat(
          discount.replace('$', '').replace('off', '').trim()
        )
      } else {
        discountType = 'price'
        discountValue = parseFloat(discount.replace('$', ''))
      }
    }

    breaks.push({
      min_quantity: minQty,
      max_quantity: maxQty,
      discount_type: discountType,
      discount_value: discountValue,
      sort_order: i,
    })
  }

  return breaks
}

// Format quantity breaks for display
export function formatQuantityBreaksDisplay(breaks: QuantityBreak[]): string {
  const sorted = [...breaks].sort((a, b) => a.min_quantity - b.min_quantity)

  return sorted
    .map((b) => {
      const range = b.max_quantity
        ? `${b.min_quantity}-${b.max_quantity}`
        : `${b.min_quantity}+`

      let discount = ''
      switch (b.discount_type) {
        case 'percentage':
          discount = `${b.discount_value}%`
          break
        case 'fixed':
          discount = `$${b.discount_value} off`
          break
        case 'price':
          discount = `$${b.discount_value}`
          break
      }

      return `${range}: ${discount}`
    })
    .join('; ')
}

// Transform import data
export function transformPricingRuleImport(
  data: z.infer<typeof pricingRuleImportSchema>
): {
  rule: Partial<PricingRule>
  quantity_breaks?: QuantityBreak[]
} {
  const rule: Partial<PricingRule> = {
    name: data.name,
    description: data.description,
    rule_type: data.rule_type,
    priority: data.priority || 100,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    is_active: data.is_active ?? true,
    start_date: data.start_date,
    end_date: data.end_date,
    conditions: {},
  }

  let quantity_breaks: QuantityBreak[] | undefined

  if (data.quantity_breaks) {
    quantity_breaks = parseQuantityBreaksCSV(data.quantity_breaks)
  }

  return { rule, quantity_breaks }
}

export function transformProductPricingImport(
  data: z.infer<typeof productPricingImportSchema>
): Partial<ProductPricing> {
  return {
    cost: data.cost,
    base_price: data.base_price,
    min_margin_percent: data.min_margin_percent || 20,
    currency: data.currency || 'USD',
    pricing_unit: data.pricing_unit || 'EACH',
    unit_quantity: data.unit_quantity || 1,
    effective_date: data.effective_date,
    expiry_date: data.expiry_date,
  }
}

// Validation for overlapping rules
export function checkRuleConflicts(
  newRule: Partial<PricingRule>,
  existingRules: PricingRuleRecord[]
): string[] {
  const conflicts: string[] = []

  for (const existing of existingRules) {
    // Skip if different products
    if (
      newRule.product_id &&
      existing.product_id &&
      newRule.product_id !== existing.product_id
    ) {
      continue
    }

    // Skip if different categories
    if (
      newRule.category_id &&
      existing.category_id &&
      newRule.category_id !== existing.category_id
    ) {
      continue
    }

    // Check date overlap
    const newStart = newRule.start_date ? new Date(newRule.start_date) : null
    const newEnd = newRule.end_date ? new Date(newRule.end_date) : null
    const existingStart = existing.start_date
      ? new Date(existing.start_date)
      : null
    const existingEnd = existing.end_date ? new Date(existing.end_date) : null

    const hasDateOverlap = !(
      (newEnd && existingStart && newEnd < existingStart) ||
      (newStart && existingEnd && newStart > existingEnd)
    )

    if (hasDateOverlap && existing.rule_type === newRule.rule_type) {
      // Same rule type with overlapping dates
      if (existing.priority === newRule.priority) {
        conflicts.push(
          `Conflicts with rule "${existing.name}" - same priority (${existing.priority})`
        )
      }

      if (existing.is_exclusive && newRule.is_exclusive) {
        conflicts.push(`Conflicts with exclusive rule "${existing.name}"`)
      }
    }
  }

  return conflicts
}
