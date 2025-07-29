import { useCallback, useEffect } from 'react'
import { sentryService, MonitoringContext } from '@/lib/monitoring/sentry-service'

export interface UseMonitoringOptions {
  userId?: string
  organizationId?: string
  componentName?: string
  pageName?: string
}

export function useMonitoring(options: UseMonitoringOptions = {}) {
  const { userId, organizationId, componentName, pageName } = options

  // Set user context when component mounts
  useEffect(() => {
    if (userId) {
      sentryService.setUser(userId, undefined, organizationId)
    }
  }, [userId, organizationId])

  // Set page context
  useEffect(() => {
    if (pageName) {
      sentryService.setContext({
        page: pageName,
        component: componentName,
      })
    }
  }, [pageName, componentName])

  const trackEvent = useCallback((
    eventName: string,
    data?: Record<string, any>,
    level: 'info' | 'warning' | 'error' = 'info'
  ) => {
    sentryService.captureMessage(eventName, level, {
      eventName,
      ...data,
      component: componentName,
      page: pageName,
    })
  }, [componentName, pageName])

  const trackError = useCallback((
    error: Error,
    context?: Record<string, any>
  ) => {
    sentryService.captureException(error, {
      ...context,
      component: componentName,
      page: pageName,
    })
  }, [componentName, pageName])

  const trackPerformance = useCallback((
    operationName: string,
    fn: () => Promise<any>,
    context?: MonitoringContext
  ) => {
    return sentryService.monitorFunction(operationName, fn, {
      ...context,
      component: componentName,
      page: pageName,
    })
  }, [componentName, pageName])

  const addBreadcrumb = useCallback((
    message: string,
    category: string = 'app',
    data?: Record<string, any>
  ) => {
    sentryService.addBreadcrumb(message, category, 'info', {
      ...data,
      component: componentName,
      page: pageName,
    })
  }, [componentName, pageName])

  const setContext = useCallback((
    context: MonitoringContext
  ) => {
    sentryService.setContext({
      ...context,
      component: componentName,
      page: pageName,
    })
  }, [componentName, pageName])

  return {
    trackEvent,
    trackError,
    trackPerformance,
    addBreadcrumb,
    setContext,
  }
}

// Hook for tracking page views
export function usePageTracking(pageName: string, userId?: string, organizationId?: string) {
  const { addBreadcrumb } = useMonitoring({ pageName, userId, organizationId })

  useEffect(() => {
    addBreadcrumb(`Page viewed: ${pageName}`, 'navigation', {
      pageName,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    })
  }, [pageName, addBreadcrumb])
}

// Hook for tracking user actions
export function useActionTracking(actionName: string, options: UseMonitoringOptions = {}) {
  const { trackEvent, addBreadcrumb } = useMonitoring(options)

  const trackAction = useCallback((
    actionData?: Record<string, any>,
    level: 'info' | 'warning' | 'error' = 'info'
  ) => {
    addBreadcrumb(`Action: ${actionName}`, 'user_action', actionData)
    trackEvent(`User Action: ${actionName}`, actionData, level)
  }, [actionName, trackEvent, addBreadcrumb])

  return { trackAction }
}

// Hook for tracking API calls
export function useApiTracking(apiName: string, options: UseMonitoringOptions = {}) {
  const { trackPerformance, trackError, addBreadcrumb } = useMonitoring(options)

  const trackApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> => {
    addBreadcrumb(`API Call: ${apiName}`, 'api', context)
    
    try {
      const result = await trackPerformance(apiName, apiCall, context)
      addBreadcrumb(`API Success: ${apiName}`, 'api', { success: true })
      return result
    } catch (error) {
      addBreadcrumb(`API Error: ${apiName}`, 'api', { 
        success: false, 
        error: (error as Error).message 
      })
      trackError(error as Error, context)
      throw error
    }
  }, [apiName, trackPerformance, trackError, addBreadcrumb])

  return { trackApiCall }
}