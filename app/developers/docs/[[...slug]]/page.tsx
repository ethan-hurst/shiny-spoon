import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ApiSidebar } from '@/components/developers/api-sidebar'
import { CodeExample } from '@/components/developers/code-example'
import { ApiPlayground } from '@/components/developers/api-playground'
import { parseOpenAPISpec, getEndpointsByTag, getEndpointById } from '@/lib/openapi/parser'
import { promises as fs } from 'fs'
import path from 'path'
import { Lock, Unlock } from 'lucide-react'

async function loadOpenAPISpec() {
  const specPath = path.join(process.cwd(), 'public', 'openapi.yaml')
  const fileContent = await fs.readFile(specPath, 'utf8')
  return parseOpenAPISpec(fileContent)
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const params = await props.params
  const spec = await loadOpenAPISpec()
  const operationId = params.slug?.[0]

  if (operationId) {
    const endpoint = getEndpointById(spec, operationId)
    if (endpoint) {
      return {
        title: endpoint.summary || endpoint.operationId,
        description: endpoint.description || `API documentation for ${endpoint.path}`,
      }
    }
  }

  return {
    title: 'API Documentation',
    description: 'Explore the TruthSource API documentation',
  }
}

export default async function ApiDocsPage(props: {
  params: Promise<{ slug?: string[] }>
}) {
  const params = await props.params
  const spec = await loadOpenAPISpec()
  const endpoints = getEndpointsByTag(spec)
  const operationId = params.slug?.[0]

  // If no slug, show overview
  if (!operationId) {
    return (
      <div className="flex gap-8">
        <div className="hidden lg:block lg:w-80">
          <ApiSidebar endpoints={endpoints} tags={spec.tags} />
        </div>
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
            <p className="text-muted-foreground mt-2">
              Complete reference documentation for the TruthSource API
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>
                Everything you need to start using the TruthSource API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Base URL</h3>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  https://api.truthsource.io/v1
                </code>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  All API requests require authentication using an API key. Include your API key in the X-API-Key header:
                </p>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  X-API-Key: your_api_key_here
                </code>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Rate Limiting</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Standard tier: 1,000 requests per hour</li>
                  <li>• Professional tier: 10,000 requests per hour</li>
                  <li>• Enterprise tier: Unlimited (fair use policy applies)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Response Format</h3>
                <p className="text-sm text-muted-foreground">
                  All API responses are returned in JSON format with appropriate HTTP status codes.
                </p>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Available Endpoints</h2>
            <div className="space-y-6">
              {Object.entries(endpoints).map(([tag, tagEndpoints]) => {
                const tagInfo = spec.tags?.find((t) => t.name === tag)
                return (
                  <div key={tag}>
                    <h3 className="text-lg font-semibold mb-2">{tag}</h3>
                    {tagInfo?.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {tagInfo.description}
                      </p>
                    )}
                    <div className="grid gap-3">
                      {tagEndpoints.map((endpoint) => (
                        <Card
                          key={`${endpoint.method}-${endpoint.path}`}
                          className="hover:bg-accent/50 transition-colors"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  endpoint.method === 'GET'
                                    ? 'default'
                                    : endpoint.method === 'POST'
                                    ? 'secondary'
                                    : 'outline'
                                }
                              >
                                {endpoint.method}
                              </Badge>
                              <code className="text-sm font-mono">{endpoint.path}</code>
                              {endpoint.security ? (
                                <Lock className="h-4 w-4 text-muted-foreground ml-auto" />
                              ) : (
                                <Unlock className="h-4 w-4 text-muted-foreground ml-auto" />
                              )}
                            </div>
                            {endpoint.summary && (
                              <CardDescription className="mt-1">
                                {endpoint.summary}
                              </CardDescription>
                            )}
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Find the specific endpoint
  const endpoint = getEndpointById(spec, operationId)
  if (!endpoint) {
    notFound()
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'POST':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'PUT':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'PATCH':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'DELETE':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <div className="flex gap-8">
      <div className="hidden lg:block lg:w-80">
        <ApiSidebar endpoints={endpoints} tags={spec.tags} />
      </div>
      <div className="flex-1 space-y-8">
        {/* Endpoint Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getMethodColor(
                endpoint.method
              )}`}
            >
              {endpoint.method}
            </span>
            <h1 className="text-2xl font-mono font-semibold">{endpoint.path}</h1>
          </div>
          {endpoint.summary && (
            <p className="text-lg text-muted-foreground">{endpoint.summary}</p>
          )}
          {endpoint.description && (
            <p className="mt-2 text-muted-foreground">{endpoint.description}</p>
          )}
        </div>

        <Separator />

        {/* Parameters */}
        {endpoint.parameters && endpoint.parameters.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Parameters</h2>
            <div className="space-y-4">
              {['path', 'query', 'header'].map((paramType) => {
                const params = endpoint.parameters.filter(
                  (p: any) => p.in === paramType
                )
                if (params.length === 0) return null

                return (
                  <div key={paramType}>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase mb-2">
                      {paramType} Parameters
                    </h3>
                    <Card>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {params.map((param: any) => (
                            <div key={param.name} className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm font-semibold">
                                      {param.name}
                                    </code>
                                    {param.required && (
                                      <Badge variant="destructive" className="text-xs">
                                        Required
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {param.schema?.type || 'string'}
                                    </Badge>
                                  </div>
                                  {param.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {param.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Request Body */}
        {endpoint.requestBody && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Request Body</h2>
            <Card>
              <CardContent className="p-6">
                {endpoint.requestBody.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {endpoint.requestBody.description}
                  </p>
                )}
                {endpoint.requestBody.content?.['application/json']?.schema && (
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                    <code className="text-sm">
                      {JSON.stringify(
                        endpoint.requestBody.content['application/json'].schema,
                        null,
                        2
                      )}
                    </code>
                  </pre>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Responses */}
        {endpoint.responses && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Responses</h2>
            <div className="space-y-3">
              {Object.entries(endpoint.responses).map(([status, response]: [string, any]) => (
                <Card key={status}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          status.startsWith('2')
                            ? 'default'
                            : status.startsWith('4')
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {status}
                      </Badge>
                      <CardDescription>{response.description}</CardDescription>
                    </div>
                  </CardHeader>
                  {response.content?.['application/json']?.schema && (
                    <CardContent>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                        <code className="text-sm">
                          {JSON.stringify(
                            response.content['application/json'].schema,
                            null,
                            2
                          )}
                        </code>
                      </pre>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Code Examples */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Code Examples</h2>
          <CodeExample endpoint={endpoint} />
        </div>

        {/* API Playground */}
        <div>
          <h2 className="text-xl font-semibold mb-4">API Playground</h2>
          <ApiPlayground endpoint={endpoint} spec={spec} />
        </div>
      </div>
    </div>
  )
}