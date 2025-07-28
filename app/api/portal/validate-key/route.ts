import { NextResponse } from 'next/server'
import { createPublicRouteHandler } from '@/lib/api/route-handler'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import crypto from 'crypto'

const validateKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

export const POST = createPublicRouteHandler(
  async ({ body }) => {
    // Extract key prefix for lookup
    const keyPrefix = body.apiKey.substring(0, 12)
    
    // Hash the full key for comparison
    const keyHash = crypto.createHash('sha256').update(body.apiKey).digest('hex')

    // Find the API key
    const { data: apiKeyRecord } = await supabaseAdmin
      .from('api_keys')
      .select('*, organizations(name)')
      .eq('key_prefix', keyPrefix)
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (!apiKeyRecord) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    // Check if key is expired
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, reason: 'expired' }, { status: 401 })
    }

    // Update last used timestamp
    await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyRecord.id)

    return NextResponse.json({
      valid: true,
      permissions: apiKeyRecord.permissions,
      organization: {
        id: apiKeyRecord.organization_id,
        name: apiKeyRecord.organizations?.name,
      },
    })
  },
  {
    schema: { body: validateKeySchema },
    rateLimit: { 
      requests: 60, 
      window: '1m',
      identifier: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                            req.headers.get('x-real-ip') || 
                            'anonymous'
    }
  }
)