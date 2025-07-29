import { z } from 'zod'
import { productSchema, bulkProductSchema } from '@/lib/validations/product'

describe('Product Validations', () => {
  describe('productSchema', () => {
    describe('SKU validation', () => {
      it('should accept valid SKUs', () => {
        const validSkus = [
          'SKU001',
          'PROD-123',
          'item_456',
          'A1B2C3',
          'TEST-SKU_001'
        ]

        validSkus.forEach(sku => {
          const result = productSchema.safeParse({
            sku,
            name: 'Test Product',
            base_price: '99.99'
          })
          expect(result.success).toBe(true)
        })
      })

      it('should reject invalid SKUs', () => {
        const invalidSkus = [
          { value: '', error: 'SKU is required' },
          { value: 'SKU 001', error: 'SKU can only contain letters, numbers, hyphens, and underscores' },
          { value: 'SKU@001', error: 'SKU can only contain letters, numbers, hyphens, and underscores' },
          { value: 'a'.repeat(51), error: 'SKU must be less than 50 characters' }
        ]

        invalidSkus.forEach(({ value, error }) => {
          const result = productSchema.safeParse({
            sku: value,
            name: 'Test Product',
            base_price: '99.99'
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toContain(error)
          }
        })
      })
    })

    describe('name validation', () => {
      it('should accept valid names', () => {
        const validNames = [
          'Product Name',
          'Product with Special Characters: ™ ® ©',
          'Product (Version 2.0)',
          'Product #1 - Special Edition',
          'a'.repeat(200) // Max length
        ]

        validNames.forEach(name => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name,
            base_price: '99.99'
          })
          expect(result.success).toBe(true)
        })
      })

      it('should reject invalid names', () => {
        const invalidNames = [
          { value: '', error: 'Product name is required' },
          { value: 'a'.repeat(201), error: 'Name must be less than 200 characters' }
        ]

        invalidNames.forEach(({ value, error }) => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: value,
            base_price: '99.99'
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe(error)
          }
        })
      })
    })

    describe('price validation', () => {
      it('should accept valid prices', () => {
        const validPrices = [
          { input: '99.99', expected: 99.99 },
          { input: '0', expected: 0 },
          { input: '1000', expected: 1000 },
          { input: '0.01', expected: 0.01 },
          { input: '9999.99', expected: 9999.99 },
          { input: '', expected: 0 } // Empty string transforms to 0
        ]

        validPrices.forEach(({ input, expected }) => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: 'Test Product',
            base_price: input
          })
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.base_price).toBe(expected)
          }
        })
      })

      it('should reject invalid prices', () => {
        const invalidPrices = [
          '99.999', // More than 2 decimal places
          '-10.00', // Negative
          'abc',    // Non-numeric
          '10.1.1', // Invalid format
          '$99.99'  // Currency symbol
        ]

        invalidPrices.forEach(price => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: 'Test Product',
            base_price: price
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe('Invalid price format')
          }
        })
      })
    })

    describe('cost validation', () => {
      it('should accept valid costs', () => {
        const validCosts = [
          { input: '49.99', expected: 49.99 },
          { input: '0', expected: 0 },
          { input: '', expected: 0 },
          { input: undefined, expected: undefined }
        ]

        validCosts.forEach(({ input, expected }) => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: 'Test Product',
            base_price: '99.99',
            cost: input
          })
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.cost).toBe(expected)
          }
        })
      })
    })

    describe('weight validation', () => {
      it('should accept valid weights', () => {
        const validWeights = [
          { input: '1.5', expected: 1.5 },
          { input: '0.001', expected: 0.001 },
          { input: '1000', expected: 1000 },
          { input: '', expected: undefined },
          { input: undefined, expected: undefined }
        ]

        validWeights.forEach(({ input, expected }) => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: 'Test Product',
            base_price: '99.99',
            weight: input
          })
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.weight).toBe(expected)
          }
        })
      })

      it('should reject invalid weights', () => {
        const invalidWeights = [
          '1.5555', // More than 3 decimal places
          '-5',     // Negative
          'heavy',  // Non-numeric
        ]

        invalidWeights.forEach(weight => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: 'Test Product',
            base_price: '99.99',
            weight
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe('Invalid weight format')
          }
        })
      })
    })

    describe('image validation', () => {
      it('should accept valid image files', () => {
        const validImages = [
          new File([''], 'test.jpg', { type: 'image/jpeg' }),
          new File([''], 'test.png', { type: 'image/png' }),
          new File([''], 'test.webp', { type: 'image/webp' })
        ]

        validImages.forEach(image => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: 'Test Product',
            base_price: '99.99',
            image
          })
          expect(result.success).toBe(true)
        })
      })

      it('should accept string URLs for images', () => {
        const result = productSchema.safeParse({
          sku: 'SKU001',
          name: 'Test Product',
          base_price: '99.99',
          image: 'https://example.com/image.jpg'
        })
        expect(result.success).toBe(true)
      })

      it('should reject invalid image types', () => {
        const invalidImages = [
          new File([''], 'test.gif', { type: 'image/gif' }),
          new File([''], 'test.bmp', { type: 'image/bmp' }),
          new File([''], 'test.svg', { type: 'image/svg+xml' }),
          new File([''], 'test.pdf', { type: 'application/pdf' })
        ]

        invalidImages.forEach(image => {
          const result = productSchema.safeParse({
            sku: 'SKU001',
            name: 'Test Product',
            base_price: '99.99',
            image
          })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe(
              'Only JPEG, PNG, and WebP image formats are allowed'
            )
          }
        })
      })
    })

    describe('optional fields', () => {
      it('should accept product with only required fields', () => {
        const result = productSchema.safeParse({
          sku: 'SKU001',
          name: 'Minimal Product',
          base_price: '99.99'
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.description).toBeUndefined()
          expect(result.data.category).toBeUndefined()
          expect(result.data.cost).toBeUndefined()
          expect(result.data.weight).toBeUndefined()
          expect(result.data.image).toBeUndefined()
        }
      })

      it('should accept product with all fields', () => {
        const result = productSchema.safeParse({
          sku: 'SKU001',
          name: 'Complete Product',
          description: 'A comprehensive product description',
          category: 'Electronics',
          base_price: '99.99',
          cost: '49.99',
          weight: '1.5',
          image: 'https://example.com/product.jpg'
        })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('bulkProductSchema', () => {
    it('should validate array of products', () => {
      const validBulkData = {
        products: [
          {
            sku: 'SKU001',
            name: 'Product 1',
            base_price: 99.99,
            cost: 49.99
          },
          {
            sku: 'SKU002',
            name: 'Product 2',
            description: 'Description',
            category: 'Electronics',
            base_price: 149.99,
            weight: 2.5
          }
        ]
      }

      const result = bulkProductSchema.safeParse(validBulkData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.products).toHaveLength(2)
      }
    })

    it('should reject more than 5000 products', () => {
      const tooManyProducts = {
        products: Array(5001).fill(null).map((_, i) => ({
          sku: `SKU${i}`,
          name: `Product ${i}`,
          base_price: 99.99
        }))
      }

      const result = bulkProductSchema.safeParse(tooManyProducts)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Maximum 5000 products per import')
      }
    })

    it('should validate numeric types in bulk import', () => {
      const bulkData = {
        products: [
          {
            sku: 'SKU001',
            name: 'Product 1',
            base_price: 99.99,
            cost: 49.99,
            weight: 1.5
          }
        ]
      }

      const result = bulkProductSchema.safeParse(bulkData)
      expect(result.success).toBe(true)
      if (result.success) {
        const product = result.data.products[0]
        expect(typeof product.base_price).toBe('number')
        expect(typeof product.cost).toBe('number')
        expect(typeof product.weight).toBe('number')
      }
    })

    it('should handle optional fields in bulk products', () => {
      const bulkData = {
        products: [
          {
            sku: 'SKU001',
            name: 'Minimal Product',
            base_price: 99.99
            // No optional fields
          }
        ]
      }

      const result = bulkProductSchema.safeParse(bulkData)
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle whitespace in string fields', () => {
      const result = productSchema.safeParse({
        sku: '  SKU001  ',
        name: '  Product Name  ',
        base_price: '99.99'
      })
      expect(result.success).toBe(true)
      // Note: Zod doesn't trim by default, you might want to add .trim() to schemas
    })

    it('should handle maximum field lengths', () => {
      const result = productSchema.safeParse({
        sku: 'A'.repeat(50), // Max length
        name: 'B'.repeat(200), // Max length
        description: 'C'.repeat(1000), // Max length
        base_price: '99.99'
      })
      expect(result.success).toBe(true)
    })

    it('should handle unicode characters in text fields', () => {
      const result = productSchema.safeParse({
        sku: 'SKU001',
        name: 'Product™ with émojis 🎉',
        description: 'Descripción en español: ñáéíóú',
        category: '电子产品', // Chinese characters
        base_price: '99.99'
      })
      expect(result.success).toBe(true)
    })
  })
})