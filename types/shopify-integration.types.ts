// Shopify Integration Config Types

export interface ShopifyConfig {
  sync_products: boolean
  sync_inventory: boolean
  sync_orders: boolean
  sync_customers: boolean
  b2b_catalog_enabled: boolean
}

export interface ShopifySyncSettings {
  sync_frequency?: number
  batch_size?: number
  api_version?: string
}

export interface ShopifyIntegrationConfig extends ShopifyConfig {
  shop_domain: string
  created_at?: string
  updated_at?: string
}