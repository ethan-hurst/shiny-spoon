// PRP-016: Data Accuracy Monitor - Alert Acknowledgment API
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'edge'

const requestSchema = z.object({
  note: z.string().optional(),
})

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
      .select('organization_id, user_id')
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

    // Update alert status
    const { error: updateError } = await supabase
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: orgUser.user_id,
        acknowledgment_note: validatedData.note,
      })
      .eq('id', params.id)

    if (updateError) {
      throw updateError
    }

    // Log the acknowledgment
    await supabase.from('audit_logs').insert({
      organization_id: orgUser.organization_id,
      user_id: orgUser.user_id,
      action: 'alert.acknowledged',
      resource_type: 'alert',
      resource_id: params.id,
      details: {
        alert_type: alert.alert_type,
        severity: alert.severity,
        note: validatedData.note,
      },
    })

    return NextResponse.json({
      status: 'success',
      message: 'Alert acknowledged successfully',
      data: {
        alertId: params.id,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: orgUser.user_id,
      },
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

// Get alert details
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