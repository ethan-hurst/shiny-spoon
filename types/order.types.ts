export interface Order {
  id: string
  organization_id: string
  order_number: string
  customer_id: string | null
  status: OrderStatus
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  total_amount: number
  billing_address: Address | null
  shipping_address: Address | null
  order_date: string
  expected_delivery_date: string | null
  actual_delivery_date: string | null
  external_order_id: string | null
  source_platform: string | null
  sync_status: string | null
  last_sync_at: string | null
  notes: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  sku: string
  name: string
  description: string | null
  quantity: number
  shipped_quantity: number
  unit_price: number
  discount_amount: number
  tax_amount: number
  total_price: number
  warehouse_id: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  status: string
  previous_status: string | null
  changed_by: string | null
  reason: string | null
  metadata: Record<string, any>
  created_at: string
}

export interface OrderSummary extends Order {
  customer_name: string | null
  customer_email: string | null
  customer_tier: string | null
  item_count: number
  total_quantity: number
  items: OrderItemSummary[]
}

export interface OrderItemSummary {
  id: string
  sku: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  phone?: string
}

export interface CreateOrderInput {
  customer_id?: string
  items: CreateOrderItemInput[]
  billing_address?: Address
  shipping_address?: Address
  notes?: string
  metadata?: Record<string, any>
}

export interface CreateOrderItemInput {
  product_id: string
  quantity: number
  unit_price?: number
  warehouse_id?: string
}

export interface UpdateOrderInput {
  status?: OrderStatus
  notes?: string
  expected_delivery_date?: string
  actual_delivery_date?: string
  billing_address?: Address
  shipping_address?: Address
}
