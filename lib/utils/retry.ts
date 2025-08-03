/**
 * Retry utility for handling failed operations with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
  jitter?: boolean
  retryCondition?: (error: any) => boolean
  onRetry?: (attempt: number, error: any, delay: number) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: any
  attempts: number
  totalTime: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryCondition: () => true,
  onRetry: () => {},
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const startTime = Date.now()
  let lastError: any

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const data = await fn()
      return {
        success: true,
        data,
        attempts: attempt,
        totalTime: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt === config.maxAttempts || !config.retryCondition(error)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTime: Date.now() - startTime,
        }
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      )

      // Add jitter if enabled
      const finalDelay = config.jitter
        ? delay * (0.5 + Math.random() * 0.5)
        : delay

      // Call onRetry callback
      config.onRetry(attempt, error, finalDelay)

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, finalDelay))
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: config.maxAttempts,
    totalTime: Date.now() - startTime,
  }
}

/**
 * Retry condition for network errors
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false

  // Check for network-related error codes
  const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
  if (error.code && networkCodes.includes(error.code)) {
    return true
  }

  // Check for HTTP status codes that indicate temporary failures
  if (error.status) {
    return error.status >= 500 || error.status === 429
  }

  // Check for timeout errors
  if (error.message && error.message.includes('timeout')) {
    return true
  }

  return false
}

/**
 * Retry condition for database errors
 */
export function isDatabaseError(error: any): boolean {
  if (!error) return false

  // PostgreSQL error codes for temporary failures
  const retryableCodes = [
    '57014', // query_canceled
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
    '08000', // connection_exception
    '08003', // connection_does_not_exist
    '08006', // connection_failure
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08004', // sqlserver_rejected_establishment_of_sqlconnection
    '08007', // connection_failure
    '08S01', // connection_exception
  ]

  if (error.code && retryableCodes.includes(error.code)) {
    return true
  }

  // Check for connection pool exhaustion
  if (error.message && error.message.includes('connection')) {
    return true
  }

  return false
}

/**
 * Retry condition for rate limiting
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false

  // Check for rate limit status codes
  if (error.status === 429) {
    return true
  }

  // Check for rate limit error messages
  if (error.message && error.message.toLowerCase().includes('rate limit')) {
    return true
  }

  return false
}

/**
 * Retry condition for temporary service errors
 */
export function isTemporaryError(error: any): boolean {
  return (
    isNetworkError(error) || isDatabaseError(error) || isRateLimitError(error)
  )
}

/**
 * Higher-order function that wraps async functions with retry logic
 */
export function retryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const result = await withRetry(() => fn(...args), options)

    if (!result.success) {
      throw result.error
    }

    return result.data
  }) as T
}

/**
 * Retry with different strategies based on error type
 */
export async function withSmartRetry<T>(
  fn: () => Promise<T>,
  options: {
    networkRetries?: number
    databaseRetries?: number
    rateLimitRetries?: number
    baseDelay?: number
  } = {}
): Promise<RetryResult<T>> {
  const config = {
    networkRetries: 3,
    databaseRetries: 2,
    rateLimitRetries: 5,
    baseDelay: 1000,
    ...options,
  }

  // Try with network error retry first
  const networkResult = await withRetry(fn, {
    maxAttempts: config.networkRetries,
    baseDelay: config.baseDelay,
    retryCondition: isNetworkError,
  })

  if (networkResult.success) {
    return networkResult
  }

  // Try with database error retry
  const databaseResult = await withRetry(fn, {
    maxAttempts: config.databaseRetries,
    baseDelay: config.baseDelay * 2,
    retryCondition: isDatabaseError,
  })

  if (databaseResult.success) {
    return databaseResult
  }

  // Try with rate limit retry
  const rateLimitResult = await withRetry(fn, {
    maxAttempts: config.rateLimitRetries,
    baseDelay: config.baseDelay * 5,
    retryCondition: isRateLimitError,
  })

  return rateLimitResult
}
