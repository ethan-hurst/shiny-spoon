import { NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  billing_email: z.string().email().optional(),
  tax_id: z.string().max(50).optional(),
  billing_address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postal_code: z.string().min(1),
    country: z.string().min(1),
  }).optional(),
})

export const GET = createRouteHandler(
  async ({ user }) => {
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    return NextResponse.json({ organization: profile.organizations })
  },
  {
    rateLimit: { requests: 50, window: '1m' }
  }
)

export const PATCH = createRouteHandler(
  async ({ user, body }) => {
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.organization_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ organization: data })
  },
  {
    schema: { body: updateOrgSchema },
    rateLimit: { 
      requests: 10, 
      window: '1m',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)