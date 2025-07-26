// PRP-013: NetSuite Configuration Form Component
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Info, Key, Shield } from 'lucide-react'
import { createIntegration, updateIntegration } from '@/app/actions/integrations'

const netsuiteConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  account_id: z.string()
    .min(1, 'Account ID is required')
    .regex(/^[0-9]+(_SB[0-9]+)?$/, 'Invalid NetSuite Account ID format'),
  datacenter_url: z.string()
    .url('Must be a valid URL')
    .regex(/^https:\/\/[0-9]+-sb[0-9]+\.suitetalk\.api\.netsuite\.com$|^https:\/\/[0-9]+\.suitetalk\.api\.netsuite\.com$/, 
      'Invalid NetSuite data center URL format'),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
})

type NetSuiteConfigFormValues = z.infer<typeof netsuiteConfigSchema>

interface NetSuiteConfigFormProps {
  organizationId: string
  integration?: any
  config?: any
}

// Helper function to store OAuth credentials
async function storeOAuthCredentials(
  integrationId: string,
  clientId: string,
  clientSecret: string
): Promise<void> {
  const response = await fetch(`/api/integrations/netsuite/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
    body: JSON.stringify({
      integration_id: integrationId,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to store OAuth credentials' }))
    throw new Error(error.error || 'Failed to store OAuth credentials')
  }
}

export function NetSuiteConfigForm({ 
  organizationId, 
  integration,
  config 
}: NetSuiteConfigFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [redirectUri, setRedirectUri] = useState('')

  // Set redirect URI after component mounts to avoid SSR issues
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      let baseUrl: string
      
      if (appUrl) {
        // Validate NEXT_PUBLIC_APP_URL is a valid URL
        try {
          new URL(appUrl)
          baseUrl = appUrl
        } catch (error) {
          console.warn('Invalid NEXT_PUBLIC_APP_URL:', appUrl, 'Falling back to window.location.origin')
          baseUrl = window.location.origin
        }
      } else {
        baseUrl = window.location.origin
      }
      
      setRedirectUri(`${baseUrl}/integrations/netsuite/callback`)
    }
  }, [])

  const form = useForm<NetSuiteConfigFormValues>({
    resolver: zodResolver(netsuiteConfigSchema),
    defaultValues: {
      name: integration?.name || 'NetSuite Integration',
      description: integration?.description || '',
      account_id: config?.account_id || '',
      datacenter_url: config?.datacenter_url || '',
      client_id: '',
      client_secret: '',
    },
  })

  // React Query mutation for creating integrations
  const createIntegrationMutation = useMutation({
    mutationFn: async (values: NetSuiteConfigFormValues) => {
      const formData = new FormData()
      formData.append('platform', 'netsuite')
      formData.append('name', values.name)
      formData.append('description', values.description || '')
      formData.append('organization_id', organizationId)
      
      const config = {
        account_id: values.account_id,
        datacenter_url: values.datacenter_url,
      }
      formData.append('config', JSON.stringify(config))

      const result = await createIntegration(formData)
      
      // Store OAuth credentials if provided
      if (values.client_id && values.client_secret && result.data?.id) {
        await storeOAuthCredentials(result.data.id, values.client_id, values.client_secret)
      }
      
      return result
    },
    onSuccess: (result) => {
      toast({
        title: 'Integration created',
        description: 'NetSuite integration has been created successfully.',
      })
      
      // Invalidate integrations cache
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['integration', result.data?.id] })
      
      // Navigate to integration page
      router.push(`/integrations/netsuite?id=${result.data?.id}`)
    },
    onError: (error) => {
      console.error('NetSuite integration creation error:', error)
      toast({
        title: 'Integration creation failed',
        description: error instanceof Error ? error.message : 'Failed to create integration',
        variant: 'destructive',
      })
    },
  })

  // React Query mutation for updating integrations
  const updateIntegrationMutation = useMutation({
    mutationFn: async (values: NetSuiteConfigFormValues) => {
      if (!integration) throw new Error('No integration to update')
      
      const formData = new FormData()
      formData.append('id', integration.id)
      formData.append('name', values.name)
      formData.append('description', values.description || '')
      
      const config = {
        account_id: values.account_id,
        datacenter_url: values.datacenter_url,
      }
      formData.append('config', JSON.stringify(config))

      // Store OAuth credentials if provided
      if (values.client_id && values.client_secret) {
        await storeOAuthCredentials(integration.id, values.client_id, values.client_secret)
      }

      return await updateIntegration(formData)
    },
    onSuccess: () => {
      toast({
        title: 'Configuration updated',
        description: 'NetSuite configuration has been updated successfully.',
      })
      
      // Invalidate integrations cache
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['integration', integration?.id] })
      
      // Refresh the page to show updated data
      router.refresh()
    },
    onError: (error) => {
      console.error('NetSuite configuration update error:', error)
      toast({
        title: 'Configuration update failed',
        description: error instanceof Error ? error.message : 'Failed to update configuration',
        variant: 'destructive',
      })
    },
  })

  // React Query mutation for storing OAuth credentials separately
  const storeCredentialsMutation = useMutation({
    mutationFn: async ({ integrationId, clientId, clientSecret }: {
      integrationId: string
      clientId: string
      clientSecret: string
    }) => {
      return await storeOAuthCredentials(integrationId, clientId, clientSecret)
    },
    onError: (error) => {
      console.error('OAuth credentials storage error:', error)
      toast({
        title: 'Credential storage failed',
        description: error instanceof Error ? error.message : 'Failed to store OAuth credentials',
        variant: 'destructive',
      })
    },
  })

  function onSubmit(values: NetSuiteConfigFormValues) {
    if (integration) {
      // Update existing integration
      updateIntegrationMutation.mutate(values)
    } else {
      // Create new integration
      createIntegrationMutation.mutate(values)
    }
  }

  // Get loading state from mutations
  const isSubmitting = createIntegrationMutation.isPending || updateIntegrationMutation.isPending

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Configuration</CardTitle>
            <CardDescription>
              Configure your NetSuite account connection details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Integration Name</FormLabel>
                  <FormControl>
                    <Input placeholder="NetSuite Production" {...field} />
                  </FormControl>
                  <FormDescription>
                    A friendly name to identify this integration
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Main NetSuite account for inventory and pricing sync" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NetSuite Account ID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="123456 or 123456_SB1" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Your NetSuite account ID (found in Setup → Company → Company Information)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="datacenter_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Center URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://123456.suitetalk.api.netsuite.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Your NetSuite REST API base URL (found in Setup → Company → Company URLs)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {!integration && (
          <Card>
            <CardHeader>
              <CardTitle>OAuth 2.0 Credentials (Optional)</CardTitle>
              <CardDescription>
                Provide OAuth credentials now or configure them later
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>OAuth Setup Required</AlertTitle>
                <AlertDescription>
                  You'll need to create an OAuth 2.0 Integration Record in NetSuite:
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Go to Setup → Integration → Manage Integrations</li>
                    <li>Create a new integration with OAuth 2.0 enabled</li>
                    <li>Set the redirect URI to: <code className="text-xs">{redirectUri || 'Loading...'}</code></li>
                    <li>Copy the Client ID and Client Secret</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="OAuth 2.0 Client ID from NetSuite" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Secret</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="OAuth 2.0 Client Secret from NetSuite" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      <Shield className="inline h-3 w-3 mr-1" />
                      Encrypted and stored securely
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {integration ? 'Update Configuration' : 'Create Integration'}
          </Button>
        </div>
      </form>
    </Form>
  )
}