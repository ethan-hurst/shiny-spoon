'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  createProductPricingSchema,
  updateProductPricingSchema,
  createPricingRuleSchema,
  updatePricingRuleSchema,
  createCustomerPricingSchema,
  updateCustomerPricingSchema,
  priceCalculationRequestSchema,
} from '@/lib/pricing/validations'
import { clearPricingCache } from '@/lib/pricing/calculate-price'

// Product Pricing Actions
export async function createProductPricing(formData: FormData) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const parsed = createProductPricingSchema.parse({
    product_id: formData.get('product_id'),
    cost: parseFloat(formData.get('cost') as string),
    base_price: parseFloat(formData.get('base_price') as string),
    min_margin_percent: parseFloat(formData.get('min_margin_percent') as string) || 20,
    currency: formData.get('currency') || 'USD',
    pricing_unit: formData.get('pricing_unit') || 'EACH',
    unit_quantity: parseInt(formData.get('unit_quantity') as string) || 1,
    effective_date: formData.get('effective_date') || undefined,
    expiry_date: formData.get('expiry_date') || undefined,
  })

  const { error } = await supabase
    .from('product_pricing')
    .insert({
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
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const productId = formData.get('product_id') as string

  const parsed = updateProductPricingSchema.parse({
    id,
    cost: formData.has('cost') ? parseFloat(formData.get('cost') as string) : undefined,
    base_price: formData.has('base_price') ? parseFloat(formData.get('base_price') as string) : undefined,
    min_margin_percent: formData.has('min_margin_percent') ? parseFloat(formData.get('min_margin_percent') as string) : undefined,
    effective_date: formData.get('effective_date') || undefined,
    expiry_date: formData.get('expiry_date') || undefined,
  })

  const { error } = await supabase
    .from('product_pricing')
    .update(parsed)
    .eq('id', id)

  if (error) throw error

  // Clear pricing cache for this product
  clearPricingCache(productId)
  
  revalidatePath('/pricing')
  revalidatePath(`/products/${productId}`)
}

// Pricing Rule Actions
export async function createPricingRule(data: z.infer<typeof createPricingRuleSchema>) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
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
        quantity_breaks.map((qb, index) => ({
          ...qb,
          pricing_rule_id: rule.id,
          sort_order: index,
        }))
      )

    if (breaksError) throw breaksError
  }

  // Clear all pricing cache since rules affect pricing
  clearPricingCache()
  
  revalidatePath('/pricing')
  return rule
}

export async function updatePricingRule(data: z.infer<typeof updatePricingRuleSchema>) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
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
        await supabase.from('quantity_breaks').update(breakData).eq('id', breakId)
      }
    }
  }

  // Clear all pricing cache since rules affect pricing
  clearPricingCache()
  
  revalidatePath('/pricing')
  revalidatePath(`/pricing/rules/${id}`)
}

export async function deletePricingRule(ruleId: string) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('pricing_rules')
    .delete()
    .eq('id', ruleId)

  if (error) throw error

  // Clear all pricing cache since rules affect pricing
  clearPricingCache()
  
  revalidatePath('/pricing')
}

// Customer Pricing Actions
export async function createCustomerPricing(formData: FormData) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const parsed = createCustomerPricingSchema.parse({
    customer_id: formData.get('customer_id'),
    product_id: formData.get('product_id'),
    override_price: formData.has('override_price') ? parseFloat(formData.get('override_price') as string) : undefined,
    override_discount_percent: formData.has('override_discount_percent') ? parseFloat(formData.get('override_discount_percent') as string) : undefined,
    contract_number: formData.get('contract_number') || undefined,
    contract_start: formData.get('contract_start') || undefined,
    contract_end: formData.get('contract_end') || undefined,
    requires_approval: formData.get('requires_approval') === 'true',
    notes: formData.get('notes') || undefined,
  })

  const { error } = await supabase
    .from('customer_pricing')
    .insert({
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
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const id = formData.get('id') as string
  const productId = formData.get('product_id') as string

  const parsed = updateCustomerPricingSchema.parse({
    id,
    override_price: formData.has('override_price') ? parseFloat(formData.get('override_price') as string) : undefined,
    override_discount_percent: formData.has('override_discount_percent') ? parseFloat(formData.get('override_discount_percent') as string) : undefined,
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
  clearPricingCache(productId)
  
  revalidatePath('/pricing')
}

export async function approveCustomerPricing(pricingId: string) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
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

// Price Calculation Actions
export async function calculatePrice(data: z.infer<typeof priceCalculationRequestSchema>) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: result, error } = await supabase.rpc('calculate_product_price', {
    p_product_id: data.product_id,
    p_customer_id: data.customer_id || null,
    p_quantity: data.quantity,
    p_requested_date: data.requested_date || new Date().toISOString().split('T')[0],
  })

  if (error) throw error
  if (!result || result.length === 0) throw new Error('No pricing data returned')

  return result[0]
}

// Bulk Import Actions
export async function importPricingRules(file: File) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Parse CSV file
  const text = await file.text()
  const lines = text.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  
  const rules = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const rule: any = {}
    headers.forEach((header, index) => {
      rule[header] = values[index]
    })
    return rule
  })

  // Validate and insert rules
  const errors: string[] = []
  const successes: string[] = []

  for (const [index, rule] of rules.entries()) {
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
      errors.push(`Row ${index + 2}: ${error.message}`)
    }
  }

  return { successes, errors }
}

export async function exportPricingRules() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
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
    ...rules.map(rule => 
      headers.map(header => rule[header] || '').join(',')
    ),
  ].join('\n')

  return csvContent
}