import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInvoices } from '@/lib/billing'

/**
 * Handles GET requests to retrieve a paginated list of invoices for the authenticated user's organization.
 *
 * Authenticates the user, determines their organization, and returns a JSON response containing up to the specified limit of invoices and the total invoice count. Responds with appropriate error codes if authentication fails, the organization is not found, or an unexpected error occurs.
 *
 * @param request - The incoming Next.js request object containing query parameters
 * @returns A JSON response with the invoices and total count, or an error message with the appropriate HTTP status code
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
    
    const invoices = await getInvoices(profile.organization_id)

    return NextResponse.json({ 
      invoices: invoices.slice(0, limit),
      total: invoices.length 
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}