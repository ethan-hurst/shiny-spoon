// PRP-014: Shopify Setup Wizard Page
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShopifySetupWizard } from '@/components/features/integrations/shopify/shopify-setup-wizard'

export default async function ShopifySetupPage() {
  const supabase = await createClient()
  
  // Get user and validate
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

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