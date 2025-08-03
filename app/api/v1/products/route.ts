import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { ApiScope, ApiErrorCode } from '@/lib/api/types'
import { 
  apiSuccess, 
  apiError, 
  apiPaginated,
  handleApiError,
  parsePaginationParams,
  parseSortParams,
  setCorsHeaders
} from '@/lib/api/utils/response'
import { withApiMiddleware, logApiUsage } from '@/lib/api/middleware'

// Validation schemas
const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  description: z.string().optional(),
  category_id: z.string().uuid(),
  price: z.number().positive(),
  unit: z.string().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional(),
  reorder_point: z.number().int().min(0),
  reorder_quantity: z.number().int().positive(),
  tags: z.array(z.string()).optional()
})

const QuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.enum(['name', 'sku', 'created_at', 'updated_at']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  category: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  tags: z.array(z.string()).optional()
})

// GET /api/v1/products
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withApiMiddleware(request, async (req, context) => {
    try {
      // Parse query parameters
      const searchParams = Object.fromEntries(req.nextUrl.searchParams)
      const query = QuerySchema.parse(searchParams)
      
      // Parse pagination
      const { page, limit, offset } = parsePaginationParams(query.page, query.limit)
      
      // Parse sorting
      const { sortField, sortOrder } = parseSortParams(
        query.sort,
        query.order,
        ['name', 'sku', 'created_at', 'updated_at']
      )
      
      // Create Supabase client with tenant context
      const supabase = createClient()
      
      // Build query
      let queryBuilder = supabase
        .from('products')
        .select('*, category:categories(*)', { count: 'exact' })
        .eq('tenant_id', context.tenantId)
      
      // Apply filters
      if (query.search) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query.search}%,sku.ilike.%${query.search}%`)
      }
      
      if (query.category) {
        queryBuilder = queryBuilder.eq('category_id', query.category)
      }
      
      if (query.status) {
        queryBuilder = queryBuilder.eq('status', query.status)
      }
      
      if (query.tags && query.tags.length > 0) {
        queryBuilder = queryBuilder.contains('tags', query.tags)
      }
      
      // Apply sorting
      if (sortField) {
        queryBuilder = queryBuilder.order(sortField, { ascending: sortOrder === 'asc' })
      }
      
      // Apply pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1)
      
      // Execute query
      const { data, error, count } = await queryBuilder
      
      if (error) {
        return handleApiError(error, 'Failed to fetch products')
      }
      
      // Create response
      const response = apiPaginated(data || [], page, limit, count || 0)
      
      // Log API usage
      await logApiUsage(context, req, response, Date.now() - startTime)
      
      return response
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError(
          400,
          ApiErrorCode.VALIDATION_ERROR,
          'Invalid query parameters',
          error.errors
        )
      }
      
      return handleApiError(error, 'Failed to fetch products')
    }
  }, {
    requiredScopes: [ApiScope.READ_PRODUCTS]
  })
}

// POST /api/v1/products
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  return withApiMiddleware(request, async (req, context) => {
    try {
      // Parse request body
      const body = await req.json()
      const validatedData = CreateProductSchema.parse(body)
      
      // Create Supabase client
      const supabase = createClient()
      
      // Create product with tenant context
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...validatedData,
          tenant_id: context.tenantId,
          status: 'active'
        })
        .select('*, category:categories(*)')
        .single()
      
      if (error) {
        return handleApiError(error, 'Failed to create product')
      }
      
      // Create response
      const response = apiSuccess(data, undefined, 201)
      
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
      
      return handleApiError(error, 'Failed to create product')
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