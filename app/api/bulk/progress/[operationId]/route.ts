import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { createRouteHandler } from '@/lib/api/route-handler'
import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const paramsSchema = z.object({
  operationId: z.string().uuid()
})

/**
 * Streams real-time progress updates for a bulk operation as server-sent events (SSE).
 *
 * Authenticates the user, verifies organization and operation ownership, and streams progress and rollback updates for the specified bulk operation. Sends an initial state event, then pushes updates as the operation progresses or rolls back. Closes the stream when the operation completes or the client disconnects.
 *
 * @param params - Route parameters containing the bulk operation ID
 * @returns An HTTP response with an SSE stream of progress updates, or an error response if authentication or validation fails
 */
export const GET = createRouteHandler(
  async ({ user, params, request }) => {
    const supabase = createServerClient()

    // Verify operation belongs to user's org (automatic org filtering via wrapper)
    const { data: operation } = await supabase
      .from('bulk_operations')
      .select('*')
      .eq('id', params.operationId)
      .eq('organization_id', user.organizationId)
      .single()

    if (!operation) {
      return new Response('Not found', { status: 404 })
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const engine = new BulkOperationsEngine()

        // Send initial state
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'initial',
              progress: {
                operationId: operation.id,
                status: operation.status,
                totalRecords: operation.total_records || 0,
                processedRecords: operation.processed_records || 0,
                successfulRecords: operation.successful_records || 0,
                failedRecords: operation.failed_records || 0,
                rollbackProgress: operation.results?.rollback_progress || null,
              },
            })}\n\n`
          )
        )

        // Listen for progress updates
        const handleProgress = (progress: any) => {
          if (progress.operationId === params.operationId) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'progress',
                  progress,
                })}\n\n`
              )
            )
          }
        }

        // Listen for rollback progress updates
        const handleRollbackProgress = (progress: any) => {
          if (progress.operationId === params.operationId) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'rollback-progress',
                  progress,
                })}\n\n`
              )
            )
          }
        }

        engine.on('progress', handleProgress)
        engine.on('rollback-progress', handleRollbackProgress)

        // Poll for updates if operation is running or being rolled back
        if (
          operation.status === 'processing' ||
          operation.status === 'rolling_back' ||
          (operation.results?.rollback_started && operation.status !== 'rolled_back')
        ) {
          const pollInterval = setInterval(async () => {
            const { data: updated } = await supabase
              .from('bulk_operations')
              .select('*')
              .eq('id', params.operationId)
              .single()

            if (updated) {
              // Check if this is rollback progress
              const rollbackProgress = updated.results?.rollback_progress
              if (rollbackProgress) {
                handleRollbackProgress({
                  operationId: updated.id,
                  type: 'rollback',
                  status: updated.status,
                  totalRecords: rollbackProgress.total,
                  processedRecords: rollbackProgress.processed,
                  successfulRecords: rollbackProgress.successful,
                  failedRecords: rollbackProgress.failed,
                  percentage: rollbackProgress.percentage,
                })
              } else {
                // Regular operation progress
                handleProgress({
                  operationId: updated.id,
                  status: updated.status,
                  totalRecords: updated.total_records || 0,
                  processedRecords: updated.processed_records || 0,
                  successfulRecords: updated.successful_records || 0,
                  failedRecords: updated.failed_records || 0,
                })
              }

              // Close connection when operation is fully complete
              if (updated.status !== 'processing' && updated.status !== 'rolling_back' && !rollbackProgress) {
                clearInterval(pollInterval)
                controller.close()
              }
            }
          }, 1000)

          // Cleanup on disconnect
          request.signal.addEventListener('abort', () => {
            clearInterval(pollInterval)
            engine.removeListener('progress', handleProgress)
            engine.removeListener('rollback-progress', handleRollbackProgress)
            controller.close()
          })
        } else {
          // For completed operations, close immediately after sending initial state
          setTimeout(() => controller.close(), 100)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  },
  {
    schema: { params: paramsSchema },
    rateLimit: { 
      requests: 30, 
      window: '1m',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)