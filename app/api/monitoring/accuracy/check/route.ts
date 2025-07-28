// PRP-016: Data Accuracy Monitor - Manual Accuracy Check API
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { AccuracyChecker } from '@/lib/monitoring/accuracy-checker'
import { z } from 'zod'

export const runtime = 'edge'

const requestSchema = z.object({
  entityTypes: z.array(z.enum(['product', 'inventory', 'pricing'])).optional(),
  integrationId: z.string().uuid().optional(),
  sampleSize: z.number().min(1).max(10000).optional(),
})

export const POST = createRouteHandler(
  async ({ user, body }) => {
    const supabase = createClient()

    // Get user's organization (already validated by wrapper)
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Create accuracy check configuration
    const config = {
      organizationId: orgUser.organization_id,
      entityTypes: body.entityTypes || ['product', 'inventory', 'pricing'],
      integrationId: body.integrationId,
      checkType: 'manual' as const,
      sampleSize: body.sampleSize || 100,
    }

    // Initialize accuracy checker and run check
    const checker = new AccuracyChecker()
    const checkId = await checker.runCheck(config)

    // Set up SSE to stream progress updates
    const encoder = new TextEncoder()
    
    // Store cleanup function outside stream for access in cancel
    let cleanup: (() => void) | null = null
    
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial response
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'started', 
          checkId,
          message: 'Accuracy check started'
        })}\n\n`))

        // Subscribe to progress events
        const handleProgress = (progress: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'progress',
              ...progress 
            })}\n\n`))
          } catch (error) {
            // Controller might be closed if client disconnected
            console.log('Failed to send progress update:', error)
          }
        }

        const handleComplete = (result: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete',
              ...result 
            })}\n\n`))
            controller.close()
          } catch (error) {
            console.log('Failed to send complete event:', error)
          }
        }

        const handleError = (error: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error',
              error: error.message 
            })}\n\n`))
            controller.close()
          } catch (error) {
            console.log('Failed to send error event:', error)
          }
        }

        checker.on(`progress-${checkId}`, handleProgress)
        checker.on(`complete-${checkId}`, handleComplete)
        checker.on(`error-${checkId}`, handleError)

        // Timeout after 5 minutes
        const timeoutId = setTimeout(() => {
          if (cleanup) cleanup()
          controller.close()
        }, 5 * 60 * 1000)

        // Define cleanup function
        cleanup = () => {
          clearTimeout(timeoutId)
          checker.removeListener(`progress-${checkId}`, handleProgress)
          checker.removeListener(`complete-${checkId}`, handleComplete)
          checker.removeListener(`error-${checkId}`, handleError)
        }
      },
      cancel(reason) {
        // Clean up event listeners if client disconnects
        if (cleanup) {
          cleanup()
          cleanup = null
        }
        console.log('SSE stream cancelled:', reason)
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  },
  {
    schema: { body: requestSchema },
    rateLimit: { 
      requests: 10, 
      window: '1h',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)