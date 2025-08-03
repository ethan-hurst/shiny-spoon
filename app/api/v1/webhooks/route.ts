import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { ApiScope, ApiErrorCode, WebhookEventType } from '@/lib/api/types'
import { 
  apiSuccess, 
  apiError, 
  apiPaginated,
  handleApiError,
  parsePaginationParams,
  setCorsHeaders
} from '@/lib/api/utils/response'
import { withApiMiddleware, logApiUsage } from '@/lib/api/middleware'
import crypto from 'crypto'

// Validation schemas
const CreateWebhookSchema = z.object({
  url: z.string().url().startsWith('https://'),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1),
  description: z.string().optional(),
  headers: z.record(z.string()).optional()
})

const UpdateWebhookSchema = z.object({
  url: z.string().url().startsWith('https://').optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).optional(),
  active: z.boolean().optional(),
  description: z.string().optional(),
  headers: z.record(z.string()).optional()
})

// GET /api/v1/webhooks
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withApiMiddleware(request, async (req, context) => {
    try {
      const { page, limit, offset } = parsePaginationParams(
        req.nextUrl.searchParams.get('page'),
        req.nextUrl.searchParams.get('limit')
      )
      
      const supabase = createClient()
      
      const { data, error, count } = await supabase
        .from('webhook_subscriptions')
        .select('*', { count: 'exact' })
        .eq('tenant_id', context.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (error) {
        return handleApiError(error, 'Failed to fetch webhooks')
      }
      
      const response = apiPaginated(data || [], page, limit, count || 0)
      await logApiUsage(context, req, response, Date.now() - startTime)
      
      return response
    } catch (error) {
      return handleApiError(error, 'Failed to fetch webhooks')
    }
  }, {
    requiredScopes: [ApiScope.ADMIN_WEBHOOKS]
  })
}

// POST /api/v1/webhooks
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  return withApiMiddleware(request, async (req, context) => {
    try {
      const body = await req.json()
      const validatedData = CreateWebhookSchema.parse(body)
      
      // Generate webhook secret
      const secret = crypto.randomBytes(32).toString('hex')
      
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('webhook_subscriptions')
        .insert({
          tenant_id: context.tenantId,
          url: validatedData.url,
          secret,
          events: validatedData.events,
          description: validatedData.description,
          headers: validatedData.headers || {},
          created_by: context.apiKey.id
        })
        .select()
        .single()
      
      if (error) {
        return handleApiError(error, 'Failed to create webhook')
      }
      
      // Include secret in response (only shown once)
      const responseData = {
        ...data,
        secret
      }
      
      const response = apiSuccess(responseData, undefined, 201)
      await logApiUsage(context, req, response, Date.now() - startTime)
      
      return response
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError(
          400,
          ApiErrorCode.VALIDATION_ERROR,
          'Invalid webhook data',
          error.errors
        )
      }
      
      return handleApiError(error, 'Failed to create webhook')
    }
  }, {
    requiredScopes: [ApiScope.ADMIN_WEBHOOKS]
  })
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 })
  setCorsHeaders(response)
  return response
}