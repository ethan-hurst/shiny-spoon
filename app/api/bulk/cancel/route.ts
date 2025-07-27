import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateCSRFToken } from '@/lib/utils/csrf'

// Define Zod schema for request body
const cancelRequestSchema = z.object({
  operationId: z.string().uuid('Invalid operation ID format')
})

/**
 * Handles POST requests to cancel a bulk operation after validating authentication, authorization, and operation status.
 *
 * Validates the CSRF token and user authentication, parses and validates the request body, checks operation existence and user permissions, and ensures the operation is in a cancellable state before invoking the cancellation. Returns appropriate error responses for invalid input, unauthorized access, or disallowed operation status.
 *
 * @returns A JSON response indicating success or an error with the relevant HTTP status code.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const isValidCSRF = await validateCSRFToken(request)
    if (!isValidCSRF) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const supabase = createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON input' },
        { status: 400 }
      )
    }

    // Validate with Zod schema
    const validationResult = cancelRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { operationId } = validationResult.data

    // Check if the operation exists and belongs to the user's organization
    const { data: operation, error: operationError } = await supabase
      .from('bulk_operations')
      .select('id, created_by, organization_id, status')
      .eq('id', operationId)
      .single()

    if (operationError || !operation) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      )
    }

    // Get user's organization
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    // Verify user has permission to cancel this operation
    const canCancel = (
      operation.created_by === user.id || // User created the operation
      (userProfile && operation.organization_id === userProfile.organization_id) // Same organization
    )

    if (!canCancel) {
      return NextResponse.json(
        { error: 'Unauthorized to cancel this operation' },
        { status: 403 }
      )
    }

    // Check if operation can be cancelled
    if (!['pending', 'processing'].includes(operation.status)) {
      return NextResponse.json(
        { error: `Cannot cancel operation with status: ${operation.status}` },
        { status: 400 }
      )
    }

    const engine = new BulkOperationsEngine()
    await engine.cancelOperation(operationId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}