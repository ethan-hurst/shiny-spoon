import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters, withAPIRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await withAPIRateLimit(request, rateLimiters.api)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      )
    }

    const supabase = createClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customer_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        customer_id,
        status,
        subtotal,
        tax_amount,
        shipping_amount,
        discount_amount,
        total_amount,
        billing_address,
        shipping_address,
        order_date,
        expected_delivery_date,
        actual_delivery_date,
        external_order_id,
        source_platform,
        sync_status,
        last_sync_at,
        notes,
        metadata,
        created_at,
        updated_at,
        customers (
          id,
          company_name,
          display_name,
          email
        )
      `
      )
      .eq('organization_id', 'current') // Will be set by RLS

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (startDate) {
      query = query.gte('order_date', startDate)
    }
    if (endDate) {
      query = query.lte('order_date', endDate)
    }

    // Get total count for pagination
    const { count } = await query.count()

    // Apply pagination
    const { data: orders, error } = await query
      .order('order_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Orders API error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch orders data' },
        { status: 500 }
      )
    }

    // Transform data for API response
    const transformedOrders =
      orders?.map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        customerId: order.customer_id,
        status: order.status,
        subtotal: order.subtotal,
        taxAmount: order.tax_amount,
        shippingAmount: order.shipping_amount,
        discountAmount: order.discount_amount,
        totalAmount: order.total_amount,
        billingAddress: order.billing_address,
        shippingAddress: order.shipping_address,
        orderDate: order.order_date,
        expectedDeliveryDate: order.expected_delivery_date,
        actualDeliveryDate: order.actual_delivery_date,
        externalOrderId: order.external_order_id,
        sourcePlatform: order.source_platform,
        syncStatus: order.sync_status,
        lastSyncAt: order.last_sync_at,
        notes: order.notes,
        metadata: order.metadata,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        customer: order.customers
          ? {
              id: order.customers.id,
              companyName: order.customers.company_name,
              displayName: order.customers.display_name,
              email: order.customers.email,
            }
          : null,
      })) || []

    return NextResponse.json({
      data: transformedOrders,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await withAPIRateLimit(request, rateLimiters.api)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      )
    }

    const supabase = createClient()
    const body = await request.json()

    // Validate required fields
    const { orderNumber, customerId, totalAmount } = body
    if (!orderNumber || !customerId || typeof totalAmount !== 'number') {
      return NextResponse.json(
        {
          error:
            'Missing required fields: orderNumber, customerId, totalAmount',
        },
        { status: 400 }
      )
    }

    // Check if order number already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .single()

    if (existingOrder) {
      return NextResponse.json(
        { error: 'Order with this number already exists' },
        { status: 409 }
      )
    }

    // Create order
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        status: body.status || 'pending',
        subtotal: body.subtotal || totalAmount,
        tax_amount: body.taxAmount || 0,
        shipping_amount: body.shippingAmount || 0,
        discount_amount: body.discountAmount || 0,
        total_amount: totalAmount,
        billing_address: body.billingAddress,
        shipping_address: body.shippingAddress,
        order_date: body.orderDate || new Date().toISOString(),
        expected_delivery_date: body.expectedDeliveryDate,
        external_order_id: body.externalOrderId,
        source_platform: body.sourcePlatform || 'api',
        notes: body.notes,
        metadata: body.metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('Order creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: {
          id: order.id,
          orderNumber: order.order_number,
          customerId: order.customer_id,
          status: order.status,
          subtotal: order.subtotal,
          taxAmount: order.tax_amount,
          shippingAmount: order.shipping_amount,
          discountAmount: order.discount_amount,
          totalAmount: order.total_amount,
          billingAddress: order.billing_address,
          shippingAddress: order.shipping_address,
          orderDate: order.order_date,
          expectedDeliveryDate: order.expected_delivery_date,
          externalOrderId: order.external_order_id,
          sourcePlatform: order.source_platform,
          notes: order.notes,
          metadata: order.metadata,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
