'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Loader2, AlertCircle } from 'lucide-react'
import { resolveRef } from '@/lib/openapi/parser'

interface ApiPlaygroundProps {
  endpoint: any
  spec: any
}

export function ApiPlayground({ endpoint, spec }: ApiPlaygroundProps) {
  const [apiKey, setApiKey] = useState('')
  const [parameters, setParameters] = useState<Record<string, string>>({})
  const [requestBody, setRequestBody] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleParameterChange = (name: string, value: string) => {
    setParameters((prev) => ({ ...prev, [name]: value }))
  }

  const buildUrl = () => {
    let url = endpoint.path
    
    // Replace path parameters
    endpoint.parameters?.forEach((param: any) => {
      if (param.in === 'path' && parameters[param.name]) {
        url = url.replace(`{${param.name}}`, parameters[param.name])
      }
    })

    // Add query parameters
    const queryParams = endpoint.parameters
      ?.filter((param: any) => param.in === 'query' && parameters[param.name])
      .map((param: any) => `${param.name}=${encodeURIComponent(parameters[param.name])}`)
      .join('&')

    if (queryParams) {
      url += `?${queryParams}`
    }

    return url
  }

  const executeRequest = async () => {
    if (!apiKey) {
      setError('Please enter an API key')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const url = buildUrl()
      const headers: Record<string, string> = {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      }

      const options: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify({
          method: endpoint.method,
          path: url,
          body: requestBody ? JSON.parse(requestBody) : undefined,
        }),
      }

      const res = await fetch('/api/playground', options)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      setResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getExampleRequestBody = () => {
    if (!endpoint.requestBody?.content?.['application/json']?.schema) return ''
    
    const schema = endpoint.requestBody.content['application/json'].schema
    if (schema.$ref) {
      const resolved = resolveRef(spec, schema.$ref)
      if (resolved?.example) {
        return JSON.stringify(resolved.example, null, 2)
      }
    }
    
    return JSON.stringify(
      {
        example: 'Add your request body here',
      },
      null,
      2
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try it out</CardTitle>
        <CardDescription>
          Test this endpoint with your API key. Requests are proxied through our server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="api-key">API Key</Label>
          <Input
            id="api-key"
            type="password"
            placeholder="your_api_key_here"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* Path Parameters */}
        {endpoint.parameters
          ?.filter((param: any) => param.in === 'path')
          .map((param: any) => (
            <div key={param.name} className="space-y-2">
              <Label htmlFor={param.name}>
                {param.name}
                {param.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={param.name}
                placeholder={param.description || param.name}
                value={parameters[param.name] || ''}
                onChange={(e) => handleParameterChange(param.name, e.target.value)}
              />
              {param.description && (
                <p className="text-sm text-muted-foreground">{param.description}</p>
              )}
            </div>
          ))}

        {/* Query Parameters */}
        {endpoint.parameters
          ?.filter((param: any) => param.in === 'query')
          .map((param: any) => (
            <div key={param.name} className="space-y-2">
              <Label htmlFor={param.name}>
                {param.name}
                {param.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={param.name}
                placeholder={param.description || param.name}
                value={parameters[param.name] || ''}
                onChange={(e) => handleParameterChange(param.name, e.target.value)}
              />
              {param.description && (
                <p className="text-sm text-muted-foreground">{param.description}</p>
              )}
            </div>
          ))}

        {/* Request Body */}
        {endpoint.requestBody && (
          <div className="space-y-2">
            <Label htmlFor="request-body">Request Body</Label>
            <Textarea
              id="request-body"
              className="font-mono text-sm"
              placeholder={getExampleRequestBody()}
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              rows={10}
            />
          </div>
        )}

        {/* Execute Button */}
        <Button
          onClick={executeRequest}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Execute Request
            </>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Response Display */}
        {response && (
          <div className="space-y-2">
            <Label>Response</Label>
            <Tabs defaultValue="body" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="body">Body</TabsTrigger>
                <TabsTrigger value="headers">Headers</TabsTrigger>
              </TabsList>
              <TabsContent value="body">
                <div className="rounded-lg bg-muted p-4">
                  <pre className="overflow-x-auto text-sm">
                    <code>
                      {JSON.stringify(response.body, null, 2)}
                    </code>
                  </pre>
                </div>
              </TabsContent>
              <TabsContent value="headers">
                <div className="rounded-lg bg-muted p-4">
                  <pre className="overflow-x-auto text-sm">
                    <code>
                      {JSON.stringify(response.headers, null, 2)}
                    </code>
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Status: {response.status}</span>
              <span>Time: {response.time}ms</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}