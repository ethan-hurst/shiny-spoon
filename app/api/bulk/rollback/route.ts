import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

// Define the request body schema
const rollbackRequestSchema = z.object({
  operationId: z.string().uuid('Invalid operation ID format'),
})

/**
 * Handles POST requests to initiate a rollback of a completed bulk operation for an authenticated user.
 *
 * @returns A JSON response confirming rollback initiation or an error message with the corresponding HTTP status code.
 */
export const POST = createRouteHandler(
  async ({ user, body }) => {
    const supabase = createServerClient()

    // Verify operation belongs to user's organization (auto-filtered by wrapper)
    const { data: operation } = await supabase
      .from('bulk_operations')
      .select('*')
      .eq('id', body.operationId)
      .eq('organization_id', user.organizationId)
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
        updated_at: new Date().toISOString()
      })
      .eq('id', body.operationId)
      .eq('status', 'completed') // Atomic check - only update if still completed
      .select()
      .single()

    if (updateError || !updatedOperation) {
      console.error('Failed to update operation status:', updateError)
      return NextResponse.json(
        { error: 'Failed to initiate rollback - operation status may have changed' },
        { status: 409 } // Conflict status
      )
    }

    // Start rollback asynchronously but handle errors properly
    engine.rollbackOperation(body.operationId)
      .then(() => {
        console.log(`Rollback operation ${body.operationId} completed successfully`)
      })
      .catch(async (err) => {
        console.error(`Rollback operation ${body.operationId} failed:`, err)
        // Update operation status to failed
        try {
          // Get existing error log
          const { data: existingOperation } = await supabase
            .from('bulk_operations')
            .select('error_log')
            .eq('id', body.operationId)
            .single()

          const existingErrorLog = existingOperation?.error_log || []
          const newError = {
            message: err.message || 'Rollback failed',
            timestamp: new Date().toISOString()
          }

          await supabase
            .from('bulk_operations')
            .update({ 
              status: 'failed',
              error_log: [...existingErrorLog, newError],
              updated_at: new Date().toISOString()
            })
            .eq('id', body.operationId)
        } catch (updateErr) {
          console.error('Failed to update operation status after rollback error:', updateErr)
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Rollback has been initiated. The operation is being processed asynchronously.',
      operationId: body.operationId,
      status: 'rollback_initiated'
    })
  },
  {
    schema: { body: rollbackRequestSchema },
    rateLimit: { 
      requests: 10, 
      window: '1h',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)