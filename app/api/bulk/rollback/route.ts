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

    const { operationId } = await request.json()

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID required' },
        { status: 400 }
      )
    }

    // Verify operation belongs to user's organization
    const { data: operation } = await supabase
      .from('bulk_operations')
      .select('*')
      .eq('id', operationId)
      .single()

    if (!operation) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
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

    // Start rollback asynchronously
    engine.rollbackOperation(operationId).catch((err) => {
      console.error(`Rollback operation ${operationId} failed:`, err)
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