export type ERPType = 'SAP' | 'NETSUITE' | 'DYNAMICS365' | 'ORACLE_CLOUD' | 'INFOR' | 'EPICOR' | 'SAGE'

export interface ERPConfig {
  type: ERPType
  name: string
  enabled: boolean
  syncInterval?: number // minutes
  lastSync?: Date
  errorRetryLimit?: number
  rateLimitPerMinute?: number
}

export interface SAPConfig extends ERPConfig {
  type: 'SAP'
  host: string
  systemNumber: string
  client: string
  username: string
  password: string
  language?: string
  useOData?: boolean
  odataBaseUrl?: string
}

export interface NetSuiteConfig extends ERPConfig {
  type: 'NETSUITE'
  accountId: string
  consumerKey: string
  consumerSecret: string
  tokenId: string
  tokenSecret: string
  applicationId: string
  useSuiteQL?: boolean
}

export interface DynamicsConfig extends ERPConfig {
  type: 'DYNAMICS365'
  instanceUrl: string
  tenantId: string
  clientId: string
  clientSecret: string
  environment?: 'production' | 'sandbox'
}

// Query types
export interface BaseQuery {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
  fields?: string[]
}

export interface ProductQuery extends BaseQuery {
  ids?: string[]
  skus?: string[]
  categories?: string[]
  modifiedAfter?: Date
  modifiedBefore?: Date
  active?: boolean
  search?: string
  plants?: string[] // SAP-specific
}

export interface InventoryQuery extends BaseQuery {
  productIds?: string[]
  warehouseIds?: string[]
  locationIds?: string[]
  minQuantity?: number
  maxQuantity?: number
  includeReserved?: boolean
}

export interface OrderQuery extends BaseQuery {
  orderNumbers?: string[]
  customerIds?: string[]
  statuses?: OrderStatus[]
  dateFrom?: Date
  dateTo?: Date
  includeLineItems?: boolean
}

export interface CustomerQuery extends BaseQuery {
  customerIds?: string[]
  emails?: string[]
  companyNames?: string[]
  modifiedAfter?: Date
  includeContacts?: boolean
}

// Entity types
export interface Product {
  id: string
  sku: string
  name: string
  description?: string
  category?: string
  subcategory?: string
  unit: string
  price?: number
  cost?: number
  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
    unit: string
  }
  active: boolean
  metadata?: Record<string, any>
  erpSpecific?: Record<string, any>
}

export interface Inventory {
  id: string
  productId: string
  warehouseId: string
  locationId?: string
  quantity: number
  reservedQuantity?: number
  availableQuantity?: number
  reorderPoint?: number
  reorderQuantity?: number
  lastUpdated: Date
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  status: OrderStatus
  orderDate: Date
  shipDate?: Date
  deliveryDate?: Date
  items: OrderItem[]
  shippingAddress: Address
  billingAddress?: Address
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  notes?: string
}

export interface OrderItem {
  id: string
  productId: string
  sku: string
  name: string
  quantity: number
  unitPrice: number
  discount?: number
  tax?: number
  total: number
}

export interface Customer {
  id: string
  companyName?: string
  firstName?: string
  lastName?: string
  email: string
  phone?: string
  taxId?: string
  creditLimit?: number
  paymentTerms?: string
  addresses: Address[]
  contacts?: Contact[]
  metadata?: Record<string, any>
}

export interface Address {
  type: 'shipping' | 'billing' | 'both'
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault?: boolean
}

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  title?: string
  isPrimary?: boolean
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'

// Event types
export type ERPEventType = 
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'inventory.updated'
  | 'order.created'
  | 'order.updated'
  | 'order.cancelled'
  | 'customer.created'
  | 'customer.updated'

export interface ERPEvent {
  type: ERPEventType
  entityId: string
  timestamp: Date
  data: any
  source: ERPType
}

// Sync types
export interface SyncConfig {
  strategy: 'full' | 'incremental' | 'real-time'
  batchSize: number
  entities: ERPEntity[]
  schedule?: string // cron expression
  conflictResolution: 'last-write-wins' | 'merge' | 'manual'
}

export type ERPEntity = 'products' | 'inventory' | 'orders' | 'customers'

export interface BulkResult {
  success: number
  failed: number
  errors: BulkError[]
  duration: number
}

export interface BulkError {
  entity: ERPEntity
  entityId?: string
  error: string
  data?: any
}

// Field mapping types
export interface FieldMapping {
  source: string
  target: string
  transform?: (value: any) => any
  required?: boolean
  default?: any
}

export interface ERPInfo {
  type: ERPType
  name: string
  icon: string
  features: string[]
  requiredFields: string[]
  optionalFields: string[]
}

export const ERP_METADATA: Record<ERPType, ERPInfo> = {
  SAP: {
    type: 'SAP',
    name: 'SAP ERP',
    icon: '/icons/sap.svg',
    features: ['products', 'inventory', 'orders', 'mrp', 'bom'],
    requiredFields: ['host', 'systemNumber', 'client', 'username', 'password'],
    optionalFields: ['language', 'useOData', 'odataBaseUrl'],
  },
  NETSUITE: {
    type: 'NETSUITE',
    name: 'Oracle NetSuite',
    icon: '/icons/netsuite.svg',
    features: ['products', 'inventory', 'orders', 'customers', 'custom-records'],
    requiredFields: ['accountId', 'consumerKey', 'consumerSecret', 'tokenId', 'tokenSecret'],
    optionalFields: ['applicationId', 'useSuiteQL'],
  },
  DYNAMICS365: {
    type: 'DYNAMICS365',
    name: 'Microsoft Dynamics 365',
    icon: '/icons/dynamics365.svg',
    features: ['products', 'inventory', 'orders', 'customers', 'workflows'],
    requiredFields: ['instanceUrl', 'tenantId', 'clientId', 'clientSecret'],
    optionalFields: ['environment'],
  },
  ORACLE_CLOUD: {
    type: 'ORACLE_CLOUD',
    name: 'Oracle Cloud ERP',
    icon: '/icons/oracle.svg',
    features: ['products', 'inventory', 'orders', 'financials'],
    requiredFields: ['instanceUrl', 'username', 'password'],
    optionalFields: ['businessUnit'],
  },
  INFOR: {
    type: 'INFOR',
    name: 'Infor CloudSuite',
    icon: '/icons/infor.svg',
    features: ['products', 'inventory', 'orders', 'manufacturing'],
    requiredFields: ['instanceUrl', 'apiKey'],
    optionalFields: ['company'],
  },
  EPICOR: {
    type: 'EPICOR',
    name: 'Epicor ERP',
    icon: '/icons/epicor.svg',
    features: ['products', 'inventory', 'orders', 'production'],
    requiredFields: ['serverUrl', 'username', 'password'],
    optionalFields: ['company', 'plant'],
  },
  SAGE: {
    type: 'SAGE',
    name: 'Sage X3',
    icon: '/icons/sage.svg',
    features: ['products', 'inventory', 'orders', 'accounting'],
    requiredFields: ['endpoint', 'username', 'password'],
    optionalFields: ['folder', 'language'],
  },
}

// Conflict types
export interface DataConflict {
  id: string
  type: 'update_conflict' | 'duplicate' | 'missing_reference' | 'validation_error'
  entity: ERPEntity
  entityId: string
  sources: ConflictSource[]
  detectedAt: Date
  status: 'pending' | 'resolved' | 'ignored'
}

export interface ConflictSource {
  erp: ERPType
  data: any
  timestamp: Date
  version?: string
}

export interface Resolution {
  conflictId: string
  action: 'accept' | 'reject' | 'merge' | 'manual_review'
  source?: ConflictSource
  mergedData?: any
  reason: string
  resolvedBy?: string
  resolvedAt?: Date
}

// Logging types
export interface ERPLogEntry {
  id: string
  timestamp: Date
  erpType: ERPType
  operation: string
  entity?: ERPEntity
  entityId?: string
  success: boolean
  duration?: number
  error?: string
  details?: any
}