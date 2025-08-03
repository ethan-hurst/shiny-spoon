import yaml from 'js-yaml'

export interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    description?: string
    version: string
  }
  servers?: Array<{
    url: string
    description?: string
  }>
  paths: Record<string, any>
  components?: {
    schemas?: Record<string, any>
    responses?: Record<string, any>
    parameters?: Record<string, any>
    securitySchemes?: Record<string, any>
  }
  tags?: Array<{
    name: string
    description?: string
  }>
}

export function parseOpenAPISpec(content: string): OpenAPISpec {
  const spec = yaml.load(content) as OpenAPISpec
  return spec
}

export function getEndpointsByTag(spec: OpenAPISpec): Record<string, any[]> {
  const endpointsByTag: Record<string, any[]> = {}

  // Initialize with all tags
  spec.tags?.forEach((tag) => {
    endpointsByTag[tag.name] = []
  })

  // Group endpoints by tag
  Object.entries(spec.paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, endpoint]: [string, any]) => {
      if (endpoint.tags) {
        endpoint.tags.forEach((tag: string) => {
          if (!endpointsByTag[tag]) {
            endpointsByTag[tag] = []
          }
          endpointsByTag[tag].push({
            path,
            method: method.toUpperCase(),
            ...endpoint,
          })
        })
      }
    })
  })

  return endpointsByTag
}

export function getEndpointById(spec: OpenAPISpec, operationId: string): any {
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, endpoint] of Object.entries(methods as any)) {
      if (endpoint.operationId === operationId) {
        return {
          path,
          method: method.toUpperCase(),
          ...endpoint,
        }
      }
    }
  }
  return null
}

export function generateCodeExample(
  endpoint: any,
  language: 'curl' | 'nodejs' | 'python' | 'php'
): string {
  const { path, method, requestBody, parameters } = endpoint
  const baseUrl = 'https://api.truthsource.io/v1'

  switch (language) {
    case 'curl':
      let curlCommand = `curl -X ${method} "${baseUrl}${path}"`
      curlCommand += ` \\\n  -H "X-API-Key: your_api_key_here"`
      curlCommand += ` \\\n  -H "Content-Type: application/json"`

      if (requestBody?.content?.['application/json']?.schema) {
        const exampleData = generateExampleFromSchema(
          requestBody.content['application/json'].schema
        )
        curlCommand += ` \\\n  -d '${JSON.stringify(exampleData, null, 2)}'`
      }

      return curlCommand

    case 'nodejs':
      let nodeCode = `import { TruthSourceClient } from '@truthsource/node-sdk';\n\n`
      nodeCode += `const client = new TruthSourceClient({\n`
      nodeCode += `  apiKey: 'your_api_key_here'\n`
      nodeCode += `});\n\n`

      // Generate method call based on path
      const pathParts = path.split('/').filter(Boolean)
      if (pathParts.length > 0) {
        nodeCode += `const result = await client.${pathParts[0]}.${method.toLowerCase()}(`
        if (requestBody?.content?.['application/json']?.schema) {
          const exampleData = generateExampleFromSchema(
            requestBody.content['application/json'].schema
          )
          nodeCode += JSON.stringify(exampleData, null, 2)
        }
        nodeCode += `);\n\nconsole.log(result);`
      }

      return nodeCode

    case 'python':
      let pythonCode = `from truthsource import TruthSourceClient\n\n`
      pythonCode += `client = TruthSourceClient(api_key="your_api_key_here")\n\n`

      const pyPathParts = path.split('/').filter(Boolean)
      if (pyPathParts.length > 0) {
        pythonCode += `result = client.${pyPathParts[0]}.${method.toLowerCase()}(`
        if (requestBody?.content?.['application/json']?.schema) {
          const exampleData = generateExampleFromSchema(
            requestBody.content['application/json'].schema
          )
          pythonCode += JSON.stringify(exampleData, null, 2).replace(/"/g, "'")
        }
        pythonCode += `)\n\nprint(result)`
      }

      return pythonCode

    case 'php':
      let phpCode = `<?php\n`
      phpCode += `require 'vendor/autoload.php';\n\n`
      phpCode += `use TruthSource\\Client;\n\n`
      phpCode += `$client = new Client('your_api_key_here');\n\n`

      const phpPathParts = path.split('/').filter(Boolean)
      if (phpPathParts.length > 0) {
        phpCode += `$result = $client->${phpPathParts[0]}->${method.toLowerCase()}(`
        if (requestBody?.content?.['application/json']?.schema) {
          const exampleData = generateExampleFromSchema(
            requestBody.content['application/json'].schema
          )
          phpCode += JSON.stringify(exampleData, null, 2)
        }
        phpCode += `);\n\nprint_r($result);`
      }

      return phpCode

    default:
      return ''
  }
}

function generateExampleFromSchema(schema: any): any {
  if (!schema) return {}

  if (schema.$ref) {
    // Handle references - in a real implementation, you'd resolve these
    return { example: 'data' }
  }

  if (schema.type === 'object') {
    const example: any = {}
    if (schema.properties) {
      Object.entries(schema.properties).forEach(
        ([key, prop]: [string, any]) => {
          if (prop.example !== undefined) {
            example[key] = prop.example
          } else if (prop.type === 'string') {
            example[key] =
              prop.format === 'uuid' ? 'abc123-def456-ghi789' : 'example'
          } else if (prop.type === 'number' || prop.type === 'integer') {
            example[key] = prop.minimum || 1
          } else if (prop.type === 'boolean') {
            example[key] = true
          } else if (prop.type === 'array') {
            example[key] = []
          } else if (prop.type === 'object') {
            example[key] = generateExampleFromSchema(prop)
          }
        }
      )
    }
    return example
  }

  return {}
}

export function resolveRef(spec: OpenAPISpec, ref: string): any {
  if (!ref.startsWith('#/')) return null

  const path = ref.substring(2).split('/')
  let current: any = spec

  for (const segment of path) {
    current = current[segment]
    if (!current) return null
  }

  return current
}
