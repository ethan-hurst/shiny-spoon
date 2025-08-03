import { type Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Braces,
  Code2,
  CreditCard,
  FileJson,
  Package,
  Shield,
  Terminal,
  Truck,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = {
  title: 'Developer Portal',
  description:
    'Build powerful integrations with the TruthSource API. Access documentation, SDKs, and tools to sync inventory, pricing, and delivery data.',
}

const popularEndpoints = [
  {
    method: 'GET',
    path: '/inventory',
    description: 'List inventory items with real-time stock levels',
    category: 'Inventory',
    icon: Package,
  },
  {
    method: 'POST',
    path: '/pricing/calculate',
    description: 'Calculate dynamic pricing based on rules',
    category: 'Pricing',
    icon: CreditCard,
  },
  {
    method: 'POST',
    path: '/sync/trigger',
    description: 'Manually trigger data synchronization',
    category: 'Sync',
    icon: Zap,
  },
  {
    method: 'GET',
    path: '/products',
    description: 'Retrieve product catalog with details',
    category: 'Products',
    icon: BarChart3,
  },
]

const quickStartSteps = [
  {
    step: 1,
    title: 'Get your API key',
    description:
      'Sign up for a TruthSource account and generate your API key from the dashboard.',
  },
  {
    step: 2,
    title: 'Make your first request',
    description:
      'Use your API key to authenticate and make your first API call.',
  },
  {
    step: 3,
    title: 'Explore the documentation',
    description:
      'Browse our comprehensive API documentation to discover all available endpoints.',
  },
  {
    step: 4,
    title: 'Integrate with your system',
    description:
      'Use our SDKs or direct API calls to integrate TruthSource with your platform.',
  },
]

const features = [
  {
    title: 'Real-time Sync',
    description:
      'Keep inventory and pricing data synchronized across all your systems.',
    icon: Zap,
  },
  {
    title: 'Enterprise Security',
    description:
      'Bank-level encryption and SOC 2 Type II certified infrastructure.',
    icon: Shield,
  },
  {
    title: 'Powerful Analytics',
    description:
      'Track API usage, performance metrics, and sync status in real-time.',
    icon: BarChart3,
  },
]

export default function DevelopersPage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-16">
        <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl">
            Build with TruthSource
          </h1>
          <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
            Integrate your B2B e-commerce platform with our powerful API. Sync
            inventory, pricing, and delivery data in real-time.
          </p>
          <div className="space-x-4">
            <Button size="lg" asChild>
              <Link href="/developers/docs">
                View Documentation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/signup">Get API Key</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Start Guide */}
      <section className="container space-y-6">
        <div className="mx-auto max-w-[58rem] text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl">
            Quick Start
          </h2>
          <p className="max-w-[85%] mx-auto leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Get up and running with the TruthSource API in minutes
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <Tabs defaultValue="curl" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="nodejs">Node.js</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Using cURL
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                    <code className="text-sm">{`# Get your inventory items
curl -X GET https://api.truthsource.io/v1/inventory \\
  -H "X-API-Key: your_api_key_here" \\
  -H "Content-Type: application/json"`}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="nodejs" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="h-5 w-5" />
                    Using Node.js
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                    <code className="text-sm">{`// Install the SDK
npm install @truthsource/node-sdk

// Use in your code
import { TruthSourceClient } from '@truthsource/node-sdk';

const client = new TruthSourceClient({
  apiKey: 'your_api_key_here'
});

const inventory = await client.inventory.list();
console.log(inventory);`}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="python" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Braces className="h-5 w-5" />
                    Using Python
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                    <code className="text-sm">{`# Install the SDK
pip install truthsource

# Use in your code
from truthsource import TruthSourceClient

client = TruthSourceClient(api_key="your_api_key_here")

inventory = client.inventory.list()
print(inventory)`}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickStartSteps.map((item) => (
            <Card key={item.step} className="relative">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {item.step}
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Popular Endpoints */}
      <section className="container space-y-6">
        <div className="mx-auto max-w-[58rem] text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl">
            Popular Endpoints
          </h2>
          <p className="max-w-[85%] mx-auto leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Explore our most commonly used API endpoints
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          {popularEndpoints.map((endpoint, index) => {
            const Icon = endpoint.icon
            return (
              <Card key={index} className="group relative overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        {endpoint.category}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        endpoint.method === 'GET'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-mono">
                    {endpoint.path}
                  </CardTitle>
                  <CardDescription>{endpoint.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/developers/docs#${endpoint.path.replace(/\//g, '-')}`}
                    className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                  >
                    View documentation
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <Button variant="outline" size="lg" asChild>
            <Link href="/developers/docs">
              View All Endpoints
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container space-y-6 py-8 md:py-12 lg:py-16">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="relative overflow-hidden">
                <CardHeader>
                  <Icon className="h-10 w-10 text-primary" />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>

      {/* SDK Section */}
      <section className="container space-y-6 border-t pt-8 md:pt-12 lg:pt-16">
        <div className="mx-auto max-w-[58rem] text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl">
            Official SDKs
          </h2>
          <p className="max-w-[85%] mx-auto leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Use our official libraries to integrate TruthSource in your favorite
            language
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                Node.js
              </CardTitle>
              <CardDescription>
                Full-featured Node.js SDK with TypeScript support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-sm">npm install @truthsource/node-sdk</code>
              <div className="mt-4">
                <Link
                  href="/developers/sdks#nodejs"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View documentation →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Braces className="h-5 w-5" />
                Python
              </CardTitle>
              <CardDescription>
                Python SDK with async support and type hints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-sm">pip install truthsource</code>
              <div className="mt-4">
                <Link
                  href="/developers/sdks#python"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View documentation →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                PHP
              </CardTitle>
              <CardDescription>
                PHP SDK compatible with Laravel and Symfony
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-sm">
                composer require truthsource/php-sdk
              </code>
              <div className="mt-4">
                <Link
                  href="/developers/sdks#php"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View documentation →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Use Cases */}
      <section className="container space-y-6 border-t py-8 md:py-12 lg:py-16">
        <div className="mx-auto max-w-[58rem] text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl">
            Common Use Cases
          </h2>
          <p className="max-w-[85%] mx-auto leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            See how businesses use the TruthSource API
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Package className="h-10 w-10 text-primary" />
              <CardTitle>Real-time Inventory Sync</CardTitle>
              <CardDescription>
                Keep inventory levels synchronized between your ERP and
                e-commerce platform. Prevent overselling and stockouts with
                real-time updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/developers/guides/inventory-sync"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Read the guide
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CreditCard className="h-10 w-10 text-primary" />
              <CardTitle>Dynamic B2B Pricing</CardTitle>
              <CardDescription>
                Implement customer-specific pricing, volume discounts, and
                promotional rules. Calculate accurate prices based on complex
                business logic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/developers/guides/dynamic-pricing"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Read the guide
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Truck className="h-10 w-10 text-primary" />
              <CardTitle>Delivery Date Accuracy</CardTitle>
              <CardDescription>
                Calculate accurate delivery dates based on real-time inventory
                location, shipping methods, and carrier schedules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/developers/guides/delivery-accuracy"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Read the guide
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-primary" />
              <CardTitle>Webhook Integration</CardTitle>
              <CardDescription>
                Receive real-time notifications when inventory changes, orders
                are placed, or prices are updated. Build reactive systems that
                respond to events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/developers/webhooks"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Learn about webhooks
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl">
            Ready to get started?
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Join thousands of businesses using TruthSource to eliminate costly
            order errors.
          </p>
          <div className="space-x-4">
            <Button size="lg" asChild>
              <Link href="/signup">Get Your API Key</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
