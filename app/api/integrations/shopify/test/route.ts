// PRP-014: Shopify Integration Test Endpoint
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { ShopifyAPIError } from '@/types/shopify.types'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  
  try {
    // Get user and validate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { shop_domain, access_token, webhook_secret } = body

    if (!shop_domain || !access_token) {
      return NextResponse.json(
        { error: 'Missing required fields: shop_domain, access_token' },
        { status: 400 }
      )
    }

    // Create test connector
    const connector = new ShopifyConnector({
      integrationId: 'test',
      organizationId: user.user_metadata.organization_id,
      credentials: {
        access_token,
        webhook_secret: webhook_secret || '',
      },
      settings: {
        shop_domain,
        access_token,
        api_version: '2024-01',
      },
    })

    // Test connection
    const connectionTest = await connector.testConnection()
    if (!connectionTest) {
      return NextResponse.json(
        { error: 'Failed to connect to Shopify' },
        { status: 400 }
      )
    }

    // Get shop information
    const shopInfo = await connector['auth'].getShopInfo()
    
    // Check B2B features
    const hasB2B = await connector['auth'].hasB2BFeatures()
    
    // Get locations
    const locations = await connector['auth'].getLocations()
    
    // Get API usage
    const apiUsage = await connector['auth'].getApiUsage()

    // Test basic API calls
    const testResults = {
      connection: true,
      shop_info: {
        name: shopInfo.name,
        domain: shopInfo.domain,
        email: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone,
        plan: shopInfo.plan?.displayName || 'Unknown',
      },
      b2b_features: hasB2B,
      locations: locations.map(loc => ({
        id: loc.id,
        name: loc.name,
        active: loc.active,
      })),
      api_usage: {
        current: apiUsage.current,
        limit: apiUsage.limit,
        remaining: apiUsage.remaining,
        reset_time: apiUsage.resetTime.toISOString(),
      },
      permissions: {
        read_products: true, // We can get shop info, so basic read works
        read_inventory: true,
        read_orders: true,
        read_customers: true,
      },
    }

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      data: testResults,
    })

  } catch (error) {
    console.error('Shopify connection test failed:', error)
    
    if (error instanceof ShopifyAPIError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Shopify integration test endpoint',
    usage: 'POST with shop_domain, access_token, and optional webhook_secret',
  })
}