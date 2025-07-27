import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { NextRequest, NextResponse } from 'next/server'

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

    let operationId: string
    try {
      const body = await request.json()
      operationId = body.operationId
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON input' },
        { status: 400 }
      )
    }

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID required' },
        { status: 400 }
      )
    }

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

    // Update operation status to indicate rollback is starting
    const { error: updateError } = await supabase
      .from('bulk_operations')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', operationId)

    if (updateError) {
      console.error('Failed to update operation status:', updateError)
      return NextResponse.json(
        { error: 'Failed to initiate rollback' },
        { status: 500 }
      )
    }

    // Start rollback asynchronously but handle errors properly
    engine.rollbackOperation(operationId)
      .then(() => {
        console.log(`Rollback operation ${operationId} completed successfully`)
      })
      .catch(async (err) => {
        console.error(`Rollback operation ${operationId} failed:`, err)
        // Update operation status to failed
        try {
          await supabase
            .from('bulk_operations')
            .update({ 
              status: 'failed',
              error_log: [{
                message: err.message || 'Rollback failed',
                timestamp: new Date().toISOString()
              }],
              updated_at: new Date().toISOString()
            })
            .eq('id', operationId)
        } catch (updateErr) {
          console.error('Failed to update operation status after rollback error:', updateErr)
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Rollback initiated',
      operationId,
    })
  } catch (error) {
    console.error('Rollback API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}