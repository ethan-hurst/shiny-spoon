'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { AuditLogger } from '@/lib/audit/audit-logger'
import { z } from 'zod'
import { rateLimiters, withRateLimit, getUserIdentifier, checkRateLimit } from '@/lib/rate-limit'
import type { 
  CreateOrderInput, 
  UpdateOrderInput, 
  OrderStatus,
  Order,
  OrderItem
} from '@/types/order.types'

// Validation schemas
const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
})

const createOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive().optional(),
  warehouse_id: z.string().uuid().optional(),
})

const createOrderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  items: z.array(createOrderItemSchema).min(1),
  billing_address: addressSchema.optional(),
  shipping_address: addressSchema.optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

const updateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  notes: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  actual_delivery_date: z.string().optional(),
  billing_address: addressSchema.optional(),
  shipping_address: addressSchema.optional(),
})

/**
 * Generates a unique order number for the organization
 */
async function generateOrderNumber(organizationId: string, supabase: any): Promise<string> {
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('order_number')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const today = new Date()
  const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  
  if (!lastOrder || !lastOrder.order_number.startsWith(datePrefix)) {
    return `${datePrefix}-0001`
  }

  const lastNumber = parseInt(lastOrder.order_number.split('-')[1])
  return `${datePrefix}-${String(lastNumber + 1).padStart(4, '0')}`
}

/**
 * Creates a new order with items
 */
export async function createOrder(input: CreateOrderInput) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(rateLimiters.orderCreation, user.id)
  if (!rateLimitResult.success) {
    return { error: 'Rate limit exceeded. Please try again later.' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  try {
    // Validate input
    const validated = createOrderSchema.parse(input)

    // Get products for validation and pricing
    const productIds = validated.items.map(item => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, name, description, base_price')
      .in('id', productIds)

    if (productsError || !products) {
      return { error: 'Failed to fetch products' }
    }

    // Create product map for easy lookup
    const productMap = new Map(products.map((p: any) => [p.id, p]))

    // Validate all products exist and belong to organization
    for (const item of validated.items) {
      const product = productMap.get(item.product_id)
      if (!product) {
        return { error: `Product ${item.product_id} not found` }
      }
    }

    // Generate order number
    const orderNumber = await generateOrderNumber(profile.organization_id, supabase)

    // Create order items with pricing
    const orderItems = validated.items.map(item => {
      const product = productMap.get(item.product_id) as any
      const unitPrice = item.unit_price || product?.base_price || 0
      
      return {
        product_id: item.product_id,
        sku: product?.sku,
        name: product?.name,
        description: product?.description,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: unitPrice * item.quantity,
        warehouse_id: item.warehouse_id,
      }
    })

    // Calculate order totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0)
    const tax = subtotal * 0.1 // 10% tax - should be configurable
    const total = subtotal + tax

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        organization_id: profile.organization_id,
        order_number: orderNumber,
        customer_id: validated.customer_id,
        status: 'pending',
        subtotal,
        tax,
        total,
        billing_address: validated.billing_address,
        shipping_address: validated.shipping_address,
        notes: validated.notes,
        metadata: validated.metadata,
        created_by: user.id,
      })
      .select()
      .single()

    if (orderError || !order) {
      return { error: 'Failed to create order' }
    }

    // Create order items
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems.map(item => ({
        order_id: order.id,
        ...item,
      })))

    if (itemsError) {
      return { error: 'Failed to create order items' }
    }

    // Log audit event
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logCreate('order', order)

    // Send order confirmation email
    try {
      await sendOrderConfirmationEmail(order, orderItems, profile.organization_id)
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError)
      // Don't fail the order creation if email fails
    }

    // Generate invoice
    try {
      await generateInvoice(order.id, profile.organization_id)
    } catch (invoiceError) {
      console.error('Failed to generate invoice:', invoiceError)
      // Don't fail the order creation if invoice generation fails
    }

    revalidatePath('/orders')

    return { success: true, data: order }
  } catch (error) {
    console.error('Failed to create order:', error)
    return { error: error instanceof Error ? error.message : 'Failed to create order' }
  }
}

/**
 * Sends order confirmation email
 */
async function sendOrderConfirmationEmail(order: any, orderItems: any[], organizationId: string) {
  const supabase = createClient()

  // Get customer email
  let recipientEmail: string | null = null
  let customerName = 'Valued Customer'

  if (order.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('email, name')
      .eq('id', order.customer_id)
      .single()

    if (customer) {
      recipientEmail = customer.email
      customerName = customer.name
    }
  }

  // If no customer email, try to get organization owner email
  if (!recipientEmail) {
    const { data: owner } = await supabase
      .from('user_profiles')
      .select('users!inner(email)')
      .eq('organization_id', organizationId)
      .eq('role', 'owner')
      .single()

    recipientEmail = owner?.users?.email
  }

  if (recipientEmail) {
    // Queue order confirmation email
    await supabase.from('email_queue').insert({
      to: recipientEmail,
      subject: `Order Confirmation - #${order.order_number}`,
      template: 'order_confirmation',
      data: {
        customer_name: customerName,
        order_number: order.order_number,
        order_date: new Date().toLocaleDateString(),
        items: orderItems.map(item => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total_price,
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        order_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`,
      },
      status: 'pending',
    })
  }
}

/**
 * Generates invoice for an order
 */
async function generateInvoice(orderId: string, organizationId: string) {
  const supabase = createClient()

  // Get order details with items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      customers (name, email, billing_address)
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error('Order not found')
  }

  // Generate invoice number
  const invoiceNumber = `INV-${order.order_number}`

  // Create invoice record
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      organization_id: organizationId,
      order_id: orderId,
      invoice_number: invoiceNumber,
      customer_id: order.customer_id,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      status: 'pending',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (invoiceError || !invoice) {
    throw new Error('Failed to create invoice')
  }

  // Create invoice items
  const invoiceItems = order.order_items.map((item: any) => ({
    invoice_id: invoice.id,
    product_id: item.product_id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
  }))

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems)

  if (itemsError) {
    throw new Error('Failed to create invoice items')
  }

  return invoice
}

/**
 * Updates an order
 */
export async function updateOrder(orderId: string, input: UpdateOrderInput) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(rateLimiters.orderUpdates, user.id)
  if (!rateLimitResult.success) {
    return { error: 'Rate limit exceeded. Please try again later.' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  try {
    // Validate input
    const validated = updateOrderSchema.parse(input)

    // Get existing order
    const { data: existingOrder, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (orderError || !existingOrder) {
      return { error: 'Order not found' }
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        ...validated,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError || !updatedOrder) {
      return { error: 'Failed to update order' }
    }

    // Log audit event
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logUpdate('order', orderId, existingOrder, updatedOrder)

    revalidatePath('/orders')
    if (existingOrder.customer_id) {
      revalidatePath(`/customers/${existingOrder.customer_id}`)
    }

    return { success: true, data: updatedOrder }
  } catch (error) {
    console.error('Failed to update order:', error)
    return { error: error instanceof Error ? error.message : 'Failed to update order' }
  }
}

/**
 * Cancels an order
 */
export async function cancelOrder(orderId: string, reason?: string) {
  const updateData: UpdateOrderInput = {
    status: 'cancelled',
  }
  
  if (reason) {
    updateData.notes = `Cancellation reason: ${reason}`
  }
  
  return updateOrder(orderId, updateData)
}

/**
 * Gets order details with items
 */
export async function getOrderDetails(orderId: string) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get order with items and customer info
  const { data: order, error } = await supabase
    .from('order_summary')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { success: true, data: order }
}

/**
 * Lists orders with filters
 */
export async function listOrders(filters?: {
  status?: OrderStatus
  customer_id?: string
  from_date?: string
  to_date?: string
  search?: string
  limit?: number
  offset?: number
}) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  // Build query
  let query = supabase
    .from('order_summary')
    .select('*', { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('order_date', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.customer_id) {
    query = query.eq('customer_id', filters.customer_id)
  }

  if (filters?.from_date) {
    query = query.gte('order_date', filters.from_date)
  }

  if (filters?.to_date) {
    query = query.lte('order_date', filters.to_date)
  }

  if (filters?.search) {
    query = query.or(
      `order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%`
    )
  }

  // Apply pagination
  const limit = filters?.limit || 20
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return { error: error.message }
  }

  return { 
    success: true, 
    data: {
      orders: data || [],
      total: count || 0,
      limit,
      offset,
    }
  }
}

/**
 * Exports orders to CSV
 */
export async function exportOrders(filters?: {
  status?: OrderStatus
  customer_id?: string
  from_date?: string
  to_date?: string
}) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  try {
    // Build query
    let query = supabase
      .from('order_summary')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('order_date', { ascending: false })

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id)
    }

    if (filters?.from_date) {
      query = query.gte('order_date', filters.from_date)
    }

    if (filters?.to_date) {
      query = query.lte('order_date', filters.to_date)
    }

    const { data: orders, error } = await query

    if (error) {
      return { error: error.message }
    }

    // Log export event
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logExport('orders', filters, orders?.length || 0)

    return { success: true, data: orders || [] }
  } catch (error) {
    console.error('Failed to export orders:', error)
    return { error: error instanceof Error ? error.message : 'Failed to export orders' }
  }
}

/**
 * Gets order tracking information
 */
export async function getOrderTracking(orderId: string) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  try {
    // Get order with tracking info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_tracking (
          id,
          status,
          location,
          description,
          timestamp,
          tracking_number
        )
      `)
      .eq('id', orderId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (orderError || !order) {
      return { error: 'Order not found' }
    }

    // Sort tracking events by timestamp
    const trackingEvents = order.order_tracking?.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ) || []

    return { 
      success: true, 
      data: {
        order,
        tracking: trackingEvents,
        currentStatus: trackingEvents[0]?.status || order.status
      }
    }
  } catch (error) {
    console.error('Failed to get order tracking:', error)
    return { error: error instanceof Error ? error.message : 'Failed to get order tracking' }
  }
}

/**
 * Adds tracking event to an order
 */
export async function addTrackingEvent(orderId: string, trackingData: {
  status: string
  location?: string
  description: string
  tracking_number?: string
}) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  try {
    // Verify order belongs to organization
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (orderError || !order) {
      return { error: 'Order not found' }
    }

    // Add tracking event
    const { data: trackingEvent, error: trackingError } = await supabase
      .from('order_tracking')
      .insert({
        order_id: orderId,
        status: trackingData.status,
        location: trackingData.location,
        description: trackingData.description,
        tracking_number: trackingData.tracking_number,
        timestamp: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single()

    if (trackingError || !trackingEvent) {
      return { error: 'Failed to add tracking event' }
    }

    // Update order status if it's a significant status change
    if (trackingData.status !== order.status) {
      await supabase
        .from('orders')
        .update({ 
          status: trackingData.status,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', orderId)
    }

    // Log audit event
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logUpdate('order', orderId, { status: order.status }, { status: trackingData.status })

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)

    return { success: true, data: trackingEvent }
  } catch (error) {
    console.error('Failed to add tracking event:', error)
    return { error: error instanceof Error ? error.message : 'Failed to add tracking event' }
  }
}

/**
 * Gets shipping integration status
 */
export async function getShippingStatus(orderId: string) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'User profile not found' }
  }

  try {
    // Get order with shipping info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        shipping_integrations (
          id,
          provider,
          tracking_number,
          label_url,
          status
        )
      `)
      .eq('id', orderId)
      .eq('organization_id', profile.organization_id)
      .single()

    if (orderError || !order) {
      return { error: 'Order not found' }
    }

    return { 
      success: true, 
      data: {
        order,
        shipping: order.shipping_integrations || []
      }
    }
  } catch (error) {
    console.error('Failed to get shipping status:', error)
    return { error: error instanceof Error ? error.message : 'Failed to get shipping status' }
  }
}