import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Integrations
  integrations: [
    Sentry.nodeTracingIntegration(),
  ],
  
  // Before send to filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from request headers
    if (event.request?.headers) {
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
      sensitiveHeaders.forEach(header => {
        if (event.request.headers[header]) {
          event.request.headers[header] = '***'
        }
      })
    }
    
    // Filter out specific errors
    if (hint.originalException instanceof Error) {
      // Ignore common network errors
      if (hint.originalException.message.includes('ECONNREFUSED') ||
          hint.originalException.message.includes('ENOTFOUND')) {
        return null
      }
    }
    
    return event
  },
  
  // Debug mode in development
  debug: process.env.NODE_ENV === 'development',
})