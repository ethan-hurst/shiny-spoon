import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerSync } from '@/app/actions/integrations'

// Allowed entity types for sync operations
const ALLOWED_ENTITY_TYPES = ['products', 'inventory', 'orders', 'customers', 'pricing']

/**
 * Handles POST requests to trigger a manual synchronization job for a specified integration.
 *
 * Authenticates the user, validates the optional `entityType` in the request body, and initiates a sync job for the given integration ID. Responds with appropriate status codes and messages based on authentication, validation, and sync initiation outcomes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let user: { id: string; email?: string } | null = null
  let entityType: string | undefined
  
  try {
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    user = authData.user
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional entity type from request body
    try {
      const body = await request.json()
      const rawEntityType = body.entityType
      
      // Validate entityType if provided
      if (rawEntityType !== undefined) {
        if (typeof rawEntityType !== 'string' || rawEntityType.trim() === '') {
          return NextResponse.json(
            { error: 'Invalid entityType: must be a non-empty string' },
            { status: 400 }
          )
        }
        
        // Check if entityType is in allowed values
        if (!ALLOWED_ENTITY_TYPES.includes(rawEntityType)) {
          return NextResponse.json(
            { error: `Invalid entityType: must be one of ${ALLOWED_ENTITY_TYPES.join(', ')}` },
            { status: 400 }
          )
        }
        
        entityType = rawEntityType
      }
    } catch {
      // No body or invalid JSON, that's ok
    }

    const result = await triggerSync(params.id, entityType)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      jobId: result.jobId,
      message: 'Sync job created successfully' 
    })
  } catch (error) {
    console.error('Sync API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      integrationId: params.id,
      userId: user?.id,
      entityType,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}