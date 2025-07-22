# PRP-001D: Developer Portal & API Documentation

## Goal

Create a comprehensive developer portal with interactive API documentation, SDKs, code examples, and integration guides. This enables external developers and partners to integrate with TruthSource effectively, expanding the platform's reach and value.

## Why This Matters

- **Platform Growth**: Third-party integrations expand ecosystem value
- **Developer Experience**: Good docs reduce integration time from weeks to days
- **Support Efficiency**: Self-service documentation reduces developer support needs
- **Partner Enablement**: Clear APIs enable strategic partnerships
- **Revenue Opportunity**: API access can be a premium feature

## What We're Building

A complete developer portal featuring:

1. Interactive API documentation with try-it-out functionality
2. SDK libraries for popular languages
3. Authentication and rate limiting docs
4. Webhook documentation and testing
5. Code examples and tutorials
6. Integration guides for common use cases
7. API changelog and versioning

## Context & References

### Documentation & Resources

- **OpenAPI/Swagger**: https://swagger.io/specification/ - API specification
- **Redoc**: https://github.com/Redocly/redoc - API documentation engine
- **Docusaurus**: https://docusaurus.io/ - Documentation framework
- **Stripe Docs**: https://stripe.com/docs - Excellence in API docs
- **Twilio Docs**: https://www.twilio.com/docs - Great developer experience

### Design Patterns

- **GitHub API**: https://docs.github.com/en/rest - Comprehensive API docs
- **Linear API**: https://developers.linear.app/ - Clean, modern design
- **Vercel API**: https://vercel.com/docs/rest-api - Excellent examples

## Implementation Blueprint

### Phase 1: API Documentation Structure

```typescript
// app/developers/page.tsx
import { Metadata } from 'next'
import { DeveloperHero } from '@/components/developers/hero'
import { QuickStart } from '@/components/developers/quick-start'
import { PopularEndpoints } from '@/components/developers/popular-endpoints'
import { SDKSection } from '@/components/developers/sdk-section'
import { UseCases } from '@/components/developers/use-cases'

export const metadata: Metadata = {
  title: 'Developer Portal - TruthSource API',
  description: 'Build powerful integrations with the TruthSource API. Access inventory, pricing, and order data programmatically.',
}

export default function DevelopersPage() {
  return (
    <>
      <DeveloperHero />
      <QuickStart />
      <PopularEndpoints />
      <SDKSection />
      <UseCases />
    </>
  )
}

// components/developers/hero.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function DeveloperHero() {
  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Build with TruthSource API
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Real-time inventory, pricing, and order data at your fingertips.
            Start building in minutes with our comprehensive API.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/developers/docs">
              <Button size="lg">View Documentation</Button>
            </Link>
            <Link href="/portal/api-keys">
              <Button size="lg" variant="outline">Get API Keys</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
```

### Phase 2: Interactive API Documentation

```typescript
// app/developers/docs/[[...slug]]/page.tsx
import { notFound } from 'next/navigation'
import { ApiSidebar } from '@/components/developers/api-sidebar'
import { ApiContent } from '@/components/developers/api-content'
import { ApiPlayground } from '@/components/developers/api-playground'
import { getApiSpec, getEndpoint } from '@/lib/openapi'

export async function generateStaticParams() {
  const spec = await getApiSpec()
  const paths = Object.keys(spec.paths).flatMap((path) => {
    return Object.keys(spec.paths[path]).map((method) => ({
      slug: [path.slice(1), method].filter(Boolean),
    }))
  })
  return paths
}

export default async function ApiDocPage({
  params,
}: {
  params: { slug?: string[] }
}) {
  const spec = await getApiSpec()

  if (!params.slug || params.slug.length === 0) {
    // Show API overview
    return (
      <div className="flex min-h-screen">
        <ApiSidebar spec={spec} />
        <div className="flex-1 px-8 py-12">
          <ApiOverview spec={spec} />
        </div>
      </div>
    )
  }

  const [path, method] = params.slug
  const endpoint = getEndpoint(spec, `/${path}`, method)

  if (!endpoint) {
    notFound()
  }

  return (
    <div className="flex min-h-screen">
      <ApiSidebar spec={spec} activePath={`/${path}`} activeMethod={method} />
      <div className="flex-1">
        <div className="grid lg:grid-cols-2 h-full">
          <ApiContent endpoint={endpoint} path={`/${path}`} method={method} />
          <ApiPlayground endpoint={endpoint} path={`/${path}`} method={method} />
        </div>
      </div>
    </div>
  )
}

// components/developers/api-playground.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeBlock } from '@/components/ui/code-block'
import { ParameterInputs } from './parameter-inputs'
import { ResponseViewer } from './response-viewer'
import { generateCurl, generateCode } from '@/lib/api-examples'

export function ApiPlayground({ endpoint, path, method }) {
  const [apiKey, setApiKey] = useState('')
  const [parameters, setParameters] = useState({})
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleTryIt = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/playground/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          method,
          parameters,
          apiKey,
        }),
      })

      const data = await res.json()
      setResponse({
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body: data,
      })
    } catch (error) {
      setResponse({
        status: 500,
        body: { error: 'Request failed' },
      })
    } finally {
      setLoading(false)
    }
  }

  const curlExample = generateCurl(path, method, parameters, apiKey)
  const nodeExample = generateCode('node', path, method, parameters, apiKey)
  const pythonExample = generateCode('python', path, method, parameters, apiKey)

  return (
    <div className="bg-gray-900 text-white p-6 overflow-auto">
      <h3 className="text-lg font-semibold mb-4">Try it out</h3>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md"
          />
        </div>

        <ParameterInputs
          parameters={endpoint.parameters}
          values={parameters}
          onChange={setParameters}
        />

        <Button
          onClick={handleTryIt}
          disabled={!apiKey || loading}
          className="w-full"
        >
          {loading ? 'Sending...' : 'Send Request'}
        </Button>
      </div>

      {response && (
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2">Response</h4>
          <ResponseViewer response={response} />
        </div>
      )}

      <Tabs defaultValue="curl" className="w-full">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="curl">cURL</TabsTrigger>
          <TabsTrigger value="node">Node.js</TabsTrigger>
          <TabsTrigger value="python">Python</TabsTrigger>
        </TabsList>
        <TabsContent value="curl">
          <CodeBlock language="bash" code={curlExample} />
        </TabsContent>
        <TabsContent value="node">
          <CodeBlock language="javascript" code={nodeExample} />
        </TabsContent>
        <TabsContent value="python">
          <CodeBlock language="python" code={pythonExample} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Phase 3: SDK Documentation

```typescript
// app/developers/sdks/page.tsx
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeBlock } from '@/components/ui/code-block'

const sdks = [
  {
    name: 'Node.js',
    package: '@truthsource/node',
    install: 'npm install @truthsource/node',
    example: `import { TruthSource } from '@truthsource/node';

const client = new TruthSource({
  apiKey: 'your-api-key'
});

// Get inventory levels
const inventory = await client.inventory.list({
  warehouseId: 'wh_123',
  sku: 'PROD-001'
});

// Update pricing
await client.pricing.update('prod_123', {
  price: 29.99,
  currency: 'USD'
});`,
  },
  {
    name: 'Python',
    package: 'truthsource',
    install: 'pip install truthsource',
    example: `from truthsource import TruthSource

client = TruthSource(api_key='your-api-key')

# Get inventory levels
inventory = client.inventory.list(
    warehouse_id='wh_123',
    sku='PROD-001'
)

# Update pricing
client.pricing.update('prod_123', {
    'price': 29.99,
    'currency': 'USD'
})`,
  },
  {
    name: 'PHP',
    package: 'truthsource/php',
    install: 'composer require truthsource/php',
    example: `use TruthSource\\Client;

$client = new Client('your-api-key');

// Get inventory levels
$inventory = $client->inventory->list([
    'warehouse_id' => 'wh_123',
    'sku' => 'PROD-001'
]);

// Update pricing
$client->pricing->update('prod_123', [
    'price' => 29.99,
    'currency' => 'USD'
]);`,
  },
]

export default function SDKsPage() {
  return (
    <div className="container max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">SDKs & Libraries</h1>
        <p className="text-xl text-muted-foreground">
          Official libraries for popular programming languages
        </p>
      </div>

      <Tabs defaultValue="nodejs" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {sdks.map((sdk) => (
            <TabsTrigger key={sdk.name} value={sdk.name.toLowerCase().replace('.', '')}>
              {sdk.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {sdks.map((sdk) => (
          <TabsContent
            key={sdk.name}
            value={sdk.name.toLowerCase().replace('.', '')}
          >
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4">{sdk.name} SDK</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Installation</h3>
                  <CodeBlock
                    language="bash"
                    code={sdk.install}
                  />
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Quick Start</h3>
                  <CodeBlock
                    language={sdk.name.toLowerCase()}
                    code={sdk.example}
                  />
                </div>

                <div className="flex gap-4">
                  <Link href={`https://github.com/truthsource/${sdk.package}`}>
                    <Button variant="outline">
                      <Github className="h-4 w-4 mr-2" />
                      View on GitHub
                    </Button>
                  </Link>
                  <Link href={`/developers/sdks/${sdk.name.toLowerCase()}/reference`}>
                    <Button variant="outline">
                      API Reference
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
```

### Phase 4: Webhook Documentation

```typescript
// app/developers/webhooks/page.tsx
import { WebhookOverview } from '@/components/developers/webhook-overview'
import { WebhookEvents } from '@/components/developers/webhook-events'
import { WebhookSecurity } from '@/components/developers/webhook-security'
import { WebhookTesting } from '@/components/developers/webhook-testing'

export default function WebhooksPage() {
  return (
    <div className="container max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Webhooks</h1>
        <p className="text-xl text-muted-foreground">
          Receive real-time notifications when events occur in TruthSource
        </p>
      </div>

      <div className="space-y-12">
        <WebhookOverview />
        <WebhookEvents />
        <WebhookSecurity />
        <WebhookTesting />
      </div>
    </div>
  )
}

// components/developers/webhook-events.tsx
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/ui/code-block'

const events = [
  {
    name: 'inventory.updated',
    description: 'Triggered when inventory levels change',
    example: {
      event: 'inventory.updated',
      data: {
        product_id: 'prod_123',
        warehouse_id: 'wh_456',
        previous_quantity: 100,
        new_quantity: 85,
        updated_at: '2024-01-15T10:30:00Z',
      },
    },
  },
  {
    name: 'order.created',
    description: 'Triggered when a new order is created',
    example: {
      event: 'order.created',
      data: {
        order_id: 'ord_789',
        customer_id: 'cus_123',
        total: 599.99,
        items: [
          {
            product_id: 'prod_123',
            quantity: 2,
            price: 299.99,
          },
        ],
      },
    },
  },
  {
    name: 'price.changed',
    description: 'Triggered when product pricing is updated',
    example: {
      event: 'price.changed',
      data: {
        product_id: 'prod_123',
        previous_price: 249.99,
        new_price: 299.99,
        effective_date: '2024-01-16T00:00:00Z',
      },
    },
  },
]

export function WebhookEvents() {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">Available Events</h2>
      <div className="space-y-6">
        {events.map((event) => (
          <Card key={event.name} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    {event.name}
                  </code>
                </h3>
                <p className="text-muted-foreground mt-1">{event.description}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Example payload:</p>
              <CodeBlock
                language="json"
                code={JSON.stringify(event.example, null, 2)}
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
```

### Phase 5: Integration Guides

```typescript
// app/developers/guides/page.tsx
import { GuideCard } from '@/components/developers/guide-card'

const guides = [
  {
    title: 'Sync Inventory with NetSuite',
    description: 'Learn how to set up real-time inventory sync between TruthSource and NetSuite',
    icon: 'inventory',
    href: '/developers/guides/netsuite-inventory',
    duration: '30 min',
    difficulty: 'intermediate',
  },
  {
    title: 'Build a Custom Dashboard',
    description: 'Create a custom analytics dashboard using the TruthSource API',
    icon: 'dashboard',
    href: '/developers/guides/custom-dashboard',
    duration: '45 min',
    difficulty: 'advanced',
  },
  {
    title: 'Implement Webhook Handlers',
    description: 'Set up webhook endpoints to receive real-time updates',
    icon: 'webhook',
    href: '/developers/guides/webhook-handlers',
    duration: '20 min',
    difficulty: 'beginner',
  },
  {
    title: 'Migrate from Legacy System',
    description: 'Step-by-step guide to migrate your data to TruthSource',
    icon: 'migration',
    href: '/developers/guides/data-migration',
    duration: '60 min',
    difficulty: 'intermediate',
  },
]

export default function GuidesPage() {
  return (
    <div className="container max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Integration Guides</h1>
        <p className="text-xl text-muted-foreground">
          Step-by-step tutorials for common integration scenarios
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {guides.map((guide) => (
          <GuideCard key={guide.href} guide={guide} />
        ))}
      </div>
    </div>
  )
}
```

### Phase 6: API Testing & Monitoring

```typescript
// app/developers/testing/page.tsx
'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { ApiTester } from '@/components/developers/api-tester'
import { ApiMonitor } from '@/components/developers/api-monitor'
import { MockServer } from '@/components/developers/mock-server'

export default function TestingPage() {
  const [activeTab, setActiveTab] = useState('tester')

  return (
    <div className="container max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">API Testing & Monitoring</h1>
        <p className="text-xl text-muted-foreground">
          Test your integration and monitor API health
        </p>
      </div>

      <div className="space-y-8">
        <Card className="p-6">
          <div className="flex gap-4 mb-6">
            <Button
              variant={activeTab === 'tester' ? 'default' : 'outline'}
              onClick={() => setActiveTab('tester')}
            >
              API Tester
            </Button>
            <Button
              variant={activeTab === 'monitor' ? 'default' : 'outline'}
              onClick={() => setActiveTab('monitor')}
            >
              Health Monitor
            </Button>
            <Button
              variant={activeTab === 'mock' ? 'default' : 'outline'}
              onClick={() => setActiveTab('mock')}
            >
              Mock Server
            </Button>
          </div>

          {activeTab === 'tester' && <ApiTester />}
          {activeTab === 'monitor' && <ApiMonitor />}
          {activeTab === 'mock' && <MockServer />}
        </Card>
      </div>
    </div>
  )
}
```

### Phase 7: API Changelog

```typescript
// app/developers/changelog/page.tsx
import { ChangelogEntry } from '@/components/developers/changelog-entry'
import { ChangelogSubscribe } from '@/components/developers/changelog-subscribe'
import { getChangelog } from '@/lib/api-changelog'

export default async function ChangelogPage() {
  const entries = await getChangelog()

  return (
    <div className="container max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">API Changelog</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Stay updated with the latest API changes and improvements
        </p>
        <ChangelogSubscribe />
      </div>

      <div className="space-y-8">
        {entries.map((entry) => (
          <ChangelogEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}

// components/developers/changelog-entry.tsx
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { format } from 'date-fns'

export function ChangelogEntry({ entry }: { entry: ChangelogEntry }) {
  const typeColors = {
    breaking: 'destructive',
    feature: 'default',
    improvement: 'secondary',
    fix: 'outline',
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">{entry.title}</h3>
            <Badge variant={typeColors[entry.type]}>{entry.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(entry.date), 'MMMM d, yyyy')}
          </p>
        </div>
        {entry.version && (
          <Badge variant="outline">v{entry.version}</Badge>
        )}
      </div>

      <div className="prose prose-sm max-w-none">
        {entry.description}
      </div>

      {entry.migration && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Migration Guide:</p>
          <div className="text-sm">{entry.migration}</div>
        </div>
      )}
    </Card>
  )
}
```

## Validation Requirements

### Level 0: Documentation Quality

- [ ] All endpoints documented with examples
- [ ] Request/response schemas accurate
- [ ] Authentication clearly explained
- [ ] Rate limits documented
- [ ] Error codes comprehensive

### Level 1: Interactive Features

- [ ] API playground works with real endpoints
- [ ] Code examples can be copied
- [ ] SDK installation instructions correct
- [ ] Webhook testing functional
- [ ] Search finds relevant content

### Level 2: Developer Experience

- [ ] Time to first API call < 5 minutes
- [ ] Examples cover common use cases
- [ ] Error messages helpful
- [ ] Navigation intuitive
- [ ] Mobile-responsive documentation

### Level 3: Technical Accuracy

- [ ] OpenAPI spec validates
- [ ] Examples execute successfully
- [ ] SDK methods match API
- [ ] Webhook payloads accurate
- [ ] Version compatibility clear

### Level 4: Integration Success

- [ ] Developers can complete integration
- [ ] Support questions minimal
- [ ] API adoption metrics positive
- [ ] Partner integrations successful
- [ ] Community contributions active

## Files to Create/Modify

```yaml
CREATE:
  - app/developers/layout.tsx # Developer portal layout
  - app/developers/page.tsx # Developer home
  - app/developers/docs/** # API documentation
  - app/developers/sdks/** # SDK documentation
  - app/developers/guides/** # Integration guides
  - app/developers/webhooks/** # Webhook docs
  - app/developers/changelog/** # API changelog
  - components/developers/** # Developer components
  - lib/openapi/* # OpenAPI utilities
  - public/openapi.yaml # API specification
  - scripts/generate-sdk-docs.ts # SDK doc generator

MODIFY:
  - app/api/playground/route.ts # API playground endpoint
  - components/homepage/hero.tsx # Add developer CTA
  - app/sitemap.ts # Include developer pages
```

## Success Metrics

- [ ] Developer signups increased
- [ ] Time to integration reduced
- [ ] API call volume growing
- [ ] SDK downloads tracked
- [ ] Support tickets decreased
- [ ] Partner integrations launched

## Dependencies

- PRP-001: Next.js setup ✅
- PRP-001B: Content management (for guides)
- PRP-001C: Portal (for API keys)
- OpenAPI specification required

## Notes

- Consider API versioning strategy early
- Plan for rate limiting documentation
- Add interactive tutorials later
- Monitor common integration errors
- Build developer community features
