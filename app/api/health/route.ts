import { NextResponse } from 'next/server'
import { createPublicRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

const querySchema = z.object({
  detailed: z.enum(['true', 'false']).optional()
})

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

export const GET = createPublicRouteHandler(
  async ({ query }) => {
    const detailed = query?.detailed === 'true'
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      ...(detailed && { 
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV
      })
    }
    
    return NextResponse.json(health)
  },
  {
    schema: { query: querySchema },
    rateLimit: { requests: 100, window: '1m' }
  }
)
