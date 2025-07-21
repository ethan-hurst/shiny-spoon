import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PriceCalculationRequest {
  product_id: string
  customer_id?: string
  quantity?: number
  requested_date?: string
}

interface PriceCalculationResponse {
  base_price: number
  final_price: number
  discount_amount: number
  discount_percent: number
  margin_percent: number
  applied_rules: AppliedRule[]
  calculated_at: string
}

interface AppliedRule {
  rule_id?: string
  type: string
  name?: string
  description?: string
  discount_type?: string
  discount_value?: number
  discount_amount: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for server-side operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const body: PriceCalculationRequest = await req.json()
    
    // Validate required fields
    if (!body.product_id) {
      return new Response(
        JSON.stringify({ error: 'product_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify product belongs to user's organization
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, organization_id')
      .eq('id', body.product_id)
      .single()

    if (productError || !product || product.organization_id !== profile.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Product not found or access denied' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If customer_id provided, verify it belongs to the organization
    if (body.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, organization_id')
        .eq('id', body.customer_id)
        .single()

      if (customerError || !customer || customer.organization_id !== profile.organization_id) {
        return new Response(
          JSON.stringify({ error: 'Customer not found or access denied' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Call the database function to calculate price
    const { data: result, error: calcError } = await supabase.rpc('calculate_product_price', {
      p_product_id: body.product_id,
      p_customer_id: body.customer_id || null,
      p_quantity: body.quantity || 1,
      p_requested_date: body.requested_date || new Date().toISOString().split('T')[0],
    })

    if (calcError) {
      console.error('Price calculation error:', calcError)
      return new Response(
        JSON.stringify({ error: 'Failed to calculate price' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!result || result.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No pricing data available' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Format the response
    const priceData = result[0]
    const response: PriceCalculationResponse = {
      base_price: parseFloat(priceData.base_price),
      final_price: parseFloat(priceData.final_price),
      discount_amount: parseFloat(priceData.discount_amount),
      discount_percent: parseFloat(priceData.discount_percent),
      margin_percent: parseFloat(priceData.margin_percent),
      applied_rules: priceData.applied_rules || [],
      calculated_at: new Date().toISOString(),
    }

    // Log the calculation for analytics
    await supabase.from('price_calculations').insert({
      organization_id: profile.organization_id,
      product_id: body.product_id,
      customer_id: body.customer_id,
      quantity: body.quantity || 1,
      requested_by: user.id,
      base_price: response.base_price,
      final_price: response.final_price,
      total_discount: response.discount_amount,
      discount_percent: response.discount_percent,
      margin_percent: response.margin_percent,
      applied_rules: response.applied_rules,
      calculation_details: {
        request: body,
        response,
        user_id: user.id,
      },
    })

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})