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
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('products')
      .select(
        `
        id,
        sku,
        name,
        description,
        category,
        base_price,
        cost,
        weight,
        dimensions,
        image_url,
        active,
        metadata,
        created_at,
        updated_at
      `
      )
      .eq('organization_id', 'current') // Will be set by RLS

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    if (active !== null) {
      query = query.eq('active', active === 'true')
    }
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`
      )
    }

    // Get total count for pagination
    const { count } = await query.count()

    // Apply pagination
    const { data: products, error } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Products API error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch products data' },
        { status: 500 }
      )
    }

    // Transform data for API response
    const transformedProducts =
      products?.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        basePrice: product.base_price,
        cost: product.cost,
        weight: product.weight,
        dimensions: product.dimensions,
        imageUrl: product.image_url,
        active: product.active,
        metadata: product.metadata,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      })) || []

    return NextResponse.json({
      data: transformedProducts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Products API error:', error)
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
    const { sku, name, basePrice } = body
    if (!sku || !name || typeof basePrice !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: sku, name, basePrice' },
        { status: 400 }
      )
    }

    // Check if SKU already exists
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .single()

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product with this SKU already exists' },
        { status: 409 }
      )
    }

    // Create product
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        sku,
        name,
        description: body.description,
        category: body.category,
        base_price: basePrice,
        cost: body.cost,
        weight: body.weight,
        dimensions: body.dimensions,
        image_url: body.imageUrl,
        active: body.active !== false,
        metadata: body.metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('Product creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create product' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          basePrice: product.base_price,
          cost: product.cost,
          weight: product.weight,
          dimensions: product.dimensions,
          imageUrl: product.image_url,
          active: product.active,
          metadata: product.metadata,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
