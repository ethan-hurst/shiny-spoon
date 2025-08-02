import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAPIRateLimit } from '@/lib/rate-limit'
import { rateLimiters } from '@/lib/rate-limit'

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
    const warehouseId = searchParams.get('warehouse_id')
    const productId = searchParams.get('product_id')
    const lowStock = searchParams.get('low_stock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('inventory')
      .select(`
        id,
        quantity,
        reserved_quantity,
        reorder_point,
        reorder_quantity,
        last_counted_at,
        updated_at,
        products (
          id,
          sku,
          name,
          description,
          base_price,
          active
        ),
        warehouses (
          id,
          name,
          code
        )
      `)
      .eq('organization_id', 'current') // Will be set by RLS

    // Apply filters
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }
    if (productId) {
      query = query.eq('product_id', productId)
    }
    if (lowStock) {
      query = query.lte('quantity', 'reorder_point')
    }

    // Get total count for pagination
    const { count } = await query.count()

    // Apply pagination
    const { data: inventory, error } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Inventory API error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch inventory data' },
        { status: 500 }
      )
    }

    // Transform data for API response
    const transformedInventory = inventory?.map(item => ({
      id: item.id,
      productId: item.products?.id,
      warehouseId: item.warehouses?.id,
      quantity: item.quantity,
      reservedQuantity: item.reserved_quantity,
      availableQuantity: item.quantity - item.reserved_quantity,
      reorderPoint: item.reorder_point,
      reorderQuantity: item.reorder_quantity,
      lastCountedAt: item.last_counted_at,
      updatedAt: item.updated_at,
      product: item.products ? {
        id: item.products.id,
        sku: item.products.sku,
        name: item.products.name,
        description: item.products.description,
        basePrice: item.products.base_price,
        active: item.products.active
      } : null,
      warehouse: item.warehouses ? {
        id: item.warehouses.id,
        name: item.warehouses.name,
        code: item.warehouses.code
      } : null
    })) || []

    return NextResponse.json({
      data: transformedInventory,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Inventory API error:', error)
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
    const { productId, warehouseId, quantity } = body
    if (!productId || !warehouseId || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: productId, warehouseId, quantity' },
        { status: 400 }
      )
    }

    // Create inventory record
    const { data: inventory, error } = await supabase
      .from('inventory')
      .insert({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity,
        reserved_quantity: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Inventory creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create inventory record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        id: inventory.id,
        productId: inventory.product_id,
        warehouseId: inventory.warehouse_id,
        quantity: inventory.quantity,
        reservedQuantity: inventory.reserved_quantity,
        availableQuantity: inventory.quantity - inventory.reserved_quantity,
        createdAt: inventory.created_at,
        updatedAt: inventory.updated_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 