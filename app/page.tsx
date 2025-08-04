import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Dashboard - TruthSource',
  description: 'Welcome to your TruthSource dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // This should not happen, as the middleware is now protecting this page.
    // However, as a safeguard, we'll redirect to login.
    return redirect('/login')
  }

  // Get user's organization.
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (profileError) {
    if (profileError.code === 'PGRST116') {
      // This is expected for new users whose profiles are not yet created.
      return redirect('/setup')
    }
    // For any other unexpected error, log it and redirect to login.
    console.error('Unexpected error fetching user profile:', profileError)
    return redirect('/login?error=profile_fetch_failed')
  }

  if (!profile) {
    // As a final fallback, if the profile is null for any other reason,
    // redirect to the setup page to be safe.
    return redirect('/setup')
  }

  return (
    <div className="container py-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome to TruthSource</h1>
        <p className="text-muted-foreground mt-2">
          Your B2B e-commerce data accuracy platform
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Quick Actions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get started with your data synchronization
          </p>
          <div className="space-y-2">
            <a
              href="/inventory"
              className="block text-sm text-blue-600 hover:text-blue-800"
            >
              → Manage Inventory
            </a>
            <a
              href="/pricing"
              className="block text-sm text-blue-600 hover:text-blue-800"
            >
              → Configure Pricing
            </a>
            <a
              href="/integrations"
              className="block text-sm text-blue-600 hover:text-blue-800"
            >
              → Set Up Integrations
            </a>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">System Status</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Monitor your data accuracy and sync health
          </p>
          <div className="space-y-2">
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>System Online</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>Data Sync Active</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Account Info</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your account details and organization
          </p>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Email:</span> {user.email}
            </div>
            <div>
              <span className="font-medium">Role:</span> {profile?.role || 'Member'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 