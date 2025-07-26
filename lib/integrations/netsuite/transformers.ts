// PRP-013: NetSuite Data Transformers
import { z } from 'zod'
import type {
  NetSuiteItem,
  NetSuiteInventoryBalance,
  NetSuiteItemPrice,
  ProductTransformResult,
  InventoryTransformResult,
  PricingTransformResult,
} from '@/types/netsuite.types'

export class NetSuiteTransformers {
  constructor(private fieldMappings: Record<string, string> = {}) {}

  /**
   * Transform NetSuite item to TruthSource product
   */
  async transformProduct(item: any): Promise<ProductTransformResult> {
    try {
      // Parse NetSuite boolean values ('T'/'F' to boolean)
      const isActive = item.isactive === 'T'
      
      // Parse price
      const price = item.baseprice ? parseFloat(item.baseprice) : undefined
      
      // Parse weight
      const weight = item.weight ? parseFloat(item.weight) : undefined
      
      // Build metadata with custom fields
      const metadata: Record<string, any> = {
        itemType: item.itemtype,
        category: item.category,
        weightUnit: item.weightunit,
      }
      
      // Add custom fields to metadata
      Object.keys(item).forEach(key => {
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
        dimensions: item.dimensions,
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
    balance: any,
    location: any
  ): Promise<InventoryTransformResult> {
    try {
      // Map location to warehouse code
      const warehouseCode = this.mapLocationToWarehouse(location)
      
      return {
        product_sku: balance.sku,
        warehouse_code: warehouseCode,
        quantity_available: parseInt(balance.quantityavailable) || 0,
        quantity_on_hand: parseInt(balance.quantityonhand) || 0,
        quantity_on_order: parseInt(balance.quantityonorder) || 0,
        reorder_point: balance.reorderpoint ? parseInt(balance.reorderpoint) : undefined,
        preferred_stock_level: balance.preferredstocklevel 
          ? parseInt(balance.preferredstocklevel) 
          : undefined,
        external_id: `${balance.itemid}_${location.id}`,
        external_updated_at: this.parseNetSuiteDate(balance.lastmodifieddate),
      }
    } catch (error) {
      throw new Error(`Failed to transform inventory for ${balance.sku}: ${error}`)
    }
  }

  /**
   * Transform NetSuite pricing to TruthSource pricing
   */
  async transformPricing(
    itemId: string,
    prices: any[]
  ): Promise<PricingTransformResult[]> {
    try {
      return prices.map(price => ({
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
  async transformCustomer(customer: any): Promise<any> {
    try {
      const isActive = customer.isinactive === 'F'
      
      return {
        code: customer.customercode,
        name: customer.companyname,
        email: customer.email,
        phone: customer.phone,
        is_active: isActive,
        credit_limit: customer.creditlimit ? parseFloat(customer.creditlimit) : null,
        balance: customer.balance ? parseFloat(customer.balance) : 0,
        days_overdue: customer.daysoverdue ? parseInt(customer.daysoverdue) : 0,
        category: customer.category,
        price_level: customer.pricelevel,
        external_id: customer.id,
        external_updated_at: this.parseNetSuiteDate(customer.lastmodifieddate),
        metadata: {
          netsuiteId: customer.id,
        },
      }
    } catch (error) {
      throw new Error(`Failed to transform customer ${customer.customercode}: ${error}`)
    }
  }

  /**
   * Transform NetSuite sales order to TruthSource order
   */
  async transformSalesOrder(order: any, lines: any[]): Promise<any> {
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
        line_items: lines.map(line => ({
          line_number: parseInt(line.linenumber),
          sku: line.sku,
          description: line.itemname,
          quantity: parseInt(line.quantity) || 0,
          unit_price: parseFloat(line.unitprice) || 0,
          amount: parseFloat(line.amount) || 0,
          quantity_shipped: parseInt(line.quantityshipped) || 0,
          quantity_backordered: parseInt(line.quantitybackordered) || 0,
          location: line.locationname,
        })),
      }
    } catch (error) {
      throw new Error(`Failed to transform order ${order.ordernumber}: ${error}`)
    }
  }

  /**
   * Apply custom field mappings
   */
  private applyFieldMappings(data: any): Record<string, any> {
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
  private mapLocationToWarehouse(location: any): string {
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
      'MSRP': 'retail',
      'Wholesale': 'wholesale',
      'Distributor': 'distributor',
      'Special': 'special',
      'Employee': 'employee',
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
      'Billed': 'completed',
      'Closed': 'completed',
      'Cancelled': 'cancelled',
    }
    
    return mapping[netsuiteStatus] || netsuiteStatus.toLowerCase()
  }

  /**
   * Parse NetSuite date format
   */
  private parseNetSuiteDate(dateString: string): string {
    if (!dateString) {
      return new Date().toISOString()
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
          const altDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
          if (!isNaN(altDate.getTime())) {
            return altDate.toISOString()
          }
        }
        
        // If all else fails, return current date
        return new Date().toISOString()
      }
      
      return date.toISOString()
    } catch {
      return new Date().toISOString()
    }
  }

  /**
   * Transform weight with unit conversion
   */
  private transformWeight(weight: number | undefined, unit: string | undefined): number | undefined {
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
      return `${numbers[0]} x ${numbers[1]} x ${numbers[2]}`
    }
    
    // Return original if can't parse
    return dimensions
  }

  /**
   * Build composite key for records that need unique identification
   */
  buildCompositeKey(...parts: (string | number)[]): string {
    return parts.map(p => String(p)).join('_')
  }

  /**
   * Validate transformed data
   */
  validateTransformedData<T>(data: T, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        throw new Error(`Validation failed: ${issues}`)
      }
      throw error
    }
  }
}