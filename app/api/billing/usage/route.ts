import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { getUsageStats } from '@/lib/billing'

export const GET = createRouteHandler(
  async ({ user }) => {
    const usage = await getUsageStats(user.organizationId)

    return NextResponse.json({ usage })
  },
  {
    rateLimit: { requests: 100, window: '1m' }
  }
)