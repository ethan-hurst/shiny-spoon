import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { getSubscription } from '@/lib/billing'

export const GET = createRouteHandler(
  async ({ user }) => {
    const subscription = await getSubscription(user.organizationId)

    return NextResponse.json({ subscription })
  },
  {
    rateLimit: { requests: 100, window: '1m' }
  }
)