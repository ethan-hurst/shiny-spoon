import type { Metadata } from 'next'
import { Terminal, Play, FileJson, Key, Database, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'API Testing Tools | TruthSource Developer Portal',
  description: 'Test and debug TruthSource APIs with our interactive testing tools',
}

export default function TestingPage() {
  return (
    <div className="container py-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">API Testing Tools</h1>
        <p className="text-muted-foreground">
          Interactive tools to test, debug, and explore TruthSource APIs
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Testing Environment</AlertTitle>
        <AlertDescription>
          Use the sandbox environment for testing. Data in sandbox is reset daily and doesn't affect production.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="explorer" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="explorer">API Explorer</TabsTrigger>
          <TabsTrigger value="postman">Postman Collection</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox Data</TabsTrigger>
        </TabsList>

        <TabsContent value="explorer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interactive API Explorer</CardTitle>
              <CardDescription>
                Test API endpoints directly in your browser with our interactive explorer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge>GET</Badge>
                    <code className="text-sm">/api/v1/inventory</code>
                  </div>
                  <Button size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Try it
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retrieve current inventory levels with filtering and pagination
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/10 text-green-500">POST</Badge>
                    <code className="text-sm">/api/v1/pricing/calculate</code>
                  </div>
                  <Button size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Try it
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Calculate dynamic pricing based on customer and quantity
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500/10 text-yellow-500">PUT</Badge>
                    <code className="text-sm">/api/v1/products/{'{id}'}</code>
                  </div>
                  <Button size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Try it
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Update product information including pricing and availability
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authentication Tester</CardTitle>
              <CardDescription>
                Test your API credentials and authentication flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Enter your sandbox API key"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                    />
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button className="w-full">
                  <Terminal className="h-4 w-4 mr-2" />
                  Test Authentication
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="postman" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Postman Collection</CardTitle>
              <CardDescription>
                Download our pre-configured Postman collection for easy API testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <FileJson className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">Full API Collection</CardTitle>
                    <CardDescription>
                      Complete collection with all endpoints and example requests
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      Download Collection
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Database className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">Environment Variables</CardTitle>
                    <CardDescription>
                      Pre-configured environment for sandbox testing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      Download Environment
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <AlertDescription>
                  Import both files into Postman and select the "TruthSource Sandbox" environment to get started.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sandbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sandbox Test Data</CardTitle>
              <CardDescription>
                Use these pre-configured test entities in the sandbox environment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Test Customers</h4>
                  <div className="rounded-lg border p-3 space-y-2 font-mono text-sm">
                    <div>customer_id: "test-acme-corp"</div>
                    <div>customer_id: "test-global-supply"</div>
                    <div>customer_id: "test-mega-retail"</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Test Products</h4>
                  <div className="rounded-lg border p-3 space-y-2 font-mono text-sm">
                    <div>product_id: "test-widget-001" (SKU: WDG-001)</div>
                    <div>product_id: "test-gadget-002" (SKU: GDG-002)</div>
                    <div>product_id: "test-tool-003" (SKU: TL-003)</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Test API Credentials</h4>
                  <div className="rounded-lg border p-3 space-y-2 font-mono text-sm">
                    <div>API Key: sandbox_key_123456789</div>
                    <div>Base URL: https://sandbox.api.truthsource.io/v1</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertDescription>
              Sandbox data is reset every 24 hours at midnight UTC. Any changes made will not persist.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  )
}