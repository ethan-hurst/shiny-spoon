'use client'

// PRP-014: Shopify Sync Settings Component
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { ShopifyIntegrationConfig, ShopifySyncSettings } from '@/types/shopify-integration.types'

interface ShopifySyncSettingsProps {
  integrationId: string
  config: ShopifyIntegrationConfig
  syncSettings: ShopifySyncSettings
}

export function ShopifySyncSettings({
  integrationId,
  config,
  syncSettings
}: ShopifySyncSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createBrowserClient()
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [settings, setSettings] = useState({
    sync_products: config.sync_products ?? true,
    sync_inventory: config.sync_inventory ?? true,
    sync_orders: config.sync_orders ?? true,
    sync_customers: config.sync_customers ?? true,
    b2b_catalog_enabled: config.b2b_catalog_enabled ?? false,
    sync_frequency: syncSettings?.sync_frequency ?? 15,
    batch_size: syncSettings?.batch_size ?? 100
  })

  async function saveSettings() {
    setIsLoading(true)

    try {
      // Update integration config
      const { error: integrationError } = await supabase
        .from('integrations')
        .update({
          config: {
            ...syncSettings,
            sync_frequency: settings.sync_frequency,
            batch_size: settings.batch_size
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', integrationId)

      if (integrationError) throw integrationError

      // Update Shopify config
      const { error: configError } = await supabase
        .from('shopify_config')
        .update({
          sync_products: settings.sync_products,
          sync_inventory: settings.sync_inventory,
          sync_orders: settings.sync_orders,
          sync_customers: settings.sync_customers,
          b2b_catalog_enabled: settings.b2b_catalog_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('integration_id', integrationId)

      if (configError) throw configError

      toast({
        title: 'Settings saved',
        description: 'Your sync settings have been updated successfully.'
      })

      router.refresh()
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function triggerSync(entityType: string) {
    setIsSyncing(true)

    try {
      const response = await fetch('/api/integrations/shopify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          integrationId,
          entityType,
          force: true
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Sync started',
          description: `${entityType} sync has been initiated.`
        })
      } else {
        throw new Error(result.error || 'Sync failed')
      }
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to start sync',
        variant: 'destructive'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sync-products">Products</Label>
              <p className="text-sm text-muted-foreground">
                Sync product catalog including variants and metafields
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="sync-products"
                checked={settings.sync_products}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, sync_products: checked }))
                }
                disabled={isLoading}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => triggerSync('products')}
                disabled={!settings.sync_products || isSyncing}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sync-inventory">Inventory</Label>
              <p className="text-sm text-muted-foreground">
                Real-time inventory level updates across locations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="sync-inventory"
                checked={settings.sync_inventory}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, sync_inventory: checked }))
                }
                disabled={isLoading}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => triggerSync('inventory')}
                disabled={!settings.sync_inventory || isSyncing}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sync-orders">Orders</Label>
              <p className="text-sm text-muted-foreground">
                Import orders for analytics and reporting
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="sync-orders"
                checked={settings.sync_orders}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, sync_orders: checked }))
                }
                disabled={isLoading}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => triggerSync('orders')}
                disabled={!settings.sync_orders || isSyncing}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sync-customers">Customers</Label>
              <p className="text-sm text-muted-foreground">
                Sync customer data and company information
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="sync-customers"
                checked={settings.sync_customers}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, sync_customers: checked }))
                }
                disabled={isLoading}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => triggerSync('customers')}
                disabled={!settings.sync_customers || isSyncing}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="b2b-catalogs">B2B Catalogs</Label>
              <p className="text-sm text-muted-foreground">
                Manage B2B catalogs and customer-specific pricing (Plus only)
              </p>
            </div>
            <Switch
              id="b2b-catalogs"
              checked={settings.b2b_catalog_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, b2b_catalog_enabled: checked }))
              }
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="sync-frequency">Sync Frequency</Label>
              <Select
                value={settings.sync_frequency.toString()}
                onValueChange={(value) => 
                  setSettings(prev => ({ ...prev, sync_frequency: parseInt(value) }))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="sync-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                  <SelectItem value="360">Every 6 hours</SelectItem>
                  <SelectItem value="720">Every 12 hours</SelectItem>
                  <SelectItem value="1440">Daily</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                How often to check for updates
              </p>
            </div>

            <div>
              <Label htmlFor="batch-size">Batch Size</Label>
              <Select
                value={settings.batch_size.toString()}
                onValueChange={(value) => 
                  setSettings(prev => ({ ...prev, batch_size: parseInt(value) }))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="batch-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 items</SelectItem>
                  <SelectItem value="100">100 items</SelectItem>
                  <SelectItem value="250">250 items</SelectItem>
                  <SelectItem value="500">500 items</SelectItem>
                  <SelectItem value="1000">1000 items</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Items processed per batch
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => triggerSync('all')}
          disabled={isSyncing}
        >
          {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync All Now
        </Button>

        <Button onClick={saveSettings} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}