'use client'

// PRP-014: Shopify Configuration Form Component
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
 * Creates a new Shopify integration with configuration and credentials in the database.
 *
 * Inserts a new integration record, associated Shopify configuration, and credentials for the specified organization. Throws an error if any insertion fails.
 *
 * @param data - Contains the organization ID and validated form values for the integration
 * @returns The created integration record
 */
async function createIntegration(
  supabase: ReturnType<typeof createBrowserClient>,
  data: {
    organizationId: string
    values: z.infer<typeof formSchema>
  }
) {
  // Create new integration
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .insert({
      organization_id: data.organizationId,
      platform: 'shopify',
      name: `Shopify - ${data.values.shop_domain}`,
      status: 'configuring',
      config: {
        sync_frequency: data.values.sync_frequency,
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
      shop_domain: data.values.shop_domain,
      sync_products: data.values.sync_products,
      sync_inventory: data.values.sync_inventory,
      sync_orders: data.values.sync_orders,
      sync_customers: data.values.sync_customers,
      b2b_catalog_enabled: data.values.b2b_catalog_enabled
    })

  if (configError) throw configError

  // Store credentials
  const { error: credError } = await supabase
    .from('integration_credentials')
    .insert({
      integration_id: integration.id,
      credential_type: 'api_key',
      credentials: {
        access_token: data.values.access_token,
        webhook_secret: data.values.webhook_secret
      }
    })

  if (credError) throw credError

  return integration
}

/**
 * Updates an existing Shopify integration's configuration, Shopify-specific settings, and credentials in the database.
 *
 * Throws an error if any update operation fails.
 *
 * @param data - Contains the integration ID and updated form values for the integration.
 * @returns An object containing the updated integration's ID.
 */
async function updateIntegration(
  supabase: ReturnType<typeof createBrowserClient>,
  data: {
    integrationId: string
    values: z.infer<typeof formSchema>
  }
) {
  // Update existing integration
  const { error: integrationError } = await supabase
    .from('integrations')
    .update({
      config: {
        sync_frequency: data.values.sync_frequency,
        api_version: '2024-01'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', data.integrationId)

  if (integrationError) throw integrationError

  // Update Shopify config
  const { error: configError } = await supabase
    .from('shopify_config')
    .update({
      shop_domain: data.values.shop_domain,
      sync_products: data.values.sync_products,
      sync_inventory: data.values.sync_inventory,
      sync_orders: data.values.sync_orders,
      sync_customers: data.values.sync_customers,
      b2b_catalog_enabled: data.values.b2b_catalog_enabled,
      updated_at: new Date().toISOString()
    })
    .eq('integration_id', data.integrationId)

  if (configError) throw configError

  // Update credentials if provided
  if (data.values.access_token || data.values.webhook_secret) {
    const updateCredentials: Record<string, string> = {}
    
    // Only include fields with actual values
    if (data.values.access_token) {
      updateCredentials.access_token = data.values.access_token
    }
    if (data.values.webhook_secret) {
      updateCredentials.webhook_secret = data.values.webhook_secret
    }
    
    // Only update if there are fields to update
    if (Object.keys(updateCredentials).length > 0) {
      const { error: credError } = await supabase
        .from('integration_credentials')
        .update({
          credentials: updateCredentials,
          updated_at: new Date().toISOString()
        })
        .eq('integration_id', data.integrationId)

      if (credError) throw credError
    }
  }

  return { id: data.integrationId }
}

/**
 * Renders a form for configuring a Shopify integration, supporting both creation and update modes.
 *
 * Allows users to input Shopify credentials, test the connection, and configure sync options such as products, inventory, orders, customers, B2B catalog (for Shopify Plus stores), and sync frequency. Handles form validation, credential management, and provides user feedback on success or failure. On successful submission, either creates a new integration or updates an existing one.
 *
 * @param integrationId - The ID of the integration to update, if editing an existing integration.
 * @param organizationId - The organization ID for which the integration is being configured.
 * @param initialData - Optional initial values to populate the form for editing.
 * @param onSuccess - Optional callback invoked with the integration ID after successful creation.
 * @returns The Shopify configuration form component.
 */
export function ShopifyConfigForm({
  integrationId,
  organizationId,
  initialData,
  onSuccess
}: ShopifyConfigFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) => 
      createIntegration(supabase, { organizationId, values }),
    onSuccess: (integration) => {
      toast({
        title: 'Integration created',
        description: 'Your Shopify integration has been created successfully.'
      })
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['shopify-integrations'] })
      
      // Call onSuccess callback if provided, otherwise redirect
      if (onSuccess) {
        onSuccess(integration.id)
      } else {
        router.push(`/integrations/shopify?id=${integration.id}`)
      }
    },
    onError: (error) => {
      console.error('Failed to create integration:', error)
      toast({
        title: 'Error',
        description: 'Failed to create integration. Please try again.',
        variant: 'destructive'
      })
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) => 
      updateIntegration(supabase, { integrationId: integrationId!, values }),
    onSuccess: () => {
      toast({
        title: 'Configuration updated',
        description: 'Your Shopify integration has been updated successfully.'
      })
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['shopify-integrations'] })
      queryClient.invalidateQueries({ queryKey: ['integration', integrationId] })
      
      // Refresh the page to show updated data
      router.refresh()
    },
    onError: (error) => {
      console.error('Failed to update configuration:', error)
      toast({
        title: 'Error',
        description: 'Failed to update configuration. Please try again.',
        variant: 'destructive'
      })
    }
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (integrationId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
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
      // Test the connection by making a simple API call
      const response = await fetch('/api/integrations/shopify/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop_domain: values.shop_domain,
          access_token: values.access_token
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Connection successful',
          description: 'Successfully connected to your Shopify store.'
        })

        // Check if it's a Shopify Plus store
        if (data.shopInfo?.plan?.includes('plus')) {
          setIsShopifyPlus(true)
          // Enable B2B catalog if it's a Plus store
          form.setValue('b2b_catalog_enabled', true)
        } else {
          setIsShopifyPlus(false)
        }
      } else {
        throw new Error(data.error || 'Connection test failed')
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Shopify. Please check your credentials.',
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
                  Your Shopify store domain (e.g., mystore.myshopify.com)
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
                      placeholder="shpat_..."
                      {...field}
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      disabled={isLoading}
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
                  The Admin API access token from your custom app
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
                      placeholder="Enter webhook secret..."
                      {...field}
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      disabled={isLoading}
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

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={isLoading || testingConnection}
            >
              {testingConnection && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Test Connection
            </Button>
          </div>
        </div>

        {isShopifyPlus === false && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              B2B catalog sync is only available for Shopify Plus stores.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-medium">Sync Settings</h3>
          
          <FormField
            control={form.control}
            name="sync_frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sync Frequency (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="5"
                    max="1440"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  How often to sync data (minimum 5 minutes)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <FormField
              control={form.control}
              name="sync_products"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Sync Inventory</FormLabel>
                    <FormDescription>
                      Keep inventory levels in sync
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Sync Orders</FormLabel>
                    <FormDescription>
                      Import order data for analytics
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Sync Customers</FormLabel>
                    <FormDescription>
                      Import customer information
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>B2B Catalog Sync</FormLabel>
                    <FormDescription>
                      Sync B2B catalogs and pricing (Plus only)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading || isShopifyPlus === false}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {integrationId ? 'Update Configuration' : 'Create Integration'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}