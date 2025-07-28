/**
 * Integration Generator
 * Generates integrations with auth and sync
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as Handlebars from 'handlebars'
import { writeFile } from '../utils/files'
import { registerHelpers } from '../utils/handlebars-helpers'
import { logger } from '../utils/logger'
import { toKebabCase, toPascalCase } from '../utils/strings'

// Register Handlebars helpers
registerHelpers()

interface IntegrationGeneratorOptions {
  type?: 'oauth' | 'api-key' | 'webhook'
  webhook?: boolean
  sync?: boolean
  withTypes?: boolean
  withTests?: boolean
  withDocs?: boolean
  description?: string
}

export const integrationGenerator = {
  async generate(name: string, options: IntegrationGeneratorOptions = {}) {
    logger.info(`Generating integration: ${name}`)

    const {
      type = 'api-key',
      webhook = false,
      sync = true,
      withTypes = true,
      withTests = true,
      withDocs = true,
      description = `${name} integration`,
    } = options

    try {
      // Generate file names and paths
      const kebabName = toKebabCase(name)
      const integrationName = toPascalCase(name)
      const connectorName = integrationName + 'Connector'

      // Create integration directory structure
      const integrationsDir = path.join(
        process.cwd(),
        'lib',
        'integrations',
        kebabName
      )
      await fs.mkdir(integrationsDir, { recursive: true })

      // Generate connector file
      const connectorFile = path.join(integrationsDir, 'connector.ts')
      await this.generateConnectorFile(connectorFile, {
        connectorName,
        integrationName,
        kebabName,
        description,
        type,
        sync,
        webhook,
      })

      // Generate auth file
      const authFile = path.join(integrationsDir, 'auth.ts')
      await this.generateAuthFile(authFile, {
        integrationName,
        kebabName,
        type,
      })

      // Generate API client file
      const clientFile = path.join(integrationsDir, 'api-client.ts')
      await this.generateApiClientFile(clientFile, {
        integrationName,
        kebabName,
        type,
      })

      // Generate transformers file
      const transformersFile = path.join(integrationsDir, 'transformers.ts')
      await this.generateTransformersFile(transformersFile, {
        integrationName,
        kebabName,
      })

      // Generate webhook handler if needed
      if (webhook) {
        const webhookDir = path.join(
          process.cwd(),
          'app',
          'api',
          'webhooks',
          kebabName
        )
        await fs.mkdir(webhookDir, { recursive: true })
        const webhookFile = path.join(webhookDir, 'route.ts')
        await this.generateWebhookFile(webhookFile, {
          integrationName,
          kebabName,
        })
      }

      // Generate UI components
      const uiDir = path.join(
        process.cwd(),
        'app',
        '(dashboard)',
        'integrations',
        kebabName
      )
      await fs.mkdir(uiDir, { recursive: true })
      const uiFile = path.join(uiDir, 'page.tsx')
      await this.generateUIFile(uiFile, {
        integrationName,
        kebabName,
        type,
        webhook,
      })

      // Generate types file if needed
      if (withTypes) {
        const typesDir = path.join(process.cwd(), 'types')
        await fs.mkdir(typesDir, { recursive: true })
        const typesFile = path.join(typesDir, `${kebabName}.types.ts`)
        await this.generateTypesFile(typesFile, {
          integrationName,
          kebabName,
          type,
        })
      }

      // Generate test files if needed
      if (withTests) {
        const testsDir = path.join(
          process.cwd(),
          '__tests__',
          'integrations',
          kebabName
        )
        await fs.mkdir(testsDir, { recursive: true })

        const connectorTestFile = path.join(testsDir, 'connector.test.ts')
        await this.generateTestFile(connectorTestFile, {
          connectorName,
          integrationName,
          kebabName,
          type: 'connector',
        })

        const authTestFile = path.join(testsDir, 'auth.test.ts')
        await this.generateTestFile(authTestFile, {
          integrationName,
          kebabName,
          type: 'auth',
        })
      }

      // Generate documentation if needed
      if (withDocs) {
        const docsDir = path.join(integrationsDir, 'docs')
        await fs.mkdir(docsDir, { recursive: true })
        const readmeFile = path.join(docsDir, 'README.md')
        await this.generateDocumentationFile(readmeFile, {
          integrationName,
          kebabName,
          type,
          webhook,
          sync,
        })
      }

      logger.success(`Integration ${integrationName} generated successfully!`)
      logger.info('Generated files:')
      logger.info(`  - ${path.relative(process.cwd(), connectorFile)}`)
      logger.info(`  - ${path.relative(process.cwd(), authFile)}`)
      logger.info(`  - ${path.relative(process.cwd(), clientFile)}`)
      logger.info(`  - ${path.relative(process.cwd(), transformersFile)}`)
      logger.info(`  - ${path.relative(process.cwd(), uiFile)}`)

      if (webhook) {
        logger.info(`  - app/api/webhooks/${kebabName}/route.ts`)
      }
      if (withTypes) {
        logger.info(`  - types/${kebabName}.types.ts`)
      }
      if (withTests) {
        logger.info(`  - __tests__/integrations/${kebabName}/*.test.ts`)
      }
      if (withDocs) {
        logger.info(`  - lib/integrations/${kebabName}/docs/README.md`)
      }

      logger.info('\nNext steps:')
      logger.info('1. Configure integration credentials in the UI')
      logger.info('2. Implement specific API endpoints in the connector')
      logger.info('3. Set up data transformations for your use case')
      logger.info('4. Test the integration with real API credentials')
      if (webhook) {
        logger.info('5. Configure webhook URL in the external service')
      }
    } catch (error) {
      logger.error('Failed to generate integration:', error)
      throw error
    }
  },

  async generateConnectorFile(filePath: string, context: any) {
    const template = this.getConnectorTemplate()
    const compiled = Handlebars.compile(template)
    const content = compiled(context)
    await writeFile(filePath, content)
  },

  async generateAuthFile(filePath: string, context: any) {
    const template = this.getAuthTemplate()
    const compiled = Handlebars.compile(template)
    const content = compiled(context)
    await writeFile(filePath, content)
  },

  async generateApiClientFile(filePath: string, context: any) {
    const template = this.getApiClientTemplate()
    const compiled = Handlebars.compile(template)
    const content = compiled(context)
    await writeFile(filePath, content)
  },

  async generateTransformersFile(filePath: string, context: any) {
    const content = `/**
 * ${context.integrationName} Data Transformers
 * Transform data between ${context.integrationName} and TruthSource formats
 */

import type { 
  ${context.integrationName}Product,
  ${context.integrationName}Customer,
  ${context.integrationName}Order 
} from '@/types/${context.kebabName}.types'

// Transform product from ${context.integrationName} to TruthSource format
export function transformProduct(externalProduct: ${context.integrationName}Product): any {
  return {
    external_id: externalProduct.id,
    name: externalProduct.name || externalProduct.title,
    description: externalProduct.description,
    sku: externalProduct.sku || externalProduct.itemId,
    price: parseFloat(externalProduct.price?.toString() || '0'),
    inventory_quantity: parseInt(externalProduct.stock?.toString() || '0'),
    status: externalProduct.active ? 'active' : 'inactive',
    external_data: externalProduct,
    last_synced_at: new Date().toISOString()
  }
}

// Transform customer from ${context.integrationName} to TruthSource format
export function transformCustomer(externalCustomer: ${context.integrationName}Customer): any {
  return {
    external_id: externalCustomer.id,
    name: externalCustomer.name || externalCustomer.companyName,
    email: externalCustomer.email,
    phone: externalCustomer.phone,
    address: {
      line1: externalCustomer.address?.line1,
      line2: externalCustomer.address?.line2,
      city: externalCustomer.address?.city,
      state: externalCustomer.address?.state,
      postal_code: externalCustomer.address?.postalCode,
      country: externalCustomer.address?.country
    },
    external_data: externalCustomer,
    last_synced_at: new Date().toISOString()
  }
}

// Transform order from ${context.integrationName} to TruthSource format
export function transformOrder(externalOrder: ${context.integrationName}Order): any {
  return {
    external_id: externalOrder.id,
    order_number: externalOrder.orderNumber || externalOrder.number,
    customer_external_id: externalOrder.customerId,
    status: externalOrder.status,
    total_amount: parseFloat(externalOrder.total?.toString() || '0'),
    currency: externalOrder.currency || 'USD',
    order_date: externalOrder.createdAt || externalOrder.orderDate,
    line_items: externalOrder.items?.map(item => ({
      product_external_id: item.productId,
      quantity: parseInt(item.quantity?.toString() || '0'),
      unit_price: parseFloat(item.price?.toString() || '0'),
      total_price: parseFloat(item.total?.toString() || '0')
    })) || [],
    external_data: externalOrder,
    last_synced_at: new Date().toISOString()
  }
}

// Transform TruthSource product to ${context.integrationName} format (for updates)
export function transformProductToExternal(product: any): Partial<${context.integrationName}Product> {
  return {
    id: product.external_id,
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: product.price,
    stock: product.inventory_quantity,
    active: product.status === 'active'
  }
}

// Data validation helpers
export function validateProductData(data: any): boolean {
  return !!(data?.name && data?.sku)
}

export function validateCustomerData(data: any): boolean {
  return !!(data?.name && data?.email)
}

export function validateOrderData(data: any): boolean {
  return !!(data?.orderNumber && data?.customerId)
}
`
    await writeFile(filePath, content)
  },

  async generateWebhookFile(filePath: string, context: any) {
    const content = `/**
 * ${context.integrationName} Webhook Handler
 * Process webhooks from ${context.integrationName}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'
import { ${context.integrationName}Connector } from '@/lib/integrations/${context.kebabName}/connector'
import { logger } from '@/lib/utils/logger'

const webhookSchema = z.object({
  event: z.string(),
  data: z.record(z.any()),
  timestamp: z.string().optional(),
  signature: z.string().optional()
})

export const POST = createRouteHandler({
  auth: false, // Webhooks use signature verification instead
  rateLimit: {
    requests: 100,
    window: 60000 // 1 minute
  }
})(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const webhook = webhookSchema.parse(body)
    
    // Verify webhook signature
    const signature = req.headers.get('x-${context.kebabName}-signature')
    if (!signature) {
      logger.warn('${context.integrationName} webhook missing signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // TODO: Implement signature verification
    // const isValid = await verifyWebhookSignature(body, signature)
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const connector = new ${context.integrationName}Connector({
      // Add configuration here
    })

    // Process webhook based on event type
    switch (webhook.event) {
      case 'product.created':
      case 'product.updated':
        await connector.syncProduct(webhook.data.id)
        break
        
      case 'product.deleted':
        await connector.handleProductDeletion(webhook.data.id)
        break
        
      case 'customer.created':
      case 'customer.updated':
        await connector.syncCustomer(webhook.data.id)
        break
        
      case 'order.created':
      case 'order.updated':
        await connector.syncOrder(webhook.data.id)
        break
        
      default:
        logger.info(\`Unhandled ${context.integrationName} webhook event: \${webhook.event}\`)
    }

    logger.info(\`Processed ${context.integrationName} webhook: \${webhook.event}\`)
    
    return NextResponse.json({ 
      success: true,
      event: webhook.event,
      processed_at: new Date().toISOString()
    })

  } catch (error) {
    logger.error('${context.integrationName} webhook processing failed:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid webhook payload',
        details: error.errors
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'Webhook processing failed' 
    }, { status: 500 })
  }
})

// Verify webhook signature (implement according to platform's requirements)
async function verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
  // TODO: Implement signature verification logic
  // This depends on the specific integration platform's webhook signature method
  
  // Example for HMAC SHA256:
  // const secret = process.env.${context.kebabName.toUpperCase()}_WEBHOOK_SECRET
  // const expectedSignature = crypto
  //   .createHmac('sha256', secret)
  //   .update(JSON.stringify(payload))
  //   .digest('hex')
  // return crypto.timingSafeEqual(
  //   Buffer.from(signature),
  //   Buffer.from(expectedSignature)
  // )
  
  return true // Remove this when implementing real verification
}
`
    await writeFile(filePath, content)
  },

  async generateUIFile(filePath: string, context: any) {
    const content = `/**
 * ${context.integrationName} Integration Configuration Page
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

interface ${context.integrationName}Config {
  enabled: boolean
  ${context.type === 'oauth' ? 'clientId: string\n  clientSecret: string' : 'apiKey: string\n  apiSecret?: string'}
  baseUrl: string
  ${context.webhook ? 'webhookSecret: string' : ''}
  syncFrequency: 'manual' | 'hourly' | 'daily'
  syncEntities: {
    products: boolean
    customers: boolean
    orders: boolean
    inventory: boolean
  }
}

export default function ${context.integrationName}IntegrationPage() {
  const [config, setConfig] = useState<${context.integrationName}Config>({
    enabled: false,
    ${context.type === 'oauth' ? "clientId: '',\n    clientSecret: ''," : "apiKey: '',\n    apiSecret: '',"}
    baseUrl: '',
    ${context.webhook ? "webhookSecret: ''," : ''}
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
        description: '${context.integrationName} integration has been configured successfully.'
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
        description: 'Successfully connected to ${context.integrationName}.'
      })
    } catch (error) {
      setConnectionStatus('error')
      toast({
        title: 'Connection failed',
        description: 'Could not connect to ${context.integrationName}. Please check your credentials.',
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
        description: 'Data has been synchronized with ${context.integrationName}.'
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
          <h1 className="text-3xl font-bold">${context.integrationName} Integration</h1>
          <p className="text-muted-foreground">
            Configure and manage your ${context.integrationName} integration
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
          ${context.webhook ? '<TabsTrigger value="webhooks">Webhooks</TabsTrigger>' : ''}
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
                ${
                  context.type === 'oauth'
                    ? `
                <div>
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={config.clientId}
                    onChange={(e) => setConfig(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Enter your ${context.integrationName} client ID"
                  />
                </div>
                <div>
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    value={config.clientSecret}
                    onChange={(e) => setConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter your ${context.integrationName} client secret"
                  />
                </div>
                `
                    : `
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    value={config.apiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter your ${context.integrationName} API key"
                  />
                </div>
                <div>
                  <Label htmlFor="apiSecret">API Secret (Optional)</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    value={config.apiSecret}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
                    placeholder="Enter your ${context.integrationName} API secret"
                  />
                </div>
                `
                }
              </div>

              <div>
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={config.baseUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.${context.kebabName}.com"
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

        ${
          context.webhook
            ? `
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
                  placeholder="Enter webhook secret from ${context.integrationName}"
                />
              </div>
              
              <div>
                <Label>Webhook URL</Label>
                <Input
                  readOnly
                  value={\`\${window.location.origin}/api/webhooks/${context.kebabName}\`}
                  className="bg-gray-50"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Configure this URL in your ${context.integrationName} webhook settings
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        `
            : ''
        }
      </Tabs>
    </div>
  )
}
`
    await writeFile(filePath, content)
  },

  async generateTypesFile(filePath: string, context: any) {
    const content = `/**
 * ${context.integrationName} Integration Types
 */

// Configuration types
export interface ${context.integrationName}Config {
  enabled: boolean
  ${context.type === 'oauth' ? 'clientId: string\n  clientSecret: string' : 'apiKey: string\n  apiSecret?: string'}
  baseUrl: string
  webhookSecret?: string
  syncFrequency: 'manual' | 'hourly' | 'daily'
  syncEntities: {
    products: boolean
    customers: boolean
    orders: boolean
    inventory: boolean
  }
}

// API Response types
export interface ${context.integrationName}ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

// Entity types from ${context.integrationName}
export interface ${context.integrationName}Product {
  id: string
  name: string
  title?: string
  description?: string
  sku?: string
  itemId?: string
  price?: number | string
  stock?: number | string
  inventory?: number
  active?: boolean
  status?: 'active' | 'inactive' | 'draft'
  category?: string
  tags?: string[]
  images?: string[]
  variants?: ${context.integrationName}ProductVariant[]
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

export interface ${context.integrationName}ProductVariant {
  id: string
  productId: string
  name: string
  sku?: string
  price?: number
  inventory?: number
  attributes?: Record<string, string>
}

export interface ${context.integrationName}Customer {
  id: string
  name?: string
  companyName?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  billingAddress?: ${context.integrationName}Customer['address']
  shippingAddress?: ${context.integrationName}Customer['address']
  customerType?: 'individual' | 'business'
  status?: 'active' | 'inactive'
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

export interface ${context.integrationName}Order {
  id: string
  orderNumber?: string
  number?: string
  customerId?: string
  customer?: ${context.integrationName}Customer
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  total?: number | string
  subtotal?: number | string
  tax?: number | string
  shipping?: number | string
  currency?: string
  orderDate?: string
  createdAt?: string
  updatedAt?: string
  items?: ${context.integrationName}OrderItem[]
  shippingAddress?: ${context.integrationName}Customer['address']
  billingAddress?: ${context.integrationName}Customer['address']
  [key: string]: any
}

export interface ${context.integrationName}OrderItem {
  id?: string
  productId?: string
  product?: ${context.integrationName}Product
  variantId?: string
  name?: string
  sku?: string
  quantity?: number | string
  price?: number | string
  total?: number | string
  [key: string]: any
}

// Sync types
export interface SyncResult {
  success: boolean
  entityType: 'product' | 'customer' | 'order' | 'inventory'
  processed: number
  created: number
  updated: number
  errors: number
  errorDetails?: string[]
  startedAt: string
  completedAt: string
}

export interface SyncStatus {
  isRunning: boolean
  currentEntity?: string
  progress?: {
    current: number
    total: number
    percentage: number
  }
  lastSync?: string
  nextSync?: string
}

// Webhook types
export interface ${context.integrationName}WebhookPayload {
  event: string
  data: Record<string, any>
  timestamp?: string
  signature?: string
}

export interface WebhookEvent {
  id: string
  event: string
  data: Record<string, any>
  processed: boolean
  processedAt?: string
  error?: string
  retryCount: number
  createdAt: string
}

// Error types
export interface ${context.integrationName}Error {
  code: string
  message: string
  details?: Record<string, any>
  retryable?: boolean
}

// Rate limiting types
export interface RateLimitInfo {
  remaining: number
  limit: number
  resetAt: string
  retryAfter?: number
}
`
    await writeFile(filePath, content)
  },

  async generateTestFile(filePath: string, context: any) {
    if (context.type === 'connector') {
      const content = `/**
 * ${context.connectorName} tests
 */

import { ${context.connectorName} } from '@/lib/integrations/${context.kebabName}/connector'

describe('${context.connectorName}', () => {
  let connector: ${context.connectorName}
  
  beforeEach(() => {
    connector = new ${context.connectorName}({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      enabled: true
    })
  })

  describe('constructor', () => {
    it('should create connector instance', () => {
      expect(connector).toBeInstanceOf(${context.connectorName})
    })

    it('should throw error for missing configuration', () => {
      expect(() => new ${context.connectorName}({})).toThrow()
    })
  })

  describe('authentication', () => {
    it('should authenticate successfully', async () => {
      // Mock successful authentication
      jest.spyOn(connector as any, 'authenticate').mockResolvedValue(true)
      
      const result = await (connector as any).authenticate()
      expect(result).toBe(true)
    })

    it('should handle authentication failure', async () => {
      jest.spyOn(connector as any, 'authenticate').mockRejectedValue(
        new Error('Authentication failed')
      )
      
      await expect((connector as any).authenticate()).rejects.toThrow('Authentication failed')
    })
  })

  describe('data synchronization', () => {
    it('should sync products successfully', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', sku: 'SKU001' },
        { id: '2', name: 'Product 2', sku: 'SKU002' }
      ]
      
      jest.spyOn(connector, 'getProducts').mockResolvedValue(mockProducts)
      
      const result = await connector.syncProducts()
      expect(result.processed).toBe(2)
      expect(result.success).toBe(true)
    })

    it('should handle sync errors gracefully', async () => {
      jest.spyOn(connector, 'getProducts').mockRejectedValue(
        new Error('API Error')
      )
      
      const result = await connector.syncProducts()
      expect(result.success).toBe(false)
      expect(result.errors).toBeGreaterThan(0)
    })
  })

  describe('API rate limiting', () => {
    it('should respect rate limits', async () => {
      // Mock rate limit response
      const rateLimitError = new Error('Rate limit exceeded')
      ;(rateLimitError as any).status = 429
      
      jest.spyOn(connector as any, 'makeRequest')
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: [] })
      
      // Should retry after rate limit
      const result = await connector.getProducts()
      expect(result).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      jest.spyOn(connector as any, 'makeRequest').mockRejectedValue(networkError)
      
      await expect(connector.getProducts()).rejects.toThrow('Network error')
    })

    it('should handle API errors', async () => {
      const apiError = new Error('API Error')
      ;(apiError as any).status = 400
      
      jest.spyOn(connector as any, 'makeRequest').mockRejectedValue(apiError)
      
      await expect(connector.getProducts()).rejects.toThrow('API Error')
    })
  })
})
`
      await writeFile(filePath, content)
    } else if (context.type === 'auth') {
      const content = `/**
 * ${context.integrationName} Auth tests
 */

import { ${context.integrationName}Auth } from '@/lib/integrations/${context.kebabName}/auth'

describe('${context.integrationName}Auth', () => {
  let auth: ${context.integrationName}Auth
  
  beforeEach(() => {
    auth = new ${context.integrationName}Auth({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    })
  })

  describe('authentication', () => {
    it('should authenticate with valid credentials', async () => {
      jest.spyOn(auth as any, 'makeRequest').mockResolvedValue({
        data: { access_token: 'token123', expires_in: 3600 }
      })
      
      const result = await auth.authenticate()
      expect(result).toBe(true)
      expect(auth.isAuthenticated()).toBe(true)
    })

    it('should handle authentication failure', async () => {
      jest.spyOn(auth as any, 'makeRequest').mockRejectedValue(
        new Error('Invalid credentials')
      )
      
      await expect(auth.authenticate()).rejects.toThrow('Invalid credentials')
    })
  })

  describe('token management', () => {
    it('should refresh token when expired', async () => {
      // Set expired token
      ;(auth as any).token = 'expired-token'
      ;(auth as any).tokenExpiry = Date.now() - 1000
      
      jest.spyOn(auth as any, 'refreshToken').mockResolvedValue({
        access_token: 'new-token',
        expires_in: 3600
      })
      
      const token = await auth.getValidToken()
      expect(token).toBe('new-token')
    })

    it('should return existing token if not expired', async () => {
      const futureExpiry = Date.now() + 3600000
      ;(auth as any).token = 'valid-token'
      ;(auth as any).tokenExpiry = futureExpiry
      
      const token = await auth.getValidToken()
      expect(token).toBe('valid-token')
    })
  })
})
`
      await writeFile(filePath, content)
    }
  },

  async generateDocumentationFile(filePath: string, context: any) {
    const content = `# ${context.integrationName} Integration

This document provides information about the ${context.integrationName} integration implementation.

## Overview

The ${context.integrationName} integration enables synchronization of data between TruthSource and ${context.integrationName}, including:

- Products and inventory
- Customer information
- Orders and transactions
${context.webhook ? '- Real-time updates via webhooks' : ''}

## Configuration

### Authentication

${
  context.type === 'oauth'
    ? `
This integration uses OAuth 2.0 authentication. You'll need:

1. **Client ID**: Your ${context.integrationName} application client ID
2. **Client Secret**: Your ${context.integrationName} application client secret
3. **Base URL**: The API endpoint for your ${context.integrationName} instance

#### OAuth Flow
1. Navigate to Integrations > ${context.integrationName}
2. Enter your Client ID and Client Secret
3. Click "Authorize" to complete the OAuth flow
4. Test the connection to verify setup
`
    : `
This integration uses API key authentication. You'll need:

1. **API Key**: Your ${context.integrationName} API key
2. **API Secret** (optional): Additional secret if required
3. **Base URL**: The API endpoint for your ${context.integrationName} instance

#### Setup
1. Navigate to Integrations > ${context.integrationName}
2. Enter your API credentials
3. Test the connection to verify setup
`
}

### Sync Configuration

Configure which data types to synchronize:

- **Products**: Product catalog, SKUs, descriptions, pricing
- **Customers**: Customer profiles and contact information
- **Orders**: Order history and line items
- **Inventory**: Stock levels and location data

Set sync frequency:
- **Manual**: Sync only when triggered manually
- **Hourly**: Automatic sync every hour
- **Daily**: Automatic sync once per day

${
  context.webhook
    ? `
### Webhook Configuration

Real-time updates can be enabled using webhooks:

1. **Webhook URL**: \`/api/webhooks/${context.kebabName}\`
2. **Webhook Secret**: Set in ${context.integrationName} and enter in TruthSource
3. **Events**: Configure which events trigger updates

Supported webhook events:
- product.created
- product.updated
- product.deleted
- customer.created
- customer.updated
- order.created
- order.updated
`
    : ''
}

## Data Mapping

### Products

| TruthSource Field | ${context.integrationName} Field |
|-------------------|------------------|
| name              | name / title     |
| description       | description      |
| sku               | sku / itemId     |
| price             | price            |
| inventory_quantity| stock / inventory|
| status            | active / status  |

### Customers

| TruthSource Field | ${context.integrationName} Field |
|-------------------|------------------|
| name              | name / companyName |
| email             | email            |
| phone             | phone            |
| address           | address          |

### Orders

| TruthSource Field | ${context.integrationName} Field |
|-------------------|------------------|
| order_number      | orderNumber / number |
| customer_id       | customerId       |
| status            | status           |
| total_amount      | total            |
| order_date        | createdAt / orderDate |

## API Endpoints

The integration provides the following internal API endpoints:

- \`GET /api/integrations/${context.kebabName}/status\` - Integration status
- \`POST /api/integrations/${context.kebabName}/sync\` - Trigger manual sync
- \`GET /api/integrations/${context.kebabName}/sync/status\` - Sync progress
${context.webhook ? `- \`POST /api/webhooks/${context.kebabName}\` - Webhook receiver` : ''}

## Error Handling

The integration includes comprehensive error handling:

1. **Network Errors**: Automatic retry with exponential backoff
2. **Rate Limiting**: Respects API rate limits with appropriate delays
3. **Authentication Errors**: Automatic token refresh for OAuth
4. **Data Validation**: Input validation before sending to ${context.integrationName}
5. **Conflict Resolution**: Handles duplicate data and conflicts

Common error scenarios and solutions:

### Authentication Failures
- Verify API credentials are correct
- Check if credentials have expired
- Ensure proper permissions are granted

### Rate Limit Errors
- Integration automatically handles rate limits
- Monitor sync frequency if hitting limits frequently
- Consider spreading sync operations over time

### Data Sync Errors
- Check data format requirements
- Verify required fields are present
- Review field mappings for accuracy

## Monitoring

Monitor integration health through:

1. **Connection Status**: Real-time connection indicator
2. **Sync History**: Log of all synchronization attempts
3. **Error Logs**: Detailed error information and stack traces
4. **Performance Metrics**: Sync duration and data volumes

## Troubleshooting

### Connection Issues
1. Verify credentials are correct and not expired
2. Test network connectivity to ${context.integrationName} servers
3. Check firewall and proxy settings

### Sync Problems
1. Review sync configuration settings
2. Check for data validation errors in logs
3. Verify required permissions in ${context.integrationName}

### Performance Issues
1. Reduce sync frequency if overwhelming the API
2. Enable webhooks for real-time updates instead of frequent polling
3. Monitor rate limit usage

## Support

For integration support:

1. Check logs in the TruthSource admin panel
2. Review ${context.integrationName} API documentation
3. Contact TruthSource support with integration logs

## Version History

- v1.0.0: Initial implementation with basic sync functionality
${context.webhook ? '- v1.1.0: Added webhook support for real-time updates' : ''}
- Current: Enhanced error handling and performance improvements
`
    await writeFile(filePath, content)
  },

  getConnectorTemplate(): string {
    return `/**
 * {{connectorName}} - {{integrationName}} Integration Connector
 * {{description}}
 */

import { BaseService } from '@/lib/base/base-service'
import { {{integrationName}}Auth } from './auth'
import { {{integrationName}}ApiClient } from './api-client'
import { transformProduct, transformCustomer, transformOrder } from './transformers'
import type { 
  {{integrationName}}Config,
  {{integrationName}}Product,
  {{integrationName}}Customer,
  {{integrationName}}Order,
  SyncResult
} from '@/types/{{kebabName}}.types'

export class {{connectorName}} extends BaseService {
  private auth: {{integrationName}}Auth
  private client: {{integrationName}}ApiClient
  private config: {{integrationName}}Config

  constructor(config: {{integrationName}}Config) {
    super({
      serviceName: '{{connectorName}}',
      maxRetries: 3,
      retryDelay: 2000,
      circuitBreakerEnabled: true,
      timeoutMs: 30000,
      monitoring: true
    })

    if (!config.{{#if (eq type 'oauth')}}clientId || !config.clientSecret{{else}}apiKey{{/if}}) {
      throw new Error('{{integrationName}} configuration is required')
    }

    this.config = config
    this.auth = new {{integrationName}}Auth(config)
    this.client = new {{integrationName}}ApiClient(config, this.auth)
  }

  /**
   * Test connection to {{integrationName}}
   */
  async testConnection(): Promise<boolean> {
    return this.execute(async () => {
      this.log('info', 'Testing {{integrationName}} connection')
      
      try {
        await this.auth.authenticate()
        await this.client.get('/ping') // or appropriate health check endpoint
        
        this.log('info', '{{integrationName}} connection successful')
        return true
      } catch (error) {
        this.log('error', '{{integrationName}} connection failed', error)
        return false
      }
    })
  }

  /**
   * Sync all products from {{integrationName}}
   */
  async syncProducts(): Promise<SyncResult> {
    return this.execute(async () => {
      this.log('info', 'Starting {{integrationName}} products sync')
      
      const result: SyncResult = {
        success: false,
        entityType: 'product',
        processed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        errorDetails: [],
        startedAt: new Date().toISOString(),
        completedAt: ''
      }

      try {
        const products = await this.getProducts()
        result.processed = products.length

        for (const product of products) {
          try {
            const transformedProduct = transformProduct(product)
            
            // TODO: Save to database
            // const existing = await productRepository.findByExternalId(product.id)
            // if (existing) {
            //   await productRepository.update(existing.id, transformedProduct)
            //   result.updated++
            // } else {
            //   await productRepository.create(transformedProduct)
            //   result.created++
            // }
            
            result.created++ // Temporary for testing
          } catch (error) {
            result.errors++
            result.errorDetails?.push(\`Product \${product.id}: \${error.message}\`)
            this.log('error', \`Failed to sync product \${product.id}\`, error)
          }
        }

        result.success = result.errors === 0
        result.completedAt = new Date().toISOString()
        
        this.recordMetric('{{kebabName}}.products.synced', {
          processed: result.processed,
          created: result.created,
          updated: result.updated,
          errors: result.errors
        })

        this.log('info', 'Products sync completed', result)
        return result

      } catch (error) {
        result.success = false
        result.completedAt = new Date().toISOString()
        this.log('error', 'Products sync failed', error)
        throw error
      }
    })
  }

  /**
   * Sync all customers from {{integrationName}}
   */
  async syncCustomers(): Promise<SyncResult> {
    return this.execute(async () => {
      this.log('info', 'Starting {{integrationName}} customers sync')
      
      const result: SyncResult = {
        success: false,
        entityType: 'customer',
        processed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        errorDetails: [],
        startedAt: new Date().toISOString(),
        completedAt: ''
      }

      try {
        const customers = await this.getCustomers()
        result.processed = customers.length

        for (const customer of customers) {
          try {
            const transformedCustomer = transformCustomer(customer)
            
            // TODO: Save to database
            result.created++ // Temporary for testing
          } catch (error) {
            result.errors++
            result.errorDetails?.push(\`Customer \${customer.id}: \${error.message}\`)
            this.log('error', \`Failed to sync customer \${customer.id}\`, error)
          }
        }

        result.success = result.errors === 0
        result.completedAt = new Date().toISOString()
        
        this.recordMetric('{{kebabName}}.customers.synced', result)
        this.log('info', 'Customers sync completed', result)
        return result

      } catch (error) {
        result.success = false
        result.completedAt = new Date().toISOString()
        this.log('error', 'Customers sync failed', error)
        throw error
      }
    })
  }

  /**
   * Get products from {{integrationName}}
   */
  async getProducts(page = 1, limit = 100): Promise<{{integrationName}}Product[]> {
    return this.execute(async () => {
      this.log('info', \`Fetching {{integrationName}} products (page \${page})\`)
      
      const response = await this.client.get('/products', {
        page,
        limit,
        // Add other query parameters as needed
      })

      return response.data || []
    })
  }

  /**
   * Get customers from {{integrationName}}
   */
  async getCustomers(page = 1, limit = 100): Promise<{{integrationName}}Customer[]> {
    return this.execute(async () => {
      this.log('info', \`Fetching {{integrationName}} customers (page \${page})\`)
      
      const response = await this.client.get('/customers', {
        page,
        limit
      })

      return response.data || []
    })
  }

  /**
   * Get orders from {{integrationName}}
   */
  async getOrders(page = 1, limit = 100): Promise<{{integrationName}}Order[]> {
    return this.execute(async () => {
      this.log('info', \`Fetching {{integrationName}} orders (page \${page})\`)
      
      const response = await this.client.get('/orders', {
        page,
        limit
      })

      return response.data || []
    })
  }

  {{#if sync}}
  /**
   * Sync specific product by ID
   */
  async syncProduct(productId: string): Promise<void> {
    return this.execute(async () => {
      this.log('info', \`Syncing {{integrationName}} product: \${productId}\`)
      
      const product = await this.client.get(\`/products/\${productId}\`)
      const transformedProduct = transformProduct(product)
      
      // TODO: Save to database
      this.log('info', \`Product \${productId} synced successfully\`)
    })
  }

  /**
   * Sync specific customer by ID
   */
  async syncCustomer(customerId: string): Promise<void> {
    return this.execute(async () => {
      this.log('info', \`Syncing {{integrationName}} customer: \${customerId}\`)
      
      const customer = await this.client.get(\`/customers/\${customerId}\`)
      const transformedCustomer = transformCustomer(customer)
      
      // TODO: Save to database
      this.log('info', \`Customer \${customerId} synced successfully\`)
    })
  }

  /**
   * Sync specific order by ID
   */
  async syncOrder(orderId: string): Promise<void> {
    return this.execute(async () => {
      this.log('info', \`Syncing {{integrationName}} order: \${orderId}\`)
      
      const order = await this.client.get(\`/orders/\${orderId}\`)
      const transformedOrder = transformOrder(order)
      
      // TODO: Save to database
      this.log('info', \`Order \${orderId} synced successfully\`)
    })
  }
  {{/if}}

  {{#if webhook}}
  /**
   * Handle product deletion from webhook
   */
  async handleProductDeletion(productId: string): Promise<void> {
    return this.execute(async () => {
      this.log('info', \`Handling {{integrationName}} product deletion: \${productId}\`)
      
      // TODO: Soft delete or mark as inactive in database
      this.log('info', \`Product \${productId} deletion handled\`)
    })
  }
  {{/if}}

  /**
   * Health check for {{integrationName}} integration
   */
  protected async runHealthCheck(): Promise<boolean> {
    try {
      return await this.testConnection()
    } catch (error) {
      this.log('error', '{{integrationName}} health check failed', error)
      return false
    }
  }
}
`
  },

  getAuthTemplate(): string {
    return `/**
 * {{integrationName}} Authentication
 * Handles authentication for {{integrationName}} API
 */

import type { {{integrationName}}Config } from '@/types/{{kebabName}}.types'

export class {{integrationName}}Auth {
  private config: {{integrationName}}Config
  private token: string | null = null
  private tokenExpiry: number = 0
  {{#if (eq type 'oauth')}}
  private refreshToken: string | null = null
  {{/if}}

  constructor(config: {{integrationName}}Config) {
    this.config = config
  }

  /**
   * Authenticate with {{integrationName}}
   */
  async authenticate(): Promise<boolean> {
    try {
      {{#if (eq type 'oauth')}}
      const response = await this.makeRequest('/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(\`Authentication failed: \${data.error || response.statusText}\`)
      }

      this.token = data.access_token
      this.refreshToken = data.refresh_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000)
      {{else}}
      // For API key authentication, test the key
      const response = await this.makeRequest('/ping', {
        method: 'GET',
        headers: {
          'Authorization': \`Bearer \${this.config.apiKey}\`,
          {{#if apiSecret}}
          'X-API-Secret': this.config.apiSecret,
          {{/if}}
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(\`Authentication failed: \${response.statusText}\`)
      }

      this.token = this.config.apiKey
      this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      {{/if}}

      return true
    } catch (error) {
      console.error('{{integrationName}} authentication failed:', error)
      throw error
    }
  }

  /**
   * Get valid authentication token
   */
  async getValidToken(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      {{#if (eq type 'oauth')}}
      if (this.refreshToken) {
        await this.refreshAccessToken()
      } else {
        await this.authenticate()
      }
      {{else}}
      await this.authenticate()
      {{/if}}
    }

    if (!this.token) {
      throw new Error('Failed to obtain valid authentication token')
    }

    return this.token
  }

  {{#if (eq type 'oauth')}}
  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await this.makeRequest('/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(\`Token refresh failed: \${data.error || response.statusText}\`)
      }

      this.token = data.access_token
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token
      }
      this.tokenExpiry = Date.now() + (data.expires_in * 1000)
    } catch (error) {
      // If refresh fails, clear tokens and require re-authentication
      this.token = null
      this.refreshToken = null
      this.tokenExpiry = 0
      throw error
    }
  }
  {{/if}}

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null && Date.now() < this.tokenExpiry
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.token) {
      throw new Error('Not authenticated. Call authenticate() first.')
    }

    {{#if (eq type 'oauth')}}
    return {
      'Authorization': \`Bearer \${this.token}\`
    }
    {{else}}
    return {
      'Authorization': \`Bearer \${this.token}\`,
      {{#if apiSecret}}
      'X-API-Secret': this.config.apiSecret || '',
      {{/if}}
    }
    {{/if}}
  }

  /**
   * Logout and clear tokens
   */
  logout(): void {
    this.token = null
    {{#if (eq type 'oauth')}}
    this.refreshToken = null
    {{/if}}
    this.tokenExpiry = 0
  }

  /**
   * Make HTTP request to {{integrationName}} API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = \`\${this.config.baseUrl}\${endpoint}\`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'TruthSource/1.0',
        ...options.headers
      }
    })

    return response
  }
}
`
  },

  getApiClientTemplate(): string {
    return `/**
 * {{integrationName}} API Client
 * HTTP client for {{integrationName}} API with rate limiting and error handling
 */

import { {{integrationName}}Auth } from './auth'
import type { 
  {{integrationName}}Config, 
  {{integrationName}}ApiResponse,
  RateLimitInfo 
} from '@/types/{{kebabName}}.types'

export class {{integrationName}}ApiClient {
  private config: {{integrationName}}Config
  private auth: {{integrationName}}Auth
  private rateLimitInfo: RateLimitInfo | null = null

  constructor(config: {{integrationName}}Config, auth: {{integrationName}}Auth) {
    this.config = config
    this.auth = auth
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<{{integrationName}}ApiResponse<T>> {
    const url = new URL(\`\${this.config.baseUrl}\${endpoint}\`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return this.makeRequest('GET', url.toString())
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any): Promise<{{integrationName}}ApiResponse<T>> {
    const url = \`\${this.config.baseUrl}\${endpoint}\`
    return this.makeRequest('POST', url, data)
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any): Promise<{{integrationName}}ApiResponse<T>> {
    const url = \`\${this.config.baseUrl}\${endpoint}\`
    return this.makeRequest('PUT', url, data)
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string): Promise<{{integrationName}}ApiResponse<T>> {
    const url = \`\${this.config.baseUrl}\${endpoint}\`
    return this.makeRequest('DELETE', url)
  }

  /**
   * Make HTTP request with authentication and rate limiting
   */
  private async makeRequest<T = any>(
    method: string, 
    url: string, 
    data?: any
  ): Promise<{{integrationName}}ApiResponse<T>> {
    const maxRetries = 3
    let retryCount = 0

    while (retryCount <= maxRetries) {
      try {
        // Check rate limits before making request
        await this.checkRateLimit()

        // Get valid auth token
        const token = await this.auth.getValidToken()

        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TruthSource/1.0',
            ...this.auth.getAuthHeaders()
          }
        }

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data)
        }

        const response = await fetch(url, options)

        // Update rate limit info from response headers
        this.updateRateLimitInfo(response)

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
          console.warn(\`{{integrationName}} rate limit hit, waiting \${retryAfter} seconds\`)
          await this.wait(retryAfter * 1000)
          retryCount++
          continue
        }

        // Handle authentication errors
        if (response.status === 401) {
          if (retryCount < maxRetries) {
            console.warn('{{integrationName}} authentication failed, retrying...')
            await this.auth.authenticate()
            retryCount++
            continue
          } else {
            throw new Error('Authentication failed after retries')
          }
        }

        // Parse response
        const responseData = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            responseData.message || 
            responseData.error || 
            \`HTTP \${response.status}: \${response.statusText}\`
          )
        }

        return {
          success: true,
          data: responseData,
          pagination: this.parsePaginationInfo(response, responseData)
        }

      } catch (error) {
        if (retryCount >= maxRetries) {
          console.error(\`{{integrationName}} API request failed after \${maxRetries} retries:\`, error)
          throw error
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000
        await this.wait(delay)
        retryCount++
      }
    }

    throw new Error('Request failed after all retries')
  }

  /**
   * Check rate limits and wait if necessary
   */
  private async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return

    const now = new Date().getTime()
    const resetTime = new Date(this.rateLimitInfo.resetAt).getTime()

    // If we're near the limit and haven't reset yet, wait
    if (this.rateLimitInfo.remaining <= 1 && now < resetTime) {
      const waitTime = resetTime - now + 1000 // Add 1 second buffer
      console.warn(\`{{integrationName}} rate limit near exhaustion, waiting \${waitTime}ms\`)
      await this.wait(waitTime)
    }
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const limit = response.headers.get('X-RateLimit-Limit')
    const resetAt = response.headers.get('X-RateLimit-Reset')

    if (remaining && limit && resetAt) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining),
        limit: parseInt(limit),
        resetAt: new Date(parseInt(resetAt) * 1000).toISOString()
      }
    }
  }

  /**
   * Parse pagination information from response
   */
  private parsePaginationInfo(response: Response, data: any): any {
    // This depends on how {{integrationName}} handles pagination
    // Common patterns:
    
    // Header-based pagination
    const totalCount = response.headers.get('X-Total-Count')
    const currentPage = response.headers.get('X-Current-Page')
    const pageSize = response.headers.get('X-Page-Size')

    if (totalCount && currentPage && pageSize) {
      return {
        total: parseInt(totalCount),
        page: parseInt(currentPage),
        limit: parseInt(pageSize),
        hasMore: (parseInt(currentPage) * parseInt(pageSize)) < parseInt(totalCount)
      }
    }

    // Response body pagination
    if (data.pagination) {
      return {
        total: data.pagination.total,
        page: data.pagination.page || data.pagination.current_page,
        limit: data.pagination.limit || data.pagination.per_page,
        hasMore: data.pagination.has_more || (data.pagination.page < data.pagination.total_pages)
      }
    }

    return undefined
  }

  /**
   * Wait for specified milliseconds
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current rate limit status
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo
  }
}
`
  },

  async interactive() {
    try {
      const inquirer = (await import('inquirer')).default

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Integration name:',
          validate: (input: string) =>
            input.trim().length > 0 || 'Integration name is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Integration description (optional):',
        },
        {
          type: 'list',
          name: 'type',
          message: 'Authentication type:',
          choices: [
            { name: 'OAuth 2.0', value: 'oauth' },
            { name: 'API Key', value: 'api-key' },
            { name: 'Webhook Only', value: 'webhook' },
          ],
        },
        {
          type: 'confirm',
          name: 'webhook',
          message: 'Include webhook support?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'sync',
          message: 'Include sync functionality?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'withTypes',
          message: 'Generate TypeScript types?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'withTests',
          message: 'Generate test files?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'withDocs',
          message: 'Generate documentation?',
          default: true,
        },
      ])

      const options = {
        type: answers.type,
        webhook: answers.webhook,
        sync: answers.sync,
        withTypes: answers.withTypes,
        withTests: answers.withTests,
        withDocs: answers.withDocs,
        description: answers.description || `${answers.name} integration`,
      }

      await this.generate(answers.name, options)
    } catch (error) {
      logger.error('Interactive integration generation failed:', error)
      throw error
    }
  },
}
