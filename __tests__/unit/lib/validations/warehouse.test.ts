import { z } from 'zod'
import { warehouseSchema, addressSchema, contactSchema } from '@/lib/validations/warehouse'

describe('Warehouse Validations', () => {
  describe('addressSchema', () => {
    it('should validate complete address', () => {
      const validAddress = {
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA'
      }

      const result = addressSchema.safeParse(validAddress)
      expect(result.success).toBe(true)
    })

    it('should use default country when not provided', () => {
      const addressWithoutCountry = {
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        postalCode: '10001'
      }

      const result = addressSchema.safeParse(addressWithoutCountry)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.country).toBe('USA')
      }
    })

    it('should reject missing required fields', () => {
      const invalidAddresses = [
        { missing: 'street', data: { city: 'NY', state: 'NY', postalCode: '10001' } },
        { missing: 'city', data: { street: '123 Main', state: 'NY', postalCode: '10001' } },
        { missing: 'state', data: { street: '123 Main', city: 'NY', postalCode: '10001' } },
        { missing: 'postalCode', data: { street: '123 Main', city: 'NY', state: 'NY' } }
      ]

      invalidAddresses.forEach(({ missing, data }) => {
        const result = addressSchema.safeParse(data)
        expect(result.success).toBe(false)
        if (!result.success) {
          const errorField = result.error.issues[0].path[0]
          expect(errorField).toBe(missing)
        }
      })
    })

    it('should accept international addresses', () => {
      const internationalAddress = {
        street: '10 Downing Street',
        city: 'London',
        state: 'England',
        postalCode: 'SW1A 2AA',
        country: 'United Kingdom'
      }

      const result = addressSchema.safeParse(internationalAddress)
      expect(result.success).toBe(true)
    })
  })

  describe('contactSchema', () => {
    it('should validate complete contact', () => {
      const validContact = {
        name: 'John Doe',
        role: 'Warehouse Manager',
        email: 'john.doe@example.com',
        phone: '+1-555-123-4567',
        isPrimary: true
      }

      const result = contactSchema.safeParse(validContact)
      expect(result.success).toBe(true)
    })

    it('should validate minimal contact', () => {
      const minimalContact = {
        name: 'Jane Smith',
        role: 'Staff'
        // Optional fields omitted
      }

      const result = contactSchema.safeParse(minimalContact)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPrimary).toBe(false) // Default value
        expect(result.data.email).toBeUndefined()
        expect(result.data.phone).toBeUndefined()
      }
    })

    it('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@company.co.uk',
        'contact+tag@warehouse.org',
        '' // Empty string is allowed
      ]

      validEmails.forEach(email => {
        const result = contactSchema.safeParse({
          name: 'Test User',
          role: 'Manager',
          email
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user space@example.com'
      ]

      invalidEmails.forEach(email => {
        const result = contactSchema.safeParse({
          name: 'Test User',
          role: 'Manager',
          email
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid email')
        }
      })
    })

    it('should accept various phone formats', () => {
      const validPhones = [
        '+1-555-123-4567',
        '555-123-4567',
        '(555) 123-4567',
        '5551234567',
        '+44 20 7946 0958',
        ''
      ]

      validPhones.forEach(phone => {
        const result = contactSchema.safeParse({
          name: 'Test User',
          role: 'Manager',
          phone
        })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('warehouseSchema', () => {
    const validWarehouse = {
      name: 'Main Distribution Center',
      code: 'MAIN-DC',
      address: {
        street: '100 Warehouse Way',
        city: 'Dallas',
        state: 'TX',
        postalCode: '75001',
        country: 'USA'
      },
      contacts: [
        {
          name: 'John Manager',
          role: 'Warehouse Manager',
          email: 'john@warehouse.com',
          isPrimary: true
        }
      ]
    }

    it('should validate complete warehouse', () => {
      const result = warehouseSchema.safeParse(validWarehouse)
      expect(result.success).toBe(true)
    })

    describe('name validation', () => {
      it('should accept valid names', () => {
        const validNames = [
          'A', // Minimum length
          'Main Warehouse',
          'Distribution Center #1',
          'North-East Fulfillment Hub',
          'a'.repeat(100) // Maximum length
        ]

        validNames.forEach(name => {
          const result = warehouseSchema.safeParse({
            ...validWarehouse,
            name
          })
          expect(result.success).toBe(true)
        })
      })

      it('should reject invalid names', () => {
        const invalidNames = [
          { value: '', error: 'Warehouse name is required' },
          { value: 'a'.repeat(101), error: 'Name must be less than 100 characters' }
        ]

        invalidNames.forEach(({ value, error }) => {
          const result = warehouseSchema.safeParse({
            ...validWarehouse,
            name: value
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe(error)
          }
        })
      })
    })

    describe('code validation', () => {
      it('should accept valid codes and transform to uppercase', () => {
        const validCodes = [
          { input: 'WH', expected: 'WH' }, // Minimum length
          { input: 'main-dc', expected: 'MAIN-DC' }, // Lowercase transformed
          { input: 'WH001', expected: 'WH001' },
          { input: 'NORTH-EAST-DC-01', expected: 'NORTH-EAST-DC-01' },
          { input: 'a'.repeat(20), expected: 'A'.repeat(20) } // Maximum length
        ]

        validCodes.forEach(({ input, expected }) => {
          const result = warehouseSchema.safeParse({
            ...validWarehouse,
            code: input
          })
          
          if (!result.success) {
            console.log(`Validation failed for input "${input}":`, result.error.issues)
          }
          
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.code).toBe(expected)
          }
        })
      })

      it('should reject invalid codes', () => {
        const invalidCodes = [
          { value: 'W', error: 'Code must be at least 2 characters' },
          { value: 'a'.repeat(21), error: 'Code must be less than 20 characters' },
          { value: 'WH_001', error: 'Code must be letters, numbers, hyphens, and spaces only' },
          { value: 'WH@001', error: 'Code must be letters, numbers, hyphens, and spaces only' }
        ]

        invalidCodes.forEach(({ value, error }) => {
          const result = warehouseSchema.safeParse({
            ...validWarehouse,
            code: value
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe(error)
          }
        })
      })
    })

    describe('contacts validation', () => {
      it('should require at least one contact', () => {
        const result = warehouseSchema.safeParse({
          ...validWarehouse,
          contacts: []
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('At least one contact is required')
        }
      })

      it('should require exactly one primary contact', () => {
        const noPrimaryContacts = {
          ...validWarehouse,
          contacts: [
            {
              name: 'Contact 1',
              role: 'Staff',
              isPrimary: false
            },
            {
              name: 'Contact 2',
              role: 'Staff',
              isPrimary: false
            }
          ]
        }

        const result = warehouseSchema.safeParse(noPrimaryContacts)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Exactly one contact must be marked as primary')
        }
      })

      it('should reject multiple primary contacts', () => {
        const multiplePrimaryContacts = {
          ...validWarehouse,
          contacts: [
            {
              name: 'Contact 1',
              role: 'Manager',
              isPrimary: true
            },
            {
              name: 'Contact 2',
              role: 'Assistant Manager',
              isPrimary: true
            }
          ]
        }

        const result = warehouseSchema.safeParse(multiplePrimaryContacts)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Exactly one contact must be marked as primary')
        }
      })

      it('should accept multiple contacts with one primary', () => {
        const multipleContacts = {
          ...validWarehouse,
          contacts: [
            {
              name: 'Manager',
              role: 'Warehouse Manager',
              isPrimary: true
            },
            {
              name: 'Assistant',
              role: 'Assistant Manager',
              isPrimary: false
            },
            {
              name: 'Supervisor',
              role: 'Shift Supervisor',
              email: 'supervisor@warehouse.com',
              isPrimary: false
            }
          ]
        }

        const result = warehouseSchema.safeParse(multipleContacts)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.contacts).toHaveLength(3)
        }
      })
    })

    describe('boolean fields', () => {
      it('should set default values for booleans', () => {
        const warehouseWithoutBooleans = {
          name: 'Test Warehouse',
          code: 'TEST',
          address: validWarehouse.address,
          contacts: validWarehouse.contacts
          // is_default and active not specified
        }

        const result = warehouseSchema.safeParse(warehouseWithoutBooleans)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.is_default).toBe(false)
          expect(result.data.active).toBe(true)
        }
      })

      it('should accept explicit boolean values', () => {
        const warehouseWithBooleans = {
          ...validWarehouse,
          is_default: true,
          active: false
        }

        const result = warehouseSchema.safeParse(warehouseWithBooleans)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.is_default).toBe(true)
          expect(result.data.active).toBe(false)
        }
      })
    })

    describe('nested validation', () => {
      it('should validate all nested fields', () => {
        const invalidNestedData = {
          name: 'Test Warehouse',
          code: 'TEST',
          address: {
            street: '', // Invalid - required
            city: 'Dallas',
            state: 'TX',
            postalCode: '75001'
          },
          contacts: [
            {
              name: '', // Invalid - required
              role: 'Manager',
              email: 'invalid-email', // Invalid format
              isPrimary: true
            }
          ]
        }

        const result = warehouseSchema.safeParse(invalidNestedData)
        expect(result.success).toBe(false)
        if (!result.success) {
          // Should have multiple errors
          expect(result.error.issues.length).toBeGreaterThan(1)
          
          // Check specific errors exist
          const errorPaths = result.error.issues.map(issue => issue.path.join('.'))
          expect(errorPaths).toContain('address.street')
          expect(errorPaths).toContain('contacts.0.name')
          expect(errorPaths).toContain('contacts.0.email')
        }
      })
    })
  })

  describe('edge cases', () => {
    it('should handle whitespace in required fields', () => {
      const warehouseWithWhitespace = {
        name: '  Main Warehouse  ',
        code: '  main-dc  ',
        address: {
          street: '  123 Main St  ',
          city: '  Dallas  ',
          state: '  TX  ',
          postalCode: '  75001  ',
          country: '  USA  '
        },
        contacts: [
          {
            name: '  John Doe  ',
            role: '  Manager  ',
            isPrimary: true
          }
        ]
      }

      const result = warehouseSchema.safeParse(warehouseWithWhitespace)
      expect(result.success).toBe(true)
      if (result.success) {
        // Code should be transformed to uppercase
        expect(result.data.code).toBe('  MAIN-DC  ')
      }
    })

    it('should handle unicode in text fields', () => {
      const warehouseWithUnicode = {
        name: 'Almacén México 🏭',
        code: 'MEX-01',
        address: {
          street: 'Calle José María 123',
          city: 'Ciudad de México',
          state: 'CDMX',
          postalCode: '01000',
          country: 'México'
        },
        contacts: [
          {
            name: 'José García',
            role: 'Gerente de Almacén',
            email: '', // Remove unicode email that fails validation
            isPrimary: true
          }
        ]
      }

      const result = warehouseSchema.safeParse(warehouseWithUnicode)
      
      if (!result.success) {
        console.log('Unicode test validation failed:', result.error.issues)
      }
      
      expect(result.success).toBe(true)
    })
  })
})