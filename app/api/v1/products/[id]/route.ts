import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { ApiScope, ApiErrorCode } from '@/lib/api/types'
import { 
  apiSuccess, 
  apiError, 
  handleApiError,
  setCorsHeaders
} from '@/lib/api/utils/response'
import { withApiMiddleware, logApiUsage } from '@/lib/api/middleware'

// Validation schemas
const UpdateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sku: z.string().regex(/^[A-Z0-9-]+$/).optional(),
  description: z.string().optional(),
  category_id: z.string().uuid().optional(),
  price: z.number().positive().optional(),
  unit: z.string().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional(),
  reorder_point: z.number().int().min(0).optional(),
  reorder_quantity: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional()
})

// GET /api/v1/products/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  
  return withApiMiddleware(request, async (req, context) => {
    try {
      const productId = params.id
      
      // Validate UUID format
      if (!z.string().uuid().safeParse(productId).success) {
        return apiError(
          400,
          ApiErrorCode.INVALID_REQUEST,
          'Invalid product ID format'
        )
      }
      
      // Create Supabase client
      const supabase = createClient()
      
      // Fetch product
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('id', productId)
        .eq('tenant_id', context.tenantId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          return apiError(
            404,
            ApiErrorCode.RESOURCE_NOT_FOUND,
            'Product not found'
          )
        }
        return handleApiError(error, 'Failed to fetch product')
      }
      
      // Create response
      const response = apiSuccess(data)
      
      // Log API usage
      await logApiUsage(context, req, response, Date.now() - startTime)
      
      return response
    } catch (error) {
      return handleApiError(error, 'Failed to fetch product')
    }
  }, {
    requiredScopes: [ApiScope.READ_PRODUCTS]
  })
}

// PUT /api/v1/products/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  
  return withApiMiddleware(request, async (req, context) => {
    try {
      const productId = params.id
      
      // Validate UUID format
      if (!z.string().uuid().safeParse(productId).success) {
        return apiError(
          400,
          ApiErrorCode.INVALID_REQUEST,
          'Invalid product ID format'
        )
      }
      
      // Parse request body
      const body = await req.json()
      const validatedData = UpdateProductSchema.parse(body)
      
      // Create Supabase client
      const supabase = createClient()
      
      // Check if product exists
      const { data: existingProduct, error: checkError } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .eq('tenant_id', context.tenantId)
        .single()
      
      if (checkError || !existingProduct) {
        return apiError(
          404,
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Product not found'
        )
      }
      
      // Update product
      const { data, error } = await supabase
        .from('products')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .eq('tenant_id', context.tenantId)
        .select('*, category:categories(*)')
        .single()
      
      if (error) {
        return handleApiError(error, 'Failed to update product')
      }
      
      // Create response
      const response = apiSuccess(data)
      
      // Log API usage
      await logApiUsage(context, req, response, Date.now() - startTime)
      
      return response
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError(
          400,
          ApiErrorCode.VALIDATION_ERROR,
          'Invalid product data',
          error.errors
        )
      }
      
      return handleApiError(error, 'Failed to update product')
    }
  }, {
    requiredScopes: [ApiScope.WRITE_PRODUCTS]
  })
}

// DELETE /api/v1/products/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  
  return withApiMiddleware(request, async (req, context) => {
    try {
      const productId = params.id
      
      // Validate UUID format
      if (!z.string().uuid().safeParse(productId).success) {
        return apiError(
          400,
          ApiErrorCode.INVALID_REQUEST,
          'Invalid product ID format'
        )
      }
      
      // Create Supabase client
      const supabase = createClient()
      
      // Check if product exists and has no inventory
      const { data: product, error: checkError } = await supabase
        .from('products')
        .select('id, inventory_items(id)')
        .eq('id', productId)
        .eq('tenant_id', context.tenantId)
        .single()
      
      if (checkError || !product) {
        return apiError(
          404,
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'Product not found'
        )
      }
      
      // Check if product has inventory
      if (product.inventory_items && product.inventory_items.length > 0) {
        return apiError(
          400,
          ApiErrorCode.VALIDATION_ERROR,
          'Cannot delete product with existing inventory'
        )
      }
      
      // Delete product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', context.tenantId)
      
      if (error) {
        return handleApiError(error, 'Failed to delete product')
      }
      
      // Create response
      const response = new NextResponse(null, { status: 204 })
      
      // Log API usage
      await logApiUsage(context, req, response, Date.now() - startTime)
      
      return response
    } catch (error) {
      return handleApiError(error, 'Failed to delete product')
    }
  }, {
    requiredScopes: [ApiScope.WRITE_PRODUCTS]
  })
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 })
  setCorsHeaders(response)
  return response
}