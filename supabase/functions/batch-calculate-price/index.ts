/// <reference path="../types/deno.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface BatchPriceRequest {
  product_id: string
  customer_id?: string
  quantity?: number
}

interface BatchPriceCalculationRequest {
  requests: BatchPriceRequest[]
  requested_date?: string
}

interface PriceResult {
  product_id: string
  base_price: number
  final_price: number
  discount_amount: number
  discount_percent: number
  margin_percent: number
  applied_rules: any[]
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body: BatchPriceCalculationRequest = await req.json()

    // Validate request
    if (
      !body.requests ||
      !Array.isArray(body.requests) ||
      body.requests.length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: 'requests array is required and must not be empty',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (body.requests.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 requests allowed per batch' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get all unique product IDs and customer IDs
    const productIds = [...new Set(body.requests.map((r) => r.product_id))]
    const customerIds = [
      ...new Set(
        body.requests.filter((r) => r.customer_id).map((r) => r.customer_id!)
      ),
    ]

    // Verify all products belong to organization
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('organization_id', profile.organization_id)

    const validProductIds = new Set(products?.map((p) => p.id) || [])

    // Verify all customers belong to organization
    let validCustomerIds = new Set<string>()
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .in('id', customerIds)
        .eq('organization_id', profile.organization_id)

      validCustomerIds = new Set(customers?.map((c) => c.id) || [])
    }

    // Calculate prices for each request
    const results: PriceResult[] = await Promise.all(
      body.requests.map(async (request) => {
        try {
          // Validate product
          if (!validProductIds.has(request.product_id)) {
            return {
              product_id: request.product_id,
              base_price: 0,
              final_price: 0,
              discount_amount: 0,
              discount_percent: 0,
              margin_percent: 0,
              applied_rules: [],
              error: 'Product not found or access denied',
            }
          }

          // Validate customer if provided
          if (
            request.customer_id &&
            !validCustomerIds.has(request.customer_id)
          ) {
            return {
              product_id: request.product_id,
              base_price: 0,
              final_price: 0,
              discount_amount: 0,
              discount_percent: 0,
              margin_percent: 0,
              applied_rules: [],
              error: 'Customer not found or access denied',
            }
          }

          // Calculate price
          const { data: result, error: calcError } = await supabase.rpc(
            'calculate_product_price',
            {
              p_product_id: request.product_id,
              p_customer_id: request.customer_id || null,
              p_quantity: request.quantity || 1,
              p_requested_date:
                body.requested_date || new Date().toISOString().split('T')[0],
            }
          )

          if (calcError || !result || result.length === 0) {
            return {
              product_id: request.product_id,
              base_price: 0,
              final_price: 0,
              discount_amount: 0,
              discount_percent: 0,
              margin_percent: 0,
              applied_rules: [],
              error: 'Failed to calculate price',
            }
          }

          const priceData = result[0]
          return {
            product_id: request.product_id,
            base_price: parseFloat(priceData.base_price),
            final_price: parseFloat(priceData.final_price),
            discount_amount: parseFloat(priceData.discount_amount),
            discount_percent: parseFloat(priceData.discount_percent),
            margin_percent: parseFloat(priceData.margin_percent),
            applied_rules: priceData.applied_rules || [],
          }
        } catch (error) {
          console.error(
            'Error calculating price for product:',
            request.product_id,
            error
          )
          return {
            product_id: request.product_id,
            base_price: 0,
            final_price: 0,
            discount_amount: 0,
            discount_percent: 0,
            margin_percent: 0,
            applied_rules: [],
            error: 'Internal error',
          }
        }
      })
    )

    // Log batch calculation
    const successfulResults = results.filter((r) => !r.error)
    if (successfulResults.length > 0) {
      await supabase.from('price_calculations').insert(
        successfulResults.map((result) => ({
          organization_id: profile.organization_id,
          product_id: result.product_id,
          customer_id: body.requests.find(
            (r) => r.product_id === result.product_id
          )?.customer_id,
          quantity:
            body.requests.find((r) => r.product_id === result.product_id)
              ?.quantity || 1,
          requested_by: user.id,
          base_price: result.base_price,
          final_price: result.final_price,
          total_discount: result.discount_amount,
          discount_percent: result.discount_percent,
          margin_percent: result.margin_percent,
          applied_rules: result.applied_rules,
          calculation_details: {
            batch: true,
            total_requests: body.requests.length,
          },
        }))
      )
    }

    return new Response(
      JSON.stringify({
        results,
        calculated_at: new Date().toISOString(),
        total: results.length,
        successful: successfulResults.length,
        failed: results.length - successfulResults.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Batch calculation error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
