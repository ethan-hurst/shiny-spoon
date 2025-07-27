import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { validateCSVFile } from '@/lib/csv/parser'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const operationType = formData.get('operationType') as string
    const entityType = formData.get('entityType') as string
    const validateOnly = formData.get('validateOnly') === 'true'
    const rollbackOnError = formData.get('rollbackOnError') === 'true'
    const chunkSize = parseInt(formData.get('chunkSize') as string) || 500
    const maxConcurrent = parseInt(formData.get('maxConcurrent') as string) || 3

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!operationType || !entityType) {
      return NextResponse.json(
        { error: 'Operation type and entity type are required' },
        { status: 400 }
      )
    }

    if (!['import', 'export', 'update', 'delete'].includes(operationType)) {
      return NextResponse.json(
        { error: 'Invalid operation type' },
        { status: 400 }
      )
    }

    if (!['products', 'inventory', 'pricing', 'customers'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entity type' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateCSVFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Create engine and start operation
    const engine = new BulkOperationsEngine()
    const operationId = await engine.startOperation(
      file,
      {
        operationType: operationType as any,
        entityType: entityType as any,
        validateOnly,
        rollbackOnError,
        chunkSize,
        maxConcurrent,
      },
      user.id
    )

    return NextResponse.json({ 
      success: true,
      operationId,
      message: 'Bulk operation started successfully'
    })

  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}