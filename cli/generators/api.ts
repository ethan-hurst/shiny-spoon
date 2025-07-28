/**
 * API Route Generator
 * Generates secure API routes with best practices
 */

import { z } from 'zod'
import Handlebars from 'handlebars'
import { writeFile, resolvePath, fileExists } from '../utils/files'
import { getNames } from '../utils/strings'
import { logger } from '../utils/logger'

const apiTemplate = `import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteHandler, createRouteHandlers } from '@/lib/api/route-handler'
import { {{serviceName}}Service } from '@/lib/services/{{kebabName}}'

// Input validation schemas
const createSchema = z.object({
  // TODO: Add your fields here
  name: z.string().min(1).max(255),
  description: z.string().optional()
})

const updateSchema = createSchema.partial()

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional()
})

const paramsSchema = z.object({
  id: z.string().uuid()
})

// Export route handlers
export const { GET, POST, PUT, DELETE } = createRouteHandlers({
  {{#if hasGet}}
  GET: async ({ query, user }) => {
    const service = new {{serviceName}}Service()
    service.setContext({
      organizationId: user!.organizationId,
      userId: user!.id
    })

    const { page, limit, search } = query as z.infer<typeof querySchema>
    const offset = (page - 1) * limit

    const result = await service.list({
      organizationId: user!.organizationId,
      search,
      limit,
      offset
    })

    return NextResponse.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      }
    })
  },
  {{/if}}

  {{#if hasPost}}
  POST: async ({ body, user }) => {
    const service = new {{serviceName}}Service()
    service.setContext({
      organizationId: user!.organizationId,
      userId: user!.id
    })

    const data = await service.create({
      ...body as z.infer<typeof createSchema>,
      organizationId: user!.organizationId
    })

    return NextResponse.json(
      { data },
      { status: 201 }
    )
  },
  {{/if}}

  {{#if hasPut}}
  PUT: async ({ params, body, user }) => {
    const { id } = params as z.infer<typeof paramsSchema>
    
    const service = new {{serviceName}}Service()
    service.setContext({
      organizationId: user!.organizationId,
      userId: user!.id
    })

    const data = await service.update(id, body as z.infer<typeof updateSchema>)

    return NextResponse.json({ data })
  },
  {{/if}}

  {{#if hasDelete}}
  DELETE: async ({ params, user }) => {
    const { id } = params as z.infer<typeof paramsSchema>
    
    const service = new {{serviceName}}Service()
    service.setContext({
      organizationId: user!.organizationId,
      userId: user!.id
    })

    await service.delete(id)

    return NextResponse.json(
      { message: 'Resource deleted successfully' },
      { status: 204 }
    )
  }
  {{/if}}
}, {
  auth: {{auth}},
  {{#if rateLimit}}
  rateLimit: {
    requests: 10,
    window: '1m'
  },
  {{/if}}
  schema: {
    {{#if hasPost}}
    body: createSchema,
    {{/if}}
    {{#if hasGet}}
    query: querySchema,
    {{/if}}
    {{#if hasPutOrDelete}}
    params: paramsSchema
    {{/if}}
  }
})`

interface ApiGeneratorOptions {
  methods?: string
  auth?: boolean
  rateLimit?: boolean
  path?: string
}

export const apiGenerator = {
  async generate(name: string, options: ApiGeneratorOptions) {
    const names = getNames(name)
    const methods = (options.methods || 'GET,POST')
      .split(',')
      .map(m => m.trim().toUpperCase())

    // Check if API already exists
    const apiPath = options.path || `app/api/${names.kebab}/route.ts`
    const fullPath = resolvePath(apiPath)
    
    if (await fileExists(fullPath)) {
      throw new Error(`API route already exists at ${apiPath}`)
    }

    // Check if service exists
    const servicePath = resolvePath(`lib/services/${names.kebab}.ts`)
    if (!await fileExists(servicePath)) {
      logger.warning(`Service '${names.pascal}Service' not found. You'll need to create it.`)
    }

    // Compile template
    const template = Handlebars.compile(apiTemplate)
    const content = template({
      serviceName: names.pascal,
      kebabName: names.kebab,
      hasGet: methods.includes('GET'),
      hasPost: methods.includes('POST'),
      hasPut: methods.includes('PUT'),
      hasDelete: methods.includes('DELETE'),
      hasPutOrDelete: methods.includes('PUT') || methods.includes('DELETE'),
      auth: options.auth !== false,
      rateLimit: options.rateLimit
    })

    // Write file
    await writeFile(fullPath, content)

    logger.success(`API route created at ${apiPath}`)
    logger.info('Next steps:')
    logger.info(`1. Create the ${names.pascal}Service if it doesn't exist`)
    logger.info('2. Update the validation schemas for your data model')
    logger.info('3. Test the endpoints with proper authentication')
  },

  async interactive() {
    const inquirer = (await import('inquirer')).default
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'API route name:',
        validate: (input: string) => input.length > 0 || 'Name is required'
      },
      {
        type: 'checkbox',
        name: 'methods',
        message: 'Select HTTP methods:',
        choices: ['GET', 'POST', 'PUT', 'DELETE'],
        default: ['GET', 'POST']
      },
      {
        type: 'confirm',
        name: 'auth',
        message: 'Require authentication?',
        default: true
      },
      {
        type: 'confirm',
        name: 'rateLimit',
        message: 'Enable rate limiting?',
        default: false
      },
      {
        type: 'input',
        name: 'path',
        message: 'Custom path (leave empty for default):',
        default: (answers: any) => `app/api/${getNames(answers.name).kebab}/route.ts`
      }
    ])

    await this.generate(answers.name, {
      methods: answers.methods.join(','),
      auth: answers.auth,
      rateLimit: answers.rateLimit,
      path: answers.path
    })
  }
}