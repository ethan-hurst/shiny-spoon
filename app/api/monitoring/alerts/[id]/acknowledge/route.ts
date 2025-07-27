// PRP-016: Data Accuracy Monitor - Alert Acknowledgment API
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'edge'

const requestSchema = z.object({
  note: z.string().optional(),
})

/**
 * Handles acknowledgment of an alert by an authenticated user.
 *
 * Validates the user's authentication and organization membership, ensures the alert exists and is active, and processes the acknowledgment using an atomic RPC call. Accepts an optional note in the request body. Returns a JSON response indicating success or error details.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify alert exists and belongs to organization
    const { data: alert } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', params.id)
      .eq('organization_id', orgUser.organization_id)
      .single()

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    if (alert.status !== 'active') {
      return NextResponse.json(
        { error: 'Alert is not active' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validatedData = requestSchema.parse(body)

    // Use RPC function for atomic alert acknowledgment
    const { data: result, error: rpcError } = await supabase
      .rpc('acknowledge_alert', {
        p_alert_id: params.id,
        p_organization_id: orgUser.organization_id,
        p_user_id: user.id,
        p_note: validatedData.note || null,
      })

    if (rpcError) {
      throw rpcError
    }

    return NextResponse.json({
      status: 'success',
      message: 'Alert acknowledged successfully',
      data: result,
    })
  } catch (error) {
    console.error('Alert acknowledgment API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to acknowledge alert' },
      { status: 500 }
    )
  }
}

/**
 * Retrieves detailed information about a specific alert, including related alert rules and discrepancies, for the authenticated user's organization.
 *
 * Returns a JSON response with the alert data on success, or an error message with the appropriate HTTP status code if the user is unauthorized, the organization or alert is not found, or an internal error occurs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgUser) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get alert with related data
    const { data: alert, error } = await supabase
      .from('alerts')
      .select(`
        *,
        alert_rules (
          id,
          name,
          entity_type,
          threshold_value,
          threshold_type
        ),
        discrepancies (
          id,
          entity_type,
          entity_id,
          field,
          source_value,
          target_value,
          severity
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', orgUser.organization_id)
      .single()

    if (error || !alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: 'success',
      data: alert,
    })
  } catch (error) {
    console.error('Get alert API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert' },
      { status: 500 }
    )
  }
}