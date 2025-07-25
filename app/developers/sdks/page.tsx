import { type Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Github,
  FileJson,
  Braces,
  Code2,
  Download,
  ExternalLink,
  Check,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'SDKs & Libraries',
  description: 'Official TruthSource SDKs and libraries for Node.js, Python, PHP, and more.',
}

const sdks = [
  {
    name: 'Node.js SDK',
    id: 'nodejs',
    icon: FileJson,
    version: '2.1.0',
    language: 'TypeScript / JavaScript',
    packageManager: 'npm',
    installCommand: 'npm install @truthsource/node-sdk',
    githubUrl: 'https://github.com/truthsource/node-sdk',
    docsUrl: 'https://github.com/truthsource/node-sdk#readme',
    features: [
      'Full TypeScript support',
      'Promise-based API',
      'Automatic retries',
      'Webhook signature verification',
      'Built-in rate limiting',
      'Comprehensive error handling',
    ],
    quickstart: `import { TruthSourceClient } from '@truthsource/node-sdk';

const client = new TruthSourceClient({
  apiKey: process.env.TRUTHSOURCE_API_KEY
});

// List inventory items
const inventory = await client.inventory.list({
  warehouseId: 'warehouse-123',
  lowStock: true
});

// Calculate pricing
const price = await client.pricing.calculate({
  productId: 'product-456',
  customerId: 'customer-789',
  quantity: 100
});

// Set up webhook handler
client.webhooks.on('inventory.updated', (event) => {
  console.log('Inventory updated:', event.data);
});`,
  },
  {
    name: 'Python SDK',
    id: 'python',
    icon: Braces,
    version: '1.8.0',
    language: 'Python 3.7+',
    packageManager: 'pip',
    installCommand: 'pip install truthsource',
    githubUrl: 'https://github.com/truthsource/python-sdk',
    docsUrl: 'https://truthsource-python.readthedocs.io',
    features: [
      'Async/await support',
      'Type hints throughout',
      'Pandas integration',
      'Automatic pagination',
      'Connection pooling',
      'Comprehensive logging',
    ],
    quickstart: `from truthsource import TruthSourceClient
import asyncio

# Initialize client
client = TruthSourceClient(api_key="your_api_key_here")

# Synchronous usage
inventory = client.inventory.list(warehouse_id="warehouse-123")

# Async usage
async def main():
    async with TruthSourceClient(api_key="your_api_key_here") as client:
        inventory = await client.inventory.list_async(
            warehouse_id="warehouse-123",
            low_stock=True
        )
        
        # Bulk update inventory
        updates = [
            {"product_id": "p1", "quantity": 100},
            {"product_id": "p2", "quantity": 200}
        ]
        results = await client.inventory.bulk_update_async(updates)

asyncio.run(main())`,
  },
  {
    name: 'PHP SDK',
    id: 'php',
    icon: Code2,
    version: '1.5.0',
    language: 'PHP 7.4+',
    packageManager: 'composer',
    installCommand: 'composer require truthsource/php-sdk',
    githubUrl: 'https://github.com/truthsource/php-sdk',
    docsUrl: 'https://github.com/truthsource/php-sdk/wiki',
    features: [
      'PSR-4 autoloading',
      'Laravel integration',
      'Symfony bundle',
      'Guzzle HTTP client',
      'PHPStan level 8',
      'Extensive test coverage',
    ],
    quickstart: `<?php
require 'vendor/autoload.php';

use TruthSource\\Client;
use TruthSource\\Resources\\Inventory;

$client = new Client('your_api_key_here');

// List inventory
$inventory = $client->inventory->list([
    'warehouse_id' => 'warehouse-123',
    'low_stock' => true
]);

foreach ($inventory->data as $item) {
    echo "Product: {$item->product->name}, ";
    echo "Quantity: {$item->quantity}\\n";
}

// Calculate pricing
$price = $client->pricing->calculate([
    'product_id' => 'product-456',
    'customer_id' => 'customer-789',
    'quantity' => 100
]);

echo "Final price: \\$" . $price->final_price . "\\n";

// Laravel usage
use TruthSource\\Laravel\\Facades\\TruthSource;

$inventory = TruthSource::inventory()->list();`,
  },
]

const communityLibraries = [
  {
    name: 'Go Client',
    language: 'Go',
    author: 'community',
    url: 'https://github.com/go-truthsource/client',
  },
  {
    name: 'Ruby Gem',
    language: 'Ruby',
    author: 'community',
    url: 'https://github.com/truthsource-rb/truthsource',
  },
  {
    name: 'Java SDK',
    language: 'Java',
    author: 'community',
    url: 'https://github.com/truthsource-java/sdk',
  },
  {
    name: '.NET Library',
    language: 'C#',
    author: 'community',
    url: 'https://github.com/truthsource-dotnet/client',
  },
]

export default function SDKsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">SDKs & Libraries</h1>
        <p className="text-lg text-muted-foreground">
          Official TruthSource SDKs make it easy to integrate our API into your application.
          Choose your preferred language and get started in minutes.
        </p>
      </div>

      {/* Official SDKs */}
      <div className="space-y-8">
        <h2 className="text-2xl font-semibold">Official SDKs</h2>
        
        <Tabs defaultValue="nodejs" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {sdks.map((sdk) => {
              const Icon = sdk.icon
              return (
                <TabsTrigger key={sdk.id} value={sdk.id} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {sdk.name}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {sdks.map((sdk) => {
            const Icon = sdk.icon
            return (
              <TabsContent key={sdk.id} value={sdk.id} className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-8 w-8" />
                        <div>
                          <CardTitle>{sdk.name}</CardTitle>
                          <CardDescription>{sdk.language}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">v{sdk.version}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Installation */}
                    <div>
                      <h3 className="font-semibold mb-2">Installation</h3>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm">
                          {sdk.installCommand}
                        </code>
                      </div>
                    </div>

                    {/* Quick Start */}
                    <div>
                      <h3 className="font-semibold mb-2">Quick Start</h3>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                        <code className="text-sm">{sdk.quickstart}</code>
                      </pre>
                    </div>

                    {/* Features */}
                    <div>
                      <h3 className="font-semibold mb-2">Features</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {sdk.features.map((feature) => (
                          <div key={feature} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex gap-4 pt-4">
                      <Button variant="outline" asChild>
                        <Link href={sdk.githubUrl} target="_blank" rel="noopener noreferrer">
                          <Github className="mr-2 h-4 w-4" />
                          View on GitHub
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={sdk.docsUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Documentation
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`${sdk.githubUrl}/releases`} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )
          })}
        </Tabs>
      </div>

      {/* Package Managers */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Package Managers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">npm Registry</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm">@truthsource/node-sdk</code>
              <Link
                href="https://www.npmjs.com/package/@truthsource/node-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
              >
                View on npm
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">PyPI</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm">truthsource</code>
              <Link
                href="https://pypi.org/project/truthsource/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
              >
                View on PyPI
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Packagist</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm">truthsource/php-sdk</code>
              <Link
                href="https://packagist.org/packages/truthsource/php-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
              >
                View on Packagist
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Community Libraries */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Community Libraries</h2>
        <p className="text-muted-foreground">
          These libraries are maintained by the community. We encourage you to evaluate them
          based on your specific needs.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {communityLibraries.map((lib) => (
            <Card key={lib.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{lib.name}</CardTitle>
                  <Badge variant="outline">{lib.language}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Link
                  href={lib.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  View on GitHub
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Build Your Own */}
      <Card>
        <CardHeader>
          <CardTitle>Build Your Own</CardTitle>
          <CardDescription>
            Don't see your language? Our REST API is easy to integrate with any HTTP client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All you need is an HTTP client that can send JSON requests with an API key header.
            Check out our API documentation for complete endpoint details.
          </p>
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/developers/docs">
                View API Documentation
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/developers/guides/build-sdk">
                SDK Building Guide
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SDK Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>SDK Requirements & Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h4 className="font-semibold mb-2">Node.js SDK</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Node.js 14.0 or higher</li>
                <li>• TypeScript 4.5+ (optional)</li>
                <li>• Works in browsers with bundlers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Python SDK</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Python 3.7 or higher</li>
                <li>• Async support with Python 3.7+</li>
                <li>• Type hints included</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">PHP SDK</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• PHP 7.4 or higher</li>
                <li>• Composer for dependency management</li>
                <li>• Framework integrations available</li>
              </ul>
            </div>
          </div>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              All official SDKs are maintained by TruthSource and receive regular updates.
              For support, please visit our{' '}
              <Link href="/support" className="text-primary hover:underline">
                support center
              </Link>{' '}
              or{' '}
              <Link
                href="https://github.com/truthsource"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub repositories
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}