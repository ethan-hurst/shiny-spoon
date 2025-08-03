// PRP-014: Shopify Setup Wizard Page
import { redirect } from 'next/navigation'
import { ShopifySetupWizard } from '@/components/features/integrations/shopify/shopify-setup-wizard'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

/**
 * Displays the Shopify integration setup page for authenticated users, handling redirects based on authentication, user profile, and existing integration status.
 *
 * Authenticated users without a profile are redirected to onboarding. Users with an existing Shopify integration are redirected to the main integration page. If no integration exists, presents a setup wizard to guide the user through connecting their Shopify store.
 */
export default async function ShopifySetupPage() {
  const supabase = await createClient()

  // Get user and validate
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  if (profileError) {
    console.error('Error fetching user profile:', profileError)
    // Check if it's a "not found" error (no profile) vs actual database error
    if (profileError.code === 'PGRST116') {
      // No profile found - redirect to onboarding
      redirect('/onboarding')
    } else {
      // Actual database error - show error page
      throw new Error('Failed to fetch user profile')
    }
  }

  if (!profile) {
    redirect('/onboarding')
  }

  // Check if integration already exists
  const { data: existingIntegration, error: integrationError } = await supabase
    .from('integrations')
    .select('id')
    .eq('platform', 'shopify')
    .eq('organization_id', profile.organization_id)
    .single()

  if (integrationError && integrationError.code !== 'PGRST116') {
    // Database error (not just "not found")
    console.error('Error checking for existing integration:', integrationError)
    throw new Error('Failed to check existing integrations')
  }

  if (existingIntegration) {
    // Redirect to main integration page if already configured
    redirect(`/integrations/shopify?id=${existingIntegration.id}`)
  }

  return (
    <div className="container py-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Shopify Integration Setup</h1>
        <p className="text-muted-foreground mt-2">
          Follow this step-by-step guide to connect your Shopify store
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Let's Get Started</CardTitle>
          <CardDescription>
            We'll walk you through the process of setting up your Shopify
            integration. This typically takes 5-10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShopifySetupWizard organizationId={profile.organization_id} />
        </CardContent>
      </Card>
    </div>
  )
}
