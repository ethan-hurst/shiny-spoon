import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

// Define Zod schema for request body
const cancelRequestSchema = z.object({
  operationId: z.string().uuid('Invalid operation ID format')
})

/**
 * Handles POST requests to cancel a bulk operation after validating authentication, authorization, and operation status.
 *
 * @returns A JSON response indicating success or an error with the relevant HTTP status code.
 */
export const POST = createRouteHandler(
  async ({ user, body }) => {
    const supabase = createServerClient()

    // Check if the operation exists and belongs to the user's organization (auto-filtered by wrapper)
    const { data: operation, error: operationError } = await supabase
      .from('bulk_operations')
      .select('id, created_by, organization_id, status')
      .eq('id', body.operationId)
      .eq('organization_id', user.organizationId)
      .single()

    if (operationError || !operation) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      )
    }

    // Verify user has permission to cancel this operation
    const canCancel = operation.created_by === user.id || user.role === 'admin'

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
    await engine.cancelOperation(body.operationId, user.id)

    return NextResponse.json({ success: true })
  },
  {
    schema: { body: cancelRequestSchema },
    rateLimit: { 
      requests: 20, 
      window: '1m',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)