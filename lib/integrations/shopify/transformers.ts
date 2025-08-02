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
import type { Database } from '@/supabase/types/database-extended'

type Product = Database['public']['Tables']['products']['Insert']
type Inventory = Database['public']['Tables']['inventory']['Insert']
type Customer = Database['public']['Tables']['customers']['Insert']
type CustomerContact = Database['public']['Tables']['customer_contacts']['Insert']

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
    
    return {
      id: internalId,
      organization_id: '', // Will be set by caller
      sku: shopifyProduct.variants[0]?.sku || '',
      name: shopifyProduct.title,
      description: shopifyProduct.description || null,
      is_active: shopifyProduct.status === 'ACTIVE'
    }
  }

  /**
   * Transform Shopify inventory level to internal format
   */
  async transformInventory(
    shopifyInventory: ShopifyInventoryLevel,
    warehouseId: string
  ): Promise<Inventory & { product_id: string }> {
    const internalId = await this.generateInternalId(shopifyInventory.inventoryItemId.toString())
    
    return {
      product_id: internalId,
      organization_id: '', // Will be set by caller
      warehouse_id: warehouseId,
      quantity: shopifyInventory.available,
      reserved_quantity: 0,
      reorder_point: null,
      reorder_quantity: null
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
  transformOrder(shopifyOrder: ShopifyOrder): {
    external_id: string
    order_number: string
    customer_email: string | null
    total_amount: number
    subtotal_amount: number
    tax_amount: number
    currency: string
    status: string
    line_items: any[]
    shipping_address: any
    billing_address: any
    customer: { external_id: string; email: string; name: string } | null
    created_at: string
    updated_at: string
  } {
    return {
      external_id: shopifyOrder.id,
      order_number: shopifyOrder.name,
      customer_email: shopifyOrder.email,
      total_amount: parseFloat(shopifyOrder.totalPrice),
      subtotal_amount: parseFloat(shopifyOrder.subtotalPrice),
      tax_amount: parseFloat(shopifyOrder.totalTax),
      currency: shopifyOrder.currencyCode,
      status: this.mapOrderStatus(shopifyOrder.financialStatus, shopifyOrder.fulfillmentStatus),
      line_items: shopifyOrder.lineItems.edges.map(edge => 
        this.transformLineItem(edge.node)
      ),
      shipping_address: this.transformAddress(shopifyOrder.shippingAddress),
      billing_address: this.transformAddress(shopifyOrder.billingAddress),
      customer: shopifyOrder.customer ? {
        external_id: shopifyOrder.customer.id,
        email: shopifyOrder.customer.email,
        name: `${shopifyOrder.customer.firstName || ''} ${shopifyOrder.customer.lastName || ''}`.trim()
      } : null,
      created_at: shopifyOrder.createdAt,
      updated_at: shopifyOrder.updatedAt
    }
  }

  /**
   * Transform Shopify customer to internal format
   */
  transformCustomer(shopifyCustomer: ShopifyCustomer): Customer & { contacts: CustomerContact[] } {
    const internalId = this.generateInternalId(shopifyCustomer.email)

    return {
      id: internalId,
      name: shopifyCustomer.company?.name || 
            `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim() ||
            shopifyCustomer.email,
      email: shopifyCustomer.email,
      phone: shopifyCustomer.phone,
      tax_id: shopifyCustomer.taxExempt ? 'EXEMPT' : null,
      status: 'active',
      external_id: shopifyCustomer.id,
      metadata: {
        shopify_id: shopifyCustomer.id,
        tags: shopifyCustomer.tags,
        tax_exempt: shopifyCustomer.taxExempt,
        company: shopifyCustomer.company
      },
      // Transform addresses to contacts
      contacts: shopifyCustomer.addresses.map((address, index) => ({
        customer_id: internalId,
        name: `${shopifyCustomer.firstName || ''} ${shopifyCustomer.lastName || ''}`.trim(),
        email: shopifyCustomer.email,
        phone: address.phone || shopifyCustomer.phone,
        is_primary: index === 0,
        address_line1: address.address1,
        address_line2: address.address2,
        city: address.city,
        state: address.provinceCode || address.province,
        postal_code: address.zip,
        country: address.countryCode || address.country
      }))
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
      description: webhookData.body_html || null,
      is_active: webhookData.status === 'active'
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

  private mapOrderStatus(
    financialStatus: string,
    fulfillmentStatus: string | null
  ): string {
    if (financialStatus === 'REFUNDED' || financialStatus === 'VOIDED') {
      return 'cancelled'
    }
    
    if (fulfillmentStatus === 'FULFILLED') {
      return 'completed'
    }

    if (financialStatus === 'PAID') {
      return 'processing'
    }

    return 'pending'
  }

  private transformLineItem(lineItem: ShopifyLineItem): any {
    return {
      external_id: lineItem.id,
      product_id: lineItem.product?.id,
      variant_id: lineItem.variant?.id,
      sku: lineItem.variant?.sku,
      title: lineItem.title,
      quantity: lineItem.quantity,
      price: parseFloat(lineItem.price)
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

  private async generateInternalId(input: string): Promise<string> {
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string')
    }
    
    // Generate a deterministic ID using SHA-256 hash
    const encoder = new TextEncoder()
    const data = encoder.encode(input.trim())
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return `shopify_${hash.substring(0, 16)}` // Use first 16 chars of hash
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