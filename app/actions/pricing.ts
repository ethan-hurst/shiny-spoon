'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  clearPricingCache,
} from '@/lib/pricing/calculate-price'
import {
  createCustomerPricingSchema,
  createPricingRuleSchema,
  createProductPricingSchema,
  priceCalculationRequestSchema,
  updateCustomerPricingSchema,
  updatePricingRuleSchema,
  updateProductPricingSchema,
} from '@/lib/pricing/validations'
import { createClient } from '@/lib/supabase/server'
import type { QuantityBreak } from '@/types/pricing.types'

// Product Pricing Actions
export async function createProductPricing(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Parse and validate numeric inputs
  const costValue = parseFloat(formData.get('cost') as string)
  const basePriceValue = parseFloat(formData.get('base_price') as string)
  const minMarginValue = parseFloat(
    formData.get('min_margin_percent') as string
  )
  const unitQuantityValue = parseInt(formData.get('unit_quantity') as string)

  const parsed = createProductPricingSchema.parse({
    product_id: formData.get('product_id'),
    cost: isNaN(costValue) ? 0 : costValue,
    base_price: isNaN(basePriceValue) ? 0 : basePriceValue,
    min_margin_percent: isNaN(minMarginValue) ? 20 : minMarginValue,
    currency: formData.get('currency') || 'USD',
    pricing_unit: formData.get('pricing_unit') || 'EACH',
    unit_quantity: isNaN(unitQuantityValue) ? 1 : unitQuantityValue,
    effective_date: formData.get('effective_date') || undefined,
    expiry_date: formData.get('expiry_date') || undefined,
  })

  const { error } = await supabase.from('product_pricing').insert({
    ...parsed,
    created_by: user.id,
  })

  if (error) throw error

  // Clear pricing cache for this product
  clearPricingCache(parsed.product_id)

  revalidatePath('/pricing')
  revalidatePath(`/products/${parsed.product_id}`)
}

export async function updateProductPricing(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const productId = formData.get('product_id') as string

  const parsed = updateProductPricingSchema.parse({
    id,
    cost: formData.has('cost')
      ? parseFloat(formData.get('cost') as string)
      : undefined,
    base_price: formData.has('base_price')
      ? parseFloat(formData.get('base_price') as string)
      : undefined,
    min_margin_percent: formData.has('min_margin_percent')
      ? parseFloat(formData.get('min_margin_percent') as string)
      : undefined,
    effective_date: formData.get('effective_date') || undefined,
    expiry_date: formData.get('expiry_date') || undefined,
  })

  const { error } = await supabase
    .from('product_pricing')
    .update(parsed)
    .eq('id', id)

  if (error) throw error

  // Clear pricing cache for this product
  await clearPricingCache(productId)

  revalidatePath('/pricing')
  revalidatePath(`/products/${productId}`)
}

// Pricing Rule Actions
export async function createPricingRule(
  data: z.infer<typeof createPricingRuleSchema>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { quantity_breaks, ...ruleData } = data

  // Start a transaction
  const { data: rule, error: ruleError } = await supabase
    .from('pricing_rules')
    .insert({
      ...ruleData,
      created_by: user.id,
    })
    .select()
    .single()

  if (ruleError) throw ruleError

  // Insert quantity breaks if provided
  if (quantity_breaks && quantity_breaks.length > 0) {
    const { error: breaksError } = await supabase
      .from('quantity_breaks')
      .insert(
        quantity_breaks.map((qb: QuantityBreak, index: number) => ({
          ...qb,
          pricing_rule_id: rule.id,
          sort_order: index,
        }))
      )

    if (breaksError) throw breaksError
  }

  // Clear all pricing cache since rules affect pricing
  await clearPricingCache()

  revalidatePath('/pricing')
  return rule
}

export async function updatePricingRule(
  data: z.infer<typeof updatePricingRuleSchema>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { id, quantity_breaks, ...ruleData } = data

  // Update the rule
  const { error: ruleError } = await supabase
    .from('pricing_rules')
    .update(ruleData)
    .eq('id', id)

  if (ruleError) throw ruleError

  // Handle quantity breaks updates
  if (quantity_breaks !== undefined) {
    // Process each break
    for (const qb of quantity_breaks) {
      if (qb._action === 'delete' && qb.id) {
        await supabase.from('quantity_breaks').delete().eq('id', qb.id)
      } else if (qb._action === 'create') {
        const { _action, ...breakData } = qb
        await supabase.from('quantity_breaks').insert({
          ...breakData,
          pricing_rule_id: id,
        })
      } else if (qb.id) {
        const { _action, id: breakId, ...breakData } = qb
        await supabase
          .from('quantity_breaks')
          .update(breakData)
          .eq('id', breakId)
      }
    }
  }

  // Clear all pricing cache since rules affect pricing
  await clearPricingCache()

  revalidatePath('/pricing')
  revalidatePath(`/pricing/rules/${id}`)
}

export async function deletePricingRule(ruleId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('pricing_rules')
    .delete()
    .eq('id', ruleId)

  if (error) throw error

  // Clear all pricing cache since rules affect pricing
  await clearPricingCache()

  revalidatePath('/pricing')
}

// Customer Pricing Actions
export async function createCustomerPricing(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const parsed = createCustomerPricingSchema.parse({
    customer_id: formData.get('customer_id'),
    product_id: formData.get('product_id'),
    override_price: formData.has('override_price')
      ? parseFloat(formData.get('override_price') as string)
      : undefined,
    override_discount_percent: formData.has('override_discount_percent')
      ? parseFloat(formData.get('override_discount_percent') as string)
      : undefined,
    contract_number: formData.get('contract_number') || undefined,
    contract_start: formData.get('contract_start') || undefined,
    contract_end: formData.get('contract_end') || undefined,
    requires_approval: formData.get('requires_approval') === 'true',
    notes: formData.get('notes') || undefined,
  })

  const { error } = await supabase.from('customer_pricing').insert({
    ...parsed,
    created_by: user.id,
  })

  if (error) throw error

  // Clear pricing cache for this product
  clearPricingCache(parsed.product_id)

  revalidatePath('/pricing')
  revalidatePath(`/customers/${parsed.customer_id}`)
}

export async function updateCustomerPricing(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const productId = formData.get('product_id') as string

  const parsed = updateCustomerPricingSchema.parse({
    id,
    override_price: formData.has('override_price')
      ? parseFloat(formData.get('override_price') as string)
      : undefined,
    override_discount_percent: formData.has('override_discount_percent')
      ? parseFloat(formData.get('override_discount_percent') as string)
      : undefined,
    contract_number: formData.get('contract_number') || undefined,
    contract_start: formData.get('contract_start') || undefined,
    contract_end: formData.get('contract_end') || undefined,
    requires_approval: formData.get('requires_approval') === 'true',
    notes: formData.get('notes') || undefined,
  })

  const { error } = await supabase
    .from('customer_pricing')
    .update(parsed)
    .eq('id', id)

  if (error) throw error

  // Clear pricing cache for this product
  await clearPricingCache(productId)

  revalidatePath('/pricing')
}

export async function approveCustomerPricing(pricingId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('customer_pricing')
    .update({
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', pricingId)

  if (error) throw error

  revalidatePath('/pricing')
}

// Bulk update customer prices
export async function bulkUpdateCustomerPrices(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const customerId = formData.get('customer_id') as string
  const updatesJson = formData.get('updates') as string
  const _applyToAllWarehouses =
    formData.get('apply_to_all_warehouses') === 'true'

  if (!customerId || !updatesJson) {
    throw new Error('Missing required fields')
  }

  let updates: Array<{
    sku: string
    price?: number
    discount_percent?: number
    reason: string
  }>
  try {
    updates = JSON.parse(updatesJson)
  } catch (error) {
    throw new Error('Invalid updates format')
  }

  // Create a bulk update ID for tracking
  const bulkUpdateId = crypto.randomUUID()

  try {
    // Execute bulk update using stored procedure within a transaction
    const { data: result, error } = await supabase.rpc(
      'bulk_update_customer_prices_transaction',
      {
        p_customer_id: customerId,
        p_updates: updates,
        p_bulk_update_id: bulkUpdateId,
        p_user_id: user.id,
      }
    )

    if (error) {
      throw error
    }

    // Clear pricing cache after successful transaction
    await clearPricingCache()
    revalidatePath('/pricing')

    return result
  } catch (error) {
    // Re-throw transaction errors
    throw error instanceof Error ? error : new Error('Transaction failed')
  }
}

// Price Calculation Actions
export async function calculatePrice(
  data: z.infer<typeof priceCalculationRequestSchema>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: result, error } = await supabase.rpc(
    'calculate_product_price',
    {
      p_product_id: data.product_id,
      p_customer_id: data.customer_id || null,
      p_quantity: data.quantity,
      p_requested_date:
        data.requested_date || new Date().toISOString().split('T')[0],
    }
  )

  if (error) throw error
  if (!result || result.length === 0)
    throw new Error('No pricing data returned')

  return result[0]
}

// Bulk Import Actions
export async function importPricingRules(file: File) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Parse CSV file using proper CSV parsing
  const text = await file.text()

  // Simple CSV parser that handles quoted fields
  function parseCSV(text: string): string[][] {
    const rows: string[][] = []
    const lines = text.split('\n').filter((line) => line.trim())

    for (const line of lines) {
      const row: string[] = []
      let current = ''
      let inQuotes = false
      let i = 0

      while (i < line.length) {
        const char = line[i]
        const nextChar = line[i + 1]

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"'
            i += 2
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
            i++
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          row.push(current.trim())
          current = ''
          i++
        } else {
          current += char
          i++
        }
      }

      // Add the last field
      row.push(current.trim())
      rows.push(row)
    }

    return rows
  }

  const rows = parseCSV(text)
  if (rows.length < 2) {
    throw new Error('CSV file must contain headers and at least one data row')
  }

  const headers = rows[0]!.map((h) => h.trim())
  const rules = rows.slice(1).map((values) => {
    const rule: any = {}
    headers.forEach((header, index) => {
      rule[header] = values[index] || ''
    })
    return rule
  })

  // Validate and insert rules
  const errors: string[] = []
  const successes: string[] = []

  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index]
    try {
      // Transform and validate rule data
      const transformedRule = {
        name: rule.name,
        description: rule.description,
        rule_type: rule.rule_type,
        priority: parseInt(rule.priority) || 100,
        discount_type: rule.discount_type,
        discount_value: parseFloat(rule.discount_value) || 0,
        is_active: rule.is_active === 'true',
        start_date: rule.start_date || undefined,
        end_date: rule.end_date || undefined,
      }

      await createPricingRule(transformedRule)
      successes.push(`Row ${index + 2}: ${rule.name}`)
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { successes, errors }
}

export async function exportPricingRules() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: rules, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .order('priority', { ascending: true })

  if (error) throw error

  // Convert to CSV
  const headers = [
    'name',
    'description',
    'rule_type',
    'priority',
    'discount_type',
    'discount_value',
    'is_active',
    'start_date',
    'end_date',
  ]

  // Helper function to escape CSV field properly
  const escapeCSVField = (value: any): string => {
    if (value === null || value === undefined) {
      return '""'
    }
    
    const strValue = String(value)
    
    // Check if value needs escaping (contains quotes, newlines, carriage returns, or commas)
    if (strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r') || strValue.includes(',')) {
      // Escape quotes by doubling them and wrap in quotes
      return `"${strValue.replace(/"/g, '""')}"`
    }
    
    // Also wrap in quotes if it starts with special characters that could be interpreted as formulas
    if (/^[=+\-@\t\r]/.test(strValue)) {
      return `"${strValue}"`
    }
    
    return strValue
  }

  const csvContent = [
    headers.map(escapeCSVField).join(','),
    ...rules.map((rule: Record<string, any>) =>
      headers
        .map((header) => escapeCSVField(rule[header] || ''))
        .join(',')
    ),
  ].join('\n')

  return csvContent
}
