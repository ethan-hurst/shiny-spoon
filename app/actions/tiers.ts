'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { customerTierSchema } from '@/types/customer.types'

/**
 * Parses and validates tier data from a FormData object, safely handling JSON fields.
 *
 * Attempts to parse the `benefits` and `requirements` fields as JSON, defaulting to empty objects if parsing fails. Returns the result of schema validation, including success status and either the parsed data or validation errors.
 */
function parseTierFormData(formData: FormData) {
  let benefits = {}
  let requirements = {}

  try {
    benefits = formData.get('benefits')
      ? JSON.parse(formData.get('benefits') as string)
      : {}
  } catch {
    benefits = {}
  }

  try {
    requirements = formData.get('requirements')
      ? JSON.parse(formData.get('requirements') as string)
      : {}
  } catch {
    requirements = {}
  }

  return customerTierSchema.safeParse({
    name: formData.get('name'),
    level: parseInt(formData.get('level') as string),
    discount_percentage: parseFloat(
      formData.get('discount_percentage') as string
    ),
    color: formData.get('color'),
    benefits,
    requirements,
  })
}

/**
 * Creates a new customer tier after validating input and ensuring uniqueness within the organization.
 *
 * Returns an error if validation fails, the organization ID is missing, the user is unauthorized, or a tier with the same level already exists. On success, returns the created tier data and triggers revalidation of relevant paths.
 *
 * @param formData - The form data containing tier details and organization ID
 * @returns An object with either an error message or the created tier data and success status
 */
export async function createTier(formData: FormData) {
  const supabase = await createClient()

  const parsed = parseTierFormData(formData)

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const organizationId = formData.get('organization_id') as string
  if (!organizationId) {
    return { error: 'Organization ID is required' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Check if level already exists
  const { data: existing } = await supabase
    .from('customer_tiers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('level', parsed.data.level)
    .single()

  if (existing) {
    return { error: 'A tier with this level already exists' }
  }

  const { data: tier, error } = await supabase
    .from('customer_tiers')
    .insert({
      ...parsed.data,
      organization_id: organizationId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings/tiers')
  revalidatePath('/customers')
  return { success: true, data: tier }
}

/**
 * Updates an existing customer tier with new data from a form submission.
 *
 * Validates the provided form data, ensures the user is authenticated, and checks for duplicate tier levels within the same organization (excluding the current tier). If validation passes and no conflicts exist, updates the tier record in the database and triggers revalidation of relevant paths.
 *
 * @param formData - The form data containing updated tier information, including the tier ID.
 * @returns An object indicating success and the updated tier data, or an error message if the operation fails.
 */
export async function updateTier(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  if (!id) {
    return { error: 'Tier ID is required' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Parse form data
  const parsed = customerTierSchema.safeParse({
    name: formData.get('name'),
    level: Number(formData.get('level')),
    discount_percentage: Number(formData.get('discount_percentage')),
    color: formData.get('color'),
    benefits: formData.get('benefits')
      ? JSON.parse(formData.get('benefits') as string)
      : {},
    requirements: formData.get('requirements')
      ? JSON.parse(formData.get('requirements') as string)
      : {},
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const organizationId = formData.get('organization_id') as string

  // Check if level already exists (excluding current tier)
  const { data: existing } = await supabase
    .from('customer_tiers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('level', parsed.data.level)
    .neq('id', id)
    .single()

  if (existing) {
    return { error: 'A tier with this level already exists' }
  }

  const { data: tier, error } = await supabase
    .from('customer_tiers')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings/tiers')
  revalidatePath('/customers')
  return { success: true, data: tier }
}

/**
 * Deletes a customer tier by its ID if no customers are assigned to it.
 *
 * Returns an error if the user is unauthorized, if any customers are assigned to the tier, or if the deletion fails. On success, triggers revalidation of relevant paths and returns a success status.
 *
 * @param id - The unique identifier of the customer tier to delete
 * @returns An object indicating success or containing an error message
 */
export async function deleteTier(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Check if any customers are using this tier
  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('tier_id', id)

  if (count && count > 0) {
    return { error: `Cannot delete tier with ${count} assigned customers` }
  }

  const { error } = await supabase.from('customer_tiers').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings/tiers')
  revalidatePath('/customers')
  return { success: true }
}
