// PRP-014: Shopify Integration Configuration Page
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, CheckCircle, ExternalLink, XCircle } from 'lucide-react'
import { ShopifyConfigForm } from '@/components/features/integrations/shopify/shopify-config-form'
import { ShopifySyncSettingsForm } from '@/components/features/integrations/shopify/shopify-sync-settings'
import { ShopifySyncStatus } from '@/components/features/integrations/shopify/shopify-sync-status'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: {
    id?: string
  }
}

/**
 * Renders the Shopify Integration configuration page, handling authentication, organization lookup, and integration setup for the current user.
 *
 * Redirects unauthenticated users to the login page and users without a profile to onboarding. Fetches the user's organization and attempts to load an existing Shopify integration, either by ID from the query string or by organization. Displays setup instructions if no integration exists, and renders forms and controls for configuring, updating, and managing the Shopify integration, including sync settings, status, and helpful resources.
 */
export default async function ShopifyIntegrationPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient()

  // Get user and validate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('Authentication error:', authError)
    redirect('/login')
  }
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
    redirect('/login')
  }

  if (!profile) {
    redirect('/onboarding')
  }

  // Check if integration exists
  let integration = null
  if (searchParams.id) {
    const { data, error } = await supabase
      .from('integrations')
      .select(
        `
        *,
        shopify_config(*)
      `
      )
      .eq('id', searchParams.id)
      .eq('organization_id', profile.organization_id)
      .single()

    if (error) {
      console.error('Error fetching integration:', error)
      // Continue with null integration - form will handle new integration
    } else {
      integration = data
    }
  } else {
    // Try to find existing Shopify integration
    const { data, error } = await supabase
      .from('integrations')
      .select(
        `
        *,
        shopify_config(*)
      `
      )
      .eq('platform', 'shopify')
      .eq('organization_id', profile.organization_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      console.error('Error fetching Shopify integration:', error)
    }

    integration = data
  }

  const isConfigured = !!integration

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shopify Integration</h1>
          <p className="text-muted-foreground mt-2">
            Connect your Shopify store to sync products, inventory, and customer
            pricing
          </p>
        </div>
        {integration && (
          <Badge
            variant={integration.status === 'active' ? 'default' : 'secondary'}
          >
            {integration.status}
          </Badge>
        )}
      </div>

      {/* Setup Instructions */}
      {!isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started with Shopify</CardTitle>
            <CardDescription>
              Follow these steps to connect your Shopify store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-medium">1. Create a Custom App in Shopify</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Go to your Shopify admin panel</li>
                <li>Navigate to Settings → Apps and sales channels</li>
                <li>Click &quot;Develop apps&quot;</li>
                <li>
                  Create a new app with a descriptive name (e.g.,
                  &quot;TruthSource Integration&quot;)
                </li>
              </ol>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">2. Configure API Permissions</h3>
              <p className="text-sm text-muted-foreground">
                Grant the following scopes to your app:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Badge variant="outline">read_products</Badge>
                <Badge variant="outline">write_products</Badge>
                <Badge variant="outline">read_inventory</Badge>
                <Badge variant="outline">write_inventory</Badge>
                <Badge variant="outline">read_orders</Badge>
                <Badge variant="outline">read_customers</Badge>
                <Badge variant="outline">read_price_rules</Badge>
                <Badge variant="outline">write_price_rules</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">3. Configure Webhooks</h3>
              <p className="text-sm text-muted-foreground">
                Add the following webhook URL to your app:
              </p>
              <code className="block p-3 bg-muted rounded text-xs">
                {process.env.NEXT_PUBLIC_URL
                  ? `${process.env.NEXT_PUBLIC_URL}/api/webhooks/shopify`
                  : '[NEXT_PUBLIC_URL not configured]/api/webhooks/shopify'}
              </code>
              {!process.env.NEXT_PUBLIC_URL && (
                <p className="text-sm text-destructive mt-2">
                  Warning: NEXT_PUBLIC_URL environment variable is not set.
                  Please configure it in your deployment settings.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">4. Get Your Credentials</h3>
              <p className="text-sm text-muted-foreground">
                After creating the app, you&apos;ll need:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li>Admin API access token</li>
                <li>Webhook signing secret</li>
                <li>Your shop domain (e.g., mystore.myshopify.com)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isConfigured
              ? 'Update Configuration'
              : 'Configure Shopify Connection'}
          </CardTitle>
          <CardDescription>
            {isConfigured
              ? 'Update your Shopify store settings and credentials'
              : 'Enter your Shopify store details to establish connection'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShopifyConfigForm
            integrationId={integration?.id}
            organizationId={profile.organization_id}
            initialData={
              integration && integration.shopify_config?.length > 0
                ? {
                    shop_domain: integration.shopify_config[0].shop_domain,
                    access_token: '', // Don't pre-fill sensitive data
                    webhook_secret: '', // Don't pre-fill sensitive data
                    sync_products: integration.shopify_config[0].sync_products,
                    sync_inventory:
                      integration.shopify_config[0].sync_inventory,
                    sync_orders: integration.shopify_config[0].sync_orders,
                    sync_customers:
                      integration.shopify_config[0].sync_customers,
                    b2b_catalog_enabled:
                      integration.shopify_config[0].b2b_catalog_enabled,
                    sync_frequency: integration.config?.sync_frequency || 15,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>

      {/* Sync Settings */}
      {integration && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure what data to sync and how often
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShopifySyncSettingsForm
                integrationId={integration.id}
                config={integration.shopify_config?.[0] || {}}
                syncSettings={integration.config}
              />
            </CardContent>
          </Card>

          {/* Sync Status */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Status</CardTitle>
              <CardDescription>
                Current synchronization status for each data type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShopifySyncStatus integrationId={integration.id} />
            </CardContent>
          </Card>

          {/* Additional Resources */}
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>Helpful links and documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Link
                  href="/integrations/shopify/test"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <CheckCircle className="h-4 w-4" />
                  Test Connection
                </Link>
                <a
                  href="https://shopify.dev/docs/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  Shopify API Documentation
                </a>
                <Link
                  href="/integrations"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <AlertCircle className="h-4 w-4" />
                  View All Integrations
                </Link>
                <Link
                  href="/support"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="h-4 w-4" />
                  Get Support
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
