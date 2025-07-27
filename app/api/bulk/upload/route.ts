import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { validateCSVFile } from '@/lib/csv/parser'
import { NextRequest, NextResponse } from 'next/server'
import { BulkOperationConfig } from '@/types/bulk-operations.types'

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

    // Validate file
    const validation = validateCSVFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Type guards for operation and entity types
    const validOperationTypes = ['import', 'export', 'update', 'delete'] as const
    const validEntityTypes = ['products', 'inventory', 'pricing', 'customers'] as const
    
    const isValidOperationType = (type: string): type is BulkOperationConfig['operationType'] => {
      return validOperationTypes.includes(type as any)
    }
    
    const isValidEntityType = (type: string): type is BulkOperationConfig['entityType'] => {
      return validEntityTypes.includes(type as any)
    }
    
    if (!isValidOperationType(operationType)) {
      return NextResponse.json(
        { error: `Invalid operation type: ${operationType}. Must be one of: ${validOperationTypes.join(', ')}` },
        { status: 400 }
      )
    }
    
    if (!isValidEntityType(entityType)) {
      return NextResponse.json(
        { error: `Invalid entity type: ${entityType}. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create engine and start operation
    const engine = new BulkOperationsEngine()
    const operationId = await engine.startOperation(
      file,
      {
        operationType,
        entityType,
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
    
    // Sanitize error messages to avoid exposing sensitive information
    let errorMessage = 'Internal server error'
    let statusCode = 500
    
    if (error instanceof Error) {
      // Define patterns for authentication-related errors
      const authErrorPatterns = [
        'authentication',
        'unauthorized',
        'unauthenticated',
        'jwt',
        'token',
        'session',
        'permission',
        'access denied',
        'forbidden',
        'credentials'
      ]
      
      const lowerMessage = error.message.toLowerCase()
      const isAuthError = authErrorPatterns.some(pattern => lowerMessage.includes(pattern))
      
      if (isAuthError) {
        errorMessage = 'Authentication error: Please check your credentials'
        statusCode = 401
      } else if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
        // Validation errors are generally safe to show
        errorMessage = error.message.replace(/\b(password|token|secret|key)\b/gi, '[REDACTED]')
        statusCode = 400
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}