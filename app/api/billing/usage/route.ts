import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsageStats } from '@/lib/billing'

/**
 * Handles GET requests to retrieve usage statistics for the authenticated user's organization.
 *
 * Returns a JSON response containing usage statistics if the user is authenticated and associated with an organization. Responds with appropriate error messages and status codes for unauthorized access, missing organization, or server errors.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const usage = await getUsageStats(profile.organization_id)

    return NextResponse.json({ usage })
  } catch (error) {
    console.error('Error fetching usage stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage statistics' },
      { status: 500 }
    )
  }
}