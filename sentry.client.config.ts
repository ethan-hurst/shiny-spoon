import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session replay for debugging
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Integrations
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  
  // Before send to filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from URLs
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/[?&]token=[^&]*/g, '&token=***')
    }
    
    // Filter out specific errors if needed
    if (hint.originalException instanceof Error) {
      if (hint.originalException.message.includes('ResizeObserver')) {
        return null
      }
    }
    
    return event
  },
  
  // Debug mode in development
  debug: process.env.NODE_ENV === 'development',
})