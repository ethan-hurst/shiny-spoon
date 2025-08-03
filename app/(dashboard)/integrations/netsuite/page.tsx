// PRP-013: NetSuite Integration Configuration Page
import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  Key,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { NetSuiteConfigForm } from '@/components/features/integrations/netsuite/netsuite-config-form'
import { NetSuiteFieldMappings } from '@/components/features/integrations/netsuite/netsuite-field-mappings'
import { NetSuiteSyncSettings } from '@/components/features/integrations/netsuite/netsuite-sync-settings'
import { NetSuiteSyncStatus } from '@/components/features/integrations/netsuite/netsuite-sync-status'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/server'
import { testConnection } from '@/app/actions/integrations'

export const metadata: Metadata = {
  title: 'NetSuite Integration | TruthSource',
  description: 'Configure and manage your NetSuite integration',
}

interface PageProps {
  searchParams: {
    id?: string
  }
}

export default async function NetSuiteIntegrationPage({
  searchParams,
}: PageProps) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  // Get or check for existing NetSuite integration
  let integration = null
  let netsuiteConfig = null

  if (searchParams.id) {
    // Get specific integration
    const { data } = await supabase
      .from('integrations')
      .select(
        `
        *,
        netsuite_config (*)
      `
      )
      .eq('id', searchParams.id)
      .eq('organization_id', profile.organization_id)
      .eq('platform', 'netsuite')
      .single()

    integration = data
    if (integration) {
      netsuiteConfig = integration.netsuite_config?.[0]
    }
  } else {
    // Check for existing NetSuite integration
    const { data } = await supabase
      .from('integrations')
      .select(
        `
        *,
        netsuite_config (*)
      `
      )
      .eq('organization_id', profile.organization_id)
      .eq('platform', 'netsuite')
      .single()

    if (data) {
      integration = data
      netsuiteConfig = data.netsuite_config?.[0]
    }
  }

  const isConfigured = integration && integration.status === 'active'
  const hasCredentials = integration && integration.credential_type !== null

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NetSuite Integration</h1>
          <p className="text-muted-foreground mt-1">
            Connect your NetSuite ERP to sync products, inventory, and pricing
            data
          </p>
        </div>
        {integration && (
          <div className="flex items-center gap-2">
            <Badge
              variant={
                integration.status === 'active' ? 'default' : 'secondary'
              }
            >
              {integration.status}
            </Badge>
            {isConfigured && (
              <form
                action={async () => {
                  'use server'
                  await testConnection(integration.id)
                }}
              >
                <Button variant="outline" size="sm">
                  <Activity className="mr-2 h-4 w-4" />
                  Test Connection
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {!integration ? (
        // Initial setup view
        <Card>
          <CardHeader>
            <CardTitle>Get Started with NetSuite</CardTitle>
            <CardDescription>
              Set up your NetSuite integration to automatically sync inventory
              and pricing data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Real-time Inventory Sync</h3>
                  <p className="text-sm text-muted-foreground">
                    Keep inventory levels synchronized across all locations
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Automated Price Updates</h3>
                  <p className="text-sm text-muted-foreground">
                    Sync price levels and customer-specific pricing
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Product Catalog Sync</h3>
                  <p className="text-sm text-muted-foreground">
                    Import and update product information automatically
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Prerequisites</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>NetSuite account with REST Web Services enabled</li>
                  <li>OAuth 2.0 Integration Record created in NetSuite</li>
                  <li>Administrator or Integration role permissions</li>
                </ul>
              </AlertDescription>
            </Alert>

            <NetSuiteConfigForm organizationId={profile.organization_id} />
          </CardContent>
        </Card>
      ) : (
        // Configuration management view
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config">
              <Settings className="mr-2 h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="sync">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Settings
            </TabsTrigger>
            <TabsTrigger value="mappings">
              <Database className="mr-2 h-4 w-4" />
              Field Mappings
            </TabsTrigger>
            <TabsTrigger value="status">
              <Activity className="mr-2 h-4 w-4" />
              Sync Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>NetSuite Connection</CardTitle>
                <CardDescription>
                  Manage your NetSuite account connection and authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Account ID
                    </p>
                    <p className="text-sm font-mono">
                      {netsuiteConfig?.account_id || 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Data Center
                    </p>
                    <p className="text-sm">
                      {netsuiteConfig?.datacenter_url || 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Authentication
                    </p>
                    <div className="flex items-center gap-2">
                      {hasCredentials ? (
                        <>
                          <Badge variant="outline" className="text-green-600">
                            <Key className="mr-1 h-3 w-3" />
                            OAuth 2.0 Connected
                          </Badge>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-orange-600">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Not Authenticated
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Last Updated
                    </p>
                    <p className="text-sm">
                      {new Date(integration.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {!hasCredentials && (
                  <Alert className="mt-4">
                    <Key className="h-4 w-4" />
                    <AlertTitle>Authentication Required</AlertTitle>
                    <AlertDescription>
                      Connect your NetSuite account using OAuth 2.0 to start
                      syncing data.
                      <Link
                        href={`/api/integrations/netsuite/auth?integration_id=${integration.id}`}
                      >
                        <Button variant="default" size="sm" className="mt-2">
                          Connect NetSuite Account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}

                <NetSuiteConfigForm
                  organizationId={profile.organization_id}
                  integration={integration}
                  config={netsuiteConfig}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <NetSuiteSyncSettings
              integrationId={integration.id}
              config={netsuiteConfig}
            />
          </TabsContent>

          <TabsContent value="mappings" className="space-y-4">
            <NetSuiteFieldMappings
              integrationId={integration.id}
              mappings={netsuiteConfig?.field_mappings || {}}
            />
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <NetSuiteSyncStatus integrationId={integration.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
