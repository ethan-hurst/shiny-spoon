'use client'

// PRP-014: Shopify Configuration Form Component
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { createBrowserClient } from '@/lib/supabase/client'
import type { ShopifyConfigFormData } from '@/types/shopify.types'

const formSchema = z.object({
  shop_domain: z.string()
    .min(1, 'Shop domain is required')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/,
      'Must be a valid Shopify domain (e.g., mystore.myshopify.com)'
    ),
  access_token: z.string().min(1, 'Access token is required'),
  webhook_secret: z.string().min(1, 'Webhook secret is required'),
  sync_products: z.boolean().default(true),
  sync_inventory: z.boolean().default(true),
  sync_orders: z.boolean().default(true),
  sync_customers: z.boolean().default(true),
  b2b_catalog_enabled: z.boolean().default(false),
  sync_frequency: z.number().min(5).max(1440).default(15)
})

interface ShopifyConfigFormProps {
  integrationId?: string
  organizationId: string
  initialData?: ShopifyConfigFormData
  onSuccess?: (integrationId: string) => void
}

/**
 * Renders a form for configuring a Shopify integration, supporting both creation and update modes.
 *
 * The form allows users to enter Shopify credentials, set sync options, enable B2B catalog features (if available), and specify sync frequency. It validates input, handles form submission to create or update integration records in the backend, and provides a "Test Connection" feature to verify Shopify credentials and detect Shopify Plus status. Success and error notifications are displayed as appropriate. On successful creation, an optional callback is invoked or the user is redirected to the integration detail page.
 *
 * @param integrationId - Optional ID of an existing integration to update; if omitted, a new integration is created.
 * @param organizationId - The ID of the organization for which the integration is being configured.
 * @param initialData - Optional initial values to prefill the form fields.
 * @param onSuccess - Optional callback invoked with the integration ID after successful creation.
 * @returns A React component rendering the Shopify configuration form.
 */
export function ShopifyConfigForm({
  integrationId,
  organizationId,
  initialData,
  onSuccess
}: ShopifyConfigFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [isShopifyPlus, setIsShopifyPlus] = useState<boolean | null>(null)
  const supabase = createBrowserClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      shop_domain: '',
      access_token: '',
      webhook_secret: '',
      sync_products: true,
      sync_inventory: true,
      sync_orders: true,
      sync_customers: true,
      b2b_catalog_enabled: false,
      sync_frequency: 15
    }
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      if (integrationId) {
        // Update existing integration
        const { error: integrationError } = await supabase
          .from('integrations')
          .update({
            config: {
              sync_frequency: values.sync_frequency,
              api_version: '2024-01'
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', integrationId)

        if (integrationError) throw integrationError

        // Update Shopify config
        const { error: configError } = await supabase
          .from('shopify_config')
          .update({
            shop_domain: values.shop_domain,
            sync_products: values.sync_products,
            sync_inventory: values.sync_inventory,
            sync_orders: values.sync_orders,
            sync_customers: values.sync_customers,
            b2b_catalog_enabled: values.b2b_catalog_enabled,
            updated_at: new Date().toISOString()
          })
          .eq('integration_id', integrationId)

        if (configError) throw configError

        // Update credentials if provided
        if (values.access_token || values.webhook_secret) {
          const updateCredentials: Record<string, string> = {}
          
          // Only include fields with actual values
          if (values.access_token) {
            updateCredentials.access_token = values.access_token
          }
          if (values.webhook_secret) {
            updateCredentials.webhook_secret = values.webhook_secret
          }
          
          // Only update if there are fields to update
          if (Object.keys(updateCredentials).length > 0) {
            const { error: credError } = await supabase
              .from('integration_credentials')
              .update({
                credentials: updateCredentials,
                updated_at: new Date().toISOString()
              })
              .eq('integration_id', integrationId)

            if (credError) throw credError
          }
        }

        toast({
          title: 'Configuration updated',
          description: 'Your Shopify integration has been updated successfully.'
        })
      } else {
        // Create new integration
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .insert({
            organization_id: organizationId,
            platform: 'shopify',
            name: `Shopify - ${values.shop_domain}`,
            status: 'configuring',
            config: {
              sync_frequency: values.sync_frequency,
              api_version: '2024-01'
            }
          })
          .select()
          .single()

        if (integrationError) throw integrationError

        // Create Shopify config
        const { error: configError } = await supabase
          .from('shopify_config')
          .insert({
            integration_id: integration.id,
            shop_domain: values.shop_domain,
            sync_products: values.sync_products,
            sync_inventory: values.sync_inventory,
            sync_orders: values.sync_orders,
            sync_customers: values.sync_customers,
            b2b_catalog_enabled: values.b2b_catalog_enabled
          })

        if (configError) throw configError

        // Store credentials
        const { error: credError } = await supabase
          .from('integration_credentials')
          .insert({
            integration_id: integration.id,
            credential_type: 'api_key',
            credentials: {
              access_token: values.access_token,
              webhook_secret: values.webhook_secret
            }
          })

        if (credError) throw credError

        toast({
          title: 'Integration created',
          description: 'Your Shopify integration has been created successfully.'
        })

        // Call onSuccess callback if provided, otherwise redirect
        if (onSuccess) {
          onSuccess(integration.id)
        } else {
          router.push(`/integrations/shopify?id=${integration.id}`)
        }
      } else {
        // Only refresh if we're updating existing integration
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
      toast({
        title: 'Error',
        description: 'Failed to save configuration. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function testConnection() {
    const values = form.getValues()
    if (!values.shop_domain || !values.access_token) {
      toast({
        title: 'Missing credentials',
        description: 'Please enter shop domain and access token first.',
        variant: 'destructive'
      })
      return
    }

    setTestingConnection(true)

    try {
      // Test the connection by making a simple API call with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch('/api/integrations/shopify/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop_domain: values.shop_domain,
          access_token: values.access_token
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      const result = await response.json()

      if (response.ok && result.success) {
        // Check if store is Shopify Plus
        if (result.plan) {
          setIsShopifyPlus(result.plan === 'shopify_plus' || result.plan === 'plus')
        }
        
        toast({
          title: 'Connection successful',
          description: `Connected to ${result.shop_name}`
        })
      } else {
        throw new Error(result.error || 'Connection failed')
      }
    } catch (error) {
      let errorMessage = 'Failed to connect to Shopify'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout - please try again'
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: 'Connection failed',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="shop_domain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shop Domain</FormLabel>
                <FormControl>
                  <Input
                    placeholder="mystore.myshopify.com"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Your Shopify store domain (must end with .myshopify.com)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="access_token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admin API Access Token</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showAccessToken ? 'text' : 'password'}
                      placeholder={integrationId ? 'Leave blank to keep existing' : 'shpat_...'}
                      {...field}
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                    >
                      {showAccessToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>
                  The access token from your Shopify custom app
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="webhook_secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Webhook Signing Secret</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showWebhookSecret ? 'text' : 'password'}
                      placeholder={integrationId ? 'Leave blank to keep existing' : 'Enter webhook secret'}
                      {...field}
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    >
                      {showWebhookSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>
                  Used to verify webhook authenticity
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sync_frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sync Frequency (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    {...field}
                    onChange={e => field.onChange(parseInt(e.target.value))}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  How often to sync data (5-1440 minutes)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Sync Options</h3>
          
          <FormField
            control={form.control}
            name="sync_products"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Sync Products</FormLabel>
                  <FormDescription>
                    Import and sync product catalog
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sync_inventory"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Sync Inventory</FormLabel>
                  <FormDescription>
                    Real-time inventory level updates
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sync_orders"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Sync Orders</FormLabel>
                  <FormDescription>
                    Import orders for reporting
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sync_customers"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Sync Customers</FormLabel>
                  <FormDescription>
                    Import customer data
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="b2b_catalog_enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>B2B Catalogs</FormLabel>
                  <FormDescription>
                    Enable B2B catalog and pricing features (Shopify Plus only)
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading || (isShopifyPlus === false)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {form.watch('b2b_catalog_enabled') && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              B2B features require a Shopify Plus plan. Ensure your store has the necessary features enabled.
            </AlertDescription>
          </Alert>
        )}
        
        {isShopifyPlus === false && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your store is not on a Shopify Plus plan. B2B catalog features are disabled.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {integrationId ? 'Update Configuration' : 'Create Integration'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={testingConnection || isLoading}
          >
            {testingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
        </div>
      </form>
    </Form>
  )
}