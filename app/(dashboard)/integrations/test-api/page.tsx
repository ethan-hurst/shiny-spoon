/**
 * TestApi Integration Configuration Page
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle, XCircle, Settings, Sync } from 'lucide-react'

interface TestApiConfig {
  enabled: boolean
  apiKey: string
  apiSecret?: string
  baseUrl: string
  webhookSecret: string
  syncFrequency: 'manual' | 'hourly' | 'daily'
  syncEntities: {
    products: boolean
    customers: boolean
    orders: boolean
    inventory: boolean
  }
}

export default function TestApiIntegrationPage() {
  const [config, setConfig] = useState<TestApiConfig>({
    enabled: false,
    apiKey: '',
    apiSecret: '',
    baseUrl: '',
    webhookSecret: '',
    syncFrequency: 'hourly',
    syncEntities: {
      products: true,
      customers: true,
      orders: true,
      inventory: true
    }
  })
  
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const { toast } = useToast()

  const handleSave = async () => {
    setLoading(true)
    try {
      // TODO: Implement save configuration API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: 'Configuration saved',
        description: 'TestApi integration has been configured successfully.'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      // TODO: Implement test connection API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setConnectionStatus('connected')
      toast({
        title: 'Connection successful',
        description: 'Successfully connected to TestApi.'
      })
    } catch (error) {
      setConnectionStatus('error')
      toast({
        title: 'Connection failed',
        description: 'Could not connect to TestApi. Please check your credentials.',
        variant: 'destructive'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSync = async () => {
    try {
      // TODO: Implement manual sync API call
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      toast({
        title: 'Sync completed',
        description: 'Data has been synchronized with TestApi.'
      })
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: 'Failed to sync data. Please try again.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">TestApi Integration</h1>
          <p className="text-muted-foreground">
            Configure and manage your TestApi integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
          {connectionStatus === 'error' && (
            <Badge variant="outline" className="text-red-600">
              <XCircle className="w-3 h-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="sync">Sync Settings</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                API Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled">Enable Integration</Label>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, enabled }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    value={config.apiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter your TestApi API key"
                  />
                </div>
                <div>
                  <Label htmlFor="apiSecret">API Secret (Optional)</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    value={config.apiSecret}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                    placeholder="Enter your TestApi API secret"
                  />
                </div>
                
              </div>

              <div>
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={config.baseUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.test-api.com"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleTestConnection} disabled={testing} variant="outline">
                  {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Test Connection
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sync className="w-5 h-5" />
                Sync Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Sync Frequency</Label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={config.syncFrequency}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    syncFrequency: e.target.value as any 
                  }))}
                >
                  <option value="manual">Manual only</option>
                  <option value="hourly">Every hour</option>
                  <option value="daily">Daily</option>
                </select>
              </div>

              <div>
                <Label>Entities to Sync</Label>
                <div className="mt-2 space-y-2">
                  {Object.entries(config.syncEntities).map(([entity, enabled]) => (
                    <div key={entity} className="flex items-center justify-between">
                      <Label htmlFor={entity} className="capitalize">{entity}</Label>
                      <Switch
                        id={entity}
                        checked={enabled}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({
                            ...prev,
                            syncEntities: { ...prev.syncEntities, [entity]: checked }
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSync} className="w-full">
                <Sync className="w-4 h-4 mr-2" />
                Run Manual Sync
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="webhookSecret">Webhook Secret</Label>
                <Input
                  id="webhookSecret"
                  type="password"
                  value={config.webhookSecret}
                  onChange={(e) => setConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                  placeholder="Enter webhook secret from TestApi"
                />
              </div>
              
              <div>
                <Label>Webhook URL</Label>
                <Input
                  readOnly
                  value={`${window.location.origin}/api/webhooks/test-api`}
                  className="bg-gray-50"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Configure this URL in your TestApi webhook settings
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  )
}
