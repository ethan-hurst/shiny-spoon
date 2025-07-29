// PRP-014: Shopify Data Transformers
import { ShopifyFieldMapping } from '@/types/shopify.types'

export interface ShopifyTransformConfig {
  field_mappings?: Record<string, string>
  location_mappings?: Record<string, string>
  default_currency?: string
  weight_unit_conversion?: 'grams' | 'ounces' | 'pounds' | 'kilograms'
}

export class ShopifyTransformers {
  private config: ShopifyTransformConfig

  constructor(config: ShopifyTransformConfig = {}) {
    this.config = {
      field_mappings: {},
      location_mappings: {},
      default_currency: 'USD',
      weight_unit_conversion: 'grams',
      ...config,
    }
  }

  /**
   * Transform Shopify product to internal format
   */
  transformProduct(shopifyProduct: any): any {
    const transformed = {
      id: shopifyProduct.id?.toString(),
      external_id: shopifyProduct.id?.toString(),
      platform: 'shopify',
      title: shopifyProduct.title,
      description: shopifyProduct.body_html || shopifyProduct.description,
      handle: shopifyProduct.handle,
      vendor: shopifyProduct.vendor,
      product_type: shopifyProduct.product_type,
      status: this.mapProductStatus(shopifyProduct.status),
      tags: Array.isArray(shopifyProduct.tags) ? shopifyProduct.tags : [],
      created_at: shopifyProduct.created_at,
      updated_at: shopifyProduct.updated_at,
      published_at: shopifyProduct.published_at,
      variants: shopifyProduct.variants?.map((variant: any) => this.transformVariant(variant)) || [],
      images: shopifyProduct.images?.map((image: any) => this.transformImage(image)) || [],
      options: shopifyProduct.options || [],
      metafields: shopifyProduct.metafields || [],
      // Apply field mappings
      ...this.applyFieldMappings(shopifyProduct),
    }

    return transformed
  }

  /**
   * Transform Shopify variant to internal format
   */
  transformVariant(shopifyVariant: any): any {
    return {
      id: shopifyVariant.id?.toString(),
      external_id: shopifyVariant.id?.toString(),
      title: shopifyVariant.title,
      sku: shopifyVariant.sku,
      barcode: shopifyVariant.barcode,
      price: parseFloat(shopifyVariant.price) || 0,
      compare_at_price: shopifyVariant.compare_at_price ? parseFloat(shopifyVariant.compare_at_price) : null,
      cost: shopifyVariant.cost ? parseFloat(shopifyVariant.cost) : null,
      weight: this.convertWeight(shopifyVariant.weight, shopifyVariant.weight_unit),
      weight_unit: this.config.weight_unit_conversion,
      inventory_quantity: shopifyVariant.inventory_quantity || 0,
      inventory_policy: shopifyVariant.inventory_policy,
      inventory_management: shopifyVariant.inventory_management,
      fulfillment_service: shopifyVariant.fulfillment_service,
      position: shopifyVariant.position,
      option1: shopifyVariant.option1,
      option2: shopifyVariant.option2,
      option3: shopifyVariant.option3,
      created_at: shopifyVariant.created_at,
      updated_at: shopifyVariant.updated_at,
      inventory_item_id: shopifyVariant.inventory_item_id?.toString(),
    }
  }

  /**
   * Transform Shopify image to internal format
   */
  transformImage(shopifyImage: any): any {
    return {
      id: shopifyImage.id?.toString(),
      external_id: shopifyImage.id?.toString(),
      src: shopifyImage.src,
      alt: shopifyImage.alt,
      width: shopifyImage.width,
      height: shopifyImage.height,
      position: shopifyImage.position,
      created_at: shopifyImage.created_at,
      updated_at: shopifyImage.updated_at,
    }
  }

  /**
   * Transform Shopify inventory level to internal format
   */
  transformInventoryLevel(shopifyInventory: any): any {
    return {
      id: shopifyInventory.id?.toString(),
      external_id: shopifyInventory.id?.toString(),
      inventory_item_id: shopifyInventory.inventory_item_id?.toString(),
      location_id: this.mapLocationId(shopifyInventory.location_id?.toString()),
      available: shopifyInventory.available || 0,
      created_at: shopifyInventory.created_at,
      updated_at: shopifyInventory.updated_at,
      // Location info
      location_name: shopifyInventory.location?.name,
      location_address: this.formatLocationAddress(shopifyInventory.location),
    }
  }

  /**
   * Transform Shopify customer to internal format
   */
  transformCustomer(shopifyCustomer: any): any {
    return {
      id: shopifyCustomer.id?.toString(),
      external_id: shopifyCustomer.id?.toString(),
      email: shopifyCustomer.email,
      first_name: shopifyCustomer.first_name,
      last_name: shopifyCustomer.last_name,
      phone: shopifyCustomer.phone,
      tax_exempt: shopifyCustomer.tax_exempt || false,
      tags: Array.isArray(shopifyCustomer.tags) ? shopifyCustomer.tags : [],
      note: shopifyCustomer.note,
      total_spent: parseFloat(shopifyCustomer.total_spent) || 0,
      orders_count: shopifyCustomer.orders_count || 0,
      state: shopifyCustomer.state,
      verified_email: shopifyCustomer.verified_email || false,
      multipass_identifier: shopifyCustomer.multipass_identifier,
      accepts_marketing: shopifyCustomer.accepts_marketing || false,
      accepts_marketing_updated_at: shopifyCustomer.accepts_marketing_updated_at,
      marketing_opt_in_level: shopifyCustomer.marketing_opt_in_level,
      tax_exemptions: shopifyCustomer.tax_exemptions || [],
      admin_graphql_api_id: shopifyCustomer.admin_graphql_api_id,
      default_address: shopifyCustomer.default_address ? this.transformAddress(shopifyCustomer.default_address) : null,
      addresses: shopifyCustomer.addresses?.map((address: any) => this.transformAddress(address)) || [],
      created_at: shopifyCustomer.created_at,
      updated_at: shopifyCustomer.updated_at,
      // Company info for B2B
      company: shopifyCustomer.company ? this.transformCompany(shopifyCustomer.company) : null,
    }
  }

  /**
   * Transform Shopify address to internal format
   */
  transformAddress(shopifyAddress: any): any {
    return {
      id: shopifyAddress.id?.toString(),
      customer_id: shopifyAddress.customer_id?.toString(),
      first_name: shopifyAddress.first_name,
      last_name: shopifyAddress.last_name,
      company: shopifyAddress.company,
      address1: shopifyAddress.address1,
      address2: shopifyAddress.address2,
      city: shopifyAddress.city,
      province: shopifyAddress.province,
      province_code: shopifyAddress.province_code,
      country: shopifyAddress.country,
      country_code: shopifyAddress.country_code,
      zip: shopifyAddress.zip,
      phone: shopifyAddress.phone,
      name: shopifyAddress.name,
      default: shopifyAddress.default || false,
    }
  }

  /**
   * Transform Shopify company to internal format
   */
  transformCompany(shopifyCompany: any): any {
    return {
      id: shopifyCompany.id?.toString(),
      external_id: shopifyCompany.external_id,
      name: shopifyCompany.name,
      note: shopifyCompany.note,
      created_at: shopifyCompany.created_at,
      updated_at: shopifyCompany.updated_at,
    }
  }

  /**
   * Transform Shopify order to internal format
   */
  transformOrder(shopifyOrder: any): any {
    return {
      id: shopifyOrder.id?.toString(),
      external_id: shopifyOrder.id?.toString(),
      name: shopifyOrder.name,
      email: shopifyOrder.email,
      phone: shopifyOrder.phone,
      currency: shopifyOrder.currency,
      presentment_currency: shopifyOrder.presentment_currency,
      subtotal_price: parseFloat(shopifyOrder.subtotal_price) || 0,
      total_price: parseFloat(shopifyOrder.total_price) || 0,
      total_tax: parseFloat(shopifyOrder.total_tax) || 0,
      total_discounts: parseFloat(shopifyOrder.total_discounts) || 0,
      total_weight: shopifyOrder.total_weight,
      total_tip_received: parseFloat(shopifyOrder.total_tip_received) || 0,
      total_refunds: parseFloat(shopifyOrder.total_refunds) || 0,
      total_outstanding: parseFloat(shopifyOrder.total_outstanding) || 0,
      total_refunded: parseFloat(shopifyOrder.total_refunded) || 0,
      financial_status: shopifyOrder.financial_status,
      confirmed: shopifyOrder.confirmed || false,
      test: shopifyOrder.test || false,
      cancelled_at: shopifyOrder.cancelled_at,
      cancel_reason: shopifyOrder.cancel_reason,
      cancelled: shopifyOrder.cancelled || false,
      closed_at: shopifyOrder.closed_at,
      closed: shopifyOrder.closed || false,
      processed_at: shopifyOrder.processed_at,
      fulfillment_status: shopifyOrder.fulfillment_status,
      tags: Array.isArray(shopifyOrder.tags) ? shopifyOrder.tags : [],
      note: shopifyOrder.note,
      note_attributes: shopifyOrder.note_attributes || [],
      browser_ip: shopifyOrder.browser_ip,
      landing_site: shopifyOrder.landing_site,
      landing_site_ref: shopifyOrder.landing_site_ref,
      referring_site: shopifyOrder.referring_site,
      source_name: shopifyOrder.source_name,
      source_identifier: shopifyOrder.source_identifier,
      source_url: shopifyOrder.source_url,
      source_identifier: shopifyOrder.source_identifier,
      location_id: shopifyOrder.location_id?.toString(),
      shipping_lines: shopifyOrder.shipping_lines || [],
      billing_address: shopifyOrder.billing_address ? this.transformAddress(shopifyOrder.billing_address) : null,
      shipping_address: shopifyOrder.shipping_address ? this.transformAddress(shopifyOrder.shipping_address) : null,
      line_items: shopifyOrder.line_items?.map((item: any) => this.transformLineItem(item)) || [],
      fulfillments: shopifyOrder.fulfillments || [],
      refunds: shopifyOrder.refunds || [],
      customer: shopifyOrder.customer ? this.transformCustomer(shopifyOrder.customer) : null,
      created_at: shopifyOrder.created_at,
      updated_at: shopifyOrder.updated_at,
    }
  }

  /**
   * Transform Shopify line item to internal format
   */
  transformLineItem(shopifyLineItem: any): any {
    return {
      id: shopifyLineItem.id?.toString(),
      variant_id: shopifyLineItem.variant_id?.toString(),
      title: shopifyLineItem.title,
      quantity: shopifyLineItem.quantity,
      sku: shopifyLineItem.sku,
      variant_title: shopifyLineItem.variant_title,
      vendor: shopifyLineItem.vendor,
      fulfillment_service: shopifyLineItem.fulfillment_service,
      product_id: shopifyLineItem.product_id?.toString(),
      requires_shipping: shopifyLineItem.requires_shipping || false,
      taxable: shopifyLineItem.taxable || false,
      gift_card: shopifyLineItem.gift_card || false,
      name: shopifyLineItem.name,
      variant_inventory_management: shopifyLineItem.variant_inventory_management,
      properties: shopifyLineItem.properties || [],
      product_exists: shopifyLineItem.product_exists || false,
      fulfillable_quantity: shopifyLineItem.fulfillable_quantity || 0,
      grams: shopifyLineItem.grams,
      price: parseFloat(shopifyLineItem.price) || 0,
      total_discount: parseFloat(shopifyLineItem.total_discount) || 0,
      fulfillment_status: shopifyLineItem.fulfillment_status,
      tax_lines: shopifyLineItem.tax_lines || [],
      duties: shopifyLineItem.duties || [],
      discount_allocations: shopifyLineItem.discount_allocations || [],
    }
  }

  /**
   * Transform internal product to Shopify format
   */
  transformToShopifyProduct(internalProduct: any): any {
    const shopifyProduct: any = {
      title: internalProduct.title,
      body_html: internalProduct.description,
      vendor: internalProduct.vendor,
      product_type: internalProduct.product_type,
      status: this.mapInternalProductStatus(internalProduct.status),
      tags: Array.isArray(internalProduct.tags) ? internalProduct.tags.join(', ') : '',
      variants: internalProduct.variants?.map((variant: any) => this.transformToShopifyVariant(variant)) || [],
      options: internalProduct.options || [],
    }

    // Apply reverse field mappings
    return this.applyReverseFieldMappings(shopifyProduct, internalProduct)
  }

  /**
   * Transform internal variant to Shopify format
   */
  transformToShopifyVariant(internalVariant: any): any {
    return {
      title: internalVariant.title,
      sku: internalVariant.sku,
      barcode: internalVariant.barcode,
      price: internalVariant.price?.toString(),
      compare_at_price: internalVariant.compare_at_price?.toString(),
      cost: internalVariant.cost?.toString(),
      weight: this.convertWeightToShopify(internalVariant.weight),
      weight_unit: this.getShopifyWeightUnit(),
      inventory_quantity: internalVariant.inventory_quantity,
      inventory_policy: internalVariant.inventory_policy,
      inventory_management: internalVariant.inventory_management,
      fulfillment_service: internalVariant.fulfillment_service,
      option1: internalVariant.option1,
      option2: internalVariant.option2,
      option3: internalVariant.option3,
    }
  }

  /**
   * Transform internal inventory level to Shopify format
   */
  transformToShopifyInventoryLevel(internalInventory: any): any {
    return {
      location_id: this.mapInternalLocationId(internalInventory.location_id),
      inventory_item_id: internalInventory.inventory_item_id,
      available: internalInventory.available,
    }
  }

  /**
   * Map Shopify product status to internal format
   */
  private mapProductStatus(shopifyStatus: string): string {
    const statusMap: Record<string, string> = {
      'active': 'active',
      'archived': 'archived',
      'draft': 'draft',
    }
    return statusMap[shopifyStatus] || 'draft'
  }

  /**
   * Map internal product status to Shopify format
   */
  private mapInternalProductStatus(internalStatus: string): string {
    const statusMap: Record<string, string> = {
      'active': 'active',
      'archived': 'archived',
      'draft': 'draft',
    }
    return statusMap[internalStatus] || 'draft'
  }

  /**
   * Convert weight to internal unit
   */
  private convertWeight(weight: number, unit: string): number {
    if (!weight) return 0

    const unitMap: Record<string, number> = {
      'grams': 1,
      'ounces': 28.3495,
      'pounds': 453.592,
      'kilograms': 1000,
    }

    const multiplier = unitMap[unit.toLowerCase()] || 1
    return weight * multiplier
  }

  /**
   * Convert weight from internal unit to Shopify unit
   */
  private convertWeightToShopify(weight: number): number {
    if (!weight) return 0

    const unitMap: Record<string, number> = {
      'grams': 1,
      'ounces': 0.035274,
      'pounds': 0.00220462,
      'kilograms': 0.001,
    }

    const multiplier = unitMap[this.config.weight_unit_conversion || 'grams'] || 1
    return weight * multiplier
  }

  /**
   * Get Shopify weight unit
   */
  private getShopifyWeightUnit(): string {
    const unitMap: Record<string, string> = {
      'grams': 'g',
      'ounces': 'oz',
      'pounds': 'lb',
      'kilograms': 'kg',
    }
    return unitMap[this.config.weight_unit_conversion || 'grams'] || 'g'
  }

  /**
   * Map Shopify location ID to internal location ID
   */
  private mapLocationId(shopifyLocationId: string): string {
    return this.config.location_mappings?.[shopifyLocationId] || shopifyLocationId
  }

  /**
   * Map internal location ID to Shopify location ID
   */
  private mapInternalLocationId(internalLocationId: string): string {
    const reverseMappings = Object.entries(this.config.location_mappings || {}).reduce(
      (acc, [shopifyId, internalId]) => {
        acc[internalId] = shopifyId
        return acc
      },
      {} as Record<string, string>
    )
    return reverseMappings[internalLocationId] || internalLocationId
  }

  /**
   * Format location address
   */
  private formatLocationAddress(location: any): string {
    if (!location) return ''
    
    const parts = [
      location.address1,
      location.address2,
      location.city,
      location.province,
      location.zip,
      location.country,
    ].filter(Boolean)
    
    return parts.join(', ')
  }

  /**
   * Apply field mappings from Shopify to internal format
   */
  private applyFieldMappings(shopifyData: any): Record<string, any> {
    const mapped: Record<string, any> = {}
    
    for (const [shopifyField, internalField] of Object.entries(this.config.field_mappings || {})) {
      if (shopifyData[shopifyField] !== undefined) {
        mapped[internalField] = shopifyData[shopifyField]
      }
    }
    
    return mapped
  }

  /**
   * Apply reverse field mappings from internal to Shopify format
   */
  private applyReverseFieldMappings(shopifyData: any, internalData: any): any {
    const reverseMappings = Object.entries(this.config.field_mappings || {}).reduce(
      (acc, [shopifyField, internalField]) => {
        acc[internalField] = shopifyField
        return acc
      },
      {} as Record<string, string>
    )
    
    for (const [internalField, shopifyField] of Object.entries(reverseMappings)) {
      if (internalData[internalField] !== undefined) {
        shopifyData[shopifyField] = internalData[internalField]
      }
    }
    
    return shopifyData
  }
}