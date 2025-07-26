// PRP-014: Shopify Setup Wizard Page
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShopifySetupWizard } from '@/components/features/integrations/shopify/shopify-setup-wizard'

/**
 * Renders the Shopify integration setup page, guiding authenticated users through connecting their Shopify store.
 *
 * Redirects to the login page if the user is not authenticated, to onboarding if the user profile or organization is missing, or to the main Shopify integration page if an integration already exists. Otherwise, displays a setup wizard for new Shopify integrations.
 */
export default async function ShopifySetupPage() {
  const supabase = await createClient()
  
  // Get user and validate
  const { data: { user } } = await supabase.auth.getUser()
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
    redirect('/onboarding')
  }

  if (!profile) {
    redirect('/onboarding')
  }

  // Check if integration already exists
  const { data: existingIntegration } = await supabase
    .from('integrations')
    .select('id')
    .eq('platform', 'shopify')
    .eq('organization_id', profile.organization_id)
    .single()

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
            We'll walk you through the process of setting up your Shopify integration.
            This typically takes 5-10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShopifySetupWizard organizationId={profile.organization_id} />
        </CardContent>
      </Card>
    </div>
  )
}