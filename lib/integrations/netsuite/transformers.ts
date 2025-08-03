// PRP-013: NetSuite Data Transformers
import { z } from 'zod'
import type {
  InventoryTransformResult,
  PricingTransformResult,
  ProductTransformResult,
} from '@/types/netsuite.types'

/**
 * NetSuite item data structure as returned from SuiteQL queries
 */
interface NetSuiteItemData {
  id: string
  sku: string
  name: string
  description?: string
  baseprice?: string
  weight?: string
  weightunit?: string
  dimensions?: string
  isactive: 'T' | 'F'
  itemtype: string
  category?: string
  lastmodifieddate: string
  // Allow custom fields (e.g., custitem_*)
  [key: string]: string | undefined
}

/**
 * NetSuite inventory balance data structure
 */
interface NetSuiteInventoryData {
  itemid: string
  sku: string
  itemname: string
  locationid: string
  locationname: string
  quantityavailable: string
  quantityonhand: string
  quantityintransit: string
  quantityonorder: string
  reorderpoint?: string
  preferredstocklevel?: string
  lastmodifieddate: string
}

/**
 * NetSuite location data structure
 */
interface NetSuiteLocationData {
  id: string
  name: string
  isinactive: 'T' | 'F'
  makeinventoryavailable: 'T' | 'F'
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

/**
 * NetSuite price data structure
 */
interface NetSuitePriceData {
  itemid: string
  sku: string
  itemname: string
  pricelevelid: string
  pricelevelname: string
  unitprice: string
  currency: string
  lastmodifieddate: string
}

/**
 * NetSuite customer data structure
 */
interface NetSuiteCustomerData {
  id: string
  customercode: string
  companyname?: string
  email?: string
  phone?: string
  isinactive: 'T' | 'F'
  lastmodifieddate: string
  creditlimit?: string
  balance?: string
  daysoverdue?: string
  category?: string
  pricelevel?: string
}

/**
 * NetSuite sales order data structure
 */
interface NetSuiteSalesOrderData {
  id: string
  ordernumber: string
  trandate: string
  duedate?: string
  orderstatus: string
  total: string
  subtotal: string
  taxtotal?: string
  shippingcost?: string
  lastmodifieddate: string
  customercode: string
  customername?: string
}

/**
 * NetSuite sales order line data structure
 */
interface NetSuiteSalesOrderLineData {
  id: string
  linenumber: string
  sku: string
  itemname: string
  quantity: string
  unitprice: string
  amount: string
  quantityshipped?: string
  quantitybackordered?: string
  locationname?: string
}

export class NetSuiteTransformers {
  constructor(private fieldMappings: Record<string, string> = {}) {}

  /**
   * Transform NetSuite item to TruthSource product
   */
  async transformProduct(
    item: NetSuiteItemData
  ): Promise<ProductTransformResult> {
    try {
      // Parse NetSuite boolean values ('T'/'F' to boolean)
      const isActive = item.isactive === 'T'

      // Parse price
      const price = item.baseprice
        ? isNaN(parseFloat(item.baseprice))
          ? undefined
          : parseFloat(item.baseprice)
        : undefined

      // Parse weight
      const weight = item.weight ? parseFloat(item.weight) : undefined

      // Build metadata with custom fields
      const metadata: Record<string, any> = {
        itemType: item.itemtype,
        category: item.category,
        weightUnit: item.weightunit,
      }

      // Add custom fields to metadata
      Object.keys(item).forEach((key) => {
        if (key.startsWith('custitem_') && key !== 'custitem_dimensions') {
          metadata[key] = item[key]
        }
      })

      // Apply field mappings
      const mappedData = this.applyFieldMappings(item)

      return {
        sku: item.sku,
        name: mappedData.name || item.name,
        description: mappedData.description || item.description,
        price,
        weight,
        dimensions: this.parseDimensions(item.dimensions),
        is_active: isActive,
        external_id: item.id,
        external_updated_at: this.parseNetSuiteDate(item.lastmodifieddate),
        metadata,
      }
    } catch (error) {
      throw new Error(`Failed to transform product ${item.sku}: ${error}`)
    }
  }

  /**
   * Transform NetSuite inventory balance to TruthSource inventory
   */
  async transformInventory(
    balance: NetSuiteInventoryData,
    location: NetSuiteLocationData
  ): Promise<InventoryTransformResult> {
    try {
      // Map location to warehouse code
      const warehouseCode = this.mapLocationToWarehouse(location)

      return {
        product_sku: balance.sku,
        warehouse_code: warehouseCode,
        quantity_available: parseInt(balance.quantityavailable, 10) || 0,
        quantity_on_hand: parseInt(balance.quantityonhand, 10) || 0,
        quantity_on_order: parseInt(balance.quantityonorder, 10) || 0,
        reorder_point: balance.reorderpoint
          ? parseInt(balance.reorderpoint, 10)
          : undefined,
        preferred_stock_level: balance.preferredstocklevel
          ? parseInt(balance.preferredstocklevel, 10)
          : undefined,
        external_id: `${balance.itemid}_${location.id}`,
        external_updated_at: this.parseNetSuiteDate(balance.lastmodifieddate),
      }
    } catch (error) {
      throw new Error(
        `Failed to transform inventory for ${balance.sku}: ${error}`
      )
    }
  }

  /**
   * Transform NetSuite pricing to TruthSource pricing
   */
  async transformPricing(
    itemId: string,
    prices: NetSuitePriceData[]
  ): Promise<PricingTransformResult[]> {
    try {
      return prices.map((price) => ({
        product_sku: itemId,
        price_tier: this.mapPriceLevelToTier(price.pricelevelname),
        unit_price: parseFloat(price.unitprice) || 0,
        currency_code: price.currency || 'USD',
        external_id: `${itemId}_${price.pricelevelid}`,
        external_updated_at: this.parseNetSuiteDate(price.lastmodifieddate),
      }))
    } catch (error) {
      throw new Error(`Failed to transform pricing for ${itemId}: ${error}`)
    }
  }

  /**
   * Transform NetSuite customer to TruthSource customer
   */
  async transformCustomer(customer: NetSuiteCustomerData): Promise<any> {
    try {
      const isActive = customer.isinactive === 'F'

      return {
        code: customer.customercode,
        name: customer.companyname,
        email: customer.email,
        phone: customer.phone,
        is_active: isActive,
        credit_limit: customer.creditlimit
          ? isNaN(parseFloat(customer.creditlimit))
            ? null
            : parseFloat(customer.creditlimit)
          : null,
        balance: customer.balance
          ? isNaN(parseFloat(customer.balance))
            ? 0
            : parseFloat(customer.balance)
          : 0,
        days_overdue: customer.daysoverdue
          ? isNaN(parseInt(customer.daysoverdue, 10))
            ? 0
            : parseInt(customer.daysoverdue, 10)
          : 0,
        category: customer.category,
        price_level: customer.pricelevel,
        external_id: customer.id,
        external_updated_at: this.parseNetSuiteDate(customer.lastmodifieddate),
        metadata: {
          netsuiteId: customer.id,
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to transform customer ${customer.customercode}: ${error}`
      )
    }
  }

  /**
   * Transform NetSuite sales order to TruthSource order
   */
  async transformSalesOrder(
    order: NetSuiteSalesOrderData,
    lines: NetSuiteSalesOrderLineData[]
  ): Promise<any> {
    try {
      // Map NetSuite order status to TruthSource status
      const status = this.mapOrderStatus(order.orderstatus)

      return {
        order_number: order.ordernumber,
        customer_code: order.customercode,
        order_date: this.parseNetSuiteDate(order.trandate),
        due_date: order.duedate ? this.parseNetSuiteDate(order.duedate) : null,
        status,
        subtotal: parseFloat(order.subtotal) || 0,
        tax_total: parseFloat(order.taxtotal) || 0,
        shipping_cost: parseFloat(order.shippingcost) || 0,
        total: parseFloat(order.total) || 0,
        external_id: order.id,
        external_updated_at: this.parseNetSuiteDate(order.lastmodifieddate),
        line_items: lines.map((line) => ({
          line_number: parseInt(line.linenumber, 10),
          sku: line.sku,
          description: line.itemname,
          quantity: parseInt(line.quantity, 10) || 0,
          unit_price: parseFloat(line.unitprice) || 0,
          amount: parseFloat(line.amount) || 0,
          quantity_shipped: parseInt(line.quantityshipped, 10) || 0,
          quantity_backordered: parseInt(line.quantitybackordered, 10) || 0,
          location: line.locationname,
        })),
      }
    } catch (error) {
      throw new Error(
        `Failed to transform order ${order.ordernumber}: ${error}`
      )
    }
  }

  /**
   * Apply custom field mappings
   */
  private applyFieldMappings(data: Record<string, any>): Record<string, any> {
    const mapped: Record<string, any> = {}

    Object.entries(this.fieldMappings).forEach(([sourceField, targetField]) => {
      if (data[sourceField] !== undefined) {
        mapped[targetField] = data[sourceField]
      }
    })

    return { ...data, ...mapped }
  }

  /**
   * Map NetSuite location to warehouse code
   */
  private mapLocationToWarehouse(location: NetSuiteLocationData): string {
    // Use location name as warehouse code, removing special characters
    return location.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50) // Limit length
  }

  /**
   * Map NetSuite price level to TruthSource tier
   */
  private mapPriceLevelToTier(priceLevel: string): string {
    const mapping: Record<string, string> = {
      'Base Price': 'base',
      MSRP: 'retail',
      Wholesale: 'wholesale',
      Distributor: 'distributor',
      Special: 'special',
      Employee: 'employee',
      'Online Price': 'online',
    }

    // Check exact match first
    if (mapping[priceLevel]) {
      return mapping[priceLevel]
    }

    // Check case-insensitive match
    const lowerPriceLevel = priceLevel.toLowerCase()
    for (const [key, value] of Object.entries(mapping)) {
      if (key.toLowerCase() === lowerPriceLevel) {
        return value
      }
    }

    // Default: use sanitized price level name
    return priceLevel
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50)
  }

  /**
   * Map NetSuite order status to TruthSource status
   */
  private mapOrderStatus(netsuiteStatus: string): string {
    const mapping: Record<string, string> = {
      'Pending Fulfillment': 'pending',
      'Pending Approval': 'pending_approval',
      'Partially Fulfilled': 'partially_shipped',
      'Pending Billing/Partially Fulfilled': 'partially_shipped',
      'Pending Billing': 'pending_billing',
      Billed: 'completed',
      Closed: 'completed',
      Cancelled: 'cancelled',
    }

    return mapping[netsuiteStatus] || netsuiteStatus.toLowerCase()
  }

  /**
   * Parse NetSuite date format
   * @throws Error if the date string is invalid or cannot be parsed
   */
  private parseNetSuiteDate(dateString: string): string {
    if (!dateString) {
      throw new Error(
        'NetSuite date is empty or undefined - this indicates missing data in the source system'
      )
    }

    try {
      // NetSuite dates might come in various formats
      // Try to parse and convert to ISO string
      const date = new Date(dateString)

      if (isNaN(date.getTime())) {
        // Try alternative format (MM/DD/YYYY)
        const parts = dateString.split('/')
        if (parts.length === 3) {
          const [month, day, year] = parts
          // Create date in UTC to avoid timezone issues
          // Note: month is 0-indexed in Date.UTC, so subtract 1
          const altDate = new Date(
            Date.UTC(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              0,
              0,
              0,
              0
            )
          )
          if (!isNaN(altDate.getTime())) {
            return altDate.toISOString()
          }
        }

        // If all else fails, throw an error with the invalid date string
        throw new Error(
          `Invalid NetSuite date format: "${dateString}" - expected format: YYYY-MM-DD, MM/DD/YYYY, or ISO 8601`
        )
      }

      // For MM/DD/YYYY format, we need to handle it specially even if new Date() succeeds
      // because new Date() might interpret it in the wrong timezone
      if (dateString.includes('/') && dateString.split('/').length === 3) {
        const parts = dateString.split('/')
        const [month, day, year] = parts
        // Create date in UTC to avoid timezone issues
        const altDate = new Date(
          Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            0,
            0,
            0,
            0
          )
        )
        return altDate.toISOString()
      }

      return date.toISOString()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(
        `Failed to parse NetSuite date: "${dateString}" - ${error}`
      )
    }
  }

  /**
   * Transform weight with unit conversion
   */
  private transformWeight(
    weight: number | undefined,
    unit: string | undefined
  ): number | undefined {
    if (!weight) return undefined

    // Convert to standard unit (kg)
    switch (unit?.toLowerCase()) {
      case 'lb':
      case 'lbs':
      case 'pound':
      case 'pounds':
        return weight * 0.453592 // Convert pounds to kg
      case 'oz':
      case 'ounce':
      case 'ounces':
        return weight * 0.0283495 // Convert ounces to kg
      case 'g':
      case 'gram':
      case 'grams':
        return weight / 1000 // Convert grams to kg
      case 'kg':
      case 'kilogram':
      case 'kilograms':
      default:
        return weight // Already in kg or unknown unit
    }
  }

  /**
   * Parse dimensions string
   */
  private parseDimensions(dimensions: string | undefined): string | undefined {
    if (!dimensions) return undefined

    // NetSuite might store dimensions in various formats
    // Try to standardize to "L x W x H"
    const cleaned = dimensions.trim()

    // If already in correct format, return as is
    if (/^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?\s*x\s*\d+(\.\d+)?/.test(cleaned)) {
      return cleaned
    }

    // Try to extract numbers and format
    const numbers = cleaned.match(/\d+(\.\d+)?/g)
    if (numbers && numbers.length >= 3) {
      // Parse and validate numbers
      const parsedNumbers = numbers.slice(0, 3).map((n) => {
        const parsed = parseFloat(n)
        return isNaN(parsed) ? 0 : parsed
      })

      // Only return formatted dimensions if all are valid
      if (parsedNumbers.every((n) => n > 0)) {
        return `${parsedNumbers[0]} x ${parsedNumbers[1]} x ${parsedNumbers[2]}`
      }
    }

    // Return original if can't parse
    return dimensions
  }

  /**
   * Build composite key for records that need unique identification
   */
  buildCompositeKey(...parts: (string | number)[]): string {
    return parts.map((p) => String(p)).join('_')
  }

  /**
   * Validate transformed data
   */
  validateTransformedData<T>(data: T, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')
        throw new Error(`Validation failed: ${issues}`)
      }
      throw error
    }
  }
}
