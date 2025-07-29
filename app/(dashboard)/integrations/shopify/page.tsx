// PRP-014: Shopify Integration Page
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { ShopifyConnector } from '@/lib/integrations/shopify/connector'
import { ShopifyAPIError } from '@/types/shopify.types'
import { 
  Store, 
  Settings, 
  Sync, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw
} from 'lucide-react'

interface ShopifyConfig {
  shop_domain: string
  access_token: string
  webhook_secret: string
  sync_products: boolean
  sync_inventory: boolean
  sync_orders: boolean
  sync_customers: boolean
  b2b_catalog_enabled: boolean
  sync_frequency: number
  field_mappings?: Record<string, string>
  location_mappings?: Record<string, string>
}

interface SyncStatus {
  last_sync?: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  progress?: number
  error?: string
}

export default function ShopifyIntegrationPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [config, setConfig] = useState<ShopifyConfig>({
    shop_domain: '',
    access_token: '',
    webhook_secret: '',
    sync_products: true,
    sync_inventory: true,
    sync_orders: false,
    sync_customers: false,
    b2b_catalog_enabled: false,
    sync_frequency: 60,
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle')
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncStatus>>({
    products: { status: 'idle' },
    inventory: { status: 'idle' },
    customers: { status: 'idle' },
    orders: { status: 'idle' },
  })
  const [shopInfo, setShopInfo] = useState<any>(null)
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    loadIntegration()
    generateWebhookUrl()
  }, [])

  const loadIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: integration } = await supabase
        .from('integrations')
        .select('*')
        .eq('platform', 'shopify')
        .eq('organization_id', user.user_metadata.organization_id)
        .single()

      if (integration) {
        setConfig({
          ...config,
          ...integration.config,
        })
        setConnectionStatus('connected')
      }
    } catch (error) {
      console.error('Failed to load integration:', error)
    }
  }

  const generateWebhookUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_URL || window.location.origin
    setWebhookUrl(`${baseUrl}/api/webhooks/shopify`)
  }

  const testConnection = async () => {
    setIsTesting(true)
    setConnectionStatus('testing')

    try {
      const connector = new ShopifyConnector({
        integrationId: 'test',
        organizationId: 'test',
        credentials: {
          access_token: config.access_token,
          webhook_secret: config.webhook_secret,
        },
        settings: {
          shop_domain: config.shop_domain,
          access_token: config.access_token,
          api_version: '2024-01',
        },
      })

      await connector.authenticate()
      const shopInfo = await connector['auth'].getShopInfo()
      setShopInfo(shopInfo)
      setConnectionStatus('connected')
      
      toast({
        title: 'Connection successful',
        description: `Connected to ${shopInfo.name}`,
      })
    } catch (error) {
      setConnectionStatus('failed')
      toast({
        title: 'Connection failed',
        description: error instanceof ShopifyAPIError ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const saveIntegration = async () => {
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const integrationData = {
        platform: 'shopify',
        organization_id: user.user_metadata.organization_id,
        name: `Shopify - ${config.shop_domain}`,
        description: 'Shopify B2B Integration',
        status: 'active',
        config,
        sync_settings: {
          sync_products: config.sync_products,
          sync_inventory: config.sync_inventory,
          sync_orders: config.sync_orders,
          sync_customers: config.sync_customers,
          sync_frequency: config.sync_frequency,
        },
      }

      const { data: integration, error } = await supabase
        .from('integrations')
        .upsert(integrationData)
        .select()
        .single()

      if (error) throw error

      // Save credentials
      await supabase
        .from('integration_credentials')
        .upsert({
          integration_id: integration.id,
          organization_id: user.user_metadata.organization_id,
          credential_type: 'api_key',
          credentials: {
            access_token: config.access_token,
            webhook_secret: config.webhook_secret,
          },
        })

      toast({
        title: 'Integration saved',
        description: 'Shopify integration has been configured successfully.',
      })
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const syncData = async (entityType: string) => {
    setIsSyncing(true)
    setSyncStatus(prev => ({
      ...prev,
      [entityType]: { status: 'running', progress: 0 }
    }))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const connector = new ShopifyConnector({
        integrationId: 'sync',
        organizationId: user.user_metadata.organization_id,
        credentials: {
          access_token: config.access_token,
          webhook_secret: config.webhook_secret,
        },
        settings: config,
      })

      await connector.authenticate()
      
      const result = await connector.sync(entityType as any, {
        limit: 100,
        force: true,
      })

      setSyncStatus(prev => ({
        ...prev,
        [entityType]: {
          status: result.success ? 'completed' : 'failed',
          last_sync: new Date().toISOString(),
          error: result.success ? undefined : result.errors[0]?.error,
        }
      }))

      toast({
        title: 'Sync completed',
        description: `Synced ${result.items_processed} ${entityType}`,
      })
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        [entityType]: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }))

      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast({
      title: 'Webhook URL copied',
      description: 'URL copied to clipboard',
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shopify Integration</h1>
          <p className="text-muted-foreground">
            Connect your Shopify store to sync products, inventory, and orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
            {connectionStatus === 'connected' ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : connectionStatus === 'failed' ? (
              <XCircle className="w-3 h-3 mr-1" />
            ) : (
              <AlertCircle className="w-3 h-3 mr-1" />
            )}
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'failed' ? 'Failed' : 'Not Connected'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Store Configuration
              </CardTitle>
              <CardDescription>
                Configure your Shopify store connection settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shop_domain">Shop Domain</Label>
                  <Input
                    id="shop_domain"
                    placeholder="your-store.myshopify.com"
                    value={config.shop_domain}
                    onChange={(e) => setConfig(prev => ({ ...prev, shop_domain: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="access_token">Access Token</Label>
                  <Input
                    id="access_token"
                    type="password"
                    placeholder="shpat_..."
                    value={config.access_token}
                    onChange={(e) => setConfig(prev => ({ ...prev, access_token: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_secret">Webhook Secret</Label>
                <Input
                  id="webhook_secret"
                  type="password"
                  placeholder="webhook_secret"
                  value={config.webhook_secret}
                  onChange={(e) => setConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
                />
              </div>

              {shopInfo && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connected to <strong>{shopInfo.name}</strong> ({shopInfo.domain})
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={testConnection}
                  disabled={isTesting || !config.shop_domain || !config.access_token}
                >
                  {isTesting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                <Button
                  onClick={saveIntegration}
                  disabled={isLoading || connectionStatus !== 'connected'}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4 mr-2" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure what data to sync from Shopify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sync_products"
                    checked={config.sync_products}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sync_products: checked }))}
                  />
                  <Label htmlFor="sync_products">Sync Products</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sync_inventory"
                    checked={config.sync_inventory}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sync_inventory: checked }))}
                  />
                  <Label htmlFor="sync_inventory">Sync Inventory</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sync_orders"
                    checked={config.sync_orders}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sync_orders: checked }))}
                  />
                  <Label htmlFor="sync_orders">Sync Orders</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sync_customers"
                    checked={config.sync_customers}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sync_customers: checked }))}
                  />
                  <Label htmlFor="sync_customers">Sync Customers</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync_frequency">Sync Frequency (minutes)</Label>
                <Input
                  id="sync_frequency"
                  type="number"
                  min="5"
                  max="1440"
                  value={config.sync_frequency}
                  onChange={(e) => setConfig(prev => ({ ...prev, sync_frequency: parseInt(e.target.value) }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sync className="w-5 h-5" />
                Manual Sync
              </CardTitle>
              <CardDescription>
                Manually trigger data synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(syncStatus).map(([entityType, status]) => (
                <div key={entityType} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="capitalize font-medium">{entityType}</div>
                    {status.status === 'running' && (
                      <Progress value={status.progress} className="w-24" />
                    )}
                    {status.status === 'completed' && (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                    {status.status === 'failed' && (
                      <Badge variant="destructive" className="text-xs">
                        <XCircle className="w-3 h-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => syncData(entityType)}
                    disabled={isSyncing || status.status === 'running'}
                  >
                    {status.status === 'running' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sync className="w-4 h-4" />
                    )}
                    Sync
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Configure webhooks in your Shopify admin to enable real-time updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly />
                  <Button variant="outline" onClick={copyWebhookUrl}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Add this webhook URL in your Shopify admin under Settings → Notifications → Webhooks
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Required Webhook Topics</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>• products/create</div>
                  <div>• products/update</div>
                  <div>• inventory_levels/update</div>
                  <div>• orders/create</div>
                  <div>• orders/updated</div>
                  <div>• customers/create</div>
                  <div>• customers/update</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
              <CardDescription>
                Monitor the health and performance of your Shopify integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Last Sync</div>
                  <div className="text-lg font-semibold">
                    {Object.values(syncStatus).some(s => s.last_sync) 
                      ? new Date(Math.max(...Object.values(syncStatus)
                          .filter(s => s.last_sync)
                          .map(s => new Date(s.last_sync!).getTime())
                        )).toLocaleString()
                      : 'Never'
                    }
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Connection Status</div>
                  <div className="text-lg font-semibold capitalize">
                    {connectionStatus}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}