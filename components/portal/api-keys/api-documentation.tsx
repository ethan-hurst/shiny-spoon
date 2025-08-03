import { Book, Code, ExternalLink, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ApiDocumentation() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'https://api.truthsource.io'

  const codeExamples = {
    curl: `# Get all products
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     ${baseUrl}/v1/products

# Get a specific product
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     ${baseUrl}/v1/products/PRODUCT_ID

# Update inventory
curl -X PATCH \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"quantity": 100, "warehouse_id": "WAREHOUSE_ID"}' \\
     ${baseUrl}/v1/inventory/PRODUCT_ID`,

    javascript: `// Using fetch
const response = await fetch('${baseUrl}/v1/products', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});
const products = await response.json();

// Update inventory
const updateResponse = await fetch('${baseUrl}/v1/inventory/PRODUCT_ID', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    quantity: 100,
    warehouse_id: 'WAREHOUSE_ID'
  })
});`,

    python: `import requests

# Get all products
headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}
response = requests.get('${baseUrl}/v1/products', headers=headers)
products = response.json()

# Update inventory
update_data = {
    'quantity': 100,
    'warehouse_id': 'WAREHOUSE_ID'
}
update_response = requests.patch(
    '${baseUrl}/v1/inventory/PRODUCT_ID',
    headers=headers,
    json=update_data
)`,
  }

  const endpoints = [
    {
      method: 'GET',
      path: '/v1/products',
      description: 'List all products',
      permissions: ['read'],
    },
    {
      method: 'GET',
      path: '/v1/products/:id',
      description: 'Get a specific product',
      permissions: ['read'],
    },
    {
      method: 'POST',
      path: '/v1/products',
      description: 'Create a new product',
      permissions: ['write'],
    },
    {
      method: 'PATCH',
      path: '/v1/products/:id',
      description: 'Update a product',
      permissions: ['write'],
    },
    {
      method: 'DELETE',
      path: '/v1/products/:id',
      description: 'Delete a product',
      permissions: ['delete'],
    },
    {
      method: 'GET',
      path: '/v1/inventory',
      description: 'Get inventory levels',
      permissions: ['read'],
    },
    {
      method: 'PATCH',
      path: '/v1/inventory/:productId',
      description: 'Update inventory levels',
      permissions: ['write'],
    },
    {
      method: 'GET',
      path: '/v1/pricing/calculate',
      description: 'Calculate pricing for a customer',
      permissions: ['read'],
    },
  ]

  const getMethodBadgeColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      POST: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
      PATCH:
        'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      PUT: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
      DELETE: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    }
    return colors[method] || 'bg-gray-100 text-gray-700'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Documentation</CardTitle>
            <CardDescription>
              Quick reference for using the TruthSource API
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/docs/api" target="_blank" rel="noopener noreferrer">
              <Book className="h-4 w-4 mr-2" />
              Full Docs
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-2">Base URL</h3>
          <code className="text-sm bg-muted px-2 py-1 rounded">{baseUrl}</code>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Authentication</h3>
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm mb-2">
              Include your API key in the Authorization header:
            </p>
            <code className="text-xs">Authorization: Bearer YOUR_API_KEY</code>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Available Endpoints
          </h3>
          <div className="space-y-2">
            {endpoints.map((endpoint, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getMethodBadgeColor(endpoint.method)}`}
                >
                  {endpoint.method}
                </span>
                <code className="font-mono text-xs">{endpoint.path}</code>
                <span className="text-muted-foreground text-xs">
                  - {endpoint.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Examples
          </h3>
          <Tabs defaultValue="curl" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                <code>{codeExamples.curl}</code>
              </pre>
            </TabsContent>
            <TabsContent value="javascript" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                <code>{codeExamples.javascript}</code>
              </pre>
            </TabsContent>
            <TabsContent value="python" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                <code>{codeExamples.python}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </div>

        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium mb-2">Rate Limits</h3>
          <p className="text-sm text-muted-foreground">
            API calls are limited based on your subscription plan. Rate limit
            information is included in response headers:
          </p>
          <ul className="mt-2 space-y-1 text-xs font-mono">
            <li>X-RateLimit-Limit: Your rate limit</li>
            <li>X-RateLimit-Remaining: Calls remaining</li>
            <li>X-RateLimit-Reset: Reset timestamp</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
