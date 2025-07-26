import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerSync } from '@/app/actions/integrations'

// Trigger manual sync
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional entity type from request body
    let entityType: string | undefined
    try {
      const body = await request.json()
      entityType = body.entityType
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
    console.error('Sync API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}