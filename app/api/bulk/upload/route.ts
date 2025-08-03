import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { validateCSVFile } from '@/lib/csv/parser'
import { rateLimiters } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase/server'
import { validateCSRFToken } from '@/lib/utils/csrf'
import { BulkOperationConfig } from '@/types/bulk-operations.types'

// Define valid types
const VALID_OPERATION_TYPES = ['import', 'export', 'update', 'delete'] as const
const VALID_ENTITY_TYPES = [
  'products',
  'inventory',
  'pricing',
  'customers',
] as const

// Define the schema for bulk upload form data
const bulkUploadSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, {
    message: 'File is required and must be a valid file',
  }),
  operationType: z.enum(VALID_OPERATION_TYPES, {
    errorMap: () => ({
      message: `Invalid operation type. Must be one of: ${VALID_OPERATION_TYPES.join(', ')}`,
    }),
  }),
  entityType: z.enum(VALID_ENTITY_TYPES, {
    errorMap: () => ({
      message: `Invalid entity type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
    }),
  }),
  validateOnly: z.boolean().default(false),
  rollbackOnError: z.boolean().default(false),
  chunkSize: z
    .number()
    .int()
    .min(1, 'Chunk size must be at least 1')
    .max(10000, 'Chunk size must not exceed 10000')
    .default(500),
  maxConcurrent: z
    .number()
    .int()
    .min(1, 'Max concurrent must be at least 1')
    .max(10, 'Max concurrent must not exceed 10')
    .default(3),
})

/**
 * Handles bulk upload operations via a POST request, including authentication, CSRF validation, form data parsing, and input validation.
 *
 * Validates the CSRF token and user authentication, ensures the user belongs to an organization, and parses multipart form data for required parameters and a CSV file. Checks operation and entity types, numeric and boolean options, and validates the CSV file. Initiates the bulk operation and returns a JSON response with the operation ID on success. Handles and sanitizes errors, returning appropriate HTTP status codes and messages.
 *
 * @returns A JSON response indicating success with an operation ID, or an error message with the appropriate HTTP status code.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const isValidCSRF = await validateCSRFToken(request)
    if (!isValidCSRF) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }

    const supabase = createServerClient()

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting check for bulk operations
    if (rateLimiters.bulkOperations) {
      const { success, limit, reset, remaining } =
        await rateLimiters.bulkOperations.limit(user.id)

      if (!success) {
        return NextResponse.json(
          {
            error: 'Too many bulk operations. Please try again later.',
            details: `Rate limit exceeded. Try again in ${Math.round((reset - Date.now()) / 1000 / 60)} minutes.`,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        )
      }
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

    // Parse form data
    const formData = await request.formData()

    // Prepare data for validation
    const rawData = {
      file: formData.get('file'),
      operationType: formData.get('operationType'),
      entityType: formData.get('entityType'),
      validateOnly: formData.get('validateOnly') === 'true',
      rollbackOnError: formData.get('rollbackOnError') === 'true',
      chunkSize: formData.get('chunkSize')
        ? parseInt(String(formData.get('chunkSize')))
        : undefined,
      maxConcurrent: formData.get('maxConcurrent')
        ? parseInt(String(formData.get('maxConcurrent')))
        : undefined,
    }

    // Validate with Zod schema
    let validatedData: z.infer<typeof bulkUploadSchema>
    try {
      validatedData = bulkUploadSchema.parse(rawData)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0]
        return NextResponse.json({ error: firstError.message }, { status: 400 })
      }
      throw error
    }

    // Validate CSV file
    const validation = validateCSVFile(validatedData.file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Create engine and start operation
    const engine = new BulkOperationsEngine()
    const operationId = await engine.startOperation(
      validatedData.file,
      {
        operationType: validatedData.operationType,
        entityType: validatedData.entityType,
        validateOnly: validatedData.validateOnly,
        rollbackOnError: validatedData.rollbackOnError,
        chunkSize: validatedData.chunkSize,
        maxConcurrent: validatedData.maxConcurrent,
      },
      user.id
    )

    return NextResponse.json({
      success: true,
      operationId,
      message: 'Bulk operation started successfully',
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
