import { z } from 'zod'
import {
  addressSchema,
  contactSchema,
  customerSchema,
} from '@/types/customer.types'

// Customer creation schema (with required fields)
export const createCustomerSchema = customerSchema.extend({
  // Ensure billing address is required for new customers
  billing_address: addressSchema,
})

// Customer update schema (all fields optional except id)
export const updateCustomerSchema = customerSchema.partial().extend({
  id: z.string().uuid(),
})

// Contact creation schema
export const createContactSchema = contactSchema.extend({
  customer_id: z.string().uuid(),
})

// Contact update schema
export const updateContactSchema = contactSchema.partial().extend({
  id: z.string().uuid(),
})

// Bulk import schema
export const customerImportSchema = z.object({
  company_name: z.string().min(1),
  display_name: z.string().optional(),
  tax_id: z.string().optional(),
  website: z.string().optional(),
  tier_name: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  customer_type: z.enum(['standard', 'vip', 'partner']).optional(),
  billing_line1: z.string().min(1),
  billing_line2: z.string().optional(),
  billing_city: z.string().min(1),
  billing_state: z.string().min(1),
  billing_postal_code: z.string().min(1),
  billing_country: z.string().length(2),
  shipping_line1: z.string().optional(),
  shipping_line2: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_postal_code: z.string().optional(),
  shipping_country: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.length === 2,
      'Country code must be exactly 2 characters'
    ),
  credit_limit: z.number().optional(),
  payment_terms: z.number().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
  tags: z.string().optional(), // Comma-separated
  contact_first_name: z.string().optional(),
  contact_last_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  contact_mobile: z.string().optional(),
})

// Filter validation schema
export const customerFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  tier_id: z.string().uuid().optional(),
  customer_type: z.enum(['standard', 'vip', 'partner']).optional(),
  tags: z.array(z.string()).optional(),
  min_credit_limit: z.number().min(0).optional(),
  max_credit_limit: z.number().min(0).optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
})

// Activity log schema
export const createActivitySchema = z.object({
  customer_id: z.string().uuid(),
  type: z.enum([
    'order',
    'payment',
    'contact',
    'note',
    'email',
    'phone',
    'meeting',
    'tier_change',
    'status_change',
    'contact_added',
    'contact_removed',
    'settings_update',
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  related_type: z.string().optional(),
  related_id: z.string().uuid().optional(),
})

// Tier assignment schema
export const assignTierSchema = z.object({
  customer_id: z.string().uuid(),
  tier_id: z.string().uuid().nullable(),
})

// Credit limit update schema
export const updateCreditLimitSchema = z.object({
  customer_id: z.string().uuid(),
  credit_limit: z.number().min(0).max(1000000),
  reason: z.string().min(1),
})

// Portal access schema
export const updatePortalAccessSchema = z.object({
  customer_id: z.string().uuid(),
  portal_enabled: z.boolean(),
  portal_subdomain: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      'Subdomain can only contain lowercase letters, numbers, and hyphens'
    )
    .optional(),
})

// Helper to transform import data to customer data
export function transformImportData(
  data: z.infer<typeof customerImportSchema>
) {
  const customer: any = {
    company_name: data.company_name,
    display_name: data.display_name,
    tax_id: data.tax_id,
    website: data.website,
    status: data.status || 'active',
    customer_type: data.customer_type || 'standard',
    credit_limit: data.credit_limit || 0,
    payment_terms: data.payment_terms || 30,
    currency: data.currency || 'USD',
    notes: data.notes,
    tags: data.tags
      ? data.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    billing_address: {
      line1: data.billing_line1,
      line2: data.billing_line2,
      city: data.billing_city,
      state: data.billing_state,
      postal_code: data.billing_postal_code,
      country: data.billing_country,
    },
  }

  // Add shipping address if provided and complete
  if (
    data.shipping_line1 &&
    data.shipping_city &&
    data.shipping_state &&
    data.shipping_postal_code &&
    data.shipping_country
  ) {
    customer.shipping_address = {
      line1: data.shipping_line1,
      line2: data.shipping_line2,
      city: data.shipping_city,
      state: data.shipping_state,
      postal_code: data.shipping_postal_code,
      country: data.shipping_country,
    }
  }

  // Prepare contact if provided
  let contact = null
  if (data.contact_first_name && data.contact_last_name && data.contact_email) {
    contact = {
      first_name: data.contact_first_name,
      last_name: data.contact_last_name,
      email: data.contact_email,
      phone: data.contact_phone,
      mobile: data.contact_mobile,
      role: 'primary' as const,
      is_primary: true,
    }
  }

  return { customer, contact, tier_name: data.tier_name }
}
