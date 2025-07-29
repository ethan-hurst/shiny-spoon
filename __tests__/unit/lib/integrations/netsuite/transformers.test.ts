import { NetSuiteTransformers } from '@/lib/integrations/netsuite/transformers'
import { z } from 'zod'

describe('NetSuiteTransformers', () => {
  let transformers: NetSuiteTransformers

  beforeEach(() => {
    transformers = new NetSuiteTransformers()
  })

  describe('transformProduct', () => {
    const mockItem = {
      id: '123',
      sku: 'PROD-001',
      name: 'Test Product',
      description: 'Test Description',
      baseprice: '99.99',
      weight: '2.5',
      weightunit: 'lb',
      dimensions: '10 x 5 x 3',
      isactive: 'T' as const,
      itemtype: 'inventoryitem',
      category: 'Electronics',
      lastmodifieddate: '2024-01-15T10:30:00Z',
      custitem_color: 'Blue',
      custitem_size: 'Large'
    }

    it('should transform NetSuite item to product successfully', async () => {
      const result = await transformers.transformProduct(mockItem)

      expect(result).toEqual({
        sku: 'PROD-001',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        weight: 2.5,
        dimensions: '10 x 5 x 3',
        is_active: true,
        external_id: '123',
        external_updated_at: '2024-01-15T10:30:00.000Z',
        metadata: {
          itemType: 'inventoryitem',
          category: 'Electronics',
          weightUnit: 'lb',
          custitem_color: 'Blue',
          custitem_size: 'Large'
        }
      })
    })

    it('should handle inactive items', async () => {
      const inactiveItem = { ...mockItem, isactive: 'F' as const }
      const result = await transformers.transformProduct(inactiveItem)
      
      expect(result.is_active).toBe(false)
    })

    it('should handle missing optional fields', async () => {
      const minimalItem = {
        id: '123',
        sku: 'MIN-001',
        name: 'Minimal Product',
        isactive: 'T' as const,
        itemtype: 'inventoryitem',
        lastmodifieddate: '2024-01-15'
      }

      const result = await transformers.transformProduct(minimalItem)

      expect(result).toMatchObject({
        sku: 'MIN-001',
        name: 'Minimal Product',
        description: undefined,
        price: undefined,
        weight: undefined,
        dimensions: undefined,
        is_active: true
      })
    })

    it('should parse custom fields into metadata', async () => {
      const itemWithCustomFields = {
        ...mockItem,
        custitem_manufacturer: 'ACME Corp',
        custitem_warranty: '2 years',
        custitem_dimensions: 'Should not be in metadata'
      }

      const result = await transformers.transformProduct(itemWithCustomFields)

      expect(result.metadata).toMatchObject({
        custitem_manufacturer: 'ACME Corp',
        custitem_warranty: '2 years'
      })
      expect(result.metadata.custitem_dimensions).toBeUndefined()
    })

    it('should handle invalid price values', async () => {
      const itemWithInvalidPrice = { ...mockItem, baseprice: 'invalid' }
      const result = await transformers.transformProduct(itemWithInvalidPrice)
      
      expect(result.price).toBeUndefined()
    })

    it('should throw error on transformation failure', async () => {
      const invalidItem = { ...mockItem, lastmodifieddate: null as any }
      
      await expect(transformers.transformProduct(invalidItem))
        .rejects.toThrow('Failed to transform product PROD-001:')
    })

    it('should apply field mappings', async () => {
      const mappedTransformers = new NetSuiteTransformers({
        displayname: 'name',
        salesdescription: 'description'
      })

      const itemWithMappedFields = {
        ...mockItem,
        displayname: 'Display Name',
        salesdescription: 'Sales Description'
      }

      const result = await mappedTransformers.transformProduct(itemWithMappedFields)

      expect(result.name).toBe('Display Name')
      expect(result.description).toBe('Sales Description')
    })
  })

  describe('transformInventory', () => {
    const mockBalance = {
      itemid: '123',
      sku: 'PROD-001',
      itemname: 'Test Product',
      locationid: '456',
      locationname: 'Main Warehouse',
      quantityavailable: '100',
      quantityonhand: '120',
      quantityintransit: '10',
      quantityonorder: '50',
      reorderpoint: '25',
      preferredstocklevel: '150',
      lastmodifieddate: '2024-01-15T10:30:00Z'
    }

    const mockLocation = {
      id: '456',
      name: 'Main Warehouse',
      isinactive: 'F' as const,
      makeinventoryavailable: 'T' as const,
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US'
    }

    it('should transform inventory balance successfully', async () => {
      const result = await transformers.transformInventory(mockBalance, mockLocation)

      expect(result).toEqual({
        product_sku: 'PROD-001',
        warehouse_code: 'MAIN_WAREHOUSE',
        quantity_available: 100,
        quantity_on_hand: 120,
        quantity_on_order: 50,
        reorder_point: 25,
        preferred_stock_level: 150,
        external_id: '123_456',
        external_updated_at: '2024-01-15T10:30:00.000Z'
      })
    })

    it('should handle missing optional inventory fields', async () => {
      const minimalBalance = {
        itemid: '123',
        sku: 'PROD-001',
        itemname: 'Test Product',
        locationid: '456',
        locationname: 'Warehouse',
        quantityavailable: '50',
        quantityonhand: '50',
        quantityintransit: '0',
        quantityonorder: '0',
        lastmodifieddate: '2024-01-15'
      }

      const result = await transformers.transformInventory(minimalBalance, mockLocation)

      expect(result.reorder_point).toBeUndefined()
      expect(result.preferred_stock_level).toBeUndefined()
    })

    it('should handle invalid quantity values', async () => {
      const invalidBalance = {
        ...mockBalance,
        quantityavailable: 'invalid',
        quantityonhand: '',
        quantityonorder: null as any
      }

      const result = await transformers.transformInventory(invalidBalance, mockLocation)

      expect(result.quantity_available).toBe(0)
      expect(result.quantity_on_hand).toBe(0)
      expect(result.quantity_on_order).toBe(0)
    })

    it('should handle special characters in location name', async () => {
      const specialLocation = {
        ...mockLocation,
        name: 'New York - East (Main)'
      }

      const result = await transformers.transformInventory(mockBalance, specialLocation)

      expect(result.warehouse_code).toBe('NEW_YORK_EAST_MAIN_')
    })

    it('should truncate long warehouse codes', async () => {
      const longLocation = {
        ...mockLocation,
        name: 'This is a very long warehouse name that exceeds the maximum allowed length for codes'
      }

      const result = await transformers.transformInventory(mockBalance, longLocation)

      expect(result.warehouse_code).toHaveLength(50)
      expect(result.warehouse_code).toMatch(/^THIS_IS_A_VERY_LONG_WAREHOUSE_NAME_THAT_EXCEEDS_T/)
    })

    it('should throw error on transformation failure', async () => {
      const invalidBalance = { ...mockBalance, lastmodifieddate: '' }
      
      await expect(transformers.transformInventory(invalidBalance, mockLocation))
        .rejects.toThrow('Failed to transform inventory for PROD-001:')
    })
  })

  describe('transformPricing', () => {
    const mockPrices = [
      {
        itemid: '123',
        sku: 'PROD-001',
        itemname: 'Test Product',
        pricelevelid: '1',
        pricelevelname: 'Base Price',
        unitprice: '99.99',
        currency: 'USD',
        lastmodifieddate: '2024-01-15T10:30:00Z'
      },
      {
        itemid: '123',
        sku: 'PROD-001',
        itemname: 'Test Product',
        pricelevelid: '2',
        pricelevelname: 'Wholesale',
        unitprice: '79.99',
        currency: 'USD',
        lastmodifieddate: '2024-01-15T10:30:00Z'
      }
    ]

    it('should transform pricing data successfully', async () => {
      const result = await transformers.transformPricing('PROD-001', mockPrices)

      expect(result).toEqual([
        {
          product_sku: 'PROD-001',
          price_tier: 'base',
          unit_price: 99.99,
          currency_code: 'USD',
          external_id: 'PROD-001_1',
          external_updated_at: '2024-01-15T10:30:00.000Z'
        },
        {
          product_sku: 'PROD-001',
          price_tier: 'wholesale',
          unit_price: 79.99,
          currency_code: 'USD',
          external_id: 'PROD-001_2',
          external_updated_at: '2024-01-15T10:30:00.000Z'
        }
      ])
    })

    it('should handle empty price array', async () => {
      const result = await transformers.transformPricing('PROD-001', [])
      expect(result).toEqual([])
    })

    it('should map known price levels correctly', async () => {
      const priceLevels = [
        { pricelevelname: 'MSRP', expected: 'retail' },
        { pricelevelname: 'Distributor', expected: 'distributor' },
        { pricelevelname: 'Special', expected: 'special' },
        { pricelevelname: 'Employee', expected: 'employee' },
        { pricelevelname: 'Online Price', expected: 'online' }
      ]

      for (const { pricelevelname, expected } of priceLevels) {
        const price = { ...mockPrices[0], pricelevelname }
        const result = await transformers.transformPricing('PROD-001', [price])
        expect(result[0].price_tier).toBe(expected)
      }
    })

    it('should handle unknown price levels', async () => {
      const customPrice = {
        ...mockPrices[0],
        pricelevelname: 'Custom Level 123!'
      }

      const result = await transformers.transformPricing('PROD-001', [customPrice])
      expect(result[0].price_tier).toBe('custom_level_123_')
    })

    it('should handle case-insensitive price level mapping', async () => {
      const price = {
        ...mockPrices[0],
        pricelevelname: 'base price'
      }

      const result = await transformers.transformPricing('PROD-001', [price])
      expect(result[0].price_tier).toBe('base')
    })

    it('should handle invalid price values', async () => {
      const invalidPrice = {
        ...mockPrices[0],
        unitprice: 'invalid'
      }

      const result = await transformers.transformPricing('PROD-001', [invalidPrice])
      expect(result[0].unit_price).toBe(0)
    })

    it('should use default currency when missing', async () => {
      const priceWithoutCurrency = {
        ...mockPrices[0],
        currency: ''
      }

      const result = await transformers.transformPricing('PROD-001', [priceWithoutCurrency])
      expect(result[0].currency_code).toBe('USD')
    })
  })

  describe('transformCustomer', () => {
    const mockCustomer = {
      id: '789',
      customercode: 'CUST-001',
      companyname: 'Acme Corporation',
      email: 'contact@acme.com',
      phone: '555-1234',
      isinactive: 'F' as const,
      lastmodifieddate: '2024-01-15T10:30:00Z',
      creditlimit: '10000',
      balance: '2500.50',
      daysoverdue: '5',
      category: 'Premium',
      pricelevel: 'Wholesale'
    }

    it('should transform customer successfully', async () => {
      const result = await transformers.transformCustomer(mockCustomer)

      expect(result).toEqual({
        code: 'CUST-001',
        name: 'Acme Corporation',
        email: 'contact@acme.com',
        phone: '555-1234',
        is_active: true,
        credit_limit: 10000,
        balance: 2500.50,
        days_overdue: 5,
        category: 'Premium',
        price_level: 'Wholesale',
        external_id: '789',
        external_updated_at: '2024-01-15T10:30:00.000Z',
        metadata: {
          netsuiteId: '789'
        }
      })
    })

    it('should handle inactive customers', async () => {
      const inactiveCustomer = { ...mockCustomer, isinactive: 'T' as const }
      const result = await transformers.transformCustomer(inactiveCustomer)
      
      expect(result.is_active).toBe(false)
    })

    it('should handle missing optional fields', async () => {
      const minimalCustomer = {
        id: '789',
        customercode: 'CUST-002',
        isinactive: 'F' as const,
        lastmodifieddate: '2024-01-15'
      }

      const result = await transformers.transformCustomer(minimalCustomer)

      expect(result).toMatchObject({
        code: 'CUST-002',
        name: undefined,
        email: undefined,
        phone: undefined,
        is_active: true,
        credit_limit: null,
        balance: 0,
        days_overdue: 0
      })
    })

    it('should handle invalid numeric values', async () => {
      const invalidCustomer = {
        ...mockCustomer,
        creditlimit: 'invalid',
        balance: '',
        daysoverdue: null as any
      }

      const result = await transformers.transformCustomer(invalidCustomer)

      expect(result.credit_limit).toBeNull()
      expect(result.balance).toBe(0)
      expect(result.days_overdue).toBe(0)
    })
  })

  describe('transformSalesOrder', () => {
    const mockOrder = {
      id: '456',
      ordernumber: 'SO-12345',
      trandate: '2024-01-15',
      duedate: '2024-01-30',
      orderstatus: 'Pending Fulfillment',
      total: '1199.99',
      subtotal: '999.99',
      taxtotal: '100.00',
      shippingcost: '100.00',
      lastmodifieddate: '2024-01-15T10:30:00Z',
      customercode: 'CUST-001',
      customername: 'Acme Corporation'
    }

    const mockLines = [
      {
        id: '1',
        linenumber: '1',
        sku: 'PROD-001',
        itemname: 'Product 1',
        quantity: '5',
        unitprice: '99.99',
        amount: '499.95',
        quantityshipped: '3',
        quantitybackordered: '2',
        locationname: 'Main Warehouse'
      },
      {
        id: '2',
        linenumber: '2',
        sku: 'PROD-002',
        itemname: 'Product 2',
        quantity: '10',
        unitprice: '50.00',
        amount: '500.00',
        quantityshipped: '10',
        quantitybackordered: '0',
        locationname: 'East Warehouse'
      }
    ]

    it('should transform sales order with lines successfully', async () => {
      const result = await transformers.transformSalesOrder(mockOrder, mockLines)

      expect(result).toEqual({
        order_number: 'SO-12345',
        customer_code: 'CUST-001',
        order_date: '2024-01-15T00:00:00.000Z',
        due_date: '2024-01-30T00:00:00.000Z',
        status: 'pending',
        subtotal: 999.99,
        tax_total: 100,
        shipping_cost: 100,
        total: 1199.99,
        external_id: '456',
        external_updated_at: '2024-01-15T10:30:00.000Z',
        line_items: [
          {
            line_number: 1,
            sku: 'PROD-001',
            description: 'Product 1',
            quantity: 5,
            unit_price: 99.99,
            amount: 499.95,
            quantity_shipped: 3,
            quantity_backordered: 2,
            location: 'Main Warehouse'
          },
          {
            line_number: 2,
            sku: 'PROD-002',
            description: 'Product 2',
            quantity: 10,
            unit_price: 50,
            amount: 500,
            quantity_shipped: 10,
            quantity_backordered: 0,
            location: 'East Warehouse'
          }
        ]
      })
    })

    it('should map order statuses correctly', async () => {
      const statusMappings = [
        { netsuiteStatus: 'Pending Approval', expected: 'pending_approval' },
        { netsuiteStatus: 'Partially Fulfilled', expected: 'partially_shipped' },
        { netsuiteStatus: 'Pending Billing/Partially Fulfilled', expected: 'partially_shipped' },
        { netsuiteStatus: 'Pending Billing', expected: 'pending_billing' },
        { netsuiteStatus: 'Billed', expected: 'completed' },
        { netsuiteStatus: 'Closed', expected: 'completed' },
        { netsuiteStatus: 'Cancelled', expected: 'cancelled' }
      ]

      for (const { netsuiteStatus, expected } of statusMappings) {
        const order = { ...mockOrder, orderstatus: netsuiteStatus }
        const result = await transformers.transformSalesOrder(order, [])
        expect(result.status).toBe(expected)
      }
    })

    it('should handle unknown order status', async () => {
      const order = { ...mockOrder, orderstatus: 'Custom Status' }
      const result = await transformers.transformSalesOrder(order, [])
      
      expect(result.status).toBe('custom status')
    })

    it('should handle missing optional fields', async () => {
      const minimalOrder = {
        id: '456',
        ordernumber: 'SO-12346',
        trandate: '2024-01-15',
        orderstatus: 'Pending',
        total: '100',
        subtotal: '100',
        lastmodifieddate: '2024-01-15',
        customercode: 'CUST-002'
      }

      const result = await transformers.transformSalesOrder(minimalOrder, [])

      expect(result.due_date).toBeNull()
      expect(result.tax_total).toBe(0)
      expect(result.shipping_cost).toBe(0)
      expect(result.line_items).toEqual([])
    })

    it('should handle invalid numeric values in lines', async () => {
      const invalidLines = [{
        ...mockLines[0],
        quantity: 'invalid',
        unitprice: '',
        amount: null as any,
        quantityshipped: undefined as any
      }]

      const result = await transformers.transformSalesOrder(mockOrder, invalidLines)

      expect(result.line_items[0]).toMatchObject({
        quantity: 0,
        unit_price: 0,
        amount: 0,
        quantity_shipped: 0
      })
    })
  })

  describe('date parsing', () => {
    it('should parse ISO date format', async () => {
      const item = {
        ...createMockItem(),
        lastmodifieddate: '2024-01-15T10:30:00Z'
      }

      const result = await transformers.transformProduct(item)
      expect(result.external_updated_at).toBe('2024-01-15T10:30:00.000Z')
    })

    it('should parse MM/DD/YYYY format', async () => {
      const item = {
        ...createMockItem(),
        lastmodifieddate: '01/15/2024'
      }

      const result = await transformers.transformProduct(item)
      expect(result.external_updated_at).toBe('2024-01-15T00:00:00.000Z')
    })

    it('should throw error for empty date', async () => {
      const item = {
        ...createMockItem(),
        lastmodifieddate: ''
      }

      await expect(transformers.transformProduct(item))
        .rejects.toThrow('NetSuite date is empty or undefined')
    })

    it('should throw error for invalid date format', async () => {
      const item = {
        ...createMockItem(),
        lastmodifieddate: 'invalid-date'
      }

      await expect(transformers.transformProduct(item))
        .rejects.toThrow('Invalid NetSuite date format: "invalid-date"')
    })
  })

  describe('dimension parsing', () => {
    it('should handle standard dimension format', async () => {
      const item = {
        ...createMockItem(),
        dimensions: '10 x 5 x 3'
      }

      const result = await transformers.transformProduct(item)
      expect(result.dimensions).toBe('10 x 5 x 3')
    })

    it('should format dimension numbers', async () => {
      const item = {
        ...createMockItem(),
        dimensions: '10.5, 5.25, 3.75 inches'
      }

      const result = await transformers.transformProduct(item)
      expect(result.dimensions).toBe('10.5 x 5.25 x 3.75')
    })

    it('should handle various dimension separators', async () => {
      const item = {
        ...createMockItem(),
        dimensions: '10 by 5 by 3'
      }

      const result = await transformers.transformProduct(item)
      expect(result.dimensions).toBe('10 x 5 x 3')
    })

    it('should return original if cannot parse', async () => {
      const item = {
        ...createMockItem(),
        dimensions: 'custom format'
      }

      const result = await transformers.transformProduct(item)
      expect(result.dimensions).toBe('custom format')
    })

    it('should handle missing dimensions', async () => {
      const item = {
        ...createMockItem(),
        dimensions: undefined
      }

      const result = await transformers.transformProduct(item)
      expect(result.dimensions).toBeUndefined()
    })
  })

  describe('utility methods', () => {
    it('should build composite keys correctly', () => {
      const key = transformers.buildCompositeKey('item', 123, 'loc', 456)
      expect(key).toBe('item_123_loc_456')
    })

    it('should handle empty parts in composite key', () => {
      const key = transformers.buildCompositeKey('', 0, null as any, undefined as any)
      expect(key).toBe('_0_null_undefined')
    })

    it('should validate transformed data with schema', () => {
      const schema = z.object({
        sku: z.string(),
        price: z.number()
      })

      const validData = { sku: 'TEST-001', price: 99.99 }
      const result = transformers.validateTransformedData(validData, schema)
      
      expect(result).toEqual(validData)
    })

    it('should throw validation error for invalid data', () => {
      const schema = z.object({
        sku: z.string(),
        price: z.number()
      })

      const invalidData = { sku: 'TEST-001', price: 'invalid' }
      
      expect(() => transformers.validateTransformedData(invalidData, schema))
        .toThrow('Validation failed: price: Expected number, received string')
    })
  })
})

// Helper function to create mock item
function createMockItem() {
  return {
    id: '123',
    sku: 'PROD-001',
    name: 'Test Product',
    isactive: 'T' as const,
    itemtype: 'inventoryitem',
    lastmodifieddate: '2024-01-15T10:30:00Z'
  }
}