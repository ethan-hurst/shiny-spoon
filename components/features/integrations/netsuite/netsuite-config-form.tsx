// PRP-013: NetSuite Configuration Form Component
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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

export function NetSuiteConfigForm({ 
  organizationId, 
  integration,
  config 
}: NetSuiteConfigFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  async function onSubmit(values: NetSuiteConfigFormValues) {
    setIsSubmitting(true)

    try {
      if (integration) {
        // Update existing integration
        const formData = new FormData()
        formData.append('id', integration.id)
        formData.append('name', values.name)
        formData.append('description', values.description || '')
        
        const config = {
          account_id: values.account_id,
          datacenter_url: values.datacenter_url,
        }
        formData.append('config', JSON.stringify(config))

        // If OAuth credentials provided, store them separately
        if (values.client_id && values.client_secret) {
          const response = await fetch(`/api/integrations/netsuite/auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              integration_id: integration.id,
              client_id: values.client_id,
              client_secret: values.client_secret,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to store OAuth credentials')
          }
        }

        await updateIntegration(formData)
        
        toast({
          title: 'Configuration updated',
          description: 'NetSuite configuration has been updated successfully.',
        })
        
        router.refresh()
      } else {
        // Create new integration
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
        
        // If OAuth credentials provided, store them
        if (values.client_id && values.client_secret && result.id) {
          const response = await fetch(`/api/integrations/netsuite/auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              integration_id: result.id,
              client_id: values.client_id,
              client_secret: values.client_secret,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to store OAuth credentials')
          }
        }

        toast({
          title: 'Integration created',
          description: 'NetSuite integration has been created successfully.',
        })
        
        // Redirect to integration page
        router.push(`/integrations/netsuite?id=${result.id}`)
      }
    } catch (error) {
      console.error('NetSuite configuration error:', error)
      toast({
        title: 'Configuration failed',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

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
                    <li>Set the redirect URI to: <code className="text-xs">{`${window.location.origin}/integrations/netsuite/callback`}</code></li>
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