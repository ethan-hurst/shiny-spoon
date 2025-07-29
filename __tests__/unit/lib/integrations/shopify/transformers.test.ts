import { ShopifyTransformers } from '@/lib/integrations/shopify/transformers'
import crypto from 'crypto'
import type {
  ShopifyProduct,
  ShopifyVariant,
  ShopifyInventoryLevel,
  ShopifyOrder,
  ShopifyCustomer,
  ShopifyMetafield,
  ShopifyLineItem,
  ShopifyAddress
} from '@/types/shopify.types'

// Mock crypto module
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'abcdef1234567890abcdef1234567890')
    }))
  }))
}))

describe('ShopifyTransformers', () => {
  let transformers: ShopifyTransformers

  beforeEach(() => {
    transformers = new ShopifyTransformers()
    jest.clearAllMocks()
  })

  describe('transformProduct', () => {
    const mockProduct: ShopifyProduct = {
      id: 'gid://shopify/Product/123',
      title: 'Test Product',
      descriptionHtml: '<p>Test <strong>description</strong></p>',
      handle: 'test-product',
      vendor: 'Test Vendor',
      productType: 'Electronics',
      status: 'ACTIVE',
      tags: ['tag1', 'tag2'],
      variants: {
        edges: [{
          node: {
            id: 'gid://shopify/ProductVariant/456',
            title: 'Default',
            sku: 'TEST-SKU-001',
            price: '99.99',
            barcode: '123456789',
            weight: 1.5,
            weightUnit: 'KILOGRAMS'
          }
        }]
      },
      metafields: {
        edges: []
      }
    }

    it('should transform Shopify product successfully', () => {
      const result = transformers.transformProduct(mockProduct)

      expect(result).toEqual({
        id: 'shopify_abcdef1234567890',
        name: 'Test Product',
        sku: 'TEST-SKU-001',
        description: 'Test description',
        price: 99.99,
        category: 'Electronics',
        status: 'active',
        external_id: 'gid://shopify/Product/123',
        metadata: {
          shopify_id: 'gid://shopify/Product/123',
          shopify_handle: 'test-product',
          vendor: 'Test Vendor',
          tags: ['tag1', 'tag2'],
          variants: [{
            id: 'gid://shopify/ProductVariant/456',
            title: 'Default',
            sku: 'TEST-SKU-001',
            price: '99.99',
            barcode: '123456789',
            weight: 1.5,
            weight_unit: 'KILOGRAMS'
          }],
          metafields: {}
        }
      })
    })

    it('should throw error if product has no variants', () => {
      const productWithoutVariants = {
        ...mockProduct,
        variants: { edges: [] }
      }

      expect(() => transformers.transformProduct(productWithoutVariants))
        .toThrow('Product gid://shopify/Product/123 has no variants')
    })

    it('should handle product without SKU', () => {
      const productNoSku = {
        ...mockProduct,
        variants: {
          edges: [{
            node: {
              ...mockProduct.variants.edges[0].node,
              sku: null
            }
          }]
        }
      }

      const result = transformers.transformProduct(productNoSku)

      expect(result.sku).toBe('SHOPIFY-gid://shopify/Product/123')
      expect(crypto.createHash).toHaveBeenCalledWith('sha256')
    })

    it('should handle missing description', () => {
      const productNoDescription = {
        ...mockProduct,
        descriptionHtml: null
      }

      const result = transformers.transformProduct(productNoDescription)
      expect(result.description).toBe('')
    })

    it('should map product status correctly', () => {
      const statuses: Array<{ shopify: 'ACTIVE' | 'ARCHIVED' | 'DRAFT', expected: string }> = [
        { shopify: 'ACTIVE', expected: 'active' },
        { shopify: 'ARCHIVED', expected: 'inactive' },
        { shopify: 'DRAFT', expected: 'inactive' }
      ]

      statuses.forEach(({ shopify, expected }) => {
        const product = { ...mockProduct, status: shopify }
        const result = transformers.transformProduct(product)
        expect(result.status).toBe(expected)
      })
    })

    it('should extract truthsource metafields', () => {
      const productWithMetafields = {
        ...mockProduct,
        metafields: {
          edges: [
            {
              node: {
                namespace: 'truthsource',
                key: 'custom_field',
                value: '123',
                type: 'number_integer'
              }
            },
            {
              node: {
                namespace: 'other',
                key: 'ignored',
                value: 'value',
                type: 'string'
              }
            }
          ]
        }
      }

      const result = transformers.transformProduct(productWithMetafields)
      expect(result.metadata.metafields).toEqual({ custom_field: 123 })
    })

    it('should handle multiple variants', () => {
      const multiVariantProduct = {
        ...mockProduct,
        variants: {
          edges: [
            {
              node: {
                id: 'variant1',
                title: 'Small',
                sku: 'SKU-SMALL',
                price: '89.99',
                barcode: null,
                weight: 1.0,
                weightUnit: 'KILOGRAMS'
              }
            },
            {
              node: {
                id: 'variant2',
                title: 'Large',
                sku: 'SKU-LARGE',
                price: '109.99',
                barcode: '987654321',
                weight: 2.0,
                weightUnit: 'KILOGRAMS'
              }
            }
          ]
        }
      }

      const result = transformers.transformProduct(multiVariantProduct)
      
      // Should use first variant as primary
      expect(result.sku).toBe('SKU-SMALL')
      expect(result.price).toBe(89.99)
      
      // Should include all variants in metadata
      expect(result.metadata.variants).toHaveLength(2)
      expect(result.metadata.variants[1].sku).toBe('SKU-LARGE')
    })
  })

  describe('transformInventory', () => {
    const mockInventoryLevel: ShopifyInventoryLevel = {
      id: 'gid://shopify/InventoryLevel/123',
      available: 100,
      updatedAt: '2024-01-15T10:30:00Z',
      item: {
        id: 'gid://shopify/InventoryItem/456',
        sku: 'TEST-SKU-001'
      },
      location: {
        id: 'gid://shopify/Location/789'
      }
    }

    it('should transform inventory level successfully', () => {
      const warehouseId = 'warehouse-123'
      const result = transformers.transformInventory(mockInventoryLevel, warehouseId)

      expect(result).toEqual({
        product_id: 'shopify_abcdef1234567890',
        warehouse_id: 'warehouse-123',
        quantity: 100,
        reserved_quantity: 0,
        metadata: {
          shopify_inventory_item_id: 'gid://shopify/InventoryItem/456',
          shopify_location_id: 'gid://shopify/Location/789',
          last_updated: '2024-01-15T10:30:00Z'
        }
      })
    })

    it('should throw error if inventory item has no SKU', () => {
      const inventoryNoSku = {
        ...mockInventoryLevel,
        item: {
          id: 'gid://shopify/InventoryItem/456',
          sku: null
        }
      }

      expect(() => transformers.transformInventory(inventoryNoSku, 'warehouse-123'))
        .toThrow('Inventory item gid://shopify/InventoryItem/456 has no SKU')
    })

    it('should generate consistent product ID from SKU', () => {
      const result = transformers.transformInventory(mockInventoryLevel, 'warehouse-123')
      
      // Should call hash with same SKU to generate matching product ID
      expect(crypto.createHash).toHaveBeenCalledWith('sha256')
      const mockHash = crypto.createHash('sha256')
      expect(mockHash.update).toHaveBeenCalledWith('TEST-SKU-001')
    })
  })

  describe('transformInventoryFromWebhook', () => {
    const mockWebhookData = {
      inventory_item_id: 456,
      location_id: 789,
      available: 50,
      updated_at: '2024-01-15T10:30:00Z'
    }

    it('should transform webhook inventory data', () => {
      const result = transformers.transformInventoryFromWebhook(mockWebhookData, 'warehouse-123')

      expect(result).toEqual({
        warehouse_id: 'warehouse-123',
        quantity: 50,
        reserved_quantity: 0,
        shopify_inventory_item_id: '456',
        metadata: {
          shopify_inventory_item_id: '456',
          shopify_location_id: '789',
          last_updated: '2024-01-15T10:30:00Z'
        }
      })
    })
  })

  describe('transformOrder', () => {
    const mockOrder: ShopifyOrder = {
      id: 'gid://shopify/Order/123',
      name: '#1001',
      email: 'customer@example.com',
      totalPrice: '149.99',
      subtotalPrice: '139.99',
      totalTax: '10.00',
      currencyCode: 'USD',
      financialStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      lineItems: {
        edges: [{
          node: {
            id: 'gid://shopify/LineItem/456',
            title: 'Test Product',
            quantity: 2,
            price: '69.99',
            product: { id: 'gid://shopify/Product/789' },
            variant: { id: 'gid://shopify/ProductVariant/012', sku: 'SKU-001' }
          }
        }]
      },
      shippingAddress: {
        address1: '123 Main St',
        address2: 'Apt 4',
        city: 'New York',
        province: 'New York',
        provinceCode: 'NY',
        zip: '10001',
        country: 'United States',
        countryCode: 'US',
        phone: '555-1234',
        company: 'Acme Corp'
      },
      billingAddress: {
        address1: '456 Billing Ave',
        address2: null,
        city: 'Brooklyn',
        province: 'New York',
        provinceCode: 'NY',
        zip: '11201',
        country: 'United States',
        countryCode: 'US',
        phone: '555-5678',
        company: null
      },
      customer: {
        id: 'gid://shopify/Customer/999',
        email: 'customer@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }
    }

    it('should transform order successfully', () => {
      const result = transformers.transformOrder(mockOrder)

      expect(result).toEqual({
        external_id: 'gid://shopify/Order/123',
        order_number: '#1001',
        customer_email: 'customer@example.com',
        total_amount: 149.99,
        subtotal_amount: 139.99,
        tax_amount: 10,
        currency: 'USD',
        status: 'processing',
        line_items: [{
          external_id: 'gid://shopify/LineItem/456',
          product_id: 'gid://shopify/Product/789',
          variant_id: 'gid://shopify/ProductVariant/012',
          sku: 'SKU-001',
          title: 'Test Product',
          quantity: 2,
          price: 69.99
        }],
        shipping_address: {
          line1: '123 Main St',
          line2: 'Apt 4',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'US',
          phone: '555-1234',
          company: 'Acme Corp'
        },
        billing_address: {
          line1: '456 Billing Ave',
          line2: null,
          city: 'Brooklyn',
          state: 'NY',
          postal_code: '11201',
          country: 'US',
          phone: '555-5678',
          company: null
        },
        customer: {
          external_id: 'gid://shopify/Customer/999',
          email: 'customer@example.com',
          name: 'John Doe'
        },
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:30:00Z'
      })
    })

    it('should map order statuses correctly', () => {
      const statusTests = [
        { financial: 'REFUNDED', fulfillment: null, expected: 'cancelled' },
        { financial: 'VOIDED', fulfillment: null, expected: 'cancelled' },
        { financial: 'PAID', fulfillment: 'FULFILLED', expected: 'completed' },
        { financial: 'PAID', fulfillment: 'UNFULFILLED', expected: 'processing' },
        { financial: 'PENDING', fulfillment: null, expected: 'pending' },
        { financial: 'AUTHORIZED', fulfillment: null, expected: 'pending' }
      ]

      statusTests.forEach(({ financial, fulfillment, expected }) => {
        const order = { 
          ...mockOrder, 
          financialStatus: financial,
          fulfillmentStatus: fulfillment
        }
        const result = transformers.transformOrder(order)
        expect(result.status).toBe(expected)
      })
    })

    it('should handle missing addresses', () => {
      const orderNoAddresses = {
        ...mockOrder,
        shippingAddress: undefined,
        billingAddress: undefined
      }

      const result = transformers.transformOrder(orderNoAddresses)
      expect(result.shipping_address).toBeNull()
      expect(result.billing_address).toBeNull()
    })

    it('should handle order without customer', () => {
      const orderNoCustomer = {
        ...mockOrder,
        customer: null
      }

      const result = transformers.transformOrder(orderNoCustomer)
      expect(result.customer).toBeNull()
    })
  })

  describe('transformCustomer', () => {
    const mockCustomer: ShopifyCustomer = {
      id: 'gid://shopify/Customer/123',
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-1234',
      company: {
        name: 'Acme Corp',
        taxId: '123456789'
      },
      taxExempt: false,
      tags: ['wholesale', 'vip'],
      addresses: [
        {
          address1: '123 Main St',
          address2: 'Suite 100',
          city: 'New York',
          province: 'New York',
          provinceCode: 'NY',
          zip: '10001',
          country: 'United States',
          countryCode: 'US',
          phone: '555-1234',
          company: 'Acme Corp'
        }
      ]
    }

    it('should transform customer successfully', () => {
      const result = transformers.transformCustomer(mockCustomer)

      expect(result).toMatchObject({
        id: 'shopify_abcdef1234567890',
        name: 'Acme Corp',
        email: 'customer@example.com',
        phone: '555-1234',
        tax_id: null,
        status: 'active',
        external_id: 'gid://shopify/Customer/123',
        metadata: {
          shopify_id: 'gid://shopify/Customer/123',
          tags: ['wholesale', 'vip'],
          tax_exempt: false,
          company: {
            name: 'Acme Corp',
            taxId: '123456789'
          }
        }
      })

      expect(result.contacts).toHaveLength(1)
      expect(result.contacts[0]).toMatchObject({
        customer_id: 'shopify_abcdef1234567890',
        name: 'John Doe',
        email: 'customer@example.com',
        phone: '555-1234',
        is_primary: true,
        address_line1: '123 Main St',
        address_line2: 'Suite 100',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      })
    })

    it('should handle tax exempt customers', () => {
      const taxExemptCustomer = {
        ...mockCustomer,
        taxExempt: true
      }

      const result = transformers.transformCustomer(taxExemptCustomer)
      expect(result.tax_id).toBe('EXEMPT')
    })

    it('should use personal name when no company', () => {
      const personalCustomer = {
        ...mockCustomer,
        company: null
      }

      const result = transformers.transformCustomer(personalCustomer)
      expect(result.name).toBe('John Doe')
    })

    it('should use email as name when no other info', () => {
      const minimalCustomer = {
        ...mockCustomer,
        firstName: null,
        lastName: null,
        company: null
      }

      const result = transformers.transformCustomer(minimalCustomer)
      expect(result.name).toBe('customer@example.com')
    })

    it('should handle multiple addresses', () => {
      const multiAddressCustomer = {
        ...mockCustomer,
        addresses: [
          {
            address1: '123 Main St',
            address2: null,
            city: 'New York',
            province: 'NY',
            provinceCode: 'NY',
            zip: '10001',
            country: 'US',
            countryCode: 'US',
            phone: '555-1111',
            company: null
          },
          {
            address1: '456 Second Ave',
            address2: 'Apt 2',
            city: 'Brooklyn',
            province: 'NY',
            provinceCode: 'NY',
            zip: '11201',
            country: 'US',
            countryCode: 'US',
            phone: '555-2222',
            company: 'Branch Office'
          }
        ]
      }

      const result = transformers.transformCustomer(multiAddressCustomer)
      expect(result.contacts).toHaveLength(2)
      expect(result.contacts[0].is_primary).toBe(true)
      expect(result.contacts[1].is_primary).toBe(false)
    })
  })

  describe('transformProductFromWebhook', () => {
    const mockWebhookProduct = {
      id: 123,
      title: 'Webhook Product',
      body_html: '<p>Product description</p>',
      handle: 'webhook-product',
      vendor: 'Test Vendor',
      product_type: 'Electronics',
      status: 'active',
      tags: 'tag1, tag2, tag3',
      admin_graphql_api_id: 'gid://shopify/Product/123',
      variants: [
        {
          id: 456,
          title: 'Default',
          sku: 'WEBHOOK-SKU',
          price: '79.99',
          barcode: '123456',
          weight: 1.2,
          weight_unit: 'kg'
        }
      ]
    }

    it('should transform webhook product successfully', () => {
      const result = transformers.transformProductFromWebhook(mockWebhookProduct)

      expect(result).toEqual({
        id: 'shopify_abcdef1234567890',
        name: 'Webhook Product',
        sku: 'WEBHOOK-SKU',
        description: 'Product description',
        price: 79.99,
        category: 'Electronics',
        status: 'active',
        external_id: 'gid://shopify/Product/123',
        metadata: {
          shopify_id: '123',
          shopify_handle: 'webhook-product',
          vendor: 'Test Vendor',
          tags: ['tag1', 'tag2', 'tag3'],
          variants: [{
            id: '456',
            title: 'Default',
            sku: 'WEBHOOK-SKU',
            price: '79.99',
            barcode: '123456',
            weight: 1.2,
            weight_unit: 'kg'
          }]
        }
      })
    })

    it('should handle webhook product without variants', () => {
      const noVariantProduct = {
        ...mockWebhookProduct,
        variants: null
      }

      expect(() => transformers.transformProductFromWebhook(noVariantProduct))
        .toThrow('Product 123 has no variants')
    })

    it('should handle inactive status', () => {
      const inactiveProduct = {
        ...mockWebhookProduct,
        status: 'archived'
      }

      const result = transformers.transformProductFromWebhook(inactiveProduct)
      expect(result.status).toBe('inactive')
    })

    it('should handle missing admin_graphql_api_id', () => {
      const productNoGraphqlId = {
        ...mockWebhookProduct,
        admin_graphql_api_id: null
      }

      const result = transformers.transformProductFromWebhook(productNoGraphqlId)
      expect(result.external_id).toBe('gid://shopify/Product/123')
    })

    it('should handle empty tags', () => {
      const noTagsProduct = {
        ...mockWebhookProduct,
        tags: ''
      }

      const result = transformers.transformProductFromWebhook(noTagsProduct)
      expect(result.metadata.tags).toEqual([])
    })
  })

  describe('helper methods', () => {
    describe('stripHtml', () => {
      it('should remove HTML tags', () => {
        const html = '<p>Hello <strong>world</strong>!</p>'
        const result = (transformers as any).stripHtml(html)
        expect(result).toBe('Hello world!')
      })

      it('should handle nested tags', () => {
        const html = '<div><p>Nested <span><strong>content</strong></span></p></div>'
        const result = (transformers as any).stripHtml(html)
        expect(result).toBe('Nested content')
      })

      it('should trim whitespace', () => {
        const html = '  <p>  Spaced content  </p>  '
        const result = (transformers as any).stripHtml(html)
        expect(result).toBe('Spaced content')
      })
    })

    describe('parseMetafieldValue', () => {
      it('should parse integer values', () => {
        const result = (transformers as any).parseMetafieldValue('123', 'number_integer')
        expect(result).toBe(123)
      })

      it('should parse decimal values', () => {
        const result = (transformers as any).parseMetafieldValue('123.45', 'number_decimal')
        expect(result).toBe(123.45)
      })

      it('should parse boolean values', () => {
        expect((transformers as any).parseMetafieldValue('true', 'boolean')).toBe(true)
        expect((transformers as any).parseMetafieldValue('false', 'boolean')).toBe(false)
      })

      it('should parse JSON values', () => {
        const json = '{"key": "value", "number": 123}'
        const result = (transformers as any).parseMetafieldValue(json, 'json')
        expect(result).toEqual({ key: 'value', number: 123 })
      })

      it('should return original value for invalid JSON', () => {
        const invalidJson = '{invalid json}'
        const result = (transformers as any).parseMetafieldValue(invalidJson, 'json')
        expect(result).toBe(invalidJson)
      })

      it('should return string for unknown types', () => {
        const result = (transformers as any).parseMetafieldValue('value', 'custom_type')
        expect(result).toBe('value')
      })
    })

    describe('generateInternalId', () => {
      it('should generate consistent ID for same input', () => {
        const id1 = (transformers as any).generateInternalId('test-input')
        const id2 = (transformers as any).generateInternalId('test-input')
        expect(id1).toBe(id2)
      })

      it('should generate different IDs for different inputs', () => {
        jest.clearAllMocks()
        const mockHash1 = { update: jest.fn().mockReturnThis(), digest: jest.fn(() => 'hash1') }
        const mockHash2 = { update: jest.fn().mockReturnThis(), digest: jest.fn(() => 'hash2') }
        ;(crypto.createHash as jest.Mock)
          .mockReturnValueOnce(mockHash1)
          .mockReturnValueOnce(mockHash2)

        const id1 = (transformers as any).generateInternalId('input1')
        const id2 = (transformers as any).generateInternalId('input2')
        
        expect(id1).not.toBe(id2)
      })

      it('should trim input before hashing', () => {
        const id1 = (transformers as any).generateInternalId('  test  ')
        const id2 = (transformers as any).generateInternalId('test')
        expect(id1).toBe(id2)
      })

      it('should throw error for invalid input', () => {
        expect(() => (transformers as any).generateInternalId(''))
          .toThrow('generateInternalId: input must be a non-empty string')
        expect(() => (transformers as any).generateInternalId(null))
          .toThrow('generateInternalId: input must be a non-empty string')
        expect(() => (transformers as any).generateInternalId('   '))
          .toThrow('generateInternalId: input must be a non-empty string')
      })
    })
  })

  describe('transformPrice', () => {
    it('should transform B2B catalog price', () => {
      const price = {
        variant: { id: 'gid://shopify/ProductVariant/123' },
        price: { amount: '99.99', currencyCode: 'USD' },
        compareAtPrice: { amount: '129.99', currencyCode: 'USD' }
      }

      const result = transformers.transformPrice(price)

      expect(result).toEqual({
        variant_id: 'gid://shopify/ProductVariant/123',
        price: 99.99,
        currency: 'USD',
        compare_at_price: 129.99
      })
    })

    it('should handle missing compare at price', () => {
      const price = {
        variant: { id: 'gid://shopify/ProductVariant/123' },
        price: { amount: '99.99', currencyCode: 'USD' }
      }

      const result = transformers.transformPrice(price)

      expect(result.compare_at_price).toBeNull()
    })
  })

  describe('location mapping', () => {
    it('should return undefined for unmapped location', () => {
      const warehouseId = transformers.getWarehouseId('unknown-location')
      expect(warehouseId).toBeUndefined()
    })

    it('should check if location is mapped', () => {
      expect(transformers.isLocationMapped('unknown-location')).toBe(false)
    })
  })
})