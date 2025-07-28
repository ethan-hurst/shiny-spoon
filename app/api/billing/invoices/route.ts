import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { getInvoices } from '@/lib/billing'
import { z } from 'zod'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10)
})

export const GET = createRouteHandler(
  async ({ user, query }) => {
    const invoices = await getInvoices(user.organizationId)

    return NextResponse.json({ 
      invoices: invoices.slice(0, query.limit),
      total: invoices.length 
    })
  },
  {
    schema: { query: querySchema },
    rateLimit: { requests: 50, window: '1m' }
  }
)