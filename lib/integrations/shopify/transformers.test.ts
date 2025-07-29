// PRP-014: Shopify Data Transformers - Unit Tests

import crypto from 'crypto'
import { ShopifyTransformers } from './transformers'
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

describe('ShopifyTransformers', () => {
  let transformer: ShopifyTransformers
  let transformerWithMappings: ShopifyTransformers

  beforeEach(() => {
    transformer = new ShopifyTransformers()
    transformerWithMappings = new ShopifyTransformers({
      'location_123': 'warehouse_abc',
      'location_456': 'warehouse_def'
    })
  })

  describe('constructor', () => {
    it('should initialize with empty location mappings by default', () => {
      const t = new ShopifyTransformers()
      expect(t.getWarehouseId('any_location')).toBeUndefined()
    })

    it('should initialize with provided location mappings', () => {
      const mappings = { 'loc1': 'warehouse1', 'loc2': 'warehouse2' }
      const t = new ShopifyTransformers(mappings)
      expect(t.getWarehouseId('loc1')).toBe('warehouse1')
      expect(t.getWarehouseId('loc2')).toBe('warehouse2')
    })
  })

  describe('transformProduct', () => {
    const mockShopifyProduct: ShopifyProduct = {
      id: 'gid://shopify/Product/123456',
      title: 'Test Product',
      handle: 'test-product',
      descriptionHtml: '<p>Test <strong>description</strong></p>',
      status: 'ACTIVE',
      productType: 'Electronics',
      vendor: 'Test Vendor',
      tags: ['tag1', 'tag2'],
      updatedAt: '2023-01-01T12:00:00Z',
      createdAt: '2023-01-01T10:00:00Z',
      variants: {
        edges: [
          {
            node: {
              id: 'gid://shopify/ProductVariant/789',
              title: 'Default Title',
              sku: 'TEST-SKU-001',
              price: '19.99',
              compareAtPrice: '24.99',
              barcode: '123456789',
              weight: 1.5,
              weightUnit: 'kg',
              inventoryPolicy: 'DENY',
              inventoryManagement: 'SHOPIFY'
            }
          }
        ],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false
        }
      },
      metafields: {
        edges: [
          {
            node: {
              namespace: 'truthsource',
              key: 'priority',
              value: '5',
              type: 'number_integer'
            }
          }
        ],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false
        }
      }
    }

    it('should transform a complete Shopify product', () => {
      const result = transformer.transformProduct(mockShopifyProduct)

      expect(result).toMatchObject({
        name: 'Test Product',
        sku: 'TEST-SKU-001',
        description: 'Test description',
        price: 19.99,
        category: 'Electronics',
        status: 'active',
        external_id: 'gid://shopify/Product/123456'
      })

      expect(result.id).toMatch(/^shopify_[a-f0-9]{16}$/)
      expect(result.metadata).toMatchObject({
        shopify_id: 'gid://shopify/Product/123456',
        shopify_handle: 'test-product',
        vendor: 'Test Vendor',
        tags: ['tag1', 'tag2'],
        metafields: { priority: 5 }
      })
    })

    it('should handle product without SKU by generating one', () => {
      const productWithoutSku = {
        ...mockShopifyProduct,
        variants: {
          edges: [
            {
              node: {
                ...mockShopifyProduct.variants.edges[0].node,
                sku: null
              }
            }
          ],
          pageInfo: mockShopifyProduct.variants.pageInfo
        }
      }

      const result = transformer.transformProduct(productWithoutSku)
      expect(result.sku).toBe('SHOPIFY-gid://shopify/Product/123456')
    })

    it('should handle product without description', () => {
      const productWithoutDesc = {
        ...mockShopifyProduct,
        descriptionHtml: null
      }

      const result = transformer.transformProduct(productWithoutDesc)
      expect(result.description).toBe('')
    })

    it('should handle product without metafields', () => {
      const productWithoutMeta = {
        ...mockShopifyProduct,
        metafields: {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }

      const result = transformer.transformProduct(productWithoutMeta)
      expect(result.metadata.metafields).toEqual({})
    })

    it('should handle product without productType', () => {
      const productWithoutType = {
        ...mockShopifyProduct,
        productType: null
      }

      const result = transformer.transformProduct(productWithoutType)
      expect(result.category).toBe('uncategorized')
    })

    it('should throw error for product without variants', () => {
      const productWithoutVariants = {
        ...mockShopifyProduct,
        variants: {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }

      expect(() => transformer.transformProduct(productWithoutVariants))
        .toThrow('Product gid://shopify/Product/123456 has no variants')
    })

    it('should map different product statuses correctly', () => {
      const activeProduct = { ...mockShopifyProduct, status: 'ACTIVE' as const }
      const archivedProduct = { ...mockShopifyProduct, status: 'ARCHIVED' as const }
      const draftProduct = { ...mockShopifyProduct, status: 'DRAFT' as const }

      expect(transformer.transformProduct(activeProduct).status).toBe('active')
      expect(transformer.transformProduct(archivedProduct).status).toBe('inactive')
      expect(transformer.transformProduct(draftProduct).status).toBe('inactive')
    })

    it('should handle multiple variants in metadata', () => {
      const multiVariantProduct = {
        ...mockShopifyProduct,
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/789',
                title: 'Small',
                sku: 'TEST-SKU-S',
                price: '19.99',
                barcode: '123456789',
                weight: 1.0,
                weightUnit: 'kg',
                inventoryPolicy: 'DENY',
                inventoryManagement: 'SHOPIFY'
              }
            },
            {
              node: {
                id: 'gid://shopify/ProductVariant/790',
                title: 'Large',
                sku: 'TEST-SKU-L',
                price: '29.99',
                barcode: '123456790',
                weight: 2.0,
                weightUnit: 'kg',
                inventoryPolicy: 'DENY',
                inventoryManagement: 'SHOPIFY'
              }
            }
          ],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }

      const result = transformer.transformProduct(multiVariantProduct)
      expect(result.metadata.variants).toHaveLength(2)
      expect(result.metadata.variants[0]).toMatchObject({
        id: 'gid://shopify/ProductVariant/789',
        title: 'Small',
        sku: 'TEST-SKU-S'
      })
      expect(result.metadata.variants[1]).toMatchObject({
        id: 'gid://shopify/ProductVariant/790',
        title: 'Large',
        sku: 'TEST-SKU-L'
      })
    })
  })

  describe('transformInventory', () => {
    const mockInventoryLevel: ShopifyInventoryLevel = {
      item: {
        id: 'gid://shopify/InventoryItem/456789',
        sku: 'TEST-SKU-001'
      },
      location: {
        id: 'gid://shopify/Location/123'
      },
      available: 50,
      updatedAt: '2023-01-01T12:00:00Z'
    }

    it('should transform inventory level correctly', () => {
      const result = transformer.transformInventory(mockInventoryLevel, 'warehouse_123')

      expect(result).toMatchObject({
        warehouse_id: 'warehouse_123',
        quantity: 50,
        reserved_quantity: 0
      })

      expect(result.product_id).toMatch(/^shopify_[a-f0-9]{16}$/)
      expect(result.metadata).toMatchObject({
        shopify_inventory_item_id: 'gid://shopify/InventoryItem/456789',
        shopify_location_id: 'gid://shopify/Location/123',
        last_updated: '2023-01-01T12:00:00Z'
      })
    })

    it('should throw error for inventory without SKU', () => {
      const inventoryWithoutSku = {
        ...mockInventoryLevel,
        item: { ...mockInventoryLevel.item, sku: null }
      }

      expect(() => transformer.transformInventory(inventoryWithoutSku, 'warehouse_123'))
        .toThrow('Inventory item gid://shopify/InventoryItem/456789 has no SKU')
    })

    it('should handle zero quantity', () => {
      const zeroInventory = { ...mockInventoryLevel, available: 0 }
      const result = transformer.transformInventory(zeroInventory, 'warehouse_123')
      expect(result.quantity).toBe(0)
    })

    it('should handle negative quantity', () => {
      const negativeInventory = { ...mockInventoryLevel, available: -5 }
      const result = transformer.transformInventory(negativeInventory, 'warehouse_123')
      expect(result.quantity).toBe(-5)
    })
  })

  describe('transformInventoryFromWebhook', () => {
    const mockWebhookData = {
      inventory_item_id: 456789,
      location_id: 123,
      available: 25,
      updated_at: '2023-01-01T12:00:00Z'
    }

    it('should transform webhook inventory data', () => {
      const result = transformer.transformInventoryFromWebhook(mockWebhookData, 'warehouse_456')

      expect(result).toMatchObject({
        warehouse_id: 'warehouse_456',
        quantity: 25,
        reserved_quantity: 0,
        shopify_inventory_item_id: '456789'
      })

      expect(result.metadata).toMatchObject({
        shopify_inventory_item_id: '456789',
        shopify_location_id: '123',
        last_updated: '2023-01-01T12:00:00Z'
      })
    })

    it('should handle zero quantity in webhook', () => {
      const zeroWebhook = { ...mockWebhookData, available: 0 }
      const result = transformer.transformInventoryFromWebhook(zeroWebhook, 'warehouse_456')
      expect(result.quantity).toBe(0)
    })
  })

  describe('transformOrder', () => {
    const mockShopifyOrder: ShopifyOrder = {
      id: 'gid://shopify/Order/789123',
      name: '#1001',
      email: 'customer@example.com',
      totalPrice: '159.99',
      subtotalPrice: '149.99',
      totalTax: '10.00',
      currencyCode: 'USD',
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      createdAt: '2023-01-01T10:00:00Z',
      updatedAt: '2023-01-01T11:00:00Z',
      lineItems: {
        edges: [
          {
            node: {
              id: 'gid://shopify/LineItem/111',
              title: 'Test Product',
              quantity: 2,
              price: '74.995',
              product: { id: 'gid://shopify/Product/123456' },
              variant: { id: 'gid://shopify/ProductVariant/789', sku: 'TEST-SKU-001' }
            }
          }
        ],
        pageInfo: { hasNextPage: false, hasPreviousPage: false }
      },
      shippingAddress: {
        address1: '123 Main St',
        address2: 'Apt 4B',
        city: 'Anytown',
        province: 'CA',
        provinceCode: 'CA',
        zip: '12345',
        country: 'United States',
        countryCode: 'US',
        phone: '555-0123',
        company: 'Test Company'
      },
      billingAddress: {
        address1: '456 Oak Ave',
        city: 'Other City',
        province: 'NY',
        provinceCode: 'NY',
        zip: '67890',
        country: 'United States',
        countryCode: 'US'
      },
      customer: {
        id: 'gid://shopify/Customer/456',
        email: 'customer@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }
    }

    it('should transform complete order', () => {
      const result = transformer.transformOrder(mockShopifyOrder)

      expect(result).toMatchObject({
        external_id: 'gid://shopify/Order/789123',
        order_number: '#1001',
        customer_email: 'customer@example.com',
        total_amount: 159.99,
        subtotal_amount: 149.99,
        tax_amount: 10.00,
        currency: 'USD',
        status: 'completed',
        created_at: '2023-01-01T10:00:00Z',
        updated_at: '2023-01-01T11:00:00Z'
      })

      expect(result.customer).toMatchObject({
        external_id: 'gid://shopify/Customer/456',
        email: 'customer@example.com',
        name: 'John Doe'
      })

      expect(result.line_items).toHaveLength(1)
      expect(result.line_items[0]).toMatchObject({
        external_id: 'gid://shopify/LineItem/111',
        title: 'Test Product',
        quantity: 2,
        price: 74.995
      })
    })

    it('should handle order without customer', () => {
      const orderWithoutCustomer = { ...mockShopifyOrder, customer: null }
      const result = transformer.transformOrder(orderWithoutCustomer)
      expect(result.customer).toBeNull()
    })

    it('should handle order without addresses', () => {
      const orderWithoutAddresses = {
        ...mockShopifyOrder,
        shippingAddress: null,
        billingAddress: null
      }
      const result = transformer.transformOrder(orderWithoutAddresses)
      expect(result.shipping_address).toBeNull()
      expect(result.billing_address).toBeNull()
    })

    it('should map order statuses correctly', () => {
      // Test different status combinations
      const paidUnfulfilled = { ...mockShopifyOrder, financialStatus: 'PAID', fulfillmentStatus: null }
      const refunded = { ...mockShopifyOrder, financialStatus: 'REFUNDED', fulfillmentStatus: null }
      const voided = { ...mockShopifyOrder, financialStatus: 'VOIDED', fulfillmentStatus: null }
      const pending = { ...mockShopifyOrder, financialStatus: 'PENDING', fulfillmentStatus: null }

      expect(transformer.transformOrder(paidUnfulfilled).status).toBe('processing')
      expect(transformer.transformOrder(refunded).status).toBe('cancelled')
      expect(transformer.transformOrder(voided).status).toBe('cancelled')
      expect(transformer.transformOrder(pending).status).toBe('pending')
    })

    it('should handle customer name edge cases', () => {
      const customerNoLastName = {
        ...mockShopifyOrder,
        customer: { ...mockShopifyOrder.customer!, lastName: null }
      }
      const customerNoFirstName = {
        ...mockShopifyOrder,
        customer: { ...mockShopifyOrder.customer!, firstName: null }
      }
      const customerNoNames = {
        ...mockShopifyOrder,
        customer: { ...mockShopifyOrder.customer!, firstName: null, lastName: null }
      }

      expect(transformer.transformOrder(customerNoLastName).customer.name).toBe('John')
      expect(transformer.transformOrder(customerNoFirstName).customer.name).toBe('Doe')
      expect(transformer.transformOrder(customerNoNames).customer.name).toBe('')
    })
  })

  describe('transformCustomer', () => {
    const mockShopifyCustomer: ShopifyCustomer = {
      id: 'gid://shopify/Customer/456789',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-0123',
      taxExempt: false,
      tags: ['vip', 'wholesale'],
      company: {
        name: 'Doe Industries'
      },
      addresses: [
        {
          address1: '123 Main St',
          address2: 'Suite 100',
          city: 'Anytown',
          province: 'California',
          zip: '12345',
          country: 'United States',
          countryCode: 'US',
          phone: '555-0456'
        },
        {
          address1: '456 Oak Ave',
          city: 'Other City',
          province: 'New York',
          zip: '67890',
          country: 'United States',
          countryCode: 'US'
        }
      ]
    }

    it('should transform complete customer', () => {
      const result = transformer.transformCustomer(mockShopifyCustomer)

      expect(result).toMatchObject({
        name: 'Doe Industries',
        email: 'john.doe@example.com',
        phone: '555-0123',
        tax_id: null,
        status: 'active',
        external_id: 'gid://shopify/Customer/456789'
      })

      expect(result.id).toMatch(/^shopify_[a-f0-9]{16}$/)
      expect(result.metadata).toMatchObject({
        shopify_id: 'gid://shopify/Customer/456789',
        tags: ['vip', 'wholesale'],
        tax_exempt: false,
        company: { name: 'Doe Industries' }
      })

      expect(result.contacts).toHaveLength(2)
      expect(result.contacts[0]).toMatchObject({
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-0456',
        is_primary: true,
        address_line1: '123 Main St',
        address_line2: 'Suite 100',
        city: 'Anytown',
        state: 'California',
        postal_code: '12345',
        country: 'US'
      })

      expect(result.contacts[1]).toMatchObject({
        is_primary: false,
        address_line1: '456 Oak Ave',
        phone: '555-0123' // Falls back to customer phone
      })
    })

    it('should handle customer without company', () => {
      const customerWithoutCompany = { ...mockShopifyCustomer, company: null }
      const result = transformer.transformCustomer(customerWithoutCompany)
      expect(result.name).toBe('John Doe')
    })

    it('should handle customer without first/last name', () => {
      const customerWithoutNames = {
        ...mockShopifyCustomer,
        firstName: null,
        lastName: null,
        company: null
      }
      const result = transformer.transformCustomer(customerWithoutNames)
      expect(result.name).toBe('john.doe@example.com')
    })

    it('should handle tax exempt customer', () => {
      const taxExemptCustomer = { ...mockShopifyCustomer, taxExempt: true }
      const result = transformer.transformCustomer(taxExemptCustomer)
      expect(result.tax_id).toBe('EXEMPT')
    })

    it('should handle customer without addresses', () => {
      const customerWithoutAddresses = { ...mockShopifyCustomer, addresses: [] }
      const result = transformer.transformCustomer(customerWithoutAddresses)
      expect(result.contacts).toHaveLength(0)
    })

    it('should generate consistent internal ID', () => {
      const result1 = transformer.transformCustomer(mockShopifyCustomer)
      const result2 = transformer.transformCustomer(mockShopifyCustomer)
      expect(result1.id).toBe(result2.id)
    })
  })

  describe('transformProductFromWebhook', () => {
    const mockWebhookProduct = {
      id: 123456,
      title: 'Webhook Product',
      handle: 'webhook-product',
      body_html: '<p>Webhook <em>description</em></p>',
      status: 'active',
      product_type: 'Gadgets',
      vendor: 'Webhook Vendor',
      tags: 'webhook, test, product',
      admin_graphql_api_id: 'gid://shopify/Product/123456',
      variants: [
        {
          id: 789,
          title: 'Default Title',
          sku: 'WEBHOOK-SKU-001',
          price: '29.99',
          barcode: '987654321',
          weight: 2.0,
          weight_unit: 'lbs'
        }
      ]
    }

    it('should transform webhook product', () => {
      const result = transformer.transformProductFromWebhook(mockWebhookProduct)

      expect(result).toMatchObject({
        name: 'Webhook Product',
        sku: 'WEBHOOK-SKU-001',
        description: 'Webhook description',
        price: 29.99,
        category: 'Gadgets',
        status: 'active',
        external_id: 'gid://shopify/Product/123456'
      })

      expect(result.metadata).toMatchObject({
        shopify_id: '123456',
        shopify_handle: 'webhook-product',
        vendor: 'Webhook Vendor',
        tags: ['webhook', 'test', 'product']
      })
    })

    it('should handle webhook product without variants', () => {
      const productWithoutVariants = { ...mockWebhookProduct, variants: [] }
      expect(() => transformer.transformProductFromWebhook(productWithoutVariants))
        .toThrow('Product 123456 has no variants')
    })

    it('should handle webhook product with inactive status', () => {
      const inactiveProduct = { ...mockWebhookProduct, status: 'draft' }
      const result = transformer.transformProductFromWebhook(inactiveProduct)
      expect(result.status).toBe('inactive')
    })

    it('should handle webhook product without admin_graphql_api_id', () => {
      const productWithoutGraphQLId = { ...mockWebhookProduct, admin_graphql_api_id: undefined }
      const result = transformer.transformProductFromWebhook(productWithoutGraphQLId)
      expect(result.external_id).toBe('gid://shopify/Product/123456')
    })

    it('should handle webhook product without tags', () => {
      const productWithoutTags = { ...mockWebhookProduct, tags: undefined }
      const result = transformer.transformProductFromWebhook(productWithoutTags)
      expect(result.metadata.tags).toEqual([])
    })
  })

  describe('transformPrice', () => {
    const mockPrice = {
      variant: { id: 'gid://shopify/ProductVariant/123' },
      price: { amount: '19.99', currencyCode: 'USD' },
      compareAtPrice: { amount: '24.99', currencyCode: 'USD' }
    }

    it('should transform price with compare at price', () => {
      const result = transformer.transformPrice(mockPrice)
      expect(result).toMatchObject({
        variant_id: 'gid://shopify/ProductVariant/123',
        price: 19.99,
        currency: 'USD',
        compare_at_price: 24.99
      })
    })

    it('should handle price without compare at price', () => {
      const priceWithoutCompare = { ...mockPrice, compareAtPrice: undefined }
      const result = transformer.transformPrice(priceWithoutCompare)
      expect(result.compare_at_price).toBeNull()
    })
  })

  describe('getWarehouseId', () => {
    it('should return mapped warehouse ID', () => {
      expect(transformerWithMappings.getWarehouseId('location_123')).toBe('warehouse_abc')
      expect(transformerWithMappings.getWarehouseId('location_456')).toBe('warehouse_def')
    })

    it('should return undefined for unmapped location', () => {
      expect(transformerWithMappings.getWarehouseId('unknown_location')).toBeUndefined()
    })
  })

  describe('isLocationMapped', () => {
    it('should return true for mapped locations', () => {
      expect(transformerWithMappings.isLocationMapped('location_123')).toBe(true)
      expect(transformerWithMappings.isLocationMapped('location_456')).toBe(true)
    })

    it('should return false for unmapped locations', () => {
      expect(transformerWithMappings.isLocationMapped('unknown_location')).toBe(false)
    })
  })

  describe('private methods', () => {
    describe('extractMetafields', () => {
      it('should extract truthsource metafields', () => {
        const metafields = {
          edges: [
            {
              node: {
                namespace: 'truthsource',
                key: 'priority',
                value: '5',
                type: 'number_integer'
              }
            },
            {
              node: {
                namespace: 'other',
                key: 'ignored',
                value: 'test',
                type: 'string'
              }
            }
          ]
        }

        // Access private method through bracket notation for testing
        const result = (transformer as any).extractMetafields(metafields)
        expect(result).toEqual({ priority: 5 })
      })

      it('should handle empty metafields', () => {
        const result = (transformer as any).extractMetafields(undefined)
        expect(result).toEqual({})
      })

      it('should handle metafields with no edges', () => {
        const result = (transformer as any).extractMetafields({ edges: [] })
        expect(result).toEqual({})
      })
    })

    describe('parseMetafieldValue', () => {
      it('should parse number_integer', () => {
        const result = (transformer as any).parseMetafieldValue('42', 'number_integer')
        expect(result).toBe(42)
      })

      it('should parse number_decimal', () => {
        const result = (transformer as any).parseMetafieldValue('3.14', 'number_decimal')
        expect(result).toBe(3.14)
      })

      it('should parse boolean true', () => {
        const result = (transformer as any).parseMetafieldValue('true', 'boolean')
        expect(result).toBe(true)
      })

      it('should parse boolean false', () => {
        const result = (transformer as any).parseMetafieldValue('false', 'boolean')
        expect(result).toBe(false)
      })

      it('should parse JSON', () => {
        const result = (transformer as any).parseMetafieldValue('{"key":"value"}', 'json')
        expect(result).toEqual({ key: 'value' })
      })

      it('should handle invalid JSON', () => {
        const result = (transformer as any).parseMetafieldValue('invalid json', 'json')
        expect(result).toBe('invalid json')
      })

      it('should return string for unknown type', () => {
        const result = (transformer as any).parseMetafieldValue('test', 'unknown_type')
        expect(result).toBe('test')
      })
    })

    describe('stripHtml', () => {
      it('should remove HTML tags', () => {
        const result = (transformer as any).stripHtml('<p>Hello <strong>world</strong></p>')
        expect(result).toBe('Hello world')
      })

      it('should handle empty string', () => {
        const result = (transformer as any).stripHtml('')
        expect(result).toBe('')
      })

      it('should handle string without HTML', () => {
        const result = (transformer as any).stripHtml('Plain text')
        expect(result).toBe('Plain text')
      })

      it('should handle nested HTML tags', () => {
        const result = (transformer as any).stripHtml('<div><p>Nested <span>content</span></p></div>')
        expect(result).toBe('Nested content')
      })

      it('should handle self-closing tags', () => {
        const result = (transformer as any).stripHtml('Line 1<br/>Line 2<hr/>')
        expect(result).toBe('Line 1Line 2')
      })
    })

    describe('mapProductStatus', () => {
      it('should map ACTIVE to active', () => {
        const result = (transformer as any).mapProductStatus('ACTIVE')
        expect(result).toBe('active')
      })

      it('should map ARCHIVED to inactive', () => {
        const result = (transformer as any).mapProductStatus('ARCHIVED')
        expect(result).toBe('inactive')
      })

      it('should map DRAFT to inactive', () => {
        const result = (transformer as any).mapProductStatus('DRAFT')
        expect(result).toBe('inactive')
      })
    })

    describe('mapOrderStatus', () => {
      it('should map refunded orders to cancelled', () => {
        const result = (transformer as any).mapOrderStatus('REFUNDED', null)
        expect(result).toBe('cancelled')
      })

      it('should map voided orders to cancelled', () => {
        const result = (transformer as any).mapOrderStatus('VOIDED', null)
        expect(result).toBe('cancelled')
      })

      it('should map fulfilled orders to completed', () => {
        const result = (transformer as any).mapOrderStatus('PAID', 'FULFILLED')
        expect(result).toBe('completed')
      })

      it('should map paid orders to processing', () => {
        const result = (transformer as any).mapOrderStatus('PAID', null)
        expect(result).toBe('processing')
      })

      it('should map other statuses to pending', () => {
        const result = (transformer as any).mapOrderStatus('PENDING', null)
        expect(result).toBe('pending')
      })

      it('should prioritize refunded over fulfilled', () => {
        const result = (transformer as any).mapOrderStatus('REFUNDED', 'FULFILLED')
        expect(result).toBe('cancelled')
      })

      it('should prioritize voided over fulfilled', () => {
        const result = (transformer as any).mapOrderStatus('VOIDED', 'FULFILLED')
        expect(result).toBe('cancelled')
      })
    })

    describe('transformLineItem', () => {
      const mockLineItem: ShopifyLineItem = {
        id: 'gid://shopify/LineItem/123',
        title: 'Test Item',
        quantity: 2,
        price: '15.99',
        product: { id: 'gid://shopify/Product/456' },
        variant: { id: 'gid://shopify/ProductVariant/789', sku: 'TEST-SKU' }
      }

      it('should transform line item', () => {
        const result = (transformer as any).transformLineItem(mockLineItem)
        expect(result).toMatchObject({
          external_id: 'gid://shopify/LineItem/123',
          product_id: 'gid://shopify/Product/456',
          variant_id: 'gid://shopify/ProductVariant/789',
          sku: 'TEST-SKU',
          title: 'Test Item',
          quantity: 2,
          price: 15.99
        })
      })

      it('should handle line item without product', () => {
        const lineItemWithoutProduct = { ...mockLineItem, product: null }
        const result = (transformer as any).transformLineItem(lineItemWithoutProduct)
        expect(result.product_id).toBeUndefined()
      })

      it('should handle line item without variant', () => {
        const lineItemWithoutVariant = { ...mockLineItem, variant: null }
        const result = (transformer as any).transformLineItem(lineItemWithoutVariant)
        expect(result.variant_id).toBeUndefined()
        expect(result.sku).toBeUndefined()
      })
    })

    describe('transformAddress', () => {
      const mockAddress: ShopifyAddress = {
        address1: '123 Main St',
        address2: 'Apt 4B',
        city: 'Anytown',
        province: 'California',
        provinceCode: 'CA',
        zip: '12345',
        country: 'United States',
        countryCode: 'US',
        phone: '555-0123',
        company: 'Test Co'
      }

      it('should transform complete address', () => {
        const result = (transformer as any).transformAddress(mockAddress)
        expect(result).toMatchObject({
          line1: '123 Main St',
          line2: 'Apt 4B',
          city: 'Anytown',
          state: 'CA',
          postal_code: '12345',
          country: 'US',
          phone: '555-0123',
          company: 'Test Co'
        })
      })

      it('should handle null address', () => {
        const result = (transformer as any).transformAddress(null)
        expect(result).toBeNull()
      })

      it('should handle undefined address', () => {
        const result = (transformer as any).transformAddress(undefined)
        expect(result).toBeNull()
      })

      it('should prefer province code over province', () => {
        const address = { ...mockAddress, provinceCode: 'NY', province: 'New York' }
        const result = (transformer as any).transformAddress(address)
        expect(result.state).toBe('NY')
      })

      it('should fall back to province when no province code', () => {
        const address = { ...mockAddress, provinceCode: null }
        const result = (transformer as any).transformAddress(address)
        expect(result.state).toBe('California')
      })

      it('should prefer country code over country', () => {
        const address = { ...mockAddress, countryCode: 'CA', country: 'Canada' }
        const result = (transformer as any).transformAddress(address)
        expect(result.country).toBe('CA')
      })

      it('should fall back to country when no country code', () => {
        const address = { ...mockAddress, countryCode: null }
        const result = (transformer as any).transformAddress(address)
        expect(result.country).toBe('United States')
      })
    })

    describe('generateInternalId', () => {
      it('should generate consistent hash-based ID', () => {
        const input = 'TEST-SKU-001'
        const result1 = (transformer as any).generateInternalId(input)
        const result2 = (transformer as any).generateInternalId(input)

        expect(result1).toBe(result2)
        expect(result1).toMatch(/^shopify_[a-f0-9]{16}$/)
      })

      it('should generate different IDs for different inputs', () => {
        const result1 = (transformer as any).generateInternalId('SKU-001')
        const result2 = (transformer as any).generateInternalId('SKU-002')

        expect(result1).not.toBe(result2)
      })

      it('should trim input before hashing', () => {
        const result1 = (transformer as any).generateInternalId('  TEST-SKU  ')
        const result2 = (transformer as any).generateInternalId('TEST-SKU')

        expect(result1).toBe(result2)
      })

      it('should throw error for empty string', () => {
        expect(() => (transformer as any).generateInternalId(''))
          .toThrow('generateInternalId: input must be a non-empty string')
      })

      it('should throw error for whitespace-only string', () => {
        expect(() => (transformer as any).generateInternalId('   '))
          .toThrow('generateInternalId: input must be a non-empty string')
      })

      it('should throw error for null input', () => {
        expect(() => (transformer as any).generateInternalId(null))
          .toThrow('generateInternalId: input must be a non-empty string')
      })

      it('should throw error for undefined input', () => {
        expect(() => (transformer as any).generateInternalId(undefined))
          .toThrow('generateInternalId: input must be a non-empty string')
      })

      it('should throw error for non-string input', () => {
        expect(() => (transformer as any).generateInternalId(123))
          .toThrow('generateInternalId: input must be a non-empty string')
      })

      it('should generate deterministic hash', () => {
        const input = 'consistent-input'
        const hash = crypto.createHash('sha256').update(input).digest('hex')
        const expectedId = `shopify_${hash.substring(0, 16)}`

        const result = (transformer as any).generateInternalId(input)
        expect(result).toBe(expectedId)
      })
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle extremely long product titles', () => {
      const longTitle = 'A'.repeat(1000)
      const product = {
        id: 'gid://shopify/Product/123',
        title: longTitle,
        handle: 'test',
        descriptionHtml: '',
        status: 'ACTIVE' as const,
        productType: 'Test',
        vendor: 'Test',
        tags: [],
        updatedAt: '2023-01-01T12:00:00Z',
        createdAt: '2023-01-01T10:00:00Z',
        variants: {
          edges: [{
            node: {
              id: 'gid://shopify/ProductVariant/123',
              title: 'Default',
              sku: 'TEST',
              price: '10.00',
              barcode: '',
              weight: 0,
              weightUnit: 'kg',
              inventoryPolicy: 'DENY',
              inventoryManagement: 'SHOPIFY'
            }
          }],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        },
        metafields: { 
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }

      const result = transformer.transformProduct(product)
      expect(result.name).toBe(longTitle)
    })

    it('should handle special characters in SKU', () => {
      const specialSku = 'TEST-SKU-!@#$%^&*()'
      const hash = crypto.createHash('sha256').update(specialSku.trim()).digest('hex')
      const expectedId = `shopify_${hash.substring(0, 16)}`

      const result = (transformer as any).generateInternalId(specialSku)
      expect(result).toBe(expectedId)
    })

    it('should handle Unicode characters', () => {
      const unicodeSku = 'TEST-SKU-世界-🌍'
      const result = (transformer as any).generateInternalId(unicodeSku)
      expect(result).toMatch(/^shopify_[a-f0-9]{16}$/)
    })

    it('should handle very large numbers in price fields', () => {
      const product = {
        id: 'gid://shopify/Product/123',
        title: 'Expensive Product',
        handle: 'expensive',
        descriptionHtml: '',
        status: 'ACTIVE' as const,
        productType: 'Luxury',
        vendor: 'Luxury Brand',
        tags: [],
        updatedAt: '2023-01-01T12:00:00Z',
        createdAt: '2023-01-01T10:00:00Z',
        variants: {
          edges: [{
            node: {
              id: 'gid://shopify/ProductVariant/123',
              title: 'Default',
              sku: 'EXPENSIVE',
              price: '999999.99',
              barcode: '',
              weight: 0,
              weightUnit: 'kg',
              inventoryPolicy: 'DENY',
              inventoryManagement: 'SHOPIFY'
            }
          }],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        },
        metafields: { 
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }

      const result = transformer.transformProduct(product)
      expect(result.price).toBe(999999.99)
    })

    it('should handle malformed HTML in description', () => {
      const malformedHtml = '<p>Test <strong>description</strong <em>more text</p>'
      const result = (transformer as any).stripHtml(malformedHtml)
      expect(result).toBe('Test description more text')
    })

    it('should handle very large inventory quantities', () => {
      const largeInventory = {
        item: {
          id: 'gid://shopify/InventoryItem/456789',
          sku: 'TEST-SKU-001'
        },
        location: {
          id: 'gid://shopify/Location/123'
        },
        available: 999999999,
        updatedAt: '2023-01-01T12:00:00Z'
      }

      const result = transformer.transformInventory(largeInventory, 'warehouse_123')
      expect(result.quantity).toBe(999999999)
    })

    it('should handle empty tags string in webhook product', () => {
      const productWithEmptyTags = {
        id: 123456,
        title: 'Test Product',
        handle: 'test-product',
        body_html: '<p>Test</p>',
        status: 'active',
        product_type: 'Test',
        vendor: 'Test Vendor',
        tags: '',
        variants: [{
          id: 789,
          title: 'Default',
          sku: 'TEST-SKU',
          price: '10.00',
          barcode: '',
          weight: 0,
          weight_unit: 'kg'
        }]
      }

      const result = transformer.transformProductFromWebhook(productWithEmptyTags)
      expect(result.metadata.tags).toEqual([''])
    })

    it('should handle null values in webhook product variants', () => {
      const productWithNullVariantFields = {
        id: 123456,
        title: 'Test Product',
        handle: 'test-product',
        body_html: '<p>Test</p>',
        status: 'active',
        product_type: 'Test',
        vendor: 'Test Vendor',
        tags: 'test',
        variants: [{
          id: 789,
          title: 'Default',
          sku: null,
          price: '10.00',
          barcode: null,
          weight: null,
          weight_unit: null
        }]
      }

      const result = transformer.transformProductFromWebhook(productWithNullVariantFields)
      expect(result.sku).toBe('SHOPIFY-123456')
      expect(result.metadata.variants[0]).toMatchObject({
        id: '789',
        title: 'Default',
        sku: null,
        price: '10.00',
        barcode: null,
        weight: null,
        weight_unit: null
      })
    })
  })

  describe('data consistency', () => {
    it('should maintain consistent product ID generation between GraphQL and webhook transforms', () => {
      const sku = 'CONSISTENT-SKU-001'

      // GraphQL product
      const graphqlProduct = {
        id: 'gid://shopify/Product/123456',
        title: 'Test Product',
        handle: 'test-product',
        descriptionHtml: '<p>Test</p>',
        status: 'ACTIVE' as const,
        productType: 'Test',
        vendor: 'Test Vendor',
        tags: ['test'],
        updatedAt: '2023-01-01T12:00:00Z',
        createdAt: '2023-01-01T10:00:00Z',
        variants: {
          edges: [{
            node: {
              id: 'gid://shopify/ProductVariant/789',
              title: 'Default',
              sku: sku,
              price: '19.99',
              barcode: '',
              weight: 0,
              weightUnit: 'kg',
              inventoryPolicy: 'DENY',
              inventoryManagement: 'SHOPIFY'
            }
          }],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        },
        metafields: { 
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }

      // Webhook product
      const webhookProduct = {
        id: 123456,
        title: 'Test Product',
        handle: 'test-product',
        body_html: '<p>Test</p>',
        status: 'active',
        product_type: 'Test',
        vendor: 'Test Vendor',
        tags: 'test',
        variants: [{
          id: 789,
          title: 'Default',
          sku: sku,
          price: '19.99',
          barcode: '',
          weight: 0,
          weight_unit: 'kg'
        }]
      }

      const graphqlResult = transformer.transformProduct(graphqlProduct)
      const webhookResult = transformer.transformProductFromWebhook(webhookProduct)

      expect(graphqlResult.id).toBe(webhookResult.id)
    })

    it('should maintain consistent inventory product ID with product transforms', () => {
      const sku = 'INVENTORY-SKU-001'

      const inventory = {
        item: {
          id: 'gid://shopify/InventoryItem/456789',
          sku: sku
        },
        location: {
          id: 'gid://shopify/Location/123'
        },
        available: 50,
        updatedAt: '2023-01-01T12:00:00Z'
      }

      const product = {
        id: 'gid://shopify/Product/123456',
        title: 'Test Product',
        handle: 'test-product',
        descriptionHtml: '<p>Test</p>',
        status: 'ACTIVE' as const,
        productType: 'Test',
        vendor: 'Test Vendor',
        tags: ['test'],
        updatedAt: '2023-01-01T12:00:00Z',
        createdAt: '2023-01-01T10:00:00Z',
        variants: {
          edges: [{
            node: {
              id: 'gid://shopify/ProductVariant/789',
              title: 'Default',
              sku: sku,
              price: '19.99',
              barcode: '',
              weight: 0,
              weightUnit: 'kg',
              inventoryPolicy: 'DENY',
              inventoryManagement: 'SHOPIFY'
            }
          }],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        },
        metafields: { 
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }

      const inventoryResult = transformer.transformInventory(inventory, 'warehouse_123')
      const productResult = transformer.transformProduct(product)

      expect(inventoryResult.product_id).toBe(productResult.id)
    })
  })
})