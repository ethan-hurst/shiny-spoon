import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

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

    // Check if the operation exists and belongs to the user's organization
    const { data: operation, error: operationError } = await supabase
      .from('bulk_operations')
      .select('id, created_by, organization_id, status')
      .eq('id', operationId)
      .single()

    if (operationError || !operation) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      )
    }

    // Get user's organization
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    // Verify user has permission to cancel this operation
    const canCancel = (
      operation.created_by === user.id || // User created the operation
      (userProfile && operation.organization_id === userProfile.organization_id) // Same organization
    )

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
    await engine.cancelOperation(operationId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}