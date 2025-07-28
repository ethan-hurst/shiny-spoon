/**
 * Example API routes refactored to use ProductService
 * This demonstrates the integration pattern for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createProductService } from '@/lib/services/product.service'
import { z } from 'zod'

// Request validation schemas
const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  base_price: z.number().min(0),
  cost: z.number().min(0),
  active: z.boolean().default(true)
})

const updateProductSchema = createProductSchema.partial()

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(100).default(10)
})

/**
 * GET /api/products - List products with optional search
 * BEFORE: Direct Supabase calls, manual pagination, no retry logic
 * AFTER: Service handles organization isolation, search logic, error handling
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const productService = await createProductService()
    
    let products
    if (query) {
      // Validate search parameters
      const { q, limit: validatedLimit } = searchQuerySchema.parse({ q: query, limit })
      products = await productService.searchProducts(q, validatedLimit)
    } else {
      products = await productService.getAllProducts()
    }
    
    return NextResponse.json({
      success: true,
      data: products,
      count: products.length
    })
  } catch (error) {
    console.error('GET /api/products failed:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products - Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = createProductSchema.parse(body)
    
    const productService = await createProductService()
    
    // Service handles validation, duplicate checking, audit trails
    const product = await productService.createProduct(validatedData)
    
    return NextResponse.json({
      success: true,
      data: product
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/products failed:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/products/[id] - Get a specific product
 */
export async function GETById(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productService = await createProductService()
    
    // Service handles organization isolation
    const product = await productService.getProduct(params.id)
    
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    console.error(`GET /api/products/${params.id} failed:`, error)
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/products/[id] - Update a product
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = updateProductSchema.parse(body)
    
    const productService = await createProductService()
    
    // Service handles existence check, validation, duplicate checking
    const product = await productService.updateProduct(params.id, validatedData)
    
    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    console.error(`PUT /api/products/${params.id} failed:`, error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id] - Delete a product (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productService = await createProductService()
    
    // Service handles existence check and soft delete
    await productService.deleteProduct(params.id)
    
    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    })
  } catch (error) {
    console.error(`DELETE /api/products/${params.id} failed:`, error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/bulk - Bulk update products
 */
export async function POSTBulk(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!Array.isArray(body.updates)) {
      return NextResponse.json(
        { success: false, error: 'Updates must be an array' },
        { status: 400 }
      )
    }
    
    const productService = await createProductService()
    
    // Service handles batch processing, validation, error collection
    const results = await productService.bulkUpdateProducts(body.updates)
    
    return NextResponse.json({
      success: true,
      data: results,
      updated: results.length
    })
  } catch (error) {
    console.error('POST /api/products/bulk failed:', error)
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/sync - Sync products from external system
 */
export async function POSTSync(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!Array.isArray(body.products)) {
      return NextResponse.json(
        { success: false, error: 'Products must be an array' },
        { status: 400 }
      )
    }
    
    const productService = await createProductService()
    
    // Service handles data transformation, batch processing, error collection
    const results = await productService.syncProducts(body.products)
    
    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        created: results.created,
        updated: results.updated,
        errors: results.errors.length
      }
    })
  } catch (error) {
    console.error('POST /api/products/sync failed:', error)
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/products/low-stock - Get products with low inventory
 */
export async function GETLowStock(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threshold = parseInt(searchParams.get('threshold') || '10')
    
    const productService = await createProductService()
    
    // Service handles inventory joins and threshold filtering
    const products = await productService.getLowStockProducts(threshold)
    
    return NextResponse.json({
      success: true,
      data: products,
      count: products.length
    })
  } catch (error) {
    console.error('GET /api/products/low-stock failed:', error)
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}