'use server'

import { z } from 'zod'
import {
  customerImportSchema,
  transformImportData,
} from '@/lib/customers/validations'
import { createClient } from '@/lib/supabase/server'

// Parse CSV string to array of objects
function parseCSV(csvString: string): Record<string, string>[] {
  const lines = csvString.trim().split('\n')
  if (lines.length < 2) return []

  // Parse headers
  const headers = parseCSVLine(lines[0]!)

  // Parse data rows
  const data: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]!)
    if (values.length === headers.length) {
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || ''
      })
      data.push(row)
    }
  }

  return data
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  result.push(current)

  return result
}

// Convert objects to CSV string
function objectsToCSV(data: any[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const csvLines: string[] = []

  // Add headers
  csvLines.push(headers.map((h) => `"${h}"`).join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      if (
        typeof value === 'string' &&
        (value.includes(',') || value.includes('"') || value.includes('\n'))
      ) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return String(value)
    })
    csvLines.push(values.join(','))
  }

  return csvLines.join('\n')
}

export async function validateCustomerImport(csvData: string) {
  try {
    const rows = parseCSV(csvData)
    const errors: string[] = []
    let validCount = 0

    rows.forEach((row, index) => {
      try {
        customerImportSchema.parse(row)
        validCount++
      } catch (error) {
        if (error instanceof z.ZodError) {
          const rowErrors = error.errors.map(
            (e) => `Row ${index + 2}: ${e.path.join('.')} - ${e.message}`
          )
          errors.push(...rowErrors)
        }
      }
    })

    return { validCount, totalCount: rows.length, errors }
  } catch (error) {
    return {
      validCount: 0,
      totalCount: 0,
      errors: ['Failed to parse CSV data'],
    }
  }
}

export async function importCustomers(
  organizationId: string,
  csvData: string,
  onProgress?: (current: number, total: number) => void
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const rows = parseCSV(csvData)
    if (rows.length === 0) {
      return { error: 'No data to import' }
    }

    // Get existing tiers for mapping
    const { data: tiers } = await supabase
      .from('customer_tiers')
      .select('id, name')
      .eq('organization_id', organizationId)

    const tierMap = new Map(
      tiers?.map((t: any) => [t.name.toLowerCase(), t.id]) || []
    )

    // Get existing customers to check for duplicates
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('company_name, tax_id')
      .eq('organization_id', organizationId)

    const existingMap = new Set(
      existingCustomers?.map((c: any) => c.company_name.toLowerCase()) || []
    )
    const existingTaxIds = new Set(
      existingCustomers?.filter((c: any) => c.tax_id).map((c: any) => c.tax_id) || []
    )

    let imported = 0
    let skipped = 0
    const errors: string[] = []
    const customersToImport: any[] = []
    const contactsToImport: any[] = []

    // Validate and prepare data
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      try {
        // Validate row
        const parsed = customerImportSchema.parse(row)
        const { customer, contact, tier_name } = transformImportData(parsed)

        // Check for duplicates
        if (existingMap.has(customer.company_name.toLowerCase())) {
          skipped++
          continue
        }

        if (customer.tax_id && existingTaxIds.has(customer.tax_id)) {
          skipped++
          continue
        }

        // Map tier name to ID
        if (tier_name) {
          const tierId = tierMap.get(tier_name.toLowerCase())
          if (tierId) {
            customer.tier_id = tierId
          } else {
            errors.push(`Row ${i + 2}: Unknown tier "${tier_name}"`)
          }
        }

        // Add organization and user info
        customer.organization_id = organizationId
        customer.created_by = user.id
        customer.updated_by = user.id

        customersToImport.push({ customer, contact, index: i })
      } catch (error) {
        if (error instanceof z.ZodError) {
          const rowErrors = error.errors.map(
            (e) => `Row ${i + 2}: ${e.path.join('.')} - ${e.message}`
          )
          errors.push(...rowErrors)
        } else {
          errors.push(
            `Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      if (onProgress) {
        onProgress(i + 1, rows.length)
      }
    }

    // Stop if there are validation errors
    if (errors.length > 0) {
      return { imported: 0, skipped, errors }
    }

    // Import customers in batches
    const batchSize = 50
    for (let i = 0; i < customersToImport.length; i += batchSize) {
      const batch = customersToImport.slice(i, i + batchSize)

      // Insert customers
      const { data: insertedCustomers, error: insertError } = await supabase
        .from('customers')
        .insert(batch.map((item) => item.customer))
        .select('id, company_name')

      if (insertError) {
        errors.push(
          `Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`
        )
        continue
      }

      if (insertedCustomers) {
        imported += insertedCustomers.length

        // Prepare contacts for inserted customers
        for (let j = 0; j < insertedCustomers.length; j++) {
          const customer = insertedCustomers[j]
          const item = batch[j]

          if (item.contact) {
            contactsToImport.push({
              ...item.contact,
              customer_id: customer.id,
            })
          }

          // Log activity
          await supabase.rpc('log_customer_activity', {
            p_customer_id: customer.id,
            p_organization_id: organizationId,
            p_type: 'settings_update',
            p_title: 'Customer imported',
            p_description: `Customer ${customer.company_name} was imported from CSV`,
            p_created_by: user.id,
          })
        }
      }
    }

    // Import contacts
    if (contactsToImport.length > 0) {
      for (let i = 0; i < contactsToImport.length; i += batchSize) {
        const batch = contactsToImport.slice(i, i + batchSize)

        const { error: contactError } = await supabase
          .from('customer_contacts')
          .insert(batch)

        if (contactError) {
          errors.push(
            `Contact batch ${Math.floor(i / batchSize) + 1}: ${contactError.message}`
          )
        }
      }
    }

    return { imported, skipped, errors: errors.length > 0 ? errors : undefined }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to import customers',
      imported: 0,
      skipped: 0,
    }
  }
}

export async function exportCustomers(organizationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    // Fetch all customers with tiers and primary contacts
    const { data: customers, error } = await supabase
      .from('customers')
      .select(
        `
        *,
        customer_tiers!customers_tier_id_fkey (
          name
        ),
        customer_contacts!customer_contacts_customer_id_fkey (
          first_name,
          last_name,
          email,
          phone,
          mobile,
          is_primary
        )
      `
      )
      .eq('organization_id', organizationId)
      .order('company_name')

    if (error) {
      return { error: error.message }
    }

    if (!customers || customers.length === 0) {
      return { error: 'No customers to export' }
    }

    // Transform data for CSV
    const csvData = customers.map((customer: any) => {
      const primaryContact =
        customer.customer_contacts?.find((c: any) => c.is_primary) ||
        customer.customer_contacts?.[0]

      return {
        company_name: customer.company_name,
        display_name: customer.display_name || '',
        tax_id: customer.tax_id || '',
        website: customer.website || '',
        tier_name: customer.customer_tiers?.name || '',
        status: customer.status,
        customer_type: customer.customer_type,
        billing_line1: customer.billing_address?.line1 || '',
        billing_line2: customer.billing_address?.line2 || '',
        billing_city: customer.billing_address?.city || '',
        billing_state: customer.billing_address?.state || '',
        billing_postal_code: customer.billing_address?.postal_code || '',
        billing_country: customer.billing_address?.country || '',
        shipping_line1: customer.shipping_address?.line1 || '',
        shipping_line2: customer.shipping_address?.line2 || '',
        shipping_city: customer.shipping_address?.city || '',
        shipping_state: customer.shipping_address?.state || '',
        shipping_postal_code: customer.shipping_address?.postal_code || '',
        shipping_country: customer.shipping_address?.country || '',
        credit_limit: customer.credit_limit,
        payment_terms: customer.payment_terms,
        currency: customer.currency,
        notes: customer.notes || '',
        tags: Array.isArray(customer.tags) ? customer.tags.join(',') : '',
        contact_first_name: primaryContact?.first_name || '',
        contact_last_name: primaryContact?.last_name || '',
        contact_email: primaryContact?.email || '',
        contact_phone: primaryContact?.phone || '',
        contact_mobile: primaryContact?.mobile || '',
      }
    })

    const csv = objectsToCSV(csvData)

    return { data: csv, count: customers.length }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to export customers',
    }
  }
}
