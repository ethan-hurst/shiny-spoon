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
  if (!obj || typeof obj !== 'object') return false
  
  const product = obj as Record<string, unknown>
  
  // Required fields
  if (typeof product.id !== 'string' || !product.id) return false
  if (typeof product.title !== 'string' || !product.title) return false
  if (typeof product.status !== 'string' || !['ACTIVE', 'ARCHIVED', 'DRAFT'].includes(product.status as string)) return false
  
  // Optional fields with type checking
  if (product.handle !== undefined && typeof product.handle !== 'string') return false
  if (product.descriptionHtml !== undefined && typeof product.descriptionHtml !== 'string') return false
  if (product.vendor !== undefined && typeof product.vendor !== 'string') return false
  if (product.productType !== undefined && typeof product.productType !== 'string') return false
  if (product.tags !== undefined && !Array.isArray(product.tags)) return false
  if (product.updatedAt !== undefined && typeof product.updatedAt !== 'string') return false
  if (product.createdAt !== undefined && typeof product.createdAt !== 'string') return false
  
  // Validate variants structure
  if (product.variants && typeof product.variants === 'object') {
    const variants = product.variants as Record<string, unknown>
    if (!variants.edges || !Array.isArray(variants.edges)) return false
  }
  
  return true
}

export function isShopifyOrder(obj: unknown): obj is ShopifyOrder {
  if (!obj || typeof obj !== 'object') return false
  
  const order = obj as Record<string, unknown>
  
  // Required fields
  if (typeof order.id !== 'string' || !order.id) return false
  if (typeof order.name !== 'string' || !order.name) return false
  if (typeof order.createdAt !== 'string' || !order.createdAt) return false
  if (typeof order.updatedAt !== 'string' || !order.updatedAt) return false
  if (typeof order.totalPrice !== 'string') return false
  if (typeof order.subtotalPrice !== 'string') return false
  if (typeof order.totalTax !== 'string') return false
  if (typeof order.currencyCode !== 'string' || !order.currencyCode) return false
  
  // Validate enums
  const validFinancialStatuses = ['PENDING', 'AUTHORIZED', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED']
  const validFulfillmentStatuses = ['UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RESTOCKED']
  
  if (typeof order.financialStatus !== 'string' || !validFinancialStatuses.includes(order.financialStatus as string)) {
    return false
  }
  
  if (order.fulfillmentStatus !== null && 
      (typeof order.fulfillmentStatus !== 'string' || !validFulfillmentStatuses.includes(order.fulfillmentStatus as string))) {
    return false
  }
  
  // Optional fields with type checking
  if (order.email !== undefined && typeof order.email !== 'string') return false
  
  // Validate lineItems structure
  if (order.lineItems && typeof order.lineItems === 'object') {
    const lineItems = order.lineItems as Record<string, unknown>
    if (!lineItems.edges || !Array.isArray(lineItems.edges)) return false
  } else {
    return false // lineItems is required
  }
  
  // Validate optional customer object
  if (order.customer !== undefined && order.customer !== null) {
    if (typeof order.customer !== 'object') return false
    const customer = order.customer as Record<string, unknown>
    if (customer.id !== undefined && typeof customer.id !== 'string') return false
    if (customer.email !== undefined && typeof customer.email !== 'string') return false
  }
  
  return true
}

export function isShopifyCustomer(obj: unknown): obj is ShopifyCustomer {
  if (!obj || typeof obj !== 'object') return false
  
  const customer = obj as Record<string, unknown>
  
  // Required fields
  if (typeof customer.id !== 'string' || !customer.id) return false
  if (typeof customer.email !== 'string' || !customer.email) return false
  if (typeof customer.taxExempt !== 'boolean') return false
  if (!Array.isArray(customer.tags)) return false
  if (typeof customer.createdAt !== 'string' || !customer.createdAt) return false
  if (typeof customer.updatedAt !== 'string' || !customer.updatedAt) return false
  if (!Array.isArray(customer.addresses)) return false
  
  // Validate tags array contains strings
  for (const tag of customer.tags as unknown[]) {
    if (typeof tag !== 'string') return false
  }
  
  // Optional fields with type checking
  if (customer.firstName !== undefined && typeof customer.firstName !== 'string') return false
  if (customer.lastName !== undefined && typeof customer.lastName !== 'string') return false
  if (customer.phone !== undefined && typeof customer.phone !== 'string') return false
  
  // Validate addresses array
  for (const address of customer.addresses as unknown[]) {
    if (!address || typeof address !== 'object') return false
    const addr = address as Record<string, unknown>
    
    // All address fields are optional, but if present must be strings
    if (addr.address1 !== undefined && typeof addr.address1 !== 'string') return false
    if (addr.address2 !== undefined && typeof addr.address2 !== 'string') return false
    if (addr.city !== undefined && typeof addr.city !== 'string') return false
    if (addr.province !== undefined && typeof addr.province !== 'string') return false
    if (addr.provinceCode !== undefined && typeof addr.provinceCode !== 'string') return false
    if (addr.country !== undefined && typeof addr.country !== 'string') return false
    if (addr.countryCode !== undefined && typeof addr.countryCode !== 'string') return false
    if (addr.zip !== undefined && typeof addr.zip !== 'string') return false
    if (addr.phone !== undefined && typeof addr.phone !== 'string') return false
    if (addr.company !== undefined && typeof addr.company !== 'string') return false
  }
  
  // Validate optional company object
  if (customer.company !== undefined && customer.company !== null) {
    if (typeof customer.company !== 'object') return false
    const company = customer.company as Record<string, unknown>
    if (typeof company.id !== 'string' || !company.id) return false
    if (typeof company.name !== 'string' || !company.name) return false
    if (company.externalId !== undefined && typeof company.externalId !== 'string') return false
    if (company.note !== undefined && typeof company.note !== 'string') return false
    if (typeof company.createdAt !== 'string' || !company.createdAt) return false
    if (typeof company.updatedAt !== 'string' || !company.updatedAt) return false
  }
  
  // Validate optional catalogGroups structure
  if (customer.catalogGroups !== undefined && customer.catalogGroups !== null) {
    if (typeof customer.catalogGroups !== 'object') return false
    const catalogGroups = customer.catalogGroups as Record<string, unknown>
    if (!catalogGroups.edges || !Array.isArray(catalogGroups.edges)) return false
  }
  
  return true
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