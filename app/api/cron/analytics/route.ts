// PRP-018: Analytics Dashboard - Scheduled Analytics Job
import { subDays } from 'date-fns'
import { AnalyticsCalculator } from '@/lib/analytics/calculate-metrics'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const calculator = new AnalyticsCalculator(supabase)

    // Get all organizations
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)

    if (!organizations) {
      return new Response('No organizations found', { status: 200 })
    }

    // Calculate yesterday's metrics for each org
    const yesterday = subDays(new Date(), 1)
    const dateRange = {
      from: new Date(yesterday.setHours(0, 0, 0, 0)),
      to: new Date(yesterday.setHours(23, 59, 59, 999)),
    }

    for (const org of organizations) {
      try {
        const [orderAccuracy, syncPerformance] = await Promise.all([
          calculator.calculateOrderAccuracy(org.id, dateRange),
          calculator.calculateSyncPerformance(org.id, dateRange),
        ])

        if (orderAccuracy.length > 0) {
          await calculator.cacheMetrics(org.id, yesterday, {
            orderAccuracy: orderAccuracy[0],
            syncPerformance: syncPerformance[0],
          })
        }
      } catch (error) {
        console.error(`Failed to calculate metrics for org ${org.id}:`, error)
      }
    }

    return new Response('Analytics calculated successfully', { status: 200 })
  } catch (error) {
    console.error('Analytics cron error:', error)
    return new Response('Internal error', { status: 500 })
  }
}