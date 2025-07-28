/**
 * TestApi Integration Types
 */

// Configuration types
export interface TestApiConfig {
  enabled: boolean
  apiKey: string
  apiSecret?: string
  baseUrl: string
  webhookSecret?: string
  syncFrequency: 'manual' | 'hourly' | 'daily'
  syncEntities: {
    products: boolean
    customers: boolean
    orders: boolean
    inventory: boolean
  }
}

// API Response types
export interface TestApiApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

// Entity types from TestApi
export interface TestApiProduct {
  id: string
  name: string
  title?: string
  description?: string
  sku?: string
  itemId?: string
  price?: number | string
  stock?: number | string
  inventory?: number
  active?: boolean
  status?: 'active' | 'inactive' | 'draft'
  category?: string
  tags?: string[]
  images?: string[]
  variants?: TestApiProductVariant[]
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

export interface TestApiProductVariant {
  id: string
  productId: string
  name: string
  sku?: string
  price?: number
  inventory?: number
  attributes?: Record<string, string>
}

export interface TestApiCustomer {
  id: string
  name?: string
  companyName?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  billingAddress?: TestApiCustomer['address']
  shippingAddress?: TestApiCustomer['address']
  customerType?: 'individual' | 'business'
  status?: 'active' | 'inactive'
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

export interface TestApiOrder {
  id: string
  orderNumber?: string
  number?: string
  customerId?: string
  customer?: TestApiCustomer
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  total?: number | string
  subtotal?: number | string
  tax?: number | string
  shipping?: number | string
  currency?: string
  orderDate?: string
  createdAt?: string
  updatedAt?: string
  items?: TestApiOrderItem[]
  shippingAddress?: TestApiCustomer['address']
  billingAddress?: TestApiCustomer['address']
  [key: string]: any
}

export interface TestApiOrderItem {
  id?: string
  productId?: string
  product?: TestApiProduct
  variantId?: string
  name?: string
  sku?: string
  quantity?: number | string
  price?: number | string
  total?: number | string
  [key: string]: any
}

// Sync types
export interface SyncResult {
  success: boolean
  entityType: 'product' | 'customer' | 'order' | 'inventory'
  processed: number
  created: number
  updated: number
  errors: number
  errorDetails?: string[]
  startedAt: string
  completedAt: string
}

export interface SyncStatus {
  isRunning: boolean
  currentEntity?: string
  progress?: {
    current: number
    total: number
    percentage: number
  }
  lastSync?: string
  nextSync?: string
}

// Webhook types
export interface TestApiWebhookPayload {
  event: string
  data: Record<string, any>
  timestamp?: string
  signature?: string
}

export interface WebhookEvent {
  id: string
  event: string
  data: Record<string, any>
  processed: boolean
  processedAt?: string
  error?: string
  retryCount: number
  createdAt: string
}

// Error types
export interface TestApiError {
  code: string
  message: string
  details?: Record<string, any>
  retryable?: boolean
}

// Rate limiting types
export interface RateLimitInfo {
  remaining: number
  limit: number
  resetAt: string
  retryAfter?: number
}
