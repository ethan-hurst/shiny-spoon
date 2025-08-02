/**
 * Server-side error handling utilities
 */

export interface ServerError {
  code: string
  message: string
  details?: any
  statusCode?: number
}

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: any

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500, details?: any) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

// Common error types
export const Errors = {
  UNAUTHORIZED: new AppError('Unauthorized', 'UNAUTHORIZED', 401),
  FORBIDDEN: new AppError('Forbidden', 'FORBIDDEN', 403),
  NOT_FOUND: new AppError('Not found', 'NOT_FOUND', 404),
  VALIDATION_ERROR: new AppError('Validation error', 'VALIDATION_ERROR', 400),
  RATE_LIMIT_EXCEEDED: new AppError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429),
  CONFLICT: new AppError('Resource conflict', 'CONFLICT', 409),
  INTERNAL_ERROR: new AppError('Internal server error', 'INTERNAL_ERROR', 500),
  SERVICE_UNAVAILABLE: new AppError('Service unavailable', 'SERVICE_UNAVAILABLE', 503),
} as const

/**
 * Creates a standardized error response
 */
export function createErrorResponse(error: AppError | Error): ServerError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      statusCode: error.statusCode,
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred',
    statusCode: 500,
  }
}

/**
 * Handles errors in server actions
 */
export function handleServerError(error: unknown): { error: string } {
  console.error('Server action error:', error)

  if (error instanceof AppError) {
    return { error: error.message }
  }

  if (error instanceof Error) {
    return { error: error.message }
  }

  return { error: 'An unexpected error occurred' }
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(): void {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const missing = requiredVars.filter(varName => !process.env[varName])

  if (missing.length > 0) {
    throw new AppError(
      `Missing required environment variables: ${missing.join(', ')}`,
      'CONFIGURATION_ERROR',
      500
    )
  }
}

/**
 * Validates user authentication
 */
export async function requireAuth(supabase: any): Promise<{ user: any; profile: any }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw Errors.UNAUTHORIZED
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    throw new AppError('User profile not found', 'PROFILE_NOT_FOUND', 404)
  }

  return { user, profile }
}

/**
 * Validates organization access
 */
export async function requireOrganizationAccess(supabase: any, organizationId: string): Promise<void> {
  const { user, profile } = await requireAuth(supabase)

  if (profile.organization_id !== organizationId) {
    throw Errors.FORBIDDEN
  }
}

/**
 * Validates resource ownership
 */
export async function requireResourceAccess(
  supabase: any,
  table: string,
  resourceId: string,
  organizationId?: string
): Promise<any> {
  const { profile } = await requireAuth(supabase)

  const query = supabase
    .from(table)
    .select('*')
    .eq('id', resourceId)

  if (organizationId) {
    query.eq('organization_id', organizationId)
  } else {
    query.eq('organization_id', profile.organization_id)
  }

  const { data: resource, error } = await query.single()

  if (error || !resource) {
    throw Errors.NOT_FOUND
  }

  return resource
}

/**
 * Handles database errors
 */
export function handleDatabaseError(error: any): never {
  console.error('Database error:', error)

  // Handle specific database errors
  if (error.code === '23505') {
    throw new AppError('Resource already exists', 'DUPLICATE_ENTRY', 409)
  }

  if (error.code === '23503') {
    throw new AppError('Referenced resource not found', 'FOREIGN_KEY_VIOLATION', 400)
  }

  if (error.code === '23514') {
    throw new AppError('Invalid data provided', 'VALIDATION_ERROR', 400)
  }

  // Handle connection errors
  if (error.code === '08000' || error.code === '08001') {
    throw Errors.SERVICE_UNAVAILABLE
  }

  // Default to internal error
  throw Errors.INTERNAL_ERROR
}

/**
 * Wraps server actions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  action: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await action(...args)
    } catch (error) {
      return handleServerError(error)
    }
  }) as T
}

/**
 * Creates a safe server action that handles errors gracefully
 */
export function createSafeAction<T extends (...args: any[]) => Promise<any>>(
  action: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      const result = await action(...args)
      return { success: true, data: result }
    } catch (error) {
      const errorResponse = handleServerError(error)
      return { success: false, error: errorResponse.error }
    }
  }) as T
} 