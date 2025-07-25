'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  assignTierSchema,
  createActivitySchema,
  createContactSchema,
  createCustomerSchema,
  updateContactSchema,
  updateCreditLimitSchema,
  updateCustomerSchema,
} from '@/lib/customers/validations'
import { createClient } from '@/lib/supabase/server'

/**
 * Creates a new customer record using validated form data and associates it with the authenticated user's organization.
 *
 * Parses and validates the provided form data, inserts the customer into the database, logs the creation activity, and revalidates the customers cache path. Returns an error object if authentication, validation, or database operations fail; otherwise, returns the created customer data.
 *
 * @param formData - The form data containing customer details to be created
 * @returns An object with either the created customer data on success or an error property with details on failure
 */
export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return { error: 'User profile not found' }
  }

  // Parse form data
  const parsed = createCustomerSchema.safeParse({
    company_name: formData.get('company_name'),
    display_name: formData.get('display_name'),
    tax_id: formData.get('tax_id'),
    website: formData.get('website'),
    tier_id: formData.get('tier_id'),
    status: formData.get('status'),
    customer_type: formData.get('customer_type'),
    billing_address: {
      line1: formData.get('billing_line1'),
      line2: formData.get('billing_line2'),
      city: formData.get('billing_city'),
      state: formData.get('billing_state'),
      postal_code: formData.get('billing_postal_code'),
      country: formData.get('billing_country'),
    },
    shipping_address:
      formData.get('use_billing_for_shipping') === 'true'
        ? undefined
        : {
            line1: formData.get('shipping_line1'),
            line2: formData.get('shipping_line2'),
            city: formData.get('shipping_city'),
            state: formData.get('shipping_state'),
            postal_code: formData.get('shipping_postal_code'),
            country: formData.get('shipping_country'),
          },
    credit_limit: Number(formData.get('credit_limit') || 0),
    payment_terms: Number(formData.get('payment_terms') || 30),
    currency: formData.get('currency'),
    notes: formData.get('notes'),
    internal_notes: formData.get('internal_notes'),
    tags: formData
      .get('tags')
      ?.toString()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  // Start transaction
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      ...parsed.data,
      organization_id: profile.organization_id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Log activity
  await supabase.rpc('log_customer_activity', {
    p_customer_id: customer.id,
    p_organization_id: profile.organization_id,
    p_type: 'settings_update',
    p_title: 'Customer created',
    p_description: `Customer ${customer.company_name} was created`,
    p_created_by: user.id,
  })

  revalidatePath('/customers')
  return { success: true, data: customer }
}

/**
 * Updates an existing customer record with new data from the provided form.
 *
 * Validates the form data, updates the customer in the database, and revalidates relevant cache paths. Returns the updated customer data on success or an error object if validation or database operations fail.
 *
 * @param formData - The form data containing updated customer fields and the customer ID
 * @returns An object with either the updated customer data on success or an error message on failure
 */
export async function updateCustomer(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  if (!id) {
    return { error: 'Customer ID is required' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Parse form data
  const parsed = updateCustomerSchema.safeParse({
    id,
    company_name: formData.get('company_name'),
    display_name: formData.get('display_name'),
    tax_id: formData.get('tax_id'),
    website: formData.get('website'),
    tier_id: formData.get('tier_id'),
    status: formData.get('status'),
    customer_type: formData.get('customer_type'),
    billing_address: {
      line1: formData.get('billing_line1'),
      line2: formData.get('billing_line2'),
      city: formData.get('billing_city'),
      state: formData.get('billing_state'),
      postal_code: formData.get('billing_postal_code'),
      country: formData.get('billing_country'),
    },
    shipping_address:
      formData.get('use_billing_for_shipping') === 'true'
        ? undefined
        : {
            line1: formData.get('shipping_line1'),
            line2: formData.get('shipping_line2'),
            city: formData.get('shipping_city'),
            state: formData.get('shipping_state'),
            postal_code: formData.get('shipping_postal_code'),
            country: formData.get('shipping_country'),
          },
    credit_limit: formData.get('credit_limit')
      ? Number(formData.get('credit_limit'))
      : undefined,
    payment_terms: formData.get('payment_terms')
      ? Number(formData.get('payment_terms'))
      : undefined,
    currency: formData.get('currency'),
    notes: formData.get('notes'),
    internal_notes: formData.get('internal_notes'),
    tags: formData
      .get('tags')
      ?.toString()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const { id: _, ...updateData } = parsed.data

  const { data: customer, error } = await supabase
    .from('customers')
    .update({
      ...updateData,
      updated_by: user.id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { success: true, data: customer }
}

/**
 * Permanently deletes a customer and all related contacts and activities.
 *
 * Also logs the deletion activity for audit purposes and revalidates the customers cache path. Returns an error if the user is unauthorized or the customer does not exist.
 *
 * @param id - The unique identifier of the customer to delete
 * @returns An object indicating success or containing an error message
 */
export async function deleteCustomer(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get customer to log activity
  const { data: customer } = await supabase
    .from('customers')
    .select('company_name, organization_id')
    .eq('id', id)
    .single()

  if (!customer) {
    return { error: 'Customer not found' }
  }

  // Delete customer (cascades to contacts and activities)
  const { error } = await supabase.from('customers').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  // Log deletion activity for audit purposes
  try {
    await supabase.from('customer_activities').insert({
      customer_id: id,
      organization_id: customer.organization_id,
      type: 'settings_update',
      title: 'Customer Deleted',
      description: `Customer account was permanently deleted by user ${user.id}`,
      created_by: user.id,
    })
  } catch (logError) {
    // Don't fail the deletion if logging fails
    console.error('Failed to log customer deletion:', logError)
  }

  revalidatePath('/customers')
  return { success: true }
}

/**
 * Creates a new contact for a customer after validating input and authenticating the user.
 *
 * Validates the provided form data, inserts a new contact record, logs the activity, and revalidates the relevant customer cache path.
 *
 * @returns An object containing either the created contact data on success or an error message on failure.
 */
export async function createContact(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const parsed = createContactSchema.safeParse({
    customer_id: formData.get('customer_id'),
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    mobile: formData.get('mobile'),
    role: formData.get('role'),
    is_primary: formData.get('is_primary') === 'true',
    portal_access: formData.get('portal_access') === 'true',
    preferred_contact_method: formData.get('preferred_contact_method'),
    receives_order_updates: formData.get('receives_order_updates') === 'true',
    receives_marketing: formData.get('receives_marketing') === 'true',
    notes: formData.get('notes'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const { data: contact, error } = await supabase
    .from('customer_contacts')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Log activity
  const { data: customer } = await supabase
    .from('customers')
    .select('organization_id')
    .eq('id', parsed.data.customer_id)
    .single()

  if (customer) {
    await supabase.rpc('log_customer_activity', {
      p_customer_id: parsed.data.customer_id,
      p_organization_id: customer.organization_id,
      p_type: 'contact_added',
      p_title: 'Contact added',
      p_description: `Added contact ${contact.first_name} ${contact.last_name}`,
      p_created_by: user.id,
    })
  }

  revalidatePath(`/customers/${parsed.data.customer_id}`)
  return { success: true, data: contact }
}

/**
 * Updates an existing contact with new information provided in the form data.
 *
 * Validates the input, updates the contact record in the database, and revalidates the associated customer's cache path. Returns the updated contact data on success or an error object on failure.
 *
 * @param formData - The form data containing updated contact fields and the contact ID
 * @returns An object with either the updated contact data and `success: true`, or an `error` property with details
 */
export async function updateContact(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  if (!id) {
    return { error: 'Contact ID is required' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const parsed = updateContactSchema.safeParse({
    id,
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    mobile: formData.get('mobile'),
    role: formData.get('role'),
    is_primary: formData.get('is_primary') === 'true',
    portal_access: formData.get('portal_access') === 'true',
    preferred_contact_method: formData.get('preferred_contact_method'),
    receives_order_updates: formData.get('receives_order_updates') === 'true',
    receives_marketing: formData.get('receives_marketing') === 'true',
    notes: formData.get('notes'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const { id: _, ...updateData } = parsed.data

  const { data: contact, error } = await supabase
    .from('customer_contacts')
    .update(updateData)
    .eq('id', id)
    .select('*, customer_id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/customers/${contact.customer_id}`)
  return { success: true, data: contact }
}

/**
 * Deletes a contact by ID after verifying user authorization and logs the removal as a customer activity.
 *
 * Revalidates the cache for the associated customer after deletion.
 *
 * @param id - The unique identifier of the contact to delete
 * @returns An object indicating success or containing an error message
 */
export async function deleteContact(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get contact details for logging
  const { data: contact } = await supabase
    .from('customer_contacts')
    .select('customer_id, first_name, last_name')
    .eq('id', id)
    .single()

  if (!contact) {
    return { error: 'Contact not found' }
  }

  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  // Log activity
  const { data: customer } = await supabase
    .from('customers')
    .select('organization_id')
    .eq('id', contact.customer_id)
    .single()

  if (customer) {
    await supabase.rpc('log_customer_activity', {
      p_customer_id: contact.customer_id,
      p_organization_id: customer.organization_id,
      p_type: 'contact_removed',
      p_title: 'Contact removed',
      p_description: `Removed contact ${contact.first_name} ${contact.last_name}`,
      p_created_by: user.id,
    })
  }

  revalidatePath(`/customers/${contact.customer_id}`)
  return { success: true }
}

/**
 * Assigns or updates the tier for a specific customer.
 *
 * Updates the customer's tier and logs an activity if the tier has changed. Revalidates the cache for the affected customer.
 *
 * @param data - The customer tier assignment details, including customer ID and new tier ID.
 * @returns An object indicating success or containing an error message.
 */
export async function assignCustomerTier(
  data: z.infer<typeof assignTierSchema>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: oldCustomer } = await supabase
    .from('customers')
    .select('tier_id, organization_id')
    .eq('id', data.customer_id)
    .single()

  if (!oldCustomer) {
    return { error: 'Customer not found' }
  }

  const { error } = await supabase
    .from('customers')
    .update({
      tier_id: data.tier_id,
      updated_by: user.id,
    })
    .eq('id', data.customer_id)

  if (error) {
    return { error: error.message }
  }

  // Log tier change
  if (oldCustomer.tier_id !== data.tier_id) {
    await supabase.rpc('log_customer_activity', {
      p_customer_id: data.customer_id,
      p_organization_id: oldCustomer.organization_id,
      p_type: 'tier_change',
      p_title: 'Tier changed',
      p_description: data.tier_id
        ? 'Customer tier updated'
        : 'Customer tier removed',
      p_created_by: user.id,
    })
  }

  revalidatePath(`/customers/${data.customer_id}`)
  return { success: true }
}

/**
 * Updates a customer's credit limit and logs the change as an activity.
 *
 * Returns an error if the user is unauthorized or the customer is not found. On success, updates the credit limit, records the change with the provided reason, revalidates the relevant cache path, and returns a success indicator.
 */
export async function updateCustomerCreditLimit(
  data: z.infer<typeof updateCreditLimitSchema>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('credit_limit, organization_id')
    .eq('id', data.customer_id)
    .single()

  if (!customer) {
    return { error: 'Customer not found' }
  }

  const { error } = await supabase
    .from('customers')
    .update({
      credit_limit: data.credit_limit,
      updated_by: user.id,
    })
    .eq('id', data.customer_id)

  if (error) {
    return { error: error.message }
  }

  // Log credit limit change
  await supabase.rpc('log_customer_activity', {
    p_customer_id: data.customer_id,
    p_organization_id: customer.organization_id,
    p_type: 'settings_update',
    p_title: 'Credit limit updated',
    p_description: `Credit limit changed from ${customer.credit_limit} to ${data.credit_limit}. Reason: ${data.reason}`,
    p_metadata: {
      old_limit: customer.credit_limit,
      new_limit: data.credit_limit,
      reason: data.reason,
    },
    p_created_by: user.id,
  })

  revalidatePath(`/customers/${data.customer_id}`)
  return { success: true }
}

/**
 * Logs a custom activity for a customer and revalidates the relevant cache path.
 *
 * Returns an error if the user is unauthorized or the customer is not found. On success, returns the logged activity data.
 */
export async function logCustomerActivity(
  data: z.infer<typeof createActivitySchema>
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('organization_id')
    .eq('id', data.customer_id)
    .single()

  if (!customer) {
    return { error: 'Customer not found' }
  }

  const { data: activity, error } = await supabase.rpc(
    'log_customer_activity',
    {
      p_customer_id: data.customer_id,
      p_organization_id: customer.organization_id,
      p_type: data.type,
      p_title: data.title,
      p_description: data.description,
      p_metadata: data.metadata,
      p_related_type: data.related_type,
      p_related_id: data.related_id,
      p_created_by: user.id,
    }
  )

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/customers/${data.customer_id}`)
  return { success: true, data: activity }
}
