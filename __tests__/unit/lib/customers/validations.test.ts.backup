import {
  createCustomerSchema,
  updateCustomerSchema,
  createContactSchema,
  updateContactSchema,
  customerImportSchema,
  customerFiltersSchema,
  createActivitySchema,
  assignTierSchema,
  updateCreditLimitSchema,
  updatePortalAccessSchema,
  transformImportData
} from '@/lib/customers/validations'
import {
  addressSchema,
  contactSchema,
  customerSchema
} from '@/types/customer.types'
import { z } from 'zod'

// No mocking - test actual schema behavior

describe('Customer Validations', () => {
  const validAddress = {
    line1: '123 Main St',
    line2: 'Suite 100',
    city: 'Anytown',
    state: 'CA',
    postal_code: '12345',
    country: 'US'
  }

  const validContact = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-0123',
    mobile: '555-0124',
    role: 'primary' as const,
    is_primary: true
  }

  const validCustomer = {
    company_name: 'Acme Corp',
    display_name: 'Acme Corporation',
    tax_id: '123-45-6789',
    website: 'https://acme.com',
    status: 'active' as const,
    customer_type: 'standard' as const,
    billing_address: validAddress,
    shipping_address: validAddress,
    credit_limit: 10000,
    payment_terms: 30,
    currency: 'USD',
    notes: 'Important customer',
    tags: ['priority', 'large-account']
  }

  describe('createCustomerSchema', () => {
    it('should validate customer data with required billing address', () => {
      const result = createCustomerSchema.safeParse(validCustomer)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(validCustomer)
    })

    it('should require billing address for new customers', () => {
      const customerWithoutBilling = { ...validCustomer }
      delete customerWithoutBilling.billing_address

      const result = createCustomerSchema.safeParse(customerWithoutBilling)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should validate complete customer data', () => {
      const result = createCustomerSchema.safeParse(validCustomer)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(validCustomer)
    })
  })

  describe('updateCustomerSchema', () => {
    it('should make all fields optional except id', () => {
      const updateData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        company_name: 'Updated Corp'
      }

      const result = updateCustomerSchema.safeParse(updateData)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(updateData)
    })

      // Test that id is required
      const invalidData = { company_name: 'Updated Corp' }
      const invalidResult = updateCustomerSchema.safeParse(invalidData)
      expect(invalidResult.success).toBe(false)
    })

    it('should require UUID for id field', () => {
      const updateData = {
        id: 'invalid-uuid',
        company_name: 'Updated Corp'
      }

      const result = updateCustomerSchema.safeParse(updateData)
      expect(result.success).toBe(false)
    })

    it('should allow partial updates', () => {
      const partialUpdate = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      }

      const result = updateCustomerSchema.safeParse(partialUpdate)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(partialUpdate)
    })
  })

  describe('createContactSchema', () => {
    it('should extend contact schema with customer_id', () => {
      const contactData = {
        ...validContact,
        customer_id: '123e4567-e89b-12d3-a456-426614174000'
      }

      const result = createContactSchema.safeParse(contactData)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(contactData)
    })

    it('should require valid UUID for customer_id', () => {
      const contactData = {
        ...validContact,
        customer_id: 'invalid-uuid'
      }

      const result = createContactSchema.safeParse(contactData)
      expect(result.success).toBe(false)
    })
  })

  describe('updateContactSchema', () => {
    it('should make all fields optional except id', () => {
      const updateData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        first_name: 'Jane'
      }

      const result = updateContactSchema.safeParse(updateData)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(updateData)
    })
  })

  describe('customerImportSchema', () => {
    const validImportData = {
      company_name: 'Import Corp',
      display_name: 'Import Corporation',
      tax_id: '987-65-4321',
      website: 'https://import.com',
      tier_name: 'Gold',
      status: 'active' as const,
      customer_type: 'vip' as const,
      billing_line1: '456 Import St',
      billing_line2: 'Floor 2',
      billing_city: 'Import City',
      billing_state: 'NY',
      billing_postal_code: '54321',
      billing_country: 'US',
      shipping_line1: '789 Ship St',
      shipping_city: 'Ship City',
      shipping_state: 'TX',
      shipping_postal_code: '98765',
      shipping_country: 'US',
      credit_limit: 25000,
      payment_terms: 45,
      currency: 'USD',
      notes: 'Imported customer',
      tags: 'imported,bulk',
      contact_first_name: 'Import',
      contact_last_name: 'Contact',
      contact_email: 'contact@import.com',
      contact_phone: '555-9876',
      contact_mobile: '555-9877'
    }

    it('should validate complete import data', () => {
      const result = customerImportSchema.safeParse(validImportData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.company_name).toBe('Import Corp')
        expect(result.data.billing_country).toBe('US')
      }
    })

    it('should require minimum fields', () => {
      const minimalData = {
        company_name: 'Minimal Corp',
        billing_line1: '123 Min St',
        billing_city: 'Min City',
        billing_state: 'CA',
        billing_postal_code: '12345',
        billing_country: 'US'
      }

      const result = customerImportSchema.safeParse(minimalData)

      expect(result.success).toBe(true)
    })

    it('should reject invalid status values', () => {
      const invalidStatusData = {
        ...validImportData,
        status: 'invalid_status'
      }

      const result = customerImportSchema.safeParse(invalidStatusData)

      expect(result.success).toBe(false)
    })

    it('should reject invalid customer_type values', () => {
      const invalidTypeData = {
        ...validImportData,
        customer_type: 'invalid_type'
      }

      const result = customerImportSchema.safeParse(invalidTypeData)

      expect(result.success).toBe(false)
    })

    it('should validate country codes are exactly 2 characters', () => {
      const invalidCountryData = {
        ...validImportData,
        billing_country: 'USA', // Too long
        shipping_country: 'U' // Too short
      }

      const result = customerImportSchema.safeParse(invalidCountryData)

      expect(result.success).toBe(false)
    })

    it('should validate email format for contact', () => {
      const invalidEmailData = {
        ...validImportData,
        contact_email: 'invalid-email'
      }

      const result = customerImportSchema.safeParse(invalidEmailData)

      expect(result.success).toBe(false)
    })

    it('should allow optional shipping country to be empty', () => {
      const dataWithoutShippingCountry = {
        ...validImportData
      }
      delete dataWithoutShippingCountry.shipping_country

      const result = customerImportSchema.safeParse(dataWithoutShippingCountry)

      expect(result.success).toBe(true)
    })

    it('should validate currency is 3 characters when provided', () => {
      const invalidCurrencyData = {
        ...validImportData,
        currency: 'USDA' // Too long
      }

      const result = customerImportSchema.safeParse(invalidCurrencyData)

      expect(result.success).toBe(false)
    })
  })

  describe('customerFiltersSchema', () => {
    it('should validate filter parameters', () => {
      const validFilters = {
        search: 'Acme',
        status: 'active' as const,
        tier_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_type: 'vip' as const,
        tags: ['priority', 'large'],
        min_credit_limit: 1000,
        max_credit_limit: 50000,
        created_after: '2024-01-01T00:00:00Z',
        created_before: '2024-12-31T23:59:59Z'
      }

      const result = customerFiltersSchema.safeParse(validFilters)

      expect(result.success).toBe(true)
    })

    it('should allow partial filter data', () => {
      const partialFilters = {
        search: 'Corp',
        status: 'active' as const
      }

      const result = customerFiltersSchema.safeParse(partialFilters)

      expect(result.success).toBe(true)
    })

    it('should reject negative credit limits', () => {
      const invalidFilters = {
        min_credit_limit: -1000
      }

      const result = customerFiltersSchema.safeParse(invalidFilters)

      expect(result.success).toBe(false)
    })

    it('should validate datetime format', () => {
      const invalidDateFilters = {
        created_after: 'invalid-date'
      }

      const result = customerFiltersSchema.safeParse(invalidDateFilters)

      expect(result.success).toBe(false)
    })

    it('should validate tier_id as UUID', () => {
      const invalidTierFilters = {
        tier_id: 'invalid-uuid'
      }

      const result = customerFiltersSchema.safeParse(invalidTierFilters)

      expect(result.success).toBe(false)
    })
  })

  describe('createActivitySchema', () => {
    it('should validate activity creation data', () => {
      const validActivity = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'order' as const,
        title: 'New Order #12345',
        description: 'Customer placed a large order',
        metadata: { order_id: '12345', amount: 1500 },
        related_type: 'order',
        related_id: '987e6543-e21b-12d3-a456-426614174000'
      }

      const result = createActivitySchema.safeParse(validActivity)

      expect(result.success).toBe(true)
    })

    it('should require minimum fields', () => {
      const minimalActivity = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'note' as const,
        title: 'Quick note'
      }

      const result = createActivitySchema.safeParse(minimalActivity)

      expect(result.success).toBe(true)
    })

    it('should validate activity type enum', () => {
      const invalidTypeActivity = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'invalid_type',
        title: 'Invalid activity'
      }

      const result = createActivitySchema.safeParse(invalidTypeActivity)

      expect(result.success).toBe(false)
    })

    it('should require non-empty title', () => {
      const emptyTitleActivity = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'note' as const,
        title: ''
      }

      const result = createActivitySchema.safeParse(emptyTitleActivity)

      expect(result.success).toBe(false)
    })
  })

  describe('assignTierSchema', () => {
    it('should validate tier assignment', () => {
      const validAssignment = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        tier_id: '987e6543-e21b-12d3-a456-426614174000'
      }

      const result = assignTierSchema.safeParse(validAssignment)

      expect(result.success).toBe(true)
    })

    it('should allow null tier_id for tier removal', () => {
      const tierRemoval = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        tier_id: null
      }

      const result = assignTierSchema.safeParse(tierRemoval)

      expect(result.success).toBe(true)
    })

    it('should validate UUIDs', () => {
      const invalidUUIDs = {
        customer_id: 'invalid-uuid',
        tier_id: 'also-invalid'
      }

      const result = assignTierSchema.safeParse(invalidUUIDs)

      expect(result.success).toBe(false)
    })
  })

  describe('updateCreditLimitSchema', () => {
    it('should validate credit limit update', () => {
      const validUpdate = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        credit_limit: 50000,
        reason: 'Increased based on payment history'
      }

      const result = updateCreditLimitSchema.safeParse(validUpdate)

      expect(result.success).toBe(true)
    })

    it('should enforce credit limit bounds', () => {
      const negativeLimit = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        credit_limit: -1000,
        reason: 'Test'
      }

      const tooHighLimit = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        credit_limit: 1000001,
        reason: 'Test'
      }

      expect(updateCreditLimitSchema.safeParse(negativeLimit).success).toBe(false)
      expect(updateCreditLimitSchema.safeParse(tooHighLimit).success).toBe(false)
    })

    it('should require reason', () => {
      const noReason = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        credit_limit: 25000,
        reason: ''
      }

      const result = updateCreditLimitSchema.safeParse(noReason)

      expect(result.success).toBe(false)
    })
  })

  describe('updatePortalAccessSchema', () => {
    it('should validate portal access update', () => {
      const validUpdate = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        portal_enabled: true,
        portal_subdomain: 'acme-corp'
      }

      const result = updatePortalAccessSchema.safeParse(validUpdate)

      expect(result.success).toBe(true)
    })

    it('should validate subdomain format', () => {
      const invalidSubdomain = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        portal_enabled: true,
        portal_subdomain: 'Acme Corp!' // Invalid characters
      }

      const result = updatePortalAccessSchema.safeParse(invalidSubdomain)

      expect(result.success).toBe(false)
    })

    it('should allow optional subdomain', () => {
      const noSubdomain = {
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        portal_enabled: false
      }

      const result = updatePortalAccessSchema.safeParse(noSubdomain)

      expect(result.success).toBe(true)
    })
  })

  describe('transformImportData', () => {
    const mockImportData = {
      company_name: 'Transform Corp',
      display_name: 'Transform Corporation',
      tax_id: '111-22-3333',
      website: 'https://transform.com',
      tier_name: 'Platinum',
      status: 'active' as const,
      customer_type: 'partner' as const,
      billing_line1: '123 Transform St',
      billing_line2: 'Suite 200',
      billing_city: 'Transform City',
      billing_state: 'FL',
      billing_postal_code: '33333',
      billing_country: 'US',
      shipping_line1: '456 Ship St',
      shipping_line2: 'Dock 1',
      shipping_city: 'Ship City',
      shipping_state: 'GA',
      shipping_postal_code: '44444',
      shipping_country: 'US',
      credit_limit: 75000,
      payment_terms: 60,
      currency: 'USD',
      notes: 'Transformed customer',
      tags: 'tag1, tag2 , tag3',
      contact_first_name: 'Contact',
      contact_last_name: 'Person',
      contact_email: 'contact@transform.com',
      contact_phone: '555-1111',
      contact_mobile: '555-2222'
    }

    it('should transform import data to customer format', () => {
      const result = transformImportData(mockImportData)

      expect(result.customer.company_name).toBe('Transform Corp')
      expect(result.customer.display_name).toBe('Transform Corporation')
      expect(result.customer.billing_address).toEqual({
        line1: '123 Transform St',
        line2: 'Suite 200',
        city: 'Transform City',
        state: 'FL',
        postal_code: '33333',
        country: 'US'
      })
    })

    it('should handle optional shipping address when complete', () => {
      const result = transformImportData(mockImportData)

      expect(result.customer.shipping_address).toEqual({
        line1: '456 Ship St',
        line2: 'Dock 1',
        city: 'Ship City',
        state: 'GA',
        postal_code: '44444',
        country: 'US'
      })
    })

    it('should not include shipping address when incomplete', () => {
      const incompleteShipping = {
        ...mockImportData,
        shipping_line1: '456 Ship St',
        shipping_city: undefined, // Missing required field
        shipping_state: 'GA',
        shipping_postal_code: '44444',
        shipping_country: 'US'
      }

      const result = transformImportData(incompleteShipping)

      expect(result.customer.shipping_address).toBeUndefined()
    })

    it('should parse tags from comma-separated string', () => {
      const result = transformImportData(mockImportData)

      expect(result.customer.tags).toEqual(['tag1', 'tag2', 'tag3'])
    })

    it('should handle empty tags string', () => {
      const noTags = { ...mockImportData, tags: '' }
      const result = transformImportData(noTags)

      expect(result.customer.tags).toEqual([])
    })

    it('should handle undefined tags', () => {
      const noTags = { ...mockImportData }
      delete noTags.tags
      const result = transformImportData(noTags)

      expect(result.customer.tags).toEqual([])
    })

    it('should apply default values', () => {
      const minimalData = {
        company_name: 'Minimal Corp',
        billing_line1: '123 Min St',
        billing_city: 'Min City',
        billing_state: 'CA',
        billing_postal_code: '12345',
        billing_country: 'US'
      }

      const result = transformImportData(minimalData)

      expect(result.customer.status).toBe('active')
      expect(result.customer.customer_type).toBe('standard')
      expect(result.customer.credit_limit).toBe(0)
      expect(result.customer.payment_terms).toBe(30)
      expect(result.customer.currency).toBe('USD')
    })

    it('should create contact when all required fields are present', () => {
      const result = transformImportData(mockImportData)

      expect(result.contact).toEqual({
        first_name: 'Contact',
        last_name: 'Person',
        email: 'contact@transform.com',
        phone: '555-1111',
        mobile: '555-2222',
        role: 'primary',
        is_primary: true
      })
    })

    it('should not create contact when required fields are missing', () => {
      const noContact = { ...mockImportData }
      delete noContact.contact_email // Missing required field

      const result = transformImportData(noContact)

      expect(result.contact).toBeNull()
    })

    it('should return tier_name separately', () => {
      const result = transformImportData(mockImportData)

      expect(result.tier_name).toBe('Platinum')
    })

    it('should handle undefined tier_name', () => {
      const noTier = { ...mockImportData }
      delete noTier.tier_name

      const result = transformImportData(noTier)

      expect(result.tier_name).toBeUndefined()
    })

    it('should handle all optional fields as undefined', () => {
      const minimalData = {
        company_name: 'Minimal Corp',
        billing_line1: '123 Min St',
        billing_city: 'Min City',
        billing_state: 'CA',
        billing_postal_code: '12345',
        billing_country: 'US'
      }

      const result = transformImportData(minimalData)

      expect(result.customer.display_name).toBeUndefined()
      expect(result.customer.tax_id).toBeUndefined()
      expect(result.customer.website).toBeUndefined()
      expect(result.customer.notes).toBeUndefined()
      expect(result.contact).toBeNull()
      expect(result.tier_name).toBeUndefined()
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should work together for complete customer import workflow', () => {
      // Step 1: Validate import data
      const importData = {
        company_name: 'Integration Corp',
        billing_line1: '123 Integration St',
        billing_city: 'Integration City',
        billing_state: 'CA',
        billing_postal_code: '12345',
        billing_country: 'US',
        contact_first_name: 'John',
        contact_last_name: 'Doe',
        contact_email: 'john@integration.com'
      }

      const importResult = customerImportSchema.safeParse(importData)
      expect(importResult.success).toBe(true)

      // Step 2: Transform to internal format
      const transformed = transformImportData(importData)
      expect(transformed.customer.company_name).toBe('Integration Corp')
      expect(transformed.contact).not.toBeNull()

      // Step 3: Validate transformed customer data
      const customerResult = createCustomerSchema.safeParse(transformed.customer)
      expect(customerResult.success).toBe(true)
    })

    it('should handle schema validation errors consistently', () => {
      const invalidData = {
        company_name: '', // Empty required field
        billing_line1: '123 Test St',
        billing_city: 'Test City',
        billing_state: 'CA',
        billing_postal_code: '12345',
        billing_country: 'USA' // Invalid country code
      }

      const result = customerImportSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })
})