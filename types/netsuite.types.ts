// PRP-013: NetSuite Integration Types
import { z } from 'zod'

// NetSuite Item types
export interface NetSuiteItem {
  id: string
  itemid: string // SKU
  displayname: string
  salesdescription?: string
  baseprice?: number
  custitem_weight?: number
  custitem_dimensions?: string
  isinactive: boolean
  lastmodifieddate: string
  category?: string
  itemtype: 'Inventory' | 'NonInventory' | 'Kit' | 'Assembly' | 'Service'
  // Custom fields
  [key: `custitem_${string}`]: any
}

// NetSuite Inventory Balance
export interface NetSuiteInventoryBalance {
  item: string
  itemid: string
  location: string
  locationname: string
  quantityavailable: number
  quantityonhand: number
  quantityintransit: number
  quantityonorder: number
  reorderpoint?: number
  preferredstocklevel?: number
  lastmodifieddate: string
}

// NetSuite Price Level
export interface NetSuitePriceLevel {
  id: string
  name: string
  isinactive: boolean
}

// NetSuite Item Price
export interface NetSuiteItemPrice {
  item: string
  itemid: string
  pricelevel: string
  pricelevelname: string
  unitprice: number
  currency: string
  lastmodifieddate: string
}

// NetSuite Location
export interface NetSuiteLocation {
  id: string
  name: string
  isinactive: boolean
  makeinventoryavailable: boolean
  // Address fields
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

// NetSuite OAuth token response
export interface NetSuiteTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

// NetSuite SuiteQL response
export interface NetSuiteSuiteQLResponse<T = any> {
  items: T[]
  hasMore: boolean
  totalResults?: number
  links?: Array<{
    rel: string
    href: string
  }>
}

// NetSuite REST API Error
export interface NetSuiteApiError {
  type: string
  title: string
  status: number
  detail?: string
  'o:errorCode'?: string
  'o:errorDetails'?: Array<{
    detail: string
    'o:errorPath': string
    'o:errorCode': string
  }>
}

// NetSuite Webhook Event
export interface NetSuiteWebhookEvent {
  eventId: string
  eventType: 'CREATE' | 'UPDATE' | 'DELETE'
  eventDate: string
  recordType: string
  recordId: string
  accountId: string
  // Additional fields based on event type
  changes?: Array<{
    field: string
    oldValue: any
    newValue: any
  }>
}

// Validation schemas
export const netsuiteItemSchema = z.object({
  id: z.string(),
  itemid: z.string(),
  displayname: z.string(),
  salesdescription: z.string().optional(),
  baseprice: z.number().optional(),
  custitem_weight: z.number().optional(),
  custitem_dimensions: z.string().optional(),
  isinactive: z.boolean(),
  lastmodifieddate: z.string(),
  category: z.string().optional(),
  itemtype: z.enum(['Inventory', 'NonInventory', 'Kit', 'Assembly', 'Service']),
})

export const netsuiteInventorySchema = z.object({
  item: z.string(),
  itemid: z.string(),
  location: z.string(),
  locationname: z.string(),
  quantityavailable: z.number(),
  quantityonhand: z.number(),
  quantityintransit: z.number(),
  quantityonorder: z.number(),
  reorderpoint: z.number().optional(),
  preferredstocklevel: z.number().optional(),
  lastmodifieddate: z.string(),
})

export const netsuitePriceSchema = z.object({
  item: z.string(),
  itemid: z.string(),
  pricelevel: z.string(),
  pricelevelname: z.string(),
  unitprice: z.number(),
  currency: z.string(),
  lastmodifieddate: z.string(),
})

// Configuration types
export interface NetSuiteIntegrationConfig {
  account_id: string
  datacenter_url: string
  consumer_key?: string
  consumer_secret?: string
  token_id?: string
  token_secret?: string
  sync_frequency: number
  inventory_sync_enabled: boolean
  product_sync_enabled: boolean
  pricing_sync_enabled: boolean
  field_mappings: Record<string, string>
}

// Validation schema for NetSuite configuration
export const netsuiteIntegrationConfigSchema = z.object({
  account_id: z.string().min(1, 'Account ID is required'),
  datacenter_url: z.string().url('Datacenter URL must be a valid URL'),
  consumer_key: z.string().optional(),
  consumer_secret: z.string().optional(),
  token_id: z.string().optional(),
  token_secret: z.string().optional(),
  sync_frequency: z.number().min(1, 'Sync frequency must be at least 1'),
  inventory_sync_enabled: z.boolean(),
  product_sync_enabled: z.boolean(),
  pricing_sync_enabled: z.boolean(),
  field_mappings: z.record(z.string(), z.string()).default({}),
})

/**
 * Validates and parses a NetSuite integration configuration object.
 *
 * @param config - The configuration object to validate
 * @returns The validated and typed NetSuiteIntegrationConfig object
 * @throws If the input does not conform to the required schema
 */
export function validateNetSuiteConfig(
  config: unknown
): NetSuiteIntegrationConfig {
  return netsuiteIntegrationConfigSchema.parse(config)
}

/**
 * Determines whether the provided value is a valid NetSuite integration configuration.
 *
 * Returns true if the input conforms to the NetSuiteIntegrationConfig schema; otherwise, returns false.
 */
export function isNetSuiteIntegrationConfig(
  config: unknown
): config is NetSuiteIntegrationConfig {
  try {
    netsuiteIntegrationConfigSchema.parse(config)
    return true
  } catch {
    return false
  }
}

// Sync state types
export interface NetSuiteSyncState {
  entity_type: 'product' | 'inventory' | 'pricing'
  last_sync_date?: Date
  last_sync_token?: string
  sync_cursor?: any
  total_synced: number
  total_errors: number
}

/**
 * Determines whether the provided value is a NetSuiteApiError object.
 *
 * Returns true if the input has the required structure and types for a NetSuite API error.
 */
export function isNetSuiteApiError(error: any): error is NetSuiteApiError {
  return (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    typeof error.type === 'string' &&
    'status' in error &&
    typeof error.status === 'number' &&
    'title' in error &&
    typeof error.title === 'string' &&
    // Optional properties type checks
    (!('detail' in error) || typeof error.detail === 'string') &&
    (!('o:errorCode' in error) || typeof error['o:errorCode'] === 'string')
  )
}

/**
 * Determines whether the given object is a NetSuiteItem by checking for required properties.
 *
 * @returns True if the object has both 'id' and 'itemid' properties; otherwise, false.
 */
export function isNetSuiteItem(obj: any): obj is NetSuiteItem {
  return obj && typeof obj === 'object' && 'id' in obj && 'itemid' in obj
}

// Transform result types
export interface ProductTransformResult {
  sku: string
  name: string
  description?: string
  price?: number
  weight?: number
  dimensions?: string
  is_active: boolean
  external_id: string
  external_updated_at: string
  metadata: Record<string, any>
}

export interface InventoryTransformResult {
  product_sku: string
  warehouse_code: string
  quantity_available: number
  quantity_on_hand: number
  quantity_on_order: number
  reorder_point?: number
  preferred_stock_level?: number
  external_id: string
  external_updated_at: string
}

export interface PricingTransformResult {
  product_sku: string
  price_tier: string
  unit_price: number
  currency_code: string
  external_id: string
  external_updated_at: string
}
