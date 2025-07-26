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
import { createShopifyIntegration, updateShopifyIntegration } from '@/app/actions/shopify-integration'
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
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isShopifyPlus, setIsShopifyPlus] = useState<boolean | null>(null)

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
      // Convert form values to FormData
      const formData = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, value.toString())
      })

      let result
      if (integrationId) {
        result = await updateShopifyIntegration(integrationId, formData)
      } else {
        result = await createShopifyIntegration(formData)
      }

      toast({
        title: integrationId ? 'Configuration updated' : 'Integration created',
        description: integrationId 
          ? 'Your Shopify integration has been updated successfully.'
          : 'Your Shopify integration has been created successfully.'
      })

      // Call onSuccess callback if provided, otherwise redirect
      if (onSuccess) {
        onSuccess(result.integrationId)
      } else {
        router.push(`/integrations/shopify?id=${result.integrationId}`)
      }
    } catch (error) {
      console.error('Failed to save integration:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save integration. Please try again.',
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
      let errorMessage = 'Failed to connect to Shopify'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout - please try again'
        } else {
          errorMessage = error.message
        }
      }
      
      console.error('Connection test failed:', error)
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