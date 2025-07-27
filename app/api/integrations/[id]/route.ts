import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateIntegration, deleteIntegration } from '@/app/actions/integrations'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { z } from 'zod'

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

// CSRF token validation helper
async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  try {
    const headersList = headers()
    
    // Get CSRF token from header and cookie
    const csrfTokenFromHeader = headersList.get('x-csrf-token')
    const csrfTokenFromCookie = request.cookies.get('csrf-token')?.value
    
    // Both tokens must exist
    if (!csrfTokenFromHeader || !csrfTokenFromCookie) {
      return false
    }
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(csrfTokenFromHeader),
      Buffer.from(csrfTokenFromCookie)
    )
  } catch {
    return false
  }
}

// Update integration
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // CSRF Protection
  const isValidCSRF = await validateCSRFToken(request)
  if (!isValidCSRF) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403 }
    )
  }

  let user: { id: string; email?: string } | null = null
  let body: any = null
  
  try {
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    user = authData.user
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    body = await request.json()
    
    // Validate request body with Zod schema
    const validationResult = updateIntegrationRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      )
    }
    
    const validatedBody = validationResult.data
    
    // Convert to FormData for server action
    const formData = new FormData()
    formData.append('id', params.id)
    
    Object.entries(validatedBody).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
      }
    })

    const result = await updateIntegration(formData)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Integration PATCH API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      method: 'PATCH',
      integrationId: params.id,
      userId: user?.id,
      timestamp: new Date().toISOString()
      // Removed requestBody and userEmail to prevent logging sensitive data
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete integration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // CSRF Protection
  const isValidCSRF = await validateCSRFToken(request)
  if (!isValidCSRF) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403 }
    )
  }

  let user: { id: string; email?: string } | null = null
  
  try {
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    user = authData.user
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await deleteIntegration(params.id)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Integration DELETE API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      method: 'DELETE',
      integrationId: params.id,
      userId: user?.id,
      timestamp: new Date().toISOString()
      // Removed URL and userEmail to prevent logging sensitive data
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}