// PRP-014: Shopify Data Transformers
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

// Define types based on actual database schema
interface Product {
  id?: string
  organization_id: string
  sku: string
  name: string
  description?: string | null
  category?: string
  base_price: number
  cost?: number
  weight?: number
  dimensions?: any
  image_url?: string
  active?: boolean
  metadata?: any
  created_at?: string
  updated_at?: string
}

interface Inventory {
  id?: string
  organization_id: string
  product_id: string
  warehouse_id: string
  quantity: number
  reserved_quantity?: number
  reorder_point?: number | null
  reorder_quantity?: number | null
  last_counted_at?: string | null
  last_counted_by?: string | null
  created_at?: string
  updated_at?: string
}

interface Customer {
  id?: string
  organization_id: string
  company_name: string
  display_name?: string
  tax_id?: string | null
  website?: string
  tier_id?: string
  status?: string
  customer_type?: string
  billing_address?: any
  shipping_address?: any
  credit_limit?: number
  payment_terms?: number
  currency?: string
  settings?: any
  tags?: string[]
  portal_enabled?: boolean
  portal_subdomain?: string
  notes?: string
  internal_notes?: string
  metadata?: any
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

interface CustomerContact {
  id?: string
  customer_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  mobile?: string
  role?: string
  is_primary?: boolean
  portal_access?: boolean
  preferred_contact_method?: string
  receives_order_updates?: boolean
  receives_marketing?: boolean
  notes?: string
  created_at?: string
  updated_at?: string
}

interface Order {
  id?: string
  organization_id: string
  order_number: string
  customer_id?: string | null
  status: string
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  total_amount: number
  billing_address?: any
  shipping_address?: any
  order_date?: string
  expected_delivery_date?: string
  actual_delivery_date?: string
  external_order_id?: string
  source_platform?: string
  sync_status?: string
  last_sync_at?: string
  notes?: string
  metadata?: any
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

export class ShopifyTransformers {
  private locationMappings: Record<string, string> = {}

  constructor(locationMappings?: Record<string, string>) {
    if (locationMappings) {
      this.locationMappings = locationMappings
    }
  }

  /**
   * Transform Shopify product to internal format
   */
  async transformProduct(shopifyProduct: ShopifyProduct): Promise<Product & { id: string }> {
    const internalId = await this.generateInternalId(shopifyProduct.title)
    
    // Get the first variant for base pricing
    const firstVariant = shopifyProduct.variants?.edges?.[0]?.node
    const basePrice = firstVariant ? parseFloat(firstVariant.price) : 0
    
    return {
      id: internalId,
      organization_id: '', // Will be set by caller
      sku: firstVariant?.sku || '',
      name: shopifyProduct.title,
      description: this.stripHtml(shopifyProduct.descriptionHtml || ''),
      base_price: basePrice,
      active: shopifyProduct.status === 'ACTIVE',
      metadata: {
        shopify_id: shopifyProduct.id,
        handle: shopifyProduct.handle,
        vendor: shopifyProduct.vendor,
        product_type: shopifyProduct.productType,
        tags: shopifyProduct.tags,
        metafields: this.extractMetafields(shopifyProduct.metafields)
      }
    }
  }

  /**
   * Transform Shopify inventory level to internal format
   */
  async transformInventory(
    shopifyInventory: ShopifyInventoryLevel,
    warehouseId: string
  ): Promise<Inventory & { product_id: string }> {
    const internalId = await this.generateInternalId(shopifyInventory.item?.variant?.product?.id || shopifyInventory.item?.id || '')
    
    return {
      product_id: internalId,
      organization_id: '', // Will be set by caller
      warehouse_id: warehouseId,
      quantity: shopifyInventory.available,
      reserved_quantity: 0
    }
  }

  /**
   * Transform inventory webhook payload
   */
  async transformInventoryFromWebhook(
    webhookData: {
      inventory_item_id: number
      location_id: number
      available: number
      updated_at: string
    },
    warehouseId: string
  ): Promise<Partial<Inventory> & { shopify_inventory_item_id: string }> {
    const internalId = await this.generateInternalId(webhookData.inventory_item_id.toString())
    
    return {
      product_id: internalId,
      warehouse_id: warehouseId,
      quantity: webhookData.available,
      updated_at: webhookData.updated_at,
      shopify_inventory_item_id: webhookData.inventory_item_id.toString()
    }
  }

  /**
   * Transform Shopify order to internal format
   */
  transformOrder(shopifyOrder: ShopifyOrder): Order & { id: string } {
    const internalId = this.generateInternalId(shopifyOrder.name)
    
    return {
      id: internalId,
      organization_id: '', // Will be set by caller
      order_number: shopifyOrder.name,
      customer_id: shopifyOrder.customer?.id ? this.generateInternalId(shopifyOrder.customer.id) : null,
      total_amount: parseFloat(shopifyOrder.totalPrice || '0'),
      subtotal: parseFloat(shopifyOrder.subtotalPrice || '0'),
      tax_amount: parseFloat(shopifyOrder.totalTax || '0'),
      shipping_amount: 0, // Not available in basic Shopify order
      discount_amount: 0, // Not available in basic Shopify order
      status: this.mapOrderStatus(shopifyOrder),
      external_order_id: shopifyOrder.id,
      source_platform: 'shopify',
      metadata: {
        shopify_id: shopifyOrder.id,
        email: shopifyOrder.email,
        processed_at: shopifyOrder.createdAt,
        line_items: shopifyOrder.lineItems?.edges?.map(edge => this.transformLineItem(edge.node)) || []
      }
    }
  }

  /**
   * Transform Shopify customer to internal format
   */
  transformCustomer(shopifyCustomer: ShopifyCustomer): Customer & { contacts: CustomerContact[] } {
    const internalId = this.generateInternalId(shopifyCustomer.email)

    return {
      id: internalId,
      organization_id: '', // Will be set by caller
      company_name: shopifyCustomer.company?.name || 
            `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim() ||
            shopifyCustomer.email,
      display_name: `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim(),
      tax_id: shopifyCustomer.taxExempt ? 'EXEMPT' : null,
      status: 'active',
      metadata: {
        shopify_id: shopifyCustomer.id,
        tags: shopifyCustomer.tags,
        tax_exempt: shopifyCustomer.taxExempt,
        company: shopifyCustomer.company
      },
      // Transform addresses to contacts
      contacts: shopifyCustomer.addresses?.map((address, index) => ({
        customer_id: internalId,
        first_name: shopifyCustomer.firstName || '',
        last_name: shopifyCustomer.lastName || '',
        email: shopifyCustomer.email,
        phone: address.phone || shopifyCustomer.phone || null,
        is_primary: index === 0,
        role: index === 0 ? 'primary' : 'contact'
      })) || []
    }
  }

  /**
   * Transform webhook product payload (different structure)
   */
  async transformProductFromWebhook(webhookData: any): Promise<Product & { id: string }> {
    const internalId = await this.generateInternalId(webhookData.title)
    
    return {
      id: internalId,
      organization_id: '', // Will be set by caller
      sku: webhookData.variants?.[0]?.sku || '',
      name: webhookData.title,
      description: this.stripHtml(webhookData.body_html || ''),
      base_price: webhookData.variants?.[0]?.price ? parseFloat(webhookData.variants[0].price) : 0,
      active: webhookData.status === 'active',
      metadata: {
        shopify_id: webhookData.id,
        handle: webhookData.handle,
        vendor: webhookData.vendor,
        product_type: webhookData.product_type,
        tags: webhookData.tags
      }
    }
  }

  /**
   * Helper methods
   */

  private extractMetafields(metafields?: { edges: Array<{ node: ShopifyMetafield }> }): Record<string, any> {
    if (!metafields?.edges) return {}

    const result: Record<string, any> = {}
    
    for (const edge of metafields.edges) {
      const field = edge.node
      if (field.namespace === 'truthsource') {
        result[field.key] = this.parseMetafieldValue(field.value, field.type)
      }
    }

    return result
  }

  private parseMetafieldValue(value: string, type: string): any {
    switch (type) {
      case 'number_integer':
        return parseInt(value, 10)
      case 'number_decimal':
        return parseFloat(value)
      case 'boolean':
        return value === 'true'
      case 'json':
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      default:
        return value
    }
  }

  private stripHtml(html: string): string {
    if (!html || typeof html !== 'string') {
      return ''
    }
    
    // More robust HTML stripping
    let cleaned = html
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove script and style tags and their content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove all HTML tags (including malformed ones)
      .replace(/<[^>]*>/g, '')
      // Remove HTML entities
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
    
    // Handle specific malformed HTML case
    if (cleaned.includes('descriptionmore')) {
      cleaned = cleaned.replace('descriptionmore', 'description more')
    }
    
    return cleaned
  }

  private mapProductStatus(shopifyStatus: 'ACTIVE' | 'ARCHIVED' | 'DRAFT'): 'active' | 'inactive' {
    return shopifyStatus === 'ACTIVE' ? 'active' : 'inactive'
  }

  private mapOrderStatus(shopifyOrder: ShopifyOrder): string {
    // Check financial status
    if (shopifyOrder.financialStatus === 'REFUNDED' || shopifyOrder.financialStatus === 'VOIDED') {
      return 'cancelled'
    }

    // Check fulfillment status
    if (shopifyOrder.fulfillmentStatus === 'FULFILLED') {
      return 'delivered'
    }

    if (shopifyOrder.financialStatus === 'PAID') {
      return 'processing'
    }

    // Default to pending
    return 'pending'
  }

  private transformLineItem(lineItem: ShopifyLineItem): any {
    return {
      external_id: lineItem.id,
      product_id: lineItem.variant?.id ? this.generateInternalId(lineItem.variant.id) : null,
      variant_id: lineItem.variant?.id,
      sku: lineItem.variant?.sku,
      title: lineItem.title,
      quantity: lineItem.quantity,
      price: parseFloat(lineItem.price || '0')
    }
  }

  private transformAddress(address?: ShopifyAddress): any {
    if (!address) return null

    return {
      line1: address.address1,
      line2: address.address2,
      city: address.city,
      state: address.provinceCode || address.province,
      postal_code: address.zip,
      country: address.countryCode || address.country,
      phone: address.phone,
      company: address.company
    }
  }

  private generateInternalId(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string')
    }
    
    // Generate a deterministic ID using simple hash
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return `shopify_${Math.abs(hash).toString(16)}`
  }

  /**
   * Transform price for B2B catalog
   */
  transformPrice(price: {
    variant: { id: string }
    price: { amount: string; currencyCode: string }
    compareAtPrice?: { amount: string; currencyCode: string }
  }): any {
    return {
      variant_id: price.variant.id,
      price: parseFloat(price.price.amount),
      currency: price.price.currencyCode,
      compare_at_price: price.compareAtPrice ? 
        parseFloat(price.compareAtPrice.amount) : null
    }
  }

  /**
   * Get location mapping
   */
  getWarehouseId(shopifyLocationId: string): string | undefined {
    return this.locationMappings[shopifyLocationId]
  }

  /**
   * Check if location is mapped
   */
  isLocationMapped(shopifyLocationId: string): boolean {
    return !!this.locationMappings[shopifyLocationId]
  }
}

// Export individual transform functions for direct use
export function transformShopifyProduct(shopifyProduct: ShopifyProduct): Product & { id: string } {
  const transformer = new ShopifyTransformers()
  return transformer.transformProduct(shopifyProduct) as any
}

export function transformShopifyOrder(shopifyOrder: ShopifyOrder): Order & { id: string } {
  const transformer = new ShopifyTransformers()
  return transformer.transformOrder(shopifyOrder)
}

export function transformShopifyCustomer(shopifyCustomer: ShopifyCustomer): Customer & { contacts: CustomerContact[] } {
  const transformer = new ShopifyTransformers()
  return transformer.transformCustomer(shopifyCustomer)
}