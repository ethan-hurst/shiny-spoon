import { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeBlock } from '@/components/ui/code-block'
import { 
  BookOpen, 
  Code, 
  Key, 
  Shield, 
  Zap, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  ExternalLink
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'API Documentation - TruthSource',
  description: 'Complete API documentation for integrating with TruthSource B2B e-commerce platform',
}

const codeExamples = {
  authentication: `curl -X POST https://api.truthsource.io/v1/auth/api-keys \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -d '{
    "name": "My API Key",
    "permissions": ["inventory:read", "products:read"],
    "expiresAt": "2024-12-31T23:59:59Z"
  }'`,

  inventory: `curl -X GET "https://api.truthsource.io/v1/inventory?warehouse_id=123&limit=50" \\
  -H "X-API-Key: YOUR_API_KEY"`,

  products: `curl -X POST https://api.truthsource.io/v1/products \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "sku": "PROD-001",
    "name": "Sample Product",
    "basePrice": 29.99,
    "category": "Electronics",
    "description": "A sample product description"
  }'`,

  orders: `curl -X GET "https://api.truthsource.io/v1/orders?status=pending&limit=20" \\
  -H "X-API-Key: YOUR_API_KEY"`,

  webhooks: `curl -X POST https://api.truthsource.io/v1/webhooks \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "url": "https://your-app.com/webhooks/inventory",
    "events": ["inventory.updated", "product.created"],
    "secret": "your-webhook-secret"
  }'`
}

const sdkExamples = {
  javascript: `import { TruthSourceAPI } from '@truthsource/sdk'

const api = new TruthSourceAPI({
  apiKey: 'your-api-key',
  baseURL: 'https://api.truthsource.io/v1'
})

// Get inventory
const inventory = await api.inventory.list({
  warehouseId: '123',
  limit: 50
})

// Create product
const product = await api.products.create({
  sku: 'PROD-001',
  name: 'Sample Product',
  basePrice: 29.99
})`,

  python: `from truthsource import TruthSourceAPI

api = TruthSourceAPI(
    api_key='your-api-key',
    base_url='https://api.truthsource.io/v1'
)

# Get inventory
inventory = api.inventory.list(
    warehouse_id='123',
    limit=50
)

# Create product
product = api.products.create({
    'sku': 'PROD-001',
    'name': 'Sample Product',
    'base_price': 29.99
})`,

  php: `<?php
require_once 'vendor/autoload.php';

use TruthSource\TruthSourceAPI;

$api = new TruthSourceAPI([
    'api_key' => 'your-api-key',
    'base_url' => 'https://api.truthsource.io/v1'
]);

// Get inventory
$inventory = $api->inventory->list([
    'warehouse_id' => '123',
    'limit' => 50
]);

// Create product
$product = $api->products->create([
    'sku' => 'PROD-001',
    'name' => 'Sample Product',
    'base_price' => 29.99
]);
?>`
}

export default function APIDocumentationPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">API Documentation</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Integrate with TruthSource using our comprehensive REST API
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Interactive API Docs
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/docs" download="truthsource-api.yaml">
                <Code className="h-4 w-4 mr-2" />
                Download OpenAPI Spec
              </a>
            </Button>
          </div>
        </div>

        {/* Quick Start */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Start
            </CardTitle>
            <CardDescription>
              Get up and running with the TruthSource API in minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">1. Create an API Key</h4>
                <CodeBlock code={codeExamples.authentication} language="bash" />
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">2. Make Your First Request</h4>
                <CodeBlock code={codeExamples.inventory} language="bash" />
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">3. Response Format</h4>
                <CodeBlock 
                  code={`{
  "data": [
    {
      "id": "uuid",
      "productId": "uuid",
      "warehouseId": "uuid",
      "quantity": 100,
      "reservedQuantity": 5,
      "availableQuantity": 95,
      "product": {
        "id": "uuid",
        "sku": "PROD-001",
        "name": "Sample Product"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}`} 
                  language="json" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Reference */}
        <Tabs defaultValue="endpoints" className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="authentication">Authentication</TabsTrigger>
            <TabsTrigger value="sdks">SDKs</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-6">
            <div className="grid gap-6">
              {/* Inventory API */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Inventory API</span>
                    <Badge variant="secondary">GET /v1/inventory</Badge>
                  </CardTitle>
                  <CardDescription>
                    Manage and query inventory levels across warehouses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold mb-2">Parameters</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><code>warehouse_id</code> - Filter by warehouse</div>
                        <div><code>product_id</code> - Filter by product</div>
                        <div><code>low_stock</code> - Show items below reorder point</div>
                        <div><code>page</code> - Page number (default: 1)</div>
                        <div><code>limit</code> - Items per page (max: 100)</div>
                      </div>
                    </div>
                    <CodeBlock code={codeExamples.inventory} language="bash" />
                  </div>
                </CardContent>
              </Card>

              {/* Products API */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Products API</span>
                    <Badge variant="secondary">GET /v1/products</Badge>
                  </CardTitle>
                  <CardDescription>
                    Manage product catalog and pricing information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold mb-2">Parameters</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><code>category</code> - Filter by category</div>
                        <div><code>active</code> - Filter by active status</div>
                        <div><code>search</code> - Search in name, SKU, description</div>
                        <div><code>page</code> - Page number (default: 1)</div>
                        <div><code>limit</code> - Items per page (max: 100)</div>
                      </div>
                    </div>
                    <CodeBlock code={codeExamples.products} language="bash" />
                  </div>
                </CardContent>
              </Card>

              {/* Orders API */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Orders API</span>
                    <Badge variant="secondary">GET /v1/orders</Badge>
                  </CardTitle>
                  <CardDescription>
                    Manage customer orders and fulfillment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold mb-2">Parameters</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><code>status</code> - Filter by order status</div>
                        <div><code>customer_id</code> - Filter by customer</div>
                        <div><code>start_date</code> - Filter by date range</div>
                        <div><code>end_date</code> - Filter by date range</div>
                        <div><code>page</code> - Page number (default: 1)</div>
                        <div><code>limit</code> - Items per page (max: 100)</div>
                      </div>
                    </div>
                    <CodeBlock code={codeExamples.orders} language="bash" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="authentication" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Key Authentication
                </CardTitle>
                <CardDescription>
                  All API requests require authentication using an API key
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold mb-2">Include API Key in Header</h5>
                    <CodeBlock 
                      code={`curl -H "X-API-Key: your_api_key_here" \\
  https://api.truthsource.io/v1/inventory`} 
                      language="bash" 
                    />
                  </div>
                  
                  <div>
                    <h5 className="font-semibold mb-2">Create API Key</h5>
                    <CodeBlock code={codeExamples.authentication} language="bash" />
                  </div>
                  
                  <div>
                    <h5 className="font-semibold mb-2">Permissions</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div><code>inventory:read</code> - Read inventory data</div>
                      <div><code>inventory:write</code> - Update inventory</div>
                      <div><code>products:read</code> - Read product data</div>
                      <div><code>products:write</code> - Create/update products</div>
                      <div><code>orders:read</code> - Read order data</div>
                      <div><code>orders:write</code> - Create/update orders</div>
                      <div><code>webhooks:read</code> - Read webhook configs</div>
                      <div><code>webhooks:write</code> - Manage webhooks</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sdks" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>JavaScript/TypeScript SDK</CardTitle>
                  <CardDescription>
                    Official SDK for Node.js and browser environments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold mb-2">Installation</h5>
                      <CodeBlock code="npm install @truthsource/sdk" language="bash" />
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">Usage</h5>
                      <CodeBlock code={sdkExamples.javascript} language="javascript" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Python SDK</CardTitle>
                  <CardDescription>
                    Official SDK for Python applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold mb-2">Installation</h5>
                      <CodeBlock code="pip install truthsource" language="bash" />
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">Usage</h5>
                      <CodeBlock code={sdkExamples.python} language="python" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>PHP SDK</CardTitle>
                  <CardDescription>
                    Official SDK for PHP applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold mb-2">Installation</h5>
                      <CodeBlock code="composer require truthsource/php-sdk" language="bash" />
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">Usage</h5>
                      <CodeBlock code={sdkExamples.php} language="php" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Webhooks
                </CardTitle>
                <CardDescription>
                  Receive real-time updates when data changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold mb-2">Create Webhook</h5>
                    <CodeBlock code={codeExamples.webhooks} language="bash" />
                  </div>
                  
                  <div>
                    <h5 className="font-semibold mb-2">Available Events</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div><code>inventory.updated</code> - Inventory level changes</div>
                      <div><code>product.created</code> - New product added</div>
                      <div><code>product.updated</code> - Product information updated</div>
                      <div><code>order.created</code> - New order placed</div>
                      <div><code>order.updated</code> - Order status changed</div>
                      <div><code>customer.created</code> - New customer added</div>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold mb-2">Webhook Payload Example</h5>
                    <CodeBlock 
                      code={`{
  "event": "inventory.updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "uuid",
    "productId": "uuid",
    "warehouseId": "uuid",
    "quantity": 95,
    "previousQuantity": 100
  }
}`} 
                      language="json" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Rate Limiting & Best Practices */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Rate Limiting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Standard:</strong> 1,000 requests/hour</div>
                <div><strong>Professional:</strong> 10,000 requests/hour</div>
                <div><strong>Enterprise:</strong> Unlimited (fair use)</div>
                <div className="mt-4">
                  <AlertTriangle className="h-4 w-4 inline mr-1 text-yellow-500" />
                  <span>Rate limit headers included in all responses</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>• Use pagination for large datasets</div>
                <div>• Implement exponential backoff for retries</div>
                <div>• Cache responses when appropriate</div>
                <div>• Use webhooks for real-time updates</div>
                <div>• Validate all input data</div>
                <div>• Handle errors gracefully</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 