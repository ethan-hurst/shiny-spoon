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
  constructor(
    private locationMappings: Record<string, string> = {}
  ) {}

  /**
   * Transform Shopify product to internal format
   */
  transformProduct(shopifyProduct: ShopifyProduct): Product & { id: string } {
    // Get first variant as the primary variant
    const primaryVariant = shopifyProduct.variants.edges[0]?.node

    if (!primaryVariant) {
      throw new Error(`Product ${shopifyProduct.id} has no variants`)
    }

    // Extract metafields
    const metafields = this.extractMetafields(shopifyProduct.metafields)

    // Generate internal ID based on SKU or Shopify ID
    const internalId = this.generateInternalId(primaryVariant.sku || shopifyProduct.id)

    return {
      id: internalId,
      name: shopifyProduct.title,
      sku: primaryVariant.sku || `SHOPIFY-${shopifyProduct.id}`,
      description: this.stripHtml(shopifyProduct.descriptionHtml || ''),
      price: parseFloat(primaryVariant.price),
      category: shopifyProduct.productType || 'uncategorized',
      status: this.mapProductStatus(shopifyProduct.status),
      external_id: shopifyProduct.id,
      // Store additional Shopify data in metadata
      metadata: {
        shopify_id: shopifyProduct.id,
        shopify_handle: shopifyProduct.handle,
        vendor: shopifyProduct.vendor,
        tags: shopifyProduct.tags,
        variants: shopifyProduct.variants.edges.map(edge => ({
          id: edge.node.id,
          title: edge.node.title,
          sku: edge.node.sku,
          price: edge.node.price,
          barcode: edge.node.barcode,
          weight: edge.node.weight,
          weight_unit: edge.node.weightUnit
        })),
        metafields: metafields
      }
    }
  }

  /**
   * Transform Shopify inventory level to internal format
   */
  transformInventory(
    shopifyInventory: ShopifyInventoryLevel,
    warehouseId: string
  ): Inventory & { product_id: string } {
    // Extract variant SKU for product lookup
    const sku = shopifyInventory.item.sku
    if (!sku) {
      throw new Error(`Inventory item ${shopifyInventory.item.id} has no SKU`)
    }

    return {
      product_id: this.generateInternalId(sku), // Must match product ID generation
      warehouse_id: warehouseId,
      quantity: shopifyInventory.available,
      reserved_quantity: 0, // Shopify doesn't provide reserved quantity
      metadata: {
        shopify_inventory_item_id: shopifyInventory.item.id,
        shopify_location_id: shopifyInventory.location.id,
        last_updated: shopifyInventory.updatedAt
      }
    }
  }

  /**
   * Transform inventory webhook payload
   */
  transformInventoryFromWebhook(
    webhookData: {
      inventory_item_id: number
      location_id: number
      available: number
      updated_at: string
    },
    warehouseId: string
  ): Inventory & { product_id: string; sku: string } {
    // In webhook context, the SKU and product_id need to be resolved by the connector
    // since webhook data only contains inventory_item_id
    return {
      product_id: `temp-${webhookData.inventory_item_id}`, // Will be resolved by connector
      warehouse_id: warehouseId,
      quantity: webhookData.available,
      reserved_quantity: 0,
      sku: '', // Will be resolved by connector
      metadata: {
        shopify_inventory_item_id: webhookData.inventory_item_id.toString(),
        shopify_location_id: webhookData.location_id.toString(),
        last_updated: webhookData.updated_at
      }
    }
  }

  /**
   * Transform Shopify order to internal format
   */
  transformOrder(shopifyOrder: ShopifyOrder): any {
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
        state: address.province,
        postal_code: address.zip,
        country: address.countryCode || address.country
      }))
    }
  }

  /**
   * Transform webhook product payload (different structure)
   */
  transformProductFromWebhook(webhookData: any): Product & { id: string } {
    // Webhook products have a flatter structure
    const primaryVariant = webhookData.variants?.[0]

    if (!primaryVariant) {
      throw new Error(`Product ${webhookData.id} has no variants`)
    }

    const internalId = this.generateInternalId(primaryVariant.sku || webhookData.id.toString())

    return {
      id: internalId,
      name: webhookData.title,
      sku: primaryVariant.sku || `SHOPIFY-${webhookData.id}`,
      description: this.stripHtml(webhookData.body_html || ''),
      price: parseFloat(primaryVariant.price),
      category: webhookData.product_type || 'uncategorized',
      status: webhookData.status === 'active' ? 'active' : 'inactive',
      external_id: webhookData.admin_graphql_api_id || `gid://shopify/Product/${webhookData.id}`,
      metadata: {
        shopify_id: webhookData.id.toString(),
        shopify_handle: webhookData.handle,
        vendor: webhookData.vendor,
        tags: webhookData.tags?.split(', ') || [],
        variants: webhookData.variants?.map((v: any) => ({
          id: v.id.toString(),
          title: v.title,
          sku: v.sku,
          price: v.price,
          barcode: v.barcode,
          weight: v.weight,
          weight_unit: v.weight_unit
        })) || []
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
    return html.replace(/<[^>]*>/g, '').trim()
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

  private generateInternalId(input: string): string {
    // Generate a deterministic ID from input
    // In production, this might use a proper hashing function
    return `shopify_${input.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
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