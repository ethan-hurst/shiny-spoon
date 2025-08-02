import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAPIRateLimit } from '@/lib/rate-limit'
import { rateLimiters } from '@/lib/rate-limit'
import { APIKeyManager } from '@/lib/security/api-key-manager'

export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await withAPIRateLimit(request, rateLimiters.api)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      )
    }

    const supabase = createClient()
    const apiKeyManager = new APIKeyManager(supabase)

    // Get API keys for the current organization
    const apiKeys = await apiKeyManager.listAPIKeys('current')

    return NextResponse.json({
      data: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        expiresAt: key.expires_at,
        lastUsedAt: key.last_used_at,
        createdAt: key.created_at,
        isActive: key.is_active,
        rateLimit: key.rate_limit
      }))
    })

  } catch (error) {
    console.error('API Keys GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await withAPIRateLimit(request, rateLimiters.api)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      )
    }

    const supabase = createClient()
    const apiKeyManager = new APIKeyManager(supabase)
    const body = await request.json()

    // Validate required fields
    const { name, permissions } = body
    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, permissions' },
        { status: 400 }
      )
    }

    // Generate new API key
    const apiKey = await apiKeyManager.generateAPIKey({
      name,
      permissions,
      expiresAt: body.expiresAt,
      rateLimit: body.rateLimit || 1000
    })

    return NextResponse.json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key, // Only returned on creation
        permissions: apiKey.permissions,
        expiresAt: apiKey.expires_at,
        rateLimit: apiKey.rate_limit,
        createdAt: apiKey.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('API Keys POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 