'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  contractSchema,
  priceApprovalSchema,
  ContractItem,
} from '@/types/customer-pricing.types'
import { sendApprovalEmail } from '@/lib/email/price-approval-notification'
import { escapeCSVField } from '@/lib/utils/csv'

/**
 * Creates a new customer contract and associated contract items.
 *
 * Authenticates the user, validates contract data, ensures the customer belongs to the user's organization, and atomically creates the contract and its items using a Supabase RPC call. Revalidates relevant cache paths after creation.
 *
 * @param formData - Form data containing contract and contract item details
 * @returns The created contract data
 * @throws If the user is unauthorized, the customer is not found or not accessible, validation fails, or contract creation fails
 */
export async function createContract(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get user's organization_id
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !userProfile?.organization_id) {
    throw new Error('User profile not found or not associated with an organization')
  }

  const organizationId = userProfile.organization_id

  // Parse contract data
  const contractData = contractSchema.parse({
    customer_id: formData.get('customer_id'),
    contract_number: formData.get('contract_number'),
    contract_name: formData.get('contract_name'),
    description: formData.get('description') || undefined,
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    signed_date: formData.get('signed_date') || undefined,
    status: formData.get('status') || 'draft',
    auto_renew: formData.get('auto_renew') === 'true',
    renewal_period_months: formData.has('renewal_period_months')
      ? parseInt(formData.get('renewal_period_months') as string)
      : undefined,
    expiry_notification_days: formData.has('expiry_notification_days')
      ? parseInt(formData.get('expiry_notification_days') as string)
      : 30,
    document_url: formData.get('document_url') || undefined,
  })

  // Verify customer belongs to user's organization
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', contractData.customer_id)
    .eq('organization_id', organizationId)
    .single()

  if (customerError || !customer) {
    throw new Error('Customer not found or access denied')
  }

  // Parse contract items
  const contractItemsJson = formData.get('contract_items') as string
  const contractItems = contractItemsJson ? JSON.parse(contractItemsJson) : []

  // Use RPC to create contract and items atomically in a single transaction
  const { data: contract, error: rpcError } = await supabase
    .rpc('create_contract_with_items', {
      p_contract_data: contractData,
      p_contract_items: contractItems,
      p_user_id: user.id,
      p_organization_id: organizationId,
    })

  if (rpcError) {
    throw new Error(`Failed to create contract: ${rpcError.message}`)
  }

  if (!contract) {
    throw new Error('Contract creation failed: No data returned')
  }

  revalidatePath(`/customers/${contractData.customer_id}/pricing`)
  revalidatePath(`/customers/${contractData.customer_id}/pricing/contracts`)
  return contract
}

/**
 * Updates an existing customer contract and its items after validating user authorization and organization ownership.
 *
 * Throws an error if the user is unauthorized, the contract does not exist, or the contract does not belong to the user's organization.
 * Validates and parses contract data and items from the provided form data, then updates the contract and its items atomically.
 * Revalidates relevant cache paths upon successful update.
 */
export async function updateContract(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const contractId = formData.get('id') as string
  const customerId = formData.get('customer_id') as string

  // Get user's organization
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!userProfile?.organization_id) {
    throw new Error('User organization not found')
  }

  // Verify the contract belongs to the user's organization by checking the customer
  const { data: contract, error: contractError } = await supabase
    .from('customer_contracts')
    .select(`
      id,
      customers!inner (
        organization_id
      )
    `)
    .eq('id', contractId)
    .single()

  if (contractError || !contract) {
    throw new Error('Contract not found')
  }

  if (contract.customers.organization_id !== userProfile.organization_id) {
    throw new Error('Unauthorized: Contract belongs to a different organization')
  }

  // Parse updated contract data
  const contractData = contractSchema.parse({
    customer_id: customerId,
    contract_number: formData.get('contract_number'),
    contract_name: formData.get('contract_name'),
    description: formData.get('description') || undefined,
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    signed_date: formData.get('signed_date') || undefined,
    status: formData.get('status') || 'draft',
    auto_renew: formData.get('auto_renew') === 'true',
    renewal_period_months: formData.has('renewal_period_months')
      ? parseInt(formData.get('renewal_period_months') as string)
      : undefined,
    expiry_notification_days: formData.has('expiry_notification_days')
      ? parseInt(formData.get('expiry_notification_days') as string)
      : 30,
    document_url: formData.get('document_url') || undefined,
  })

  // Parse contract items
  const contractItemsJson = formData.get('contract_items') as string
  const contractItems = contractItemsJson ? JSON.parse(contractItemsJson) : []

  // Use RPC to update contract and items atomically in a single transaction
  const { error: updateError } = await supabase.rpc('update_contract_with_items', {
    p_contract_id: contractId,
    p_contract_data: contractData,
    p_contract_items: contractItems,
    p_user_id: user.id
  })

  if (updateError) {
    throw new Error(`Failed to update contract: ${updateError.message}`)
  }

  revalidatePath(`/customers/${customerId}/pricing`)
  revalidatePath(`/customers/${customerId}/pricing/contracts`)
}

export async function cancelContract(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const contractId = formData.get('id') as string

  // Get customer_id from the contract before updating
  const { data: contract, error: fetchError } = await supabase
    .from('customer_contracts')
    .select('customer_id')
    .eq('id', contractId)
    .single()

  if (fetchError || !contract) throw new Error('Contract not found')

  const { error } = await supabase
    .from('customer_contracts')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (error) throw error

  revalidatePath(`/customers/${contract.customer_id}/pricing/contracts`)
}

export async function renewContract(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const contractId = formData.get('id') as string
  const monthsToAdd = parseInt(formData.get('months_to_add') as string) || 12

  // Get current contract
  const { data: contract, error: fetchError } = await supabase
    .from('customer_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (fetchError || !contract) throw new Error('Contract not found')

  // Calculate new end date
  const currentEndDate = new Date(contract.end_date)
  const newEndDate = new Date(currentEndDate)
  newEndDate.setMonth(newEndDate.getMonth() + monthsToAdd)

  // Update contract
  const { error } = await supabase
    .from('customer_contracts')
    .update({
      end_date: newEndDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (error) throw error

  revalidatePath(`/customers/${contract.customer_id}/pricing/contracts`)
}

// Price History Actions
export async function getPriceHistory(
  customerId: string,
  productId?: string,
  limit: number = 50
) {
  const supabase = await createClient()

  let query = supabase
    .from('customer_price_history')
    .select(
      `
      *,
      products (
        id,
        sku,
        name
      ),
      created_by_user:created_by (
        id,
        email,
        full_name
      ),
      approved_by_user:approved_by (
        id,
        email,
        full_name
      )
    `
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

// Approval Actions
export async function createPriceApproval(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const approvalData = priceApprovalSchema.parse({
    customer_id: formData.get('customer_id'),
    product_id: formData.get('product_id'),
    current_price: parseFloat(formData.get('current_price') as string),
    requested_price: parseFloat(formData.get('requested_price') as string),
    discount_percent: parseFloat(formData.get('discount_percent') as string),
    margin_percent: parseFloat(formData.get('margin_percent') as string),
    change_reason: formData.get('change_reason'),
  })

  const { data, error } = await supabase
    .from('price_approvals')
    .insert({
      ...approvalData,
      requested_by: user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error

  // Get the full approval details with related data for the email
  const { data: approvalWithDetails, error: fetchError } = await supabase
    .from('price_approvals')
    .select(`
      *,
      customers (
        display_name,
        company_name
      ),
      products (
        name,
        sku
      ),
      requested_by_user:users!requested_by (
        email,
        full_name
      )
    `)
    .eq('id', data.id)
    .single()

  if (fetchError || !approvalWithDetails) {
    throw new Error('Failed to fetch approval details for notification')
  }

  // Get approvers from the organization
  const { data: approvers, error: approversError } = await supabase
    .from('user_profiles')
    .select('user_id, users!inner(email)')
    .eq('organization_id', approvalWithDetails.organization_id)
    .eq('role', 'approver')

  if (approversError) {
    console.error('Failed to fetch approvers:', approversError)
  }

  // Send notification emails to all approvers
  if (approvers && approvers.length > 0) {
    const emailPromises = approvers.map(async (approver: any) => {
      const approverEmail = approver.users?.email
      if (approverEmail) {
        try {
          const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pricing/approvals/${data.id}`
          await sendApprovalEmail({
            to: approverEmail,
            approval: approvalWithDetails,
            actionUrl,
          })
        } catch (err) {
          console.error(`Failed to send email to ${approverEmail}:`, err)
        }
      }
    })

    await Promise.allSettled(emailPromises)
  }

  revalidatePath('/pricing/approvals')
  return data
}

export async function approvePriceChange(approvalId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get approval details
  const { data: approval, error: fetchError } = await supabase
    .from('price_approvals')
    .select('*')
    .eq('id', approvalId)
    .single()

  if (fetchError || !approval) throw new Error('Approval not found')

  // Update approval status
  const { error: updateError } = await supabase
    .from('price_approvals')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', approvalId)

  if (updateError) throw updateError

  // Apply the price change
  if (approval.customer_pricing_id) {
    const { error: priceError } = await supabase
      .from('customer_pricing')
      .update({
        override_price: approval.requested_price,
        approval_status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', approval.customer_pricing_id)

    if (priceError) throw priceError
  }

  revalidatePath('/pricing/approvals')
  revalidatePath(`/customers/${approval.customer_id}/pricing`)
}

export async function rejectPriceChange(
  approvalId: string,
  rejectionReason: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('price_approvals')
    .update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
    })
    .eq('id', approvalId)

  if (error) throw error

  revalidatePath('/pricing/approvals')
}

/**
 * Exports a customer's product pricing data as a CSV string.
 *
 * Retrieves all products with their base and customer-specific pricing for the given customer, formats the data into a CSV file with appropriate headers, and returns the CSV content as a string.
 *
 * @param customerId - The unique identifier of the customer whose pricing data will be exported.
 * @returns A CSV string containing product pricing details for the specified customer.
 * @throws If the user is unauthorized or if there is a database query error.
 */
export async function exportCustomerPrices(customerId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get customer details
  const { data: customer } = await supabase
    .from('customers')
    .select('company_name, display_name')
    .eq('id', customerId)
    .single()

  // Get all products with customer pricing
  const { data: products, error } = await supabase
    .from('products')
    .select(
      `
      id,
      sku,
      name,
      category_id,
      product_pricing (
        base_price,
        cost,
        currency
      ),
      customer_pricing!inner (
        id,
        override_price,
        override_discount_percent,
        contract_number,
        contract_start,
        contract_end,
        approval_status,
        updated_at,
        updated_by
      )
    `
    )
    .eq('customer_pricing.customer_id', customerId)
    .order('sku')

  if (error) throw error

  // Transform to CSV format
  const headers = [
    'SKU',
    'Product Name',
    'Category',
    'Base Price',
    'Customer Price',
    'Discount %',
    'Price Source',
    'Contract Number',
    'Contract Expiry',
    'Last Updated',
    'Updated By',
  ]

  const rows = products.map((product: any) => {
    const basePrice = product.product_pricing?.[0]?.base_price || 0
    const customerPricing = product.customer_pricing?.[0]
    const customerPrice = customerPricing?.override_price || basePrice
    const discount = basePrice > 0 ? ((basePrice - customerPrice) / basePrice) * 100 : 0

    return [
      product.sku,
      product.name,
      product.category_id || '',
      basePrice.toFixed(2),
      customerPrice.toFixed(2),
      discount.toFixed(2),
      customerPricing?.contract_number ? 'Contract' : 'Custom',
      customerPricing?.contract_number || '',
      customerPricing?.contract_end || '',
      customerPricing?.updated_at
        ? new Date(customerPricing.updated_at).toLocaleDateString()
        : '',
      customerPricing?.updated_by || '',
    ]
  })

  // Generate CSV content
  const csvContent = [
    escapeCSVField(`Customer Price Sheet - ${customer?.display_name || customer?.company_name}`),
    escapeCSVField(`Generated on: ${new Date().toLocaleDateString()}`),
    '',
    headers.map(escapeCSVField).join(','),
    ...rows.map((row: (string | number)[]) =>
      row.map((cell: string | number) => escapeCSVField(cell)).join(',')
    ),
  ].join('\n')

  return csvContent
}