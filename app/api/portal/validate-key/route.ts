import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Extract key prefix for lookup
    const keyPrefix = apiKey.substring(0, 12)

    // Hash the full key for comparison
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

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
    if (
      apiKeyRecord.expires_at &&
      new Date(apiKeyRecord.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { valid: false, reason: 'expired' },
        { status: 401 }
      )
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
  } catch (error) {
    console.error('Error validating API key:', error)
    return NextResponse.json(
      { error: 'Failed to validate API key' },
      { status: 500 }
    )
  }
}
