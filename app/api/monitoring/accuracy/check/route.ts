// PRP-016: Data Accuracy Monitor - Manual Accuracy Check API
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { AccuracyChecker } from '@/lib/monitoring/accuracy-checker'
import { z } from 'zod'

export const runtime = 'edge'

const requestSchema = z.object({
  entityTypes: z.array(z.enum(['product', 'inventory', 'pricing'])).optional(),
  integrationId: z.string().uuid().optional(),
  sampleSize: z.number().min(1).max(10000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = requestSchema.parse(body)

    // Create accuracy check configuration
    const config = {
      organizationId: orgUser.organization_id,
      entityTypes: validatedData.entityTypes || ['product', 'inventory', 'pricing'],
      integrationId: validatedData.integrationId,
      checkType: 'manual' as const,
      sampleSize: validatedData.sampleSize || 100,
    }

    // Initialize accuracy checker and run check
    const checker = new AccuracyChecker()
    const checkId = await checker.runCheck(config)

    // Set up SSE to stream progress updates
    const encoder = new TextEncoder()
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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'progress',
            ...progress 
          })}\n\n`))
        }

        const handleComplete = (result: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete',
            ...result 
          })}\n\n`))
          controller.close()
        }

        const handleError = (error: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error',
            error: error.message 
          })}\n\n`))
          controller.close()
        }

        checker.on(`progress-${checkId}`, handleProgress)
        checker.on(`complete-${checkId}`, handleComplete)
        checker.on(`error-${checkId}`, handleError)

        // Timeout after 5 minutes
        setTimeout(() => {
          checker.removeListener(`progress-${checkId}`, handleProgress)
          checker.removeListener(`complete-${checkId}`, handleComplete)
          checker.removeListener(`error-${checkId}`, handleError)
          controller.close()
        }, 5 * 60 * 1000)
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Accuracy check API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to start accuracy check' },
      { status: 500 }
    )
  }
}