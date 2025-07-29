// PRP-014: Shopify Transformers Unit Tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShopifyTransformers } from '@/lib/integrations/shopify/transformers'

describe('ShopifyTransformers', () => {
  let transformers: ShopifyTransformers

  beforeEach(() => {
    transformers = new ShopifyTransformers({
      field_mappings: {
        'shopify_custom_field': 'internal_custom_field',
        'shopify_vendor': 'internal_brand'
      },
      location_mappings: {
        '1': 'warehouse_main',
        '2': 'warehouse_secondary'
      },
      default_currency: 'USD',
      weight_unit_conversion: 'grams'
    })
  })

  describe('transformProduct', () => {
    it('should transform Shopify product to internal format', () => {
      const shopifyProduct = {
        id: 123456789,
        title: 'Test Product',
        body_html: '<p>Product description</p>',
        handle: 'test-product',
        vendor: 'Test Vendor',
        product_type: 'Electronics',
        status: 'active',
        tags: ['electronics', 'gadgets'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        variants: [
          {
            id: 987654321,
            title: 'Default Title',
            sku: 'TEST-SKU-001',
            price: '29.99',
            compare_at_price: '39.99',
            inventory_quantity: 100,
            inventory_policy: 'deny',
            inventory_management: 'shopify',
            weight: 500,
            weight_unit: 'g'
          }
        ],
        images: [
          {
            id: 111222333,
            src: 'https://example.com/image.jpg',
            alt: 'Product Image',
            width: 800,
            height: 600
          }
        ],
        options: [
          {
            id: 444555666,
            name: 'Size',
            position: 1,
            values: ['Small', 'Medium', 'Large']
          }
        ],
        shopify_custom_field: 'custom_value'
      }

      const result = transformers.transformProduct(shopifyProduct)

      expect(result).toEqual({
        id: '123456789',
        external_id: '123456789',
        platform: 'shopify',
        title: 'Test Product',
        description: '<p>Product description</p>',
        handle: 'test-product',
        vendor: 'Test Vendor',
        product_type: 'Electronics',
        status: 'active',
        tags: ['electronics', 'gadgets'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        published_at: '2024-01-01T00:00:00Z',
        variants: [
          {
            id: '987654321',
            external_id: '987654321',
            title: 'Default Title',
            sku: 'TEST-SKU-001',
            barcode: undefined,
            price: 29.99,
            compare_at_price: 39.99,
            cost: null,
            weight: 500,
            weight_unit: 'grams',
            inventory_quantity: 100,
            inventory_policy: 'deny',
            inventory_management: 'shopify',
            fulfillment_service: undefined,
            position: undefined,
            option1: undefined,
            option2: undefined,
            option3: undefined,
            created_at: undefined,
            updated_at: undefined,
            inventory_item_id: undefined
          }
        ],
        images: [
          {
            id: '111222333',
            external_id: '111222333',
            src: 'https://example.com/image.jpg',
            alt: 'Product Image',
            width: 800,
            height: 600,
            position: undefined,
            created_at: undefined,
            updated_at: undefined
          }
        ],
        options: [
          {
            id: 444555666,
            name: 'Size',
            position: 1,
            values: ['Small', 'Medium', 'Large']
          }
        ],
        metafields: [],
        internal_custom_field: 'custom_value',
        internal_brand: 'Test Vendor'
      })
    })

    it('should handle missing optional fields', () => {
      const minimalProduct = {
        id: 123456789,
        title: 'Minimal Product',
        status: 'active',
        variants: []
      }

      const result = transformers.transformProduct(minimalProduct)

      expect(result.title).toBe('Minimal Product')
      expect(result.status).toBe('active')
      expect(result.variants).toEqual([])
      expect(result.description).toBeUndefined()
    })
  })

  describe('transformVariant', () => {
    it('should transform Shopify variant to internal format', () => {
      const shopifyVariant = {
        id: 987654321,
        title: 'Large - Blue',
        sku: 'LARGE-BLUE-001',
        barcode: '1234567890123',
        price: '49.99',
        compare_at_price: '59.99',
        cost: '25.00',
        weight: 750,
        weight_unit: 'g',
        inventory_quantity: 50,
        inventory_policy: 'continue',
        inventory_management: 'shopify',
        fulfillment_service: 'manual',
        position: 1,
        option1: 'Large',
        option2: 'Blue',
        option3: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        inventory_item_id: 555666777
      }

      const result = transformers.transformVariant(shopifyVariant)

      expect(result).toEqual({
        id: '987654321',
        external_id: '987654321',
        title: 'Large - Blue',
        sku: 'LARGE-BLUE-001',
        barcode: '1234567890123',
        price: 49.99,
        compare_at_price: 59.99,
        cost: 25,
        weight: 750,
        weight_unit: 'grams',
        inventory_quantity: 50,
        inventory_policy: 'continue',
        inventory_management: 'shopify',
        fulfillment_service: 'manual',
        position: 1,
        option1: 'Large',
        option2: 'Blue',
        option3: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        inventory_item_id: '555666777'
      })
    })
  })

  describe('transformInventoryLevel', () => {
    it('should transform Shopify inventory level to internal format', () => {
      const shopifyInventory = {
        id: 111222333,
        inventory_item_id: 555666777,
        location_id: 1,
        available: 25,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        location: {
          id: 1,
          name: 'Main Location',
          address1: '123 Main St',
          city: 'New York',
          country: 'United States'
        }
      }

      const result = transformers.transformInventoryLevel(shopifyInventory)

      expect(result).toEqual({
        id: '111222333',
        external_id: '111222333',
        inventory_item_id: '555666777',
        location_id: 'warehouse_main',
        available: 25,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        location_name: 'Main Location',
        location_address: '123 Main St, New York, United States'
      })
    })

    it('should handle unmapped location IDs', () => {
      const shopifyInventory = {
        id: 111222333,
        inventory_item_id: 555666777,
        location_id: 999, // Unmapped location
        available: 25
      }

      const result = transformers.transformInventoryLevel(shopifyInventory)

      expect(result.location_id).toBe('999')
    })
  })

  describe('transformCustomer', () => {
    it('should transform Shopify customer to internal format', () => {
      const shopifyCustomer = {
        id: 123456789,
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890',
        tax_exempt: false,
        tags: ['vip', 'wholesale'],
        note: 'Important customer',
        total_spent: '1500.00',
        orders_count: 15,
        state: 'enabled',
        verified_email: true,
        accepts_marketing: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        default_address: {
          id: 111222333,
          customer_id: 123456789,
          first_name: 'John',
          last_name: 'Doe',
          company: 'Acme Corp',
          address1: '123 Business St',
          address2: 'Suite 100',
          city: 'New York',
          province: 'NY',
          country: 'United States',
          zip: '10001',
          phone: '+1234567890'
        },
        addresses: [
          {
            id: 111222333,
            customer_id: 123456789,
            first_name: 'John',
            last_name: 'Doe',
            company: 'Acme Corp',
            address1: '123 Business St',
            address2: 'Suite 100',
            city: 'New York',
            province: 'NY',
            country: 'United States',
            zip: '10001',
            phone: '+1234567890'
          }
        ],
        company: {
          id: 444555666,
          name: 'Acme Corporation',
          external_id: 'ACME001',
          note: 'B2B customer'
        }
      }

      const result = transformers.transformCustomer(shopifyCustomer)

      expect(result).toEqual({
        id: '123456789',
        external_id: '123456789',
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890',
        tax_exempt: false,
        tags: ['vip', 'wholesale'],
        note: 'Important customer',
        total_spent: 1500,
        orders_count: 15,
        state: 'enabled',
        verified_email: true,
        multipass_identifier: undefined,
        accepts_marketing: true,
        accepts_marketing_updated_at: undefined,
        marketing_opt_in_level: undefined,
        tax_exemptions: [],
        admin_graphql_api_id: undefined,
        default_address: {
          id: '111222333',
          customer_id: '123456789',
          first_name: 'John',
          last_name: 'Doe',
          company: 'Acme Corp',
          address1: '123 Business St',
          address2: 'Suite 100',
          city: 'New York',
          province: 'NY',
          province_code: undefined,
          country: 'United States',
          country_code: undefined,
          zip: '10001',
          phone: '+1234567890',
          name: undefined,
          default: undefined
        },
        addresses: [
          {
            id: '111222333',
            customer_id: '123456789',
            first_name: 'John',
            last_name: 'Doe',
            company: 'Acme Corp',
            address1: '123 Business St',
            address2: 'Suite 100',
            city: 'New York',
            province: 'NY',
            province_code: undefined,
            country: 'United States',
            country_code: undefined,
            zip: '10001',
            phone: '+1234567890',
            name: undefined,
            default: undefined
          }
        ],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        company: {
          id: '444555666',
          external_id: 'ACME001',
          name: 'Acme Corporation',
          note: 'B2B customer',
          created_at: undefined,
          updated_at: undefined
        }
      })
    })
  })

  describe('transformOrder', () => {
    it('should transform Shopify order to internal format', () => {
      const shopifyOrder = {
        id: 123456789,
        name: '#1001',
        email: 'customer@example.com',
        phone: '+1234567890',
        currency: 'USD',
        presentment_currency: 'USD',
        subtotal_price: '100.00',
        total_price: '110.00',
        total_tax: '10.00',
        total_discounts: '0.00',
        total_weight: 500,
        financial_status: 'paid',
        confirmed: true,
        test: false,
        cancelled: false,
        closed: false,
        processed_at: '2024-01-01T00:00:00Z',
        fulfillment_status: 'fulfilled',
        tags: ['wholesale'],
        note: 'Rush order',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        line_items: [
          {
            id: 111222333,
            variant_id: 987654321,
            title: 'Test Product',
            quantity: 2,
            sku: 'TEST-SKU-001',
            price: '50.00'
          }
        ],
        billing_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Billing St',
          city: 'New York',
          country: 'United States'
        },
        shipping_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Shipping St',
          city: 'New York',
          country: 'United States'
        }
      }

      const result = transformers.transformOrder(shopifyOrder)

      expect(result).toEqual({
        id: '123456789',
        external_id: '123456789',
        name: '#1001',
        email: 'customer@example.com',
        phone: '+1234567890',
        currency: 'USD',
        presentment_currency: 'USD',
        subtotal_price: 100,
        total_price: 110,
        total_tax: 10,
        total_discounts: 0,
        total_weight: 500,
        total_tip_received: 0,
        total_refunds: 0,
        total_outstanding: 0,
        total_refunded: 0,
        financial_status: 'paid',
        confirmed: true,
        test: false,
        cancelled_at: undefined,
        cancel_reason: undefined,
        cancelled: false,
        closed_at: undefined,
        closed: false,
        processed_at: '2024-01-01T00:00:00Z',
        fulfillment_status: 'fulfilled',
        tags: ['wholesale'],
        note: 'Rush order',
        note_attributes: [],
        browser_ip: undefined,
        landing_site: undefined,
        landing_site_ref: undefined,
        referring_site: undefined,
        source_name: undefined,
        source_identifier: undefined,
        source_url: undefined,
        location_id: undefined,
        shipping_lines: [],
        billing_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Billing St',
          city: 'New York',
          country: 'United States'
        },
        shipping_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Shipping St',
          city: 'New York',
          country: 'United States'
        },
        line_items: [
          {
            id: '111222333',
            variant_id: '987654321',
            title: 'Test Product',
            quantity: 2,
            sku: 'TEST-SKU-001',
            variant_title: undefined,
            vendor: undefined,
            fulfillment_service: undefined,
            product_id: undefined,
            requires_shipping: false,
            taxable: false,
            gift_card: false,
            name: undefined,
            variant_inventory_management: undefined,
            properties: [],
            product_exists: false,
            fulfillable_quantity: 0,
            grams: undefined,
            price: 50,
            total_discount: 0,
            fulfillment_status: undefined,
            tax_lines: [],
            duties: [],
            discount_allocations: []
          }
        ],
        fulfillments: [],
        refunds: [],
        customer: undefined,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      })
    })
  })

  describe('transformToShopifyProduct', () => {
    it('should transform internal product to Shopify format', () => {
      const internalProduct = {
        title: 'Internal Product',
        description: '<p>Internal description</p>',
        vendor: 'Internal Brand',
        product_type: 'Electronics',
        status: 'active',
        tags: ['electronics', 'gadgets'],
        variants: [
          {
            title: 'Default Title',
            sku: 'INT-SKU-001',
            price: 29.99,
            weight: 500
          }
        ],
        internal_custom_field: 'custom_value'
      }

      const result = transformers.transformToShopifyProduct(internalProduct)

      expect(result).toEqual({
        title: 'Internal Product',
        body_html: '<p>Internal description</p>',
        vendor: 'Internal Brand',
        product_type: 'Electronics',
        status: 'active',
        tags: 'electronics, gadgets',
        variants: [
          {
            title: 'Default Title',
            sku: 'INT-SKU-001',
            barcode: undefined,
            price: '29.99',
            compare_at_price: undefined,
            cost: undefined,
            weight: 500,
            weight_unit: 'g',
            inventory_quantity: undefined,
            inventory_policy: undefined,
            inventory_management: undefined,
            fulfillment_service: undefined,
            option1: undefined,
            option2: undefined,
            option3: undefined
          }
        ],
        options: [],
        shopify_custom_field: 'custom_value'
      })
    })
  })

  describe('weight conversion', () => {
    it('should convert weight from ounces to grams', () => {
      const transformersOunces = new ShopifyTransformers({
        weight_unit_conversion: 'ounces'
      })

      const shopifyVariant = {
        weight: 16,
        weight_unit: 'oz'
      }

      const result = transformersOunces.transformVariant(shopifyVariant)
      expect(result.weight).toBe(453.592) // 16 oz * 28.3495 g/oz
    })

    it('should convert weight from pounds to grams', () => {
      const transformersPounds = new ShopifyTransformers({
        weight_unit_conversion: 'pounds'
      })

      const shopifyVariant = {
        weight: 1,
        weight_unit: 'lb'
      }

      const result = transformersPounds.transformVariant(shopifyVariant)
      expect(result.weight).toBe(453.592) // 1 lb * 453.592 g/lb
    })
  })

  describe('field mappings', () => {
    it('should apply field mappings from Shopify to internal', () => {
      const shopifyProduct = {
        id: 123456789,
        title: 'Test Product',
        shopify_custom_field: 'custom_value',
        shopify_vendor: 'Custom Brand'
      }

      const result = transformers.transformProduct(shopifyProduct)

      expect(result.internal_custom_field).toBe('custom_value')
      expect(result.internal_brand).toBe('Custom Brand')
    })

    it('should apply reverse field mappings from internal to Shopify', () => {
      const internalProduct = {
        title: 'Test Product',
        internal_custom_field: 'custom_value',
        internal_brand: 'Custom Brand'
      }

      const result = transformers.transformToShopifyProduct(internalProduct)

      expect(result.shopify_custom_field).toBe('custom_value')
      expect(result.shopify_vendor).toBe('Custom Brand')
    })
  })

  describe('location mappings', () => {
    it('should map Shopify location IDs to internal warehouse IDs', () => {
      const shopifyInventory = {
        id: 111222333,
        location_id: 1,
        available: 25
      }

      const result = transformers.transformInventoryLevel(shopifyInventory)

      expect(result.location_id).toBe('warehouse_main')
    })

    it('should map internal warehouse IDs back to Shopify location IDs', () => {
      const internalInventory = {
        location_id: 'warehouse_main',
        inventory_item_id: 555666777,
        available: 25
      }

      const result = transformers.transformToShopifyInventoryLevel(internalInventory)

      expect(result.location_id).toBe(1)
    })
  })
})