# PRP-018A: Development Automation Infrastructure

## 🚀 Quick Start

```bash
# This PRP implements the generators that future features will use:
npm run generate:api <feature-name>        # Generate API routes with rate limiting
npm run generate:service <feature-name>    # Generate services with retry logic
npm run generate:repository <feature-name> # Generate repositories with RLS
npm run generate:component <feature-name>  # Generate UI components
npm run generate:types <feature-name>      # Generate TypeScript types

# Enable real-time quality checks during development:
npm run dev:guards    # Catch security/quality issues immediately
npm run dev:monitor   # Visual dashboard of code quality

# After implementation, developers will get automatically:
✅ Rate limiting on all APIs (enforced by createRouteHandler)
✅ Retry logic with exponential backoff (BaseService)
✅ Organization isolation in all queries (BaseRepository)
✅ Comprehensive error handling and monitoring
✅ TypeScript strict types with no 'any' allowed
✅ Pre-commit quality gates that block bad code
```

## Goal

Build a comprehensive development automation infrastructure that makes writing production-ready code faster and safer by providing code generators, base classes with built-in best practices, and real-time quality enforcement tools.

## Why This Matters

- **Speed**: Reduce feature development time from hours to minutes
- **Quality**: Enforce security, performance, and reliability standards automatically
- **Consistency**: Ensure all code follows the same patterns and best practices
- **Developer Experience**: Make the right way the easiest way
- **Error Prevention**: Catch issues during development, not in production

Currently, developers must remember to add rate limiting, retry logic, error handling, monitoring, and security checks manually. This leads to inconsistent implementations and missed requirements. With this infrastructure, these concerns are handled automatically.

## What We're Building

### 1. Base Classes with Built-in Best Practices
- `BaseService<T>`: Retry logic, circuit breaker, monitoring, error handling
- `BaseRepository<T>`: Organization isolation, soft deletes, audit fields
- `createRouteHandler`: Rate limiting, CSRF protection, auth, validation

### 2. Code Generator CLI
- Generate complete features with one command
- Templates include all required patterns
- Consistent file structure and naming

### 3. Development-Time Quality Enforcement
- Real-time guards that catch issues immediately
- Visual toolbar showing current issues
- Pre-commit hooks that block bad code

### 4. Template System
- Ready-to-use templates for common patterns
- Includes all security and quality measures
- Easy to customize for specific needs

## Context & References

### Existing Patterns to Follow
- **Rate Limiting**: `lib/ratelimiter.ts` - Existing Upstash rate limiter
- **Error Handling**: `app/api/bulk/upload/route.ts:46-78` - CSRF and auth patterns
- **Type Safety**: `types/bulk-operations.types.ts` - Strict TypeScript patterns
- **Monitoring**: `lib/monitoring/accuracy-scorer.ts` - Metrics patterns

### Documentation
- **Commander.js**: https://github.com/tj/commander.js - For CLI tool
- **Plop.js Alternative**: https://plopjs.com/documentation/ - Template generation
- **Husky**: https://typicode.github.io/husky/ - Git hooks
- **TypeScript Compiler API**: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

### Dependencies
- `commander`: CLI framework
- `handlebars`: Template engine
- `husky`: Git hooks
- `lint-staged`: Pre-commit file filtering
- `chalk`: Terminal styling
- `ora`: Terminal spinners

## Implementation Blueprint

### Phase 1: Base Classes (Priority: High)

#### 1.1 BaseRepository with Organization Isolation
```typescript
// lib/base/base-repository.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface RepositoryOptions {
  tableName: string
  softDelete?: boolean
}

export abstract class BaseRepository<T extends { id: string }> {
  protected tableName: string
  protected softDelete: boolean

  constructor(
    protected supabase: SupabaseClient<Database>,
    options: RepositoryOptions
  ) {
    this.tableName = options.tableName
    this.softDelete = options.softDelete ?? true
  }

  // Always includes organization filter
  protected query() {
    // Get org ID from context (auth headers or session)
    const orgId = this.getOrganizationId()
    
    let query = this.supabase.from(this.tableName)
    
    // Always filter by organization
    query = query.eq('organization_id', orgId)
    
    // Filter out soft-deleted records by default
    if (this.softDelete) {
      query = query.is('deleted_at', null)
    }
    
    return query
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw this.handleError(error)
    return data as T
  }

  async create(input: Partial<T>): Promise<T> {
    const enrichedData = {
      ...input,
      organization_id: this.getOrganizationId(),
      created_by: this.getCurrentUserId(),
      updated_by: this.getCurrentUserId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(enrichedData)
      .select()
      .single()

    if (error) throw this.handleError(error)
    return data as T
  }

  async update(id: string, input: Partial<T>): Promise<T> {
    const enrichedData = {
      ...input,
      updated_by: this.getCurrentUserId(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await this.query()
      .update(enrichedData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw this.handleError(error)
    return data as T
  }

  async delete(id: string): Promise<void> {
    if (this.softDelete) {
      await this.update(id, {
        deleted_at: new Date().toISOString(),
        deleted_by: this.getCurrentUserId()
      } as Partial<T>)
    } else {
      const { error } = await this.query()
        .delete()
        .eq('id', id)

      if (error) throw this.handleError(error)
    }
  }

  protected abstract getOrganizationId(): string
  protected abstract getCurrentUserId(): string
  protected abstract handleError(error: any): Error
}
```

#### 1.2 BaseService with Retry and Monitoring
```typescript
// lib/base/base-service.ts
import { EventEmitter } from 'events'
import type { BaseRepository } from './base-repository'

export interface RetryOptions {
  maxAttempts?: number
  backoff?: 'linear' | 'exponential'
  initialDelay?: number
  maxDelay?: number
}

export interface ServiceOptions {
  entityName: string
  metrics?: MetricsCollector
  logger?: Logger
}

export abstract class BaseService<T> extends EventEmitter {
  protected entityName: string
  protected metrics?: MetricsCollector
  protected logger?: Logger
  protected circuitBreaker: CircuitBreaker

  constructor(
    protected repository: BaseRepository<T>,
    options: ServiceOptions
  ) {
    super()
    this.entityName = options.entityName
    this.metrics = options.metrics
    this.logger = options.logger
    
    this.circuitBreaker = new CircuitBreaker({
      name: `${this.entityName}-service`,
      timeout: 5000,
      errorThreshold: 50,
      resetTimeout: 30000
    })
  }

  protected async withRetry<R>(
    operation: () => Promise<R>,
    options: RetryOptions = {}
  ): Promise<R> {
    const {
      maxAttempts = 3,
      backoff = 'exponential',
      initialDelay = 1000,
      maxDelay = 10000
    } = options

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Track attempt
        this.metrics?.increment(`${this.entityName}.attempt`, { attempt })
        
        // Execute operation
        const result = await operation()
        
        // Track success
        this.metrics?.increment(`${this.entityName}.success`)
        
        return result
      } catch (error) {
        lastError = error as Error
        
        // Track failure
        this.metrics?.increment(`${this.entityName}.failure`, {
          attempt,
          error: error.code || 'unknown'
        })

        // Don't retry on non-retryable errors
        if (!this.isRetryable(error)) {
          throw error
        }

        // Don't retry if this is the last attempt
        if (attempt === maxAttempts) {
          throw error
        }

        // Calculate delay
        const delay = backoff === 'exponential'
          ? Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
          : initialDelay * attempt

        // Log retry
        this.logger?.warn(`Retrying ${this.entityName} operation`, {
          attempt,
          delay,
          error: error.message
        })

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  protected async withCircuitBreaker<R>(
    operation: () => Promise<R>
  ): Promise<R> {
    if (this.circuitBreaker.isOpen()) {
      throw new Error(`Circuit breaker is open for ${this.entityName}`)
    }

    try {
      const result = await operation()
      this.circuitBreaker.recordSuccess()
      return result
    } catch (error) {
      this.circuitBreaker.recordFailure()
      throw error
    }
  }

  protected isRetryable(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true
    }
    
    // HTTP status codes that are retryable
    if (error.status === 429 || error.status === 503) {
      return true
    }
    
    // Database connection errors
    if (error.code === 'ECONNRESET' || error.code === '57P01') {
      return true
    }
    
    return false
  }
}
```

#### 1.3 Route Handler Wrapper
```typescript
// lib/api/route-handler.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ratelimit } from '@/lib/ratelimiter'
import { validateCSRFToken } from '@/lib/utils/csrf'
import { createServerClient } from '@/lib/supabase/server'

export interface RouteHandlerConfig<T = any> {
  schema?: z.ZodType<T>
  rateLimit?: {
    requests: number
    window: string
  }
  requireAuth?: boolean
  requireOrgAccess?: boolean
  handler: (context: {
    input: T
    user?: User
    organizationId?: string
    supabase: SupabaseClient
  }) => Promise<any>
}

export function createRouteHandler<T = any>(
  config: RouteHandlerConfig<T>
) {
  return async (request: NextRequest) => {
    try {
      // 1. Rate limiting
      if (config.rateLimit) {
        const identifier = request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'anonymous'
        
        const { success, limit, reset, remaining } = await ratelimit.limit(
          `${request.method}:${request.url}:${identifier}`
        )
        
        if (!success) {
          return NextResponse.json(
            { error: 'Too many requests' },
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': new Date(reset).toISOString(),
                'Retry-After': Math.floor((reset - Date.now()) / 1000).toString()
              }
            }
          )
        }
      }

      // 2. CSRF validation for mutations
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const isValid = await validateCSRFToken(request)
        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid CSRF token' },
            { status: 403 }
          )
        }
      }

      // 3. Authentication
      const supabase = createServerClient()
      let user = null
      let organizationId = null

      if (config.requireAuth) {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!authUser) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }
        
        user = authUser

        // Get organization if needed
        if (config.requireOrgAccess) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

          if (!profile?.organization_id) {
            return NextResponse.json(
              { error: 'User not associated with an organization' },
              { status: 403 }
            )
          }

          organizationId = profile.organization_id
        }
      }

      // 4. Input validation
      let input: T
      if (config.schema) {
        try {
          const body = await request.json()
          input = config.schema.parse(body)
        } catch (error) {
          if (error instanceof z.ZodError) {
            return NextResponse.json(
              { 
                error: 'Validation failed',
                details: error.errors
              },
              { status: 400 }
            )
          }
          throw error
        }
      } else {
        input = await request.json()
      }

      // 5. Execute handler
      const result = await config.handler({
        input,
        user,
        organizationId,
        supabase
      })

      // 6. Return success response
      return NextResponse.json(result)

    } catch (error) {
      // Log error
      console.error('Route handler error:', error)

      // Return error response
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
```

### Phase 2: Code Generator CLI

#### 2.1 Main CLI Entry Point
```typescript
// scripts/generate.ts
#!/usr/bin/env node
import { Command } from 'commander'
import { generateAPI } from './generators/api'
import { generateService } from './generators/service'
import { generateRepository } from './generators/repository'
import { generateComponent } from './generators/component'
import { generateTypes } from './generators/types'
import chalk from 'chalk'

const program = new Command()

program
  .name('generate')
  .description('TruthSource code generator')
  .version('1.0.0')

program
  .command('api <name>')
  .description('Generate an API route with rate limiting and auth')
  .option('-m, --methods <methods>', 'HTTP methods to generate', 'GET,POST,PUT,DELETE')
  .action(async (name, options) => {
    await generateAPI(name, options)
  })

program
  .command('service <name>')
  .description('Generate a service with retry logic and monitoring')
  .action(async (name) => {
    await generateService(name)
  })

program
  .command('repository <name>')
  .description('Generate a repository with RLS and org isolation')
  .action(async (name) => {
    await generateRepository(name)
  })

program
  .command('component <name>')
  .description('Generate a UI component with loading/error states')
  .option('-t, --type <type>', 'Component type (page|feature|ui)', 'feature')
  .action(async (name, options) => {
    await generateComponent(name, options)
  })

program
  .command('types <table>')
  .description('Generate TypeScript types from database table')
  .action(async (table) => {
    await generateTypes(table)
  })

program.parse()
```

#### 2.2 API Generator
```typescript
// scripts/generators/api.ts
import fs from 'fs/promises'
import path from 'path'
import { compile } from 'handlebars'
import chalk from 'chalk'
import ora from 'ora'

export async function generateAPI(name: string, options: any) {
  const spinner = ora('Generating API route').start()

  try {
    // Parse name for nested routes
    const parts = name.split('/')
    const routeName = parts[parts.length - 1]
    const routePath = path.join('app', 'api', ...parts)

    // Create directory
    await fs.mkdir(routePath, { recursive: true })

    // Load template
    const templatePath = path.join(__dirname, '../../templates/api-route.template.ts')
    const template = await fs.readFile(templatePath, 'utf-8')

    // Compile template
    const compiled = compile(template)
    const content = compiled({
      name: routeName,
      Name: capitalize(routeName),
      methods: options.methods.split(',')
    })

    // Write file
    const filePath = path.join(routePath, 'route.ts')
    await fs.writeFile(filePath, content)

    // Generate test file
    await generateAPITest(name, routePath)

    spinner.succeed(chalk.green(`✅ Generated API route: ${filePath}`))
    
    console.log(chalk.cyan('\nNext steps:'))
    console.log(`1. Update the schema in ${filePath}`)
    console.log(`2. Implement the handler logic`)
    console.log(`3. Run tests: npm test ${routePath}`)

  } catch (error) {
    spinner.fail(chalk.red('Failed to generate API route'))
    console.error(error)
    process.exit(1)
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
```

### Phase 3: Template Files

#### 3.1 API Route Template
```typescript
// templates/api-route.template.ts
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

const {{name}}Schema = z.object({
  // TODO: Define your schema
  name: z.string().min(1).max(255),
  description: z.string().optional(),
})

type {{Name}}Input = z.infer<typeof {{name}}Schema>

{{#if (includes methods "GET")}}
export const GET = createRouteHandler({
  requireAuth: true,
  requireOrgAccess: true,
  handler: async ({ supabase, organizationId }) => {
    // TODO: Implement GET logic
    const { data, error } = await supabase
      .from('{{name}}s')
      .select('*')
      .eq('organization_id', organizationId)

    if (error) throw error

    return { data }
  }
})
{{/if}}

{{#if (includes methods "POST")}}
export const POST = createRouteHandler({
  schema: {{name}}Schema,
  rateLimit: { requests: 100, window: '1h' },
  requireAuth: true,
  requireOrgAccess: true,
  handler: async ({ input, supabase, user, organizationId }) => {
    // TODO: Implement POST logic
    const { data, error } = await supabase
      .from('{{name}}s')
      .insert({
        ...input,
        organization_id: organizationId,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single()

    if (error) throw error

    return { data }
  }
})
{{/if}}

{{#if (includes methods "PUT")}}
export const PUT = createRouteHandler({
  schema: {{name}}Schema.extend({ id: z.string().uuid() }),
  rateLimit: { requests: 100, window: '1h' },
  requireAuth: true,
  requireOrgAccess: true,
  handler: async ({ input, supabase, user, organizationId }) => {
    const { id, ...updateData } = input

    // TODO: Implement PUT logic
    const { data, error } = await supabase
      .from('{{name}}s')
      .update({
        ...updateData,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (error) throw error

    return { data }
  }
})
{{/if}}

{{#if (includes methods "DELETE")}}
export const DELETE = createRouteHandler({
  schema: z.object({ id: z.string().uuid() }),
  rateLimit: { requests: 50, window: '1h' },
  requireAuth: true,
  requireOrgAccess: true,
  handler: async ({ input, supabase, user, organizationId }) => {
    // TODO: Implement DELETE logic (soft delete)
    const { error } = await supabase
      .from('{{name}}s')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', input.id)
      .eq('organization_id', organizationId)

    if (error) throw error

    return { success: true }
  }
})
{{/if}}
```

#### 3.2 Service Template
```typescript
// templates/service.template.ts
import { BaseService } from '@/lib/base/base-service'
import { {{Name}}Repository } from './{{name}}.repository'
import type { {{Name}} } from '@/types/{{name}}.types'

export class {{Name}}Service extends BaseService<{{Name}}> {
  protected entityName = '{{name}}'

  constructor(repository: {{Name}}Repository) {
    super(repository, {
      entityName: '{{name}}',
      // TODO: Add metrics and logger if needed
    })
  }

  async create{{Name}}(input: Create{{Name}}Input): Promise<{{Name}}> {
    return this.withRetry(async () => {
      // TODO: Add business logic validation
      
      return this.repository.create(input)
    })
  }

  async update{{Name}}(id: string, input: Update{{Name}}Input): Promise<{{Name}}> {
    return this.withRetry(async () => {
      // TODO: Add business logic validation
      
      return this.repository.update(id, input)
    })
  }

  async delete{{Name}}(id: string): Promise<void> {
    return this.withRetry(async () => {
      // TODO: Add any cleanup logic
      
      return this.repository.delete(id)
    })
  }

  async get{{Name}}ById(id: string): Promise<{{Name}} | null> {
    return this.withCircuitBreaker(async () => {
      return this.repository.findById(id)
    })
  }

  // TODO: Add custom business logic methods
}
```

### Phase 4: Development Guards

#### 4.1 Query Monitor
```typescript
// lib/dev/guards/query-monitor.ts
import { SupabaseClient } from '@supabase/supabase-js'

const SYSTEM_TABLES = ['migrations', 'schema_migrations', '_realtime']

export function installQueryMonitor(supabase: SupabaseClient) {
  if (process.env.NODE_ENV !== 'development') return
  if (!process.env.DEV_GUARDS) return

  // Intercept queries
  const originalFrom = supabase.from.bind(supabase)
  
  supabase.from = function(table: string) {
    const queryBuilder = originalFrom(table)
    const originalSelect = queryBuilder.select.bind(queryBuilder)
    
    queryBuilder.select = function(...args: any[]) {
      const selectQuery = originalSelect(...args)
      const originalExecute = selectQuery.then.bind(selectQuery)
      
      selectQuery.then = async function(resolve: any, reject: any) {
        // Check if query includes organization_id
        const query = this.toString()
        
        if (!SYSTEM_TABLES.includes(table) && !query.includes('organization_id')) {
          const error = new Error(`
            🚨 SECURITY VIOLATION: Query missing organization_id filter
            
            Table: ${table}
            Query: ${query}
            
            Fix: Add .eq('organization_id', organizationId) to your query
            
            Example:
            await supabase
              .from('${table}')
              .select('*')
              .eq('organization_id', organizationId) // <-- Add this
          `)
          
          console.error(error)
          throw error
        }
        
        return originalExecute(resolve, reject)
      }
      
      return selectQuery
    }
    
    return queryBuilder
  }
}
```

#### 4.2 Route Monitor
```typescript
// lib/dev/guards/route-monitor.ts
import { NextResponse } from 'next/server'

const checkedRoutes = new Set<string>()

export function checkRouteHandler(
  method: string,
  path: string,
  handler: Function
) {
  if (process.env.NODE_ENV !== 'development') return handler
  if (!process.env.DEV_GUARDS) return handler

  const routeKey = `${method}:${path}`
  
  if (!checkedRoutes.has(routeKey)) {
    const handlerString = handler.toString()
    
    // Check for rate limiting
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      if (!handlerString.includes('rateLimit') && !handlerString.includes('createRouteHandler')) {
        console.error(`
          🚨 MISSING RATE LIMIT: ${method} ${path}
          
          Fix: Use createRouteHandler with rate limiting:
          
          export const ${method} = createRouteHandler({
            rateLimit: { requests: 100, window: '1h' },
            handler: async (context) => {
              // Your logic here
            }
          })
        `)
      }
    }
    
    // Check for CSRF protection
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (!handlerString.includes('validateCSRFToken') && !handlerString.includes('createRouteHandler')) {
        console.error(`
          🚨 MISSING CSRF PROTECTION: ${method} ${path}
          
          Fix: Use createRouteHandler (includes CSRF protection)
        `)
      }
    }
    
    checkedRoutes.add(routeKey)
  }
  
  return handler
}
```

### Phase 5: Pre-commit Hooks

#### 5.1 Setup Script
```typescript
// scripts/setup-hooks.ts
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

export async function setupHooks() {
  console.log(chalk.cyan('Setting up git hooks...'))

  // Install husky
  execSync('npx husky install', { stdio: 'inherit' })

  // Create pre-commit hook
  const preCommitPath = path.join('.husky', 'pre-commit')
  const preCommitContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run checks
npm run pre-commit-checks
`

  fs.writeFileSync(preCommitPath, preCommitContent)
  fs.chmodSync(preCommitPath, '755')

  // Create pre-commit checks script
  const checksPath = path.join('scripts', 'pre-commit-checks.ts')
  const checksContent = `import { checkRateLimits } from './checks/rate-limits'
import { checkOrgIsolation } from './checks/org-isolation'
import { checkTypes } from './checks/types'
import { runTests } from './checks/tests'

async function runChecks() {
  console.log('🔍 Running pre-commit checks...')
  
  try {
    await checkTypes()
    await checkRateLimits()
    await checkOrgIsolation()
    await runTests()
    
    console.log('✅ All checks passed!')
  } catch (error) {
    console.error('❌ Pre-commit checks failed:', error.message)
    process.exit(1)
  }
}

runChecks()
`

  fs.writeFileSync(checksPath, checksContent)

  console.log(chalk.green('✅ Git hooks setup complete!'))
}
```

#### 5.2 Rate Limit Checker
```typescript
// scripts/checks/rate-limits.ts
import glob from 'glob'
import fs from 'fs/promises'
import path from 'path'

export async function checkRateLimits() {
  const apiRoutes = glob.sync('app/api/**/route.ts')
  const issues: string[] = []

  for (const file of apiRoutes) {
    const content = await fs.readFile(file, 'utf-8')
    
    // Check each HTTP method
    const methods = ['POST', 'PUT', 'DELETE', 'PATCH']
    
    for (const method of methods) {
      if (content.includes(`export const ${method}`)) {
        // Check if it uses createRouteHandler or has rate limiting
        if (!content.includes('createRouteHandler') && !content.includes('rateLimit')) {
          issues.push(`${file}: ${method} method missing rate limiting`)
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Rate limiting issues found:\n${issues.join('\n')}`)
  }
}
```

### Phase 6: Visual Dev Toolbar

```tsx
// components/dev-toolbar/index.tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'

interface DevIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  quickFix?: () => void
}

export function DevToolbar() {
  const [issues, setIssues] = useState<DevIssue[]>([])
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    // Listen for dev guard violations
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('SECURITY VIOLATION')) {
        setIssues(prev => [...prev, {
          id: Date.now().toString(),
          type: 'error',
          message: event.error.message,
          quickFix: () => {
            // Open file in VS Code
            window.open(`vscode://file/${event.filename}:${event.lineno}`)
          }
        }])
      }
    }

    window.addEventListener('error', handleError)
    
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (process.env.NODE_ENV !== 'development') return null
  if (issues.length === 0) return null

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 left-4 bg-red-600 text-white rounded-full p-2"
      >
        <AlertCircle className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Development Issues ({issues.length})
          </h3>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {issues.map(issue => (
            <div
              key={issue.id}
              className="flex items-center justify-between bg-gray-800 rounded p-2"
            >
              <div className="flex-1">
                <p className="text-sm font-mono">{issue.message}</p>
                {issue.file && (
                  <p className="text-xs text-gray-400">{issue.file}:{issue.line}</p>
                )}
              </div>
              {issue.quickFix && (
                <button
                  onClick={issue.quickFix}
                  className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Fix
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

## Validation

### Automated Checks (Built into the system)
- Pre-commit hooks prevent committing without tests
- Dev guards catch security issues in real-time
- TypeScript compilation enforces type safety
- Generator templates include all requirements

### Manual Verification
```bash
# Test generators
npm run generate:api test/feature
npm run generate:service test-service
npm run generate:repository test-repo

# Verify generated files
cat app/api/test/feature/route.ts
cat lib/services/test-service.service.ts
cat lib/repositories/test-repo.repository.ts

# Test dev guards
DEV_GUARDS=true npm run dev

# Test pre-commit hooks
git add .
git commit -m "test"  # Should run checks
```

## Success Criteria

- [ ] All generators create working code with built-in quality measures
- [ ] Base classes handle common concerns automatically
- [ ] Dev guards catch issues during development
- [ ] Pre-commit hooks block bad code from being committed
- [ ] Development toolbar shows issues visually
- [ ] Generated code passes all existing lint/type checks
- [ ] Documentation updated with new patterns

## Dependencies

- **Required PRPs**: None - this is foundational infrastructure
- **NPM packages**: 
  - `commander`: ^11.0.0
  - `handlebars`: ^4.7.8
  - `chalk`: ^5.3.0
  - `ora`: ^7.0.1
  - `husky`: ^8.0.3
  - `lint-staged`: ^15.0.0

## Implementation Order

1. **Base Classes** (2 days)
   - BaseRepository with org isolation
   - BaseService with retry/monitoring
   - createRouteHandler wrapper

2. **Code Generators** (1 day)
   - CLI framework
   - Template system
   - Generator implementations

3. **Development Guards** (1 day)
   - Query monitoring
   - Route checking
   - Real-time validation

4. **Quality Automation** (1 day)
   - Pre-commit hooks
   - Automated checks
   - Dev toolbar

Total: ~5 days

## Risk Mitigation

- **Performance**: Dev guards only run in development mode
- **Compatibility**: Base classes extend, not replace existing code
- **Adoption**: Generators create familiar patterns
- **Migration**: Existing code continues to work

## Future Enhancements

- Generator for complete features (API + Service + Repository + UI)
- AI-powered code review in pre-commit
- Performance profiling in base classes
- Automatic documentation generation