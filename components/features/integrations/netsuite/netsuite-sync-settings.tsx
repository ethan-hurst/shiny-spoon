// PRP-013: NetSuite Sync Settings Component
'use client'

import { useState } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Save, RefreshCw, Info } from 'lucide-react'
import { updateIntegration, triggerSync } from '@/app/actions/integrations'

const syncSettingsSchema = z.object({
  sync_enabled: z.boolean(),
  sync_frequency: z.enum(['manual', 'hourly', 'daily', 'weekly']),
  sync_products: z.boolean(),
  sync_inventory: z.boolean(),
  sync_pricing: z.boolean(),
  sync_customers: z.boolean(),
  sync_orders: z.boolean(),
  inventory_locations: z.string().optional(),
  price_levels: z.string().optional(),
  batch_size: z.number().min(10).max(1000),
})

type SyncSettingsFormValues = z.infer<typeof syncSettingsSchema>

interface NetSuiteSyncSettingsProps {
  integrationId: string
  config?: any
}

export function NetSuiteSyncSettings({ integrationId, config }: NetSuiteSyncSettingsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const form = useForm<SyncSettingsFormValues>({
    resolver: zodResolver(syncSettingsSchema),
    defaultValues: {
      sync_enabled: config?.sync_enabled ?? true,
      sync_frequency: config?.sync_frequency || 'daily',
      sync_products: config?.sync_products ?? true,
      sync_inventory: config?.sync_inventory ?? true,
      sync_pricing: config?.sync_pricing ?? true,
      sync_customers: config?.sync_customers ?? false,
      sync_orders: config?.sync_orders ?? false,
      inventory_locations: config?.inventory_locations?.join(',') || '',
      price_levels: config?.price_levels?.join(',') || '',
      batch_size: config?.batch_size || 100,
    },
  })

  async function onSubmit(values: SyncSettingsFormValues) {
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('id', integrationId)
      
      const syncSettings = {
        sync_enabled: values.sync_enabled,
        sync_frequency: values.sync_frequency,
        sync_products: values.sync_products,
        sync_inventory: values.sync_inventory,
        sync_pricing: values.sync_pricing,
        sync_customers: values.sync_customers,
        sync_orders: values.sync_orders,
        inventory_locations: values.inventory_locations
          ? values.inventory_locations.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        price_levels: values.price_levels
          ? values.price_levels.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        batch_size: values.batch_size,
      }
      
      formData.append('sync_settings', JSON.stringify(syncSettings))
      
      await updateIntegration(formData)
      
      toast({
        title: 'Settings saved',
        description: 'Sync settings have been updated successfully.',
      })
    } catch (error) {
      console.error('Failed to save sync settings:', error)
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleManualSync(entityType: string) {
    setIsSyncing(true)

    try {
      const formData = new FormData()
      formData.append('integrationId', integrationId)
      formData.append('entityType', entityType)
      
      await triggerSync(formData)
      
      toast({
        title: 'Sync started',
        description: `${entityType} sync has been initiated.`,
      })
    } catch (error) {
      console.error('Failed to trigger sync:', error)
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync',
        variant: 'destructive',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync Configuration</CardTitle>
              <CardDescription>
                Configure which data to sync and how often
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="sync_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Enable Automatic Sync
                      </FormLabel>
                      <FormDescription>
                        Automatically sync data based on the configured frequency
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sync_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sync Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sync frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual Only</SelectItem>
                        <SelectItem value="hourly">Every Hour</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often to automatically sync data from NetSuite
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Types</CardTitle>
              <CardDescription>
                Select which types of data to sync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="sync_products"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Products</FormLabel>
                      <FormDescription>
                        Sync product catalog including SKUs, descriptions, and attributes
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sync_inventory"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Inventory</FormLabel>
                      <FormDescription>
                        Sync inventory levels across all locations
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sync_pricing"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Pricing</FormLabel>
                      <FormDescription>
                        Sync price levels and customer-specific pricing
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sync_customers"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Customers</FormLabel>
                      <FormDescription>
                        Sync customer records and credit information
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sync_orders"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Sales Orders</FormLabel>
                      <FormDescription>
                        Sync open sales orders for fulfillment tracking
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Fine-tune sync behavior and performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="inventory_locations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inventory Locations</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Main Warehouse, East Coast DC" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of location names to sync (leave empty for all)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price_levels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price Levels</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Base Price, Wholesale, Distributor" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of price levels to sync (leave empty for all)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="batch_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Size</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of records to process in each batch (10-1000)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </form>
      </Form>

      <Card>
        <CardHeader>
          <CardTitle>Manual Sync</CardTitle>
          <CardDescription>
            Manually trigger sync for specific data types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => handleManualSync('products')}
              disabled={isSyncing || !form.watch('sync_products')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Products
            </Button>
            <Button
              variant="outline"
              onClick={() => handleManualSync('inventory')}
              disabled={isSyncing || !form.watch('sync_inventory')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Inventory
            </Button>
            <Button
              variant="outline"
              onClick={() => handleManualSync('pricing')}
              disabled={isSyncing || !form.watch('sync_pricing')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Pricing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}