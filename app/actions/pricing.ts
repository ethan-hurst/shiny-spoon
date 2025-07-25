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

/**
 * Creates a new product pricing entry using validated form data.
 *
 * Authenticates the user, parses and validates pricing details from the provided form data, and inserts a new record into the `product_pricing` table. Clears the pricing cache for the affected product and revalidates relevant paths upon success.
 *
 * @param formData - Form data containing product pricing information
 * @throws If the user is unauthorized, validation fails, or the database operation encounters an error
 */
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

/**
 * Updates an existing product pricing record with new values.
 *
 * Validates and applies updates to the specified product pricing entry. Clears the pricing cache for the affected product and revalidates related paths.
 */
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

/**
 * Creates a new pricing rule and optionally associated quantity breaks.
 *
 * Authenticates the user, inserts a new record into the `pricing_rules` table, and, if provided, adds related quantity breaks. Clears all pricing cache and revalidates the pricing path.
 *
 * @param data - The pricing rule details, optionally including quantity breaks
 * @returns The created pricing rule record
 */
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

/**
 * Updates an existing pricing rule and its associated quantity breaks.
 *
 * If quantity breaks are provided, processes each to create, update, or delete as specified. Clears all pricing cache and revalidates relevant paths after the update.
 */
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

/**
 * Deletes a pricing rule by its ID.
 *
 * Throws an error if the user is unauthorized or if the deletion fails. Clears all pricing cache and revalidates the pricing page after deletion.
 */
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

/**
 * Creates a new customer-specific pricing entry using data from a form submission.
 *
 * Validates the input, associates the entry with the authenticated user, inserts it into the database, clears relevant pricing cache, and revalidates affected paths.
 */
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

/**
 * Updates an existing customer pricing record with new values from form data.
 *
 * Validates and applies updates to the specified customer pricing entry. Clears the pricing cache for the associated product and revalidates the pricing page.
 */
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

/**
 * Marks a customer pricing record as approved by the current user.
 *
 * Updates the specified customer pricing entry to set the approver and approval timestamp. Throws an error if the user is not authenticated or if the update fails. Triggers revalidation of the pricing page.
 */
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

/**
 * Performs a bulk update of customer-specific product prices using data from a form submission.
 *
 * Parses and validates the provided updates, then executes a transactional stored procedure to apply all changes for the specified customer. Clears all pricing cache and revalidates the pricing path upon success.
 *
 * @param formData - Form data containing `customer_id`, a JSON string of updates, and an optional flag for applying to all warehouses
 * @returns The result of the bulk update operation from the database
 * @throws Error if authentication fails, required fields are missing, updates JSON is invalid, or the database transaction fails
 */
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

/**
 * Calculates the price for a product based on provided criteria using a Supabase RPC call.
 *
 * Authenticates the user and computes the product price considering customer, quantity, and date. Throws an error if unauthorized, if the RPC call fails, or if no pricing data is returned.
 *
 * @param data - The price calculation request parameters, including product ID, optional customer ID, quantity, and optional requested date
 * @returns The calculated pricing result for the specified product and criteria
 */
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

/**
 * Imports pricing rules from a CSV file, validates and inserts each rule, and returns the results.
 *
 * The CSV must include headers and at least one data row. Each row is parsed, transformed, and passed to the pricing rule creation logic. Successes and errors are collected per row and returned.
 *
 * @param file - The CSV file containing pricing rules to import
 * @returns An object with arrays of success and error messages for each processed row
 */
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

/**
 * Exports all pricing rules as a CSV string with headers.
 *
 * The CSV includes the fields: name, description, rule_type, priority, discount_type, discount_value, is_active, start_date, and end_date. Fields containing commas, quotes, or newlines are properly escaped.
 *
 * @returns A CSV-formatted string representing all pricing rules.
 */
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

  const csvContent = [
    headers.join(','),
    ...rules.map((rule: Record<string, any>) =>
      headers
        .map((header) => {
          const value = rule[header] || ''
          // Escape CSV values that contain commas, quotes, or newlines
          if (
            typeof value === 'string' &&
            (value.includes(',') || value.includes('"') || value.includes('\n'))
          ) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(',')
    ),
  ].join('\n')

  return csvContent
}
