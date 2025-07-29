import * as Sentry from '@sentry/nextjs'

export interface MonitoringContext {
  userId?: string
  organizationId?: string
  action?: string
  entityType?: string
  entityId?: string
  [key: string]: any
}

export class SentryService {
  private static instance: SentryService

  private constructor() {}

  static getInstance(): SentryService {
    if (!SentryService.instance) {
      SentryService.instance = new SentryService()
    }
    return SentryService.instance
  }

  /**
   * Set user context for better error tracking
   */
  setUser(userId: string, email?: string, organizationId?: string): void {
    Sentry.setUser({
      id: userId,
      email,
      organizationId,
    })
  }

  /**
   * Set additional context for the current transaction
   */
  setContext(context: MonitoringContext): void {
    Sentry.setContext('application', context)
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(
    message: string,
    category: string = 'app',
    level: Sentry.SeverityLevel = 'info',
    data?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
    })
  }

  /**
   * Capture and report an error
   */
  captureException(
    error: Error,
    context?: MonitoringContext,
    tags?: Record<string, string>
  ): void {
    if (context) {
      this.setContext(context)
    }

    if (tags) {
      Sentry.setTags(tags)
    }

    Sentry.captureException(error)
  }

  /**
   * Capture a custom message
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: MonitoringContext
  ): void {
    if (context) {
      this.setContext(context)
    }

    Sentry.captureMessage(message, level)
  }

  /**
   * Start a performance transaction
   */
  startTransaction(
    name: string,
    operation: string,
    context?: MonitoringContext
  ): Sentry.Transaction {
    const transaction = Sentry.startTransaction({
      name,
      op: operation,
    })

    if (context) {
      transaction.setContext('application', context)
    }

    return transaction
  }

  /**
   * Monitor a function execution
   */
  async monitorFunction<T>(
    name: string,
    fn: () => Promise<T>,
    context?: MonitoringContext
  ): Promise<T> {
    const transaction = this.startTransaction(name, 'function', context)
    
    try {
      const result = await fn()
      transaction.setStatus('ok')
      return result
    } catch (error) {
      transaction.setStatus('internal_error')
      this.captureException(error as Error, context)
      throw error
    } finally {
      transaction.finish()
    }
  }

  /**
   * Monitor API route performance
   */
  monitorApiRoute(
    route: string,
    method: string,
    context?: MonitoringContext
  ): Sentry.Transaction {
    return this.startTransaction(
      `${method} ${route}`,
      'http.server',
      { ...context, route, method }
    )
  }

  /**
   * Track database operation
   */
  trackDatabaseOperation(
    operation: string,
    table: string,
    context?: MonitoringContext
  ): Sentry.Span {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction()
    if (!transaction) {
      return Sentry.startSpan({ op: 'db', description: operation })
    }

    const span = transaction.startChild({
      op: 'db',
      description: operation,
      data: { table, ...context },
    })

    return span
  }

  /**
   * Track external API call
   */
  trackExternalApiCall(
    service: string,
    endpoint: string,
    context?: MonitoringContext
  ): Sentry.Span {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction()
    if (!transaction) {
      return Sentry.startSpan({ op: 'http.client', description: `${service}:${endpoint}` })
    }

    const span = transaction.startChild({
      op: 'http.client',
      description: `${service}:${endpoint}`,
      data: { service, endpoint, ...context },
    })

    return span
  }

  /**
   * Set release version for better tracking
   */
  setRelease(version: string): void {
    Sentry.setTag('release', version)
  }

  /**
   * Clear user context (for logout)
   */
  clearUser(): void {
    Sentry.setUser(null)
  }
}

// Export singleton instance
export const sentryService = SentryService.getInstance()