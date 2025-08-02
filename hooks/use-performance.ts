'use client'

import { useEffect } from 'react'
import { initWebVitals } from '@/lib/performance/metrics'

export function usePerformance() {
  useEffect(() => {
    // Initialize Web Vitals monitoring
    if (typeof window !== 'undefined') {
      initWebVitals()
      
      // Log performance timing
      if (process.env.NODE_ENV === 'development') {
        window.addEventListener('load', () => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
          
          if (navigation) {
            console.log('[Performance] Page Load Metrics:', {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
              domInteractive: navigation.domInteractive - navigation.fetchStart,
              ttfb: navigation.responseStart - navigation.requestStart,
            })
          }
        })
      }
    }

    // Register service worker for PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[SW] Registration successful:', registration.scope)
            
            // Check for updates periodically
            setInterval(() => {
              registration.update()
            }, 60 * 60 * 1000) // Check every hour
          })
          .catch((error) => {
            console.error('[SW] Registration failed:', error)
          })
      })
    }
  }, [])
}

// Hook to measure component performance
export function useComponentPerformance(componentName: string) {
  useEffect(() => {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms`)
      }
      
      // Send to analytics if render time is significant
      if (renderTime > 100) {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics/vitals', JSON.stringify({
            name: `${componentName}-render`,
            value: renderTime,
            delta: renderTime,
            id: `${componentName}-${Date.now()}`,
            url: window.location.href,
            timestamp: Date.now(),
          }))
        }
      }
    }
  }, [componentName])
}