import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { createServerClient } from '@/lib/supabase/server'

// Define the request body schema
const rollbackRequestSchema = z.object({
  operationId: z.string().uuid('Invalid operation ID format'),
  csrfToken: z.string().min(1, 'CSRF token is required'),
})

/**
 * Handles POST requests to initiate a rollback of a completed bulk operation for an authenticated user.
 *
 * Validates the user's authentication, parses the request body for an operation ID, verifies the user's organization and operation ownership, and ensures the operation is eligible for rollback. Updates the operation status to "processing" and triggers the rollback asynchronously. Returns a JSON response indicating the rollback initiation or an appropriate error message.
 *
 * @returns A JSON response confirming rollback initiation or an error message with the corresponding HTTP status code.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Verify user has access
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    let validatedData: z.infer<typeof rollbackRequestSchema>
    try {
      const body = await request.json()
      validatedData = rollbackRequestSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request data',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 })
    }

    // Verify CSRF token
    const sessionToken = request.cookies.get('session-token')?.value
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token not found' },
        { status: 403 }
      )
    }

    // Generate expected CSRF token based on session and user ID
    const expectedCsrfToken = crypto
      .createHmac('sha256', process.env.CSRF_SECRET || 'default-csrf-secret')
      .update(`${sessionToken}:${user.id}`)
      .digest('hex')

    if (validatedData.csrfToken !== expectedCsrfToken) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }

    const { operationId } = validatedData

    // Get user's organization
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!userProfile?.organization_id) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      )
    }

    // Verify operation belongs to user's organization
    const { data: operation } = await supabase
      .from('bulk_operations')
      .select('*')
      .eq('id', operationId)
      .eq('organization_id', userProfile.organization_id)
      .single()

    if (!operation) {
      return NextResponse.json(
        { error: 'Operation not found or unauthorized' },
        { status: 403 }
      )
    }

    // Check if operation can be rolled back
    if (operation.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed operations can be rolled back' },
        { status: 400 }
      )
    }

    // Start rollback process
    const engine = new BulkOperationsEngine()

    // Update operation status atomically - only if still completed
    const { data: updatedOperation, error: updateError } = await supabase
      .from('bulk_operations')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', operationId)
      .eq('status', 'completed') // Atomic check - only update if still completed
      .select()
      .single()

    if (updateError || !updatedOperation) {
      console.error('Failed to update operation status:', updateError)
      return NextResponse.json(
        {
          error:
            'Failed to initiate rollback - operation status may have changed',
        },
        { status: 409 } // Conflict status
      )
    }

    // Start rollback asynchronously but handle errors properly
    engine
      .rollbackOperation(operationId)
      .then(() => {
        console.log(`Rollback operation ${operationId} completed successfully`)
      })
      .catch(async (err) => {
        console.error(`Rollback operation ${operationId} failed:`, err)
        // Update operation status to failed
        try {
          // Get existing error log
          const { data: existingOperation } = await supabase
            .from('bulk_operations')
            .select('error_log')
            .eq('id', operationId)
            .single()

          const existingErrorLog = existingOperation?.error_log || []
          const newError = {
            message: err.message || 'Rollback failed',
            timestamp: new Date().toISOString(),
          }

          await supabase
            .from('bulk_operations')
            .update({
              status: 'failed',
              error_log: [...existingErrorLog, newError],
              updated_at: new Date().toISOString(),
            })
            .eq('id', operationId)
        } catch (updateErr) {
          console.error(
            'Failed to update operation status after rollback error:',
            updateErr
          )
        }
      })

    return NextResponse.json({
      success: true,
      message:
        'Rollback has been initiated. The operation is being processed asynchronously.',
      operationId,
      status: 'rollback_initiated',
    })
  } catch (error) {
    console.error('Rollback API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
