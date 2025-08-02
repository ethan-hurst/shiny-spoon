import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for performance metrics
const performanceMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  delta: z.number(),
  id: z.string(),
  url: z.string(),
  timestamp: z.number(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate the metric
    const metric = performanceMetricSchema.parse(body)
    
    // Get user session if available
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Store metric in database (optional - for analytics)
    if (process.env.ENABLE_VITALS_LOGGING === 'true') {
      await supabase.from('performance_metrics').insert({
        user_id: user?.id,
        metric_name: metric.name,
        metric_value: metric.value,
        metric_delta: metric.delta,
        metric_id: metric.id,
        page_url: metric.url,
        rating: metric.rating,
        created_at: new Date(metric.timestamp).toISOString(),
      })
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Web Vital:', {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        url: metric.url,
      })
    }
    
    // Send to external analytics service (optional)
    if (process.env.ANALYTICS_ENDPOINT) {
      await fetch(process.env.ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metric,
          source: 'web-vitals',
          environment: process.env.NODE_ENV,
        }),
      }).catch(() => {
        // Don't fail if analytics service is down
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Analytics] Error processing vital:', error)
    
    // Return success anyway - we don't want to impact the user
    return NextResponse.json({ success: true })
  }
}