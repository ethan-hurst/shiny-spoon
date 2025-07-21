import { z } from 'zod'

// Address schema
export const addressSchema = z.object({
  line1: z.string().min(1, 'Address is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State/Province is required'),
  postal_code: z.string().min(1, 'Postal code is required'),
  country: z.string().length(2, 'Country code must be 2 characters'),
})

// Customer schema
export const customerSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  display_name: z.string().optional(),
  tax_id: z.string().optional(),
  website: z.string().url().optional(),
  tier_id: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  customer_type: z.enum(['standard', 'vip', 'partner']).default('standard'),
  billing_address: addressSchema,
  shipping_address: addressSchema.optional(),
  credit_limit: z.number().min(0).max(1000000).default(0),
  payment_terms: z.number().min(0).max(365).default(30),
  currency: z.string().length(3).default('USD'),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

// Contact schema
export const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  role: z.enum(['primary', 'billing', 'shipping', 'contact']).default('contact'),
  is_primary: z.boolean().default(false),
  portal_access: z.boolean().default(false),
  preferred_contact_method: z.enum(['email', 'phone', 'mobile']).default('email'),
  receives_order_updates: z.boolean().default(true),
  receives_marketing: z.boolean().default(false),
  notes: z.string().optional(),
})

// Customer tier schema
export const customerTierSchema = z.object({
  name: z.string().min(1, 'Tier name is required'),
  level: z.number().min(1).max(10),
  discount_percentage: z.number().min(0).max(100).default(0),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').default('#808080'),
  benefits: z.record(z.any()).optional(),
  requirements: z.record(z.any()).optional(),
})

// Types derived from schemas
export type Address = z.infer<typeof addressSchema>
export type Customer = z.infer<typeof customerSchema>
export type Contact = z.infer<typeof contactSchema>
export type CustomerTier = z.infer<typeof customerTierSchema>

// Database types (including system fields)
export interface CustomerRecord extends Customer {
  id: string
  organization_id: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface ContactRecord extends Contact {
  id: string
  customer_id: string
  created_at: string
  updated_at: string
}

export interface CustomerTierRecord extends CustomerTier {
  id: string
  organization_id: string
  created_at: string
  updated_at: string
}

export interface CustomerActivity {
  id: string
  customer_id: string
  organization_id: string
  type: 'order' | 'payment' | 'contact' | 'note' | 'email' | 'phone' | 'meeting' | 'tier_change' | 'status_change' | 'contact_added' | 'contact_removed' | 'settings_update'
  title: string
  description?: string
  metadata?: Record<string, any>
  related_type?: string
  related_id?: string
  created_by?: string
  created_at: string
}

// Customer with related data
export interface CustomerWithTier extends CustomerRecord {
  tier_name?: string
  tier_level?: number
  tier_discount?: number
  tier_color?: string
}

export interface CustomerWithStats extends CustomerWithTier {
  total_orders: number
  total_revenue: number
  last_order_date?: string
  account_age_days: number
  contact_count?: number
  primary_contact?: ContactRecord
}

// Filter types
export interface CustomerFilters {
  search?: string
  status?: Customer['status']
  tier_id?: string
  customer_type?: Customer['customer_type']
  tags?: string[]
  min_credit_limit?: number
  max_credit_limit?: number
  created_after?: Date
  created_before?: Date
}

// Export/Import types
export interface CustomerImportData {
  company_name: string
  display_name?: string
  tax_id?: string
  website?: string
  tier_name?: string // Will be mapped to tier_id
  status?: string
  customer_type?: string
  // Address fields flattened
  billing_line1: string
  billing_line2?: string
  billing_city: string
  billing_state: string
  billing_postal_code: string
  billing_country: string
  shipping_line1?: string
  shipping_line2?: string
  shipping_city?: string
  shipping_state?: string
  shipping_postal_code?: string
  shipping_country?: string
  // Business details
  credit_limit?: number
  payment_terms?: number
  currency?: string
  notes?: string
  tags?: string // Comma-separated
  // Primary contact
  contact_first_name?: string
  contact_last_name?: string
  contact_email?: string
  contact_phone?: string
  contact_mobile?: string
}

// Utility functions
export function formatCustomerName(customer: CustomerRecord | CustomerWithTier): string {
  return customer.display_name || customer.company_name
}

export function getCustomerInitials(customer: CustomerRecord | CustomerWithTier): string {
  const name = formatCustomerName(customer)
  
  if (!name || name.trim().length === 0) {
    return ''
  }
  
  const words = name.trim().split(' ').filter(word => word.length > 0)
  
  if (words.length === 0) {
    return ''
  }
  
  if (words.length === 1) {
    // Single word - take first two characters or just first if only one character
    return words[0].slice(0, 2).toUpperCase()
  }
  
  // Multiple words - take first character of each word, up to 2 characters
  return words
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function formatContactName(contact: ContactRecord): string {
  return `${contact.first_name} ${contact.last_name}`
}

export function getContactInitials(contact: ContactRecord): string {
  return `${contact.first_name[0]}${contact.last_name[0]}`.toUpperCase()
}

export function formatAddress(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postal_code}`,
    address.country
  ].filter(Boolean)
  
  return parts.join('\n')
}

export function getCustomerStatusColor(status: Customer['status']): string {
  switch (status) {
    case 'active':
      return 'text-green-600 bg-green-50'
    case 'inactive':
      return 'text-gray-600 bg-gray-50'
    case 'suspended':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function getCustomerTypeIcon(type: Customer['customer_type']): string {
  switch (type) {
    case 'vip':
      return '⭐'
    case 'partner':
      return '🤝'
    default:
      return '👤'
  }
}

export function getActivityTypeIcon(type: CustomerActivity['type']): string {
  const icons: Record<CustomerActivity['type'], string> = {
    order: '📦',
    payment: '💰',
    contact: '📞',
    note: '📝',
    email: '📧',
    phone: '☎️',
    meeting: '🤝',
    tier_change: '🎖️',
    status_change: '🔄',
    contact_added: '➕',
    contact_removed: '➖',
    settings_update: '⚙️',
  }
  return icons[type] || '📌'
}