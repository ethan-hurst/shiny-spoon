import { createServerClient } from '@/lib/supabase/server'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { validateCSVFile } from '@/lib/csv/parser'
import { NextRequest, NextResponse } from 'next/server'
import { BulkOperationConfig } from '@/types/bulk-operations.types'
import { validateCSRFToken } from '@/lib/utils/csrf'

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const isValidCSRF = await validateCSRFToken(request)
    if (!isValidCSRF) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const supabase = createServerClient()

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile?.organization_id) {
      return NextResponse.json(
        { error: 'User does not belong to an organization' },
        { status: 403 }
      )
    }

    // Parse form data with validation
    const formData = await request.formData()
    
    // Validate and get file
    const fileField = formData.get('file')
    if (!fileField || !(fileField instanceof File)) {
      return NextResponse.json({ error: 'File is required and must be a valid file' }, { status: 400 })
    }
    const file = fileField
    
    // Validate and get operationType
    const operationTypeField = formData.get('operationType')
    if (!operationTypeField || typeof operationTypeField !== 'string') {
      return NextResponse.json({ error: 'Operation type is required and must be a string' }, { status: 400 })
    }
    const operationType = operationTypeField
    
    // Validate and get entityType
    const entityTypeField = formData.get('entityType')
    if (!entityTypeField || typeof entityTypeField !== 'string') {
      return NextResponse.json({ error: 'Entity type is required and must be a string' }, { status: 400 })
    }
    const entityType = entityTypeField
    
    // Parse boolean fields safely
    const validateOnlyField = formData.get('validateOnly')
    const validateOnly = validateOnlyField === 'true'
    
    const rollbackOnErrorField = formData.get('rollbackOnError')
    const rollbackOnError = rollbackOnErrorField === 'true'
    
    // Parse numeric fields with validation
    const chunkSizeField = formData.get('chunkSize')
    const chunkSize = chunkSizeField && typeof chunkSizeField === 'string' 
      ? parseInt(chunkSizeField) 
      : 500
    if (isNaN(chunkSize) || chunkSize < 1 || chunkSize > 10000) {
      return NextResponse.json({ error: 'Chunk size must be a number between 1 and 10000' }, { status: 400 })
    }
    
    const maxConcurrentField = formData.get('maxConcurrent')
    const maxConcurrent = maxConcurrentField && typeof maxConcurrentField === 'string'
      ? parseInt(maxConcurrentField)
      : 3
    if (isNaN(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 10) {
      return NextResponse.json({ error: 'Max concurrent must be a number between 1 and 10' }, { status: 400 })
    }


    // Validate file
    const validation = validateCSVFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Type guards for operation and entity types
    const validOperationTypes = ['import', 'export', 'update', 'delete'] as const
    const validEntityTypes = ['products', 'inventory', 'pricing', 'customers'] as const

    const isValidOperationType = (
      type: string
    ): type is BulkOperationConfig['operationType'] => {
      return (validOperationTypes as readonly string[]).includes(type)
    }

    const isValidEntityType = (
      type: string
    ): type is BulkOperationConfig['entityType'] => {
      return (validEntityTypes as readonly string[]).includes(type)
    }

    if (!isValidOperationType(operationType)) {
      return NextResponse.json(
        {
          error: `Invalid operation type: ${operationType}. Must be one of: ${validOperationTypes.join(
            ', '
          )}`,
        },
        { status: 400 }
      )
    }

    if (!isValidEntityType(entityType)) {
      return NextResponse.json(
        {
          error: `Invalid entity type: ${entityType}. Must be one of: ${validEntityTypes.join(
            ', '
          )}`,
        },
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
        'credentials',
        'auth failed',
        'not authenticated',
      ]

      const lowerMessage = error.message.toLowerCase()
      const isAuthError = authErrorPatterns.some((pattern) =>
        lowerMessage.includes(pattern)
      )

      if (isAuthError) {
        errorMessage = 'Authentication error: Please check your credentials'
        statusCode = 401
      } else if (
        lowerMessage.includes('validation') ||
        lowerMessage.includes('invalid')
      ) {
        // Validation errors are generally safe to show
        errorMessage = error.message.replace(
          /\b(password|token|secret|key|credential|apikey|api_key)\b/gi,
          '[REDACTED]'
        )
        statusCode = 400
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode })
  }
}