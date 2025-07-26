import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateIntegration, deleteIntegration } from '@/app/actions/integrations'
import { headers } from 'next/headers'
import crypto from 'crypto'

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
  } catch (error) {
    console.error('Integration PATCH API error:', {
      error,
      method: 'PATCH',
      url: request.url,
      integrationId: params.id,
      userId: user?.id,
      userEmail: user?.email,
      requestBody: body,
      timestamp: new Date().toISOString()
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
      error,
      method: 'DELETE',
      url: request.url,
      integrationId: params.id,
      userId: user?.id,
      userEmail: user?.email,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}