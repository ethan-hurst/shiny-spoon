import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { updateIntegration, deleteIntegration } from '@/app/actions/integrations'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().uuid()
})

// Schema for PATCH request body validation
const updateIntegrationRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'error', 'configuring', 'suspended']).optional(),
  config: z.record(z.any()).optional(),
  sync_settings: z.object({
    sync_products: z.boolean().optional(),
    sync_inventory: z.boolean().optional(),
    sync_pricing: z.boolean().optional(),
    sync_customers: z.boolean().optional(),
    sync_orders: z.boolean().optional(),
    sync_direction: z.enum(['push', 'pull', 'bidirectional']).optional(),
    sync_frequency_minutes: z.number().min(5).max(1440).optional(),
    batch_size: z.number().min(1).max(1000).optional(),
    field_mappings: z.record(z.string()).optional(),
    filters: z.record(z.any()).optional(),
  }).optional(),
  credential_type: z.enum(['oauth2', 'api_key', 'basic_auth', 'custom']).optional(),
  credentials: z.record(z.any()).optional(),
})

/**
 * Handles PATCH requests to update an integration resource.
 *
 * Updates the specified integration using the provided data with automatic CSRF protection and auth validation.
 *
 * @returns A JSON response containing the updated integration data on success, or an error message with the corresponding HTTP status code on failure.
 */
export const PATCH = createRouteHandler(
  async ({ params, body, user }) => {
    // Convert to FormData for server action
    const formData = new FormData()
    formData.append('id', params.id)
    
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
      }
    })

    const result = await updateIntegration(formData)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result.data)
  },
  {
    schema: { 
      params: paramsSchema,
      body: updateIntegrationRequestSchema 
    },
    rateLimit: { 
      requests: 20, 
      window: '1m',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)

/**
 * Handles HTTP DELETE requests to remove an integration resource.
 *
 * Validates authentication and CSRF token before attempting deletion.
 */
export const DELETE = createRouteHandler(
  async ({ params }) => {
    const result = await deleteIntegration(params.id)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  },
  {
    schema: { params: paramsSchema },
    rateLimit: { 
      requests: 10, 
      window: '1m',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)