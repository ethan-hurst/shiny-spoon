import { onCLS, onFID, onLCP, onFCP, onTTFB, Metric } from 'web-vitals'

interface PerformanceMetric {
  name: string
  value: number
  delta: number
  id: string
  url: string
  timestamp: number
  rating?: 'good' | 'needs-improvement' | 'poor'
}

// Performance thresholds based on Web Vitals
const thresholds = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
}

function getRating(metric: Metric): 'good' | 'needs-improvement' | 'poor' {
  const threshold = thresholds[metric.name as keyof typeof thresholds]
  if (!threshold) return 'needs-improvement'
  
  if (metric.value <= threshold.good) return 'good'
  if (metric.value >= threshold.poor) return 'poor'
  return 'needs-improvement'
}

function sendToAnalytics(metric: Metric) {
  const performanceMetric: PerformanceMetric = {
    name: metric.name,
    value: Math.round(metric.value),
    delta: Math.round(metric.delta),
    id: metric.id,
    url: window.location.href,
    timestamp: Date.now(),
    rating: getRating(metric),
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: performanceMetric.value,
      rating: performanceMetric.rating,
    })
  }

  // Send to analytics endpoint
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      '/api/analytics/vitals',
      JSON.stringify(performanceMetric)
    )
  } else {
    // Fallback for browsers that don't support sendBeacon
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body: JSON.stringify(performanceMetric),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently fail - we don't want to impact user experience
    })
  }
}

export function initWebVitals() {
  // Core Web Vitals
  onCLS(sendToAnalytics)
  onFID(sendToAnalytics)
  onLCP(sendToAnalytics)
  
  // Other metrics
  onFCP(sendToAnalytics)
  onTTFB(sendToAnalytics)
}

// Custom performance marks
export function measureCustomMetric(name: string, startMark: string, endMark: string) {
  try {
    performance.mark(endMark)
    performance.measure(name, startMark, endMark)
    
    const measure = performance.getEntriesByName(name)[0]
    if (measure) {
      sendToAnalytics({
        name,
        value: measure.duration,
        delta: measure.duration,
        id: `${name}-${Date.now()}`,
        entries: [],
        navigationType: 'navigate',
      } as Metric)
    }
  } catch (error) {
    // Performance API might not be available
    console.warn('Performance measurement failed:', error)
  }
}

// Utility to measure component render time
export function measureComponentRender(componentName: string) {
  const startMark = `${componentName}-render-start`
  const endMark = `${componentName}-render-end`
  
  performance.mark(startMark)
  
  return () => {
    measureCustomMetric(`${componentName}-render`, startMark, endMark)
  }
}