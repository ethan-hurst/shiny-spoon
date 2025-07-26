// PRP-014: Shopify B2B Integration Types
import { z } from 'zod'

// ===============================
// GraphQL Response Types
// ===============================

export interface ShopifyPageInfo {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor?: string
  endCursor?: string
}

export interface ShopifyNode<T> {
  node: T
}

export interface ShopifyConnection<T> {
  edges: ShopifyNode<T>[]
  pageInfo: ShopifyPageInfo
}

// ===============================
// Product Types
// ===============================

export interface ShopifyProduct {
  id: string
  title: string
  handle: string
  descriptionHtml?: string
  vendor?: string
  productType?: string
  tags: string[]
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT'
  updatedAt: string
  createdAt: string
  variants: ShopifyConnection<ShopifyVariant>
  metafields?: ShopifyConnection<ShopifyMetafield>
}

export interface ShopifyVariant {
  id: string
  title: string
  sku: string
  price: string
  compareAtPrice?: string
  inventoryPolicy: 'DENY' | 'CONTINUE'
  inventoryManagement?: 'SHOPIFY' | 'NOT_MANAGED' | null
  weight?: number
  weightUnit?: 'GRAMS' | 'KILOGRAMS' | 'OUNCES' | 'POUNDS'
  barcode?: string
  position: number
  inventoryItem?: {
    id: string
  }
}

export interface ShopifyMetafield {
  id: string
  namespace: string
  key: string
  value: string
  type: string
}

// ===============================
// Inventory Types
// ===============================

export interface ShopifyInventoryLevel {
  id: string
  available: number
  updatedAt: string
  item: {
    id: string
    sku: string
    variant?: {
      id: string
      product: {
        id: string
      }
    }
  }
  location: {
    id: string
    name: string
  }
}

export interface ShopifyLocation {
  id: string
  name: string
  isActive: boolean
  address: {
    address1?: string
    address2?: string
    city?: string
    province?: string
    country?: string
    zip?: string
  }
  inventoryLevels?: ShopifyConnection<ShopifyInventoryLevel>
}

// ===============================
// Order Types
// ===============================

export interface ShopifyOrder {
  id: string
  name: string // Order number like #1001
  createdAt: string
  updatedAt: string
  email?: string
  totalPrice: string
  subtotalPrice: string
  totalTax: string
  currencyCode: string
  financialStatus: 'PENDING' | 'AUTHORIZED' | 'PARTIALLY_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED'
  fulfillmentStatus: 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'RESTOCKED'
  lineItems: ShopifyConnection<ShopifyLineItem>
  customer?: ShopifyCustomer
  shippingAddress?: ShopifyAddress
  billingAddress?: ShopifyAddress
}

export interface ShopifyLineItem {
  id: string
  title: string
  quantity: number
  price: string
  variant?: {
    id: string
    sku: string
  }
  product?: {
    id: string
  }
}

// ===============================
// Customer Types
// ===============================

export interface ShopifyCustomer {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  taxExempt: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  addresses: ShopifyAddress[]
  company?: ShopifyCompany
  catalogGroups?: ShopifyConnection<ShopifyCatalogGroup>
}

export interface ShopifyCompany {
  id: string
  name: string
  externalId?: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface ShopifyAddress {
  address1?: string
  address2?: string
  city?: string
  province?: string
  provinceCode?: string
  country?: string
  countryCode?: string
  zip?: string
  phone?: string
  company?: string
}

// ===============================
// B2B Types
// ===============================

export interface ShopifyCatalog {
  id: string
  title: string
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT'
  priceList?: ShopifyPriceList
  publication?: {
    id: string
  }
}

export interface ShopifyPriceList {
  id: string
  name: string
  currency: string
  prices: ShopifyConnection<ShopifyPrice>
}

export interface ShopifyPrice {
  variant: {
    id: string
  }
  price: {
    amount: string
    currencyCode: string
  }
  compareAtPrice?: {
    amount: string
    currencyCode: string
  }
}

export interface ShopifyCatalogGroup {
  id: string
  name: string
  customers?: ShopifyConnection<ShopifyCustomer>
  catalogs?: ShopifyConnection<ShopifyCatalog>
}

// ===============================
// Bulk Operation Types
// ===============================

export interface ShopifyBulkOperation {
  id: string
  status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'CANCELED' | 'FAILED' | 'EXPIRED'
  errorCode?: string
  createdAt: string
  completedAt?: string
  url?: string
  partialDataUrl?: string
}

// ===============================
// API Response Types
// ===============================

export interface ShopifyGraphQLResponse<T> {
  data?: T
  errors?: ShopifyGraphQLError[]
  extensions?: {
    cost: {
      requestedQueryCost: number
      actualQueryCost: number
      throttleStatus: {
        maximumAvailable: number
        currentlyAvailable: number
        restoreRate: number
      }
    }
  }
}

export interface ShopifyGraphQLError {
  message: string
  extensions?: {
    code: string
    documentation?: string
  }
  path?: string[]
}

// ===============================
// Webhook Types
// ===============================

export interface ShopifyWebhookPayload {
  id: string | number
  admin_graphql_api_id?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export const ShopifyWebhookTopics = [
  'products/create',
  'products/update',
  'products/delete',
  'inventory_levels/update',
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'customers/create',
  'customers/update',
  'bulk_operations/finish'
] as const

export type ShopifyWebhookTopic = typeof ShopifyWebhookTopics[number]

// ===============================
// Configuration Types
// ===============================

export interface ShopifyIntegrationConfig {
  shop_domain: string // mystore.myshopify.com
  access_token: string
  webhook_secret: string
  storefront_access_token?: string
  sync_products: boolean
  sync_inventory: boolean
  sync_orders: boolean
  sync_customers: boolean
  b2b_catalog_enabled: boolean
  default_price_list_id?: string
  location_mappings: Record<string, string> // Shopify location ID -> warehouse ID
  sync_frequency: number // minutes
  api_version: string
}

// ===============================
// Validation Schemas
// ===============================

export const shopifyWebhookPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]),
  admin_graphql_api_id: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
}).passthrough()

export const shopifyProductWebhookSchema = shopifyWebhookPayloadSchema.extend({
  title: z.string(),
  handle: z.string(),
  vendor: z.string().optional(),
  product_type: z.string().optional(),
  status: z.enum(['active', 'archived', 'draft']),
  tags: z.string(),
  variants: z.array(z.object({
    id: z.number(),
    product_id: z.number(),
    title: z.string(),
    sku: z.string(),
    price: z.string(),
    inventory_policy: z.enum(['deny', 'continue']),
    inventory_management: z.enum(['shopify', 'not_managed']).nullable(),
    weight: z.number().optional(),
    weight_unit: z.string().optional()
  }))
})

export const shopifyInventoryWebhookSchema = z.object({
  inventory_item_id: z.number(),
  location_id: z.number(),
  available: z.number(),
  updated_at: z.string()
})

export const shopifyOrderWebhookSchema = shopifyWebhookPayloadSchema.extend({
  name: z.string(),
  email: z.string().optional(),
  total_price: z.string(),
  subtotal_price: z.string(),
  total_tax: z.string(),
  currency: z.string(),
  financial_status: z.string(),
  fulfillment_status: z.string().nullable(),
  line_items: z.array(z.object({
    id: z.number(),
    variant_id: z.number().nullable(),
    title: z.string(),
    quantity: z.number(),
    price: z.string(),
    sku: z.string().optional()
  })),
  customer: z.object({
    id: z.number(),
    email: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional()
  }).optional()
})

// ===============================
// Error Types
// ===============================

export class ShopifyAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public errors?: ShopifyGraphQLError[]
  ) {
    super(message)
    this.name = 'ShopifyAPIError'
  }
}

export class ShopifyRateLimitError extends ShopifyAPIError {
  constructor(
    message: string,
    public retryAfter: number // seconds
  ) {
    super(message, 'RATE_LIMITED', 429)
    this.name = 'ShopifyRateLimitError'
  }
}

// ===============================
// Type Guards
// ===============================

export function isShopifyProduct(obj: unknown): obj is ShopifyProduct {
  return (
    obj !== null && 
    typeof obj === 'object' && 
    'id' in obj && typeof (obj as Record<string, unknown>).id === 'string' && 
    'title' in obj && typeof (obj as Record<string, unknown>).title === 'string'
  )
}

export function isShopifyOrder(obj: unknown): obj is ShopifyOrder {
  return (
    obj !== null && 
    typeof obj === 'object' && 
    'id' in obj && typeof (obj as Record<string, unknown>).id === 'string' && 
    'name' in obj && typeof (obj as Record<string, unknown>).name === 'string'
  )
}

export function isShopifyCustomer(obj: unknown): obj is ShopifyCustomer {
  return (
    obj !== null && 
    typeof obj === 'object' && 
    'id' in obj && typeof (obj as Record<string, unknown>).id === 'string' && 
    'email' in obj && typeof (obj as Record<string, unknown>).email === 'string'
  )
}

// ===============================
// Utility Types
// ===============================

export type ShopifyWebhookHeaders = {
  'x-shopify-topic': ShopifyWebhookTopic
  'x-shopify-shop-domain': string
  'x-shopify-hmac-sha256': string
  'x-shopify-webhook-id': string
  'x-shopify-api-version': string
}

export interface ShopifySyncResult {
  success: boolean
  itemsProcessed: number
  itemsFailed: number
  errors: Error[]
  nextCursor?: string
  hasMore?: boolean
}

export interface ShopifyFieldMapping {
  shopifyField: string
  internalField: string
  transform?: (value: unknown) => unknown
}

export interface ShopifyConfigFormData {
  shop_domain: string
  access_token: string
  webhook_secret: string
  sync_products: boolean
  sync_inventory: boolean
  sync_orders: boolean
  sync_customers: boolean
  b2b_catalog_enabled: boolean
  sync_frequency: number
}