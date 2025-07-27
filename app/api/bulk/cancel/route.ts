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