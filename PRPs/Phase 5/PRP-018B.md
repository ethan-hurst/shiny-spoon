# PRP-018B: Code Generator CLI Implementation

## 🚀 Quick Start

```bash
# After implementation, developers will be able to:
npm run generate:api products/batch     # Generate API with rate limiting & auth
npm run generate:service batch-processor # Generate service with retry & monitoring
npm run generate:repository batches      # Generate repository with org isolation
npm run generate:component batch-upload  # Generate UI with loading states
npm run generate:feature user-management # Generate complete feature stack

# The generators will automatically:
✅ Use existing base classes (BaseService, BaseRepository)
✅ Apply createRouteHandler for API security
✅ Include TypeScript types with strict mode
✅ Add test files with coverage setup
✅ Follow project conventions and structure
✅ Include proper error handling patterns
```

## Goal

Build a comprehensive code generator CLI that leverages our existing base infrastructure (BaseService, BaseRepository, createRouteHandler) to enable developers to scaffold production-ready features in under 5 minutes with all security, monitoring, and quality measures built-in.

## Why This Matters

- **Speed**: Transform 2-hour feature development into 5-minute scaffolding + customization
- **Consistency**: Every generated feature follows established patterns automatically
- **Quality**: Impossible to forget security measures - they're baked into templates
- **Onboarding**: New developers immediately write production-ready code
- **Maintenance**: Updates to base classes automatically benefit all features

Currently, developers must manually create files, remember to extend base classes, and implement patterns correctly. This leads to inconsistency and missed requirements. The generator ensures every feature starts with the right foundation.

## What We're Building

### 1. **CLI Tool with Commander.js**
- Interactive prompts for configuration
- Validation of inputs and paths
- Progress indicators with ora
- Success/error reporting with chalk

### 2. **Template System**
- Handlebars-based templates
- Dynamic imports and naming
- Conditional sections based on options
- Extensible for custom templates

### 3. **Generator Commands**
- `generate:api` - API routes with auth/rate-limiting
- `generate:service` - Services extending BaseService
- `generate:repository` - Repositories extending BaseRepository
- `generate:component` - React components with loading/error states
- `generate:feature` - Complete feature stack (all of the above)

### 4. **Quality Enforcement**
- Generated tests with coverage setup
- ESLint/Prettier pre-configured
- TypeScript strict mode enforced
- Import paths validated

## Context & References

### Existing Infrastructure to Build Upon
- **Base Classes**: 
  - `lib/base/base-repository.ts` - Already provides org isolation, soft deletes
  - `lib/base/base-service.ts` - Already provides retry, circuit breaker
  - `lib/api/route-handler.ts` - Already provides auth, rate limiting
- **Patterns to Follow**:
  - `app/api/bulk/upload/route.ts` - Example of createRouteHandler usage
  - `lib/integrations/netsuite/connector.ts` - Example of service patterns
  - `types/` directory structure - TypeScript organization

### Documentation
- **Commander.js**: https://github.com/tj/commander.js#readme - CLI framework
- **Handlebars**: https://handlebarsjs.com/guide/ - Template engine
- **Inquirer**: https://github.com/SBoudrias/Inquirer.js - Interactive prompts
- **Ora**: https://github.com/sindresorhus/ora - Elegant terminal spinners
- **Chalk**: https://github.com/chalk/chalk - Terminal string styling

### Dependencies to Add
```json
{
  "devDependencies": {
    "commander": "^11.0.0",
    "handlebars": "^4.7.8",
    "inquirer": "^9.2.12",
    "ora": "^7.0.1",
    "chalk": "^5.3.0",
    "fs-extra": "^11.2.0"
  }
}
```

## Implementation Blueprint

### Phase 1: CLI Foundation (Day 1)

#### 1.1 Main CLI Entry Point
```typescript
// scripts/generate.ts
#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { generateAPI } from './generators/api'
import { generateService } from './generators/service'
import { generateRepository } from './generators/repository'
import { generateComponent } from './generators/component'
import { generateFeature } from './generators/feature'

const program = new Command()

program
  .name('generate')
  .description('TruthSource code generator')
  .version('1.0.0')

// API Generator
program
  .command('api <name>')
  .description('Generate an API route with auth and rate limiting')
  .option('-m, --methods <methods>', 'HTTP methods (comma-separated)', 'GET,POST,PUT,DELETE')
  .option('-p, --public', 'Create public route (no auth)')
  .option('-a, --admin', 'Create admin-only route')
  .action(async (name, options) => {
    await generateAPI(name, options)
  })

// Service Generator
program
  .command('service <name>')
  .description('Generate a service with retry logic and monitoring')
  .option('-r, --repository', 'Include repository generation')
  .action(async (name, options) => {
    await generateService(name, options)
  })

// Repository Generator
program
  .command('repository <name>')
  .description('Generate a repository with org isolation')
  .option('-t, --table <table>', 'Database table name')
  .action(async (name, options) => {
    await generateRepository(name, options)
  })

// Component Generator
program
  .command('component <name>')
  .description('Generate a React component')
  .option('-t, --type <type>', 'Component type', 'feature')
  .option('-s, --stories', 'Include Storybook stories')
  .action(async (name, options) => {
    await generateComponent(name, options)
  })

// Feature Generator (complete stack)
program
  .command('feature <name>')
  .description('Generate complete feature stack')
  .action(async (name) => {
    await generateFeature(name)
  })

program.parse()
```

#### 1.2 Package.json Scripts
```json
{
  "scripts": {
    "generate": "tsx scripts/generate.ts",
    "generate:api": "tsx scripts/generate.ts api",
    "generate:service": "tsx scripts/generate.ts service",
    "generate:repository": "tsx scripts/generate.ts repository",
    "generate:component": "tsx scripts/generate.ts component",
    "generate:feature": "tsx scripts/generate.ts feature"
  }
}
```

### Phase 2: Template System (Day 2)

#### 2.1 API Route Template
```handlebars
// templates/api-route.hbs
import { createRouteHandler{{#if admin}}, createAdminRouteHandler{{/if}}{{#if public}}, createPublicRouteHandler{{/if}} } from '@/lib/api/route-handler'
import { z } from 'zod'
import { {{serviceName}}Service } from '@/lib/services/{{name}}.service'
import { {{repositoryName}}Repository } from '@/lib/repositories/{{name}}.repository'
import { createClient } from '@/lib/utils/supabase/server'

// Input validation schema
const {{camelCase name}}Schema = z.object({
  // TODO: Define your input schema
  name: z.string().min(1).max(255),
  description: z.string().optional(),
})

{{#each methods}}
{{#if (eq this "GET")}}
export const GET = create{{#if ../public}}Public{{/if}}{{#if ../admin}}Admin{{/if}}RouteHandler(
  async ({ query, user }) => {
    const supabase = await createClient()
    const repository = new {{../repositoryName}}Repository(supabase, user)
    const service = new {{../serviceName}}Service(repository)

    // Parse query parameters
    const { page = 1, limit = 20 } = query || {}

    // Fetch data
    const data = await service.getAll({
      page: Number(page),
      limit: Number(limit),
      organizationId: user?.organizationId
    })

    return NextResponse.json(data)
  },
  {
    {{#unless ../public}}auth: true,{{/unless}}
    schema: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
      })
    }
  }
)
{{/if}}

{{#if (eq this "POST")}}
export const POST = create{{#if ../public}}Public{{/if}}{{#if ../admin}}Admin{{/if}}RouteHandler(
  async ({ body, user }) => {
    const supabase = await createClient()
    const repository = new {{../repositoryName}}Repository(supabase, user)
    const service = new {{../serviceName}}Service(repository)

    const result = await service.create(body)

    return NextResponse.json(result, { status: 201 })
  },
  {
    {{#unless ../public}}auth: true,{{/unless}}
    schema: {
      body: {{../camelCase ../name}}Schema
    },
    rateLimit: {
      requests: 100,
      window: '1h'
    }
  }
)
{{/if}}

{{#if (eq this "PUT")}}
export const PUT = create{{#if ../public}}Public{{/if}}{{#if ../admin}}Admin{{/if}}RouteHandler(
  async ({ params, body, user }) => {
    const supabase = await createClient()
    const repository = new {{../repositoryName}}Repository(supabase, user)
    const service = new {{../serviceName}}Service(repository)

    const result = await service.update(params.id, body)

    return NextResponse.json(result)
  },
  {
    {{#unless ../public}}auth: true,{{/unless}}
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: {{../camelCase ../name}}Schema
    },
    rateLimit: {
      requests: 100,
      window: '1h'
    }
  }
)
{{/if}}

{{#if (eq this "DELETE")}}
export const DELETE = create{{#if ../public}}Public{{/if}}{{#if ../admin}}Admin{{/if}}RouteHandler(
  async ({ params, user }) => {
    const supabase = await createClient()
    const repository = new {{../repositoryName}}Repository(supabase, user)
    const service = new {{../serviceName}}Service(repository)

    await service.delete(params.id)

    return NextResponse.json({ success: true })
  },
  {
    {{#unless ../public}}auth: true,{{/unless}}
    schema: {
      params: z.object({ id: z.string().uuid() })
    },
    rateLimit: {
      requests: 50,
      window: '1h'
    }
  }
)
{{/if}}
{{/each}}
```

#### 2.2 Service Template
```handlebars
// templates/service.hbs
import { BaseService } from '@/lib/base/base-service'
import type { {{interfaceName}}Repository } from '@/lib/repositories/{{name}}.repository'
import type { {{interfaceName}}, Create{{interfaceName}}Input, Update{{interfaceName}}Input } from '@/types/{{name}}.types'

export class {{className}}Service extends BaseService {
  constructor(private repository: {{interfaceName}}Repository) {
    super({
      serviceName: '{{name}}-service',
      maxRetries: 3,
      circuitBreakerEnabled: true,
      monitoring: true
    })
  }

  /**
   * Get all {{pluralName}} with pagination
   */
  async getAll(options: {
    page: number
    limit: number
    organizationId?: string
  }) {
    return this.execute(async () => {
      const offset = (options.page - 1) * options.limit
      
      const [items, total] = await Promise.all([
        this.repository.findAll({
          limit: options.limit,
          offset,
          organizationId: options.organizationId
        }),
        this.repository.count({ organizationId: options.organizationId })
      ])

      return {
        items,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit)
      }
    })
  }

  /**
   * Get a single {{name}} by ID
   */
  async getById(id: string): Promise<{{interfaceName}} | null> {
    return this.execute(() => this.repository.findById(id))
  }

  /**
   * Create a new {{name}}
   */
  async create(input: Create{{interfaceName}}Input): Promise<{{interfaceName}}> {
    // Validate input
    const validated = this.validateInput<Create{{interfaceName}}Input>(input)
    
    return this.execute(async () => {
      // TODO: Add business logic validation
      
      this.log('info', 'Creating {{name}}', { input: validated })
      const result = await this.repository.create(validated)
      
      // TODO: Emit events, update cache, etc.
      
      return result
    })
  }

  /**
   * Update an existing {{name}}
   */
  async update(id: string, input: Update{{interfaceName}}Input): Promise<{{interfaceName}}> {
    // Validate input
    const validated = this.validateInput<Update{{interfaceName}}Input>(input)
    
    return this.execute(async () => {
      // Check if exists
      const existing = await this.repository.findById(id)
      if (!existing) {
        throw new Error('{{interfaceName}} not found')
      }
      
      // TODO: Add business logic validation
      
      this.log('info', 'Updating {{name}}', { id, input: validated })
      const result = await this.repository.update(id, validated)
      
      // TODO: Emit events, update cache, etc.
      
      return result
    })
  }

  /**
   * Delete a {{name}}
   */
  async delete(id: string): Promise<void> {
    return this.execute(async () => {
      // Check if exists
      const existing = await this.repository.findById(id)
      if (!existing) {
        throw new Error('{{interfaceName}} not found')
      }
      
      // TODO: Check for dependencies, cascade deletes, etc.
      
      this.log('info', 'Deleting {{name}}', { id })
      await this.repository.delete(id)
      
      // TODO: Emit events, clear cache, etc.
    })
  }

  /**
   * Validate input data
   */
  protected validateInput<T>(data: unknown): T {
    // TODO: Implement validation logic
    // For now, just return as-is (TypeScript will enforce types)
    return data as T
  }

  /**
   * Health check for this service
   */
  protected async runHealthCheck(): Promise<boolean> {
    try {
      // Test repository connection
      await this.repository.count({})
      return true
    } catch (error) {
      this.log('error', 'Health check failed', error)
      return false
    }
  }
}
```

#### 2.3 Repository Template
```handlebars
// templates/repository.hbs
import { BaseRepository } from '@/lib/base/base-repository'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { {{interfaceName}} } from '@/types/{{name}}.types'
import type { Database } from '@/types/database.types'

export class {{className}}Repository extends BaseRepository<{{interfaceName}}> {
  constructor(
    supabase: SupabaseClient<Database>,
    private user?: { id: string; organizationId: string }
  ) {
    super(supabase, {
      tableName: '{{tableName}}',
      softDelete: true
    })
  }

  /**
   * Get organization ID from user context
   */
  protected getOrganizationId(): string | null {
    return this.user?.organizationId || null
  }

  /**
   * Get current user ID from user context
   */
  protected getCurrentUserId(): string | null {
    return this.user?.id || null
  }

  /**
   * Custom query with proper typing
   */
  protected query() {
    return super.query() as any // Type this properly based on your database schema
  }

  /**
   * Find all with custom filters and pagination
   */
  async findAll(options?: {
    limit?: number
    offset?: number
    organizationId?: string
    filters?: Partial<{{interfaceName}}>
  }): Promise<{{interfaceName}}[]> {
    let query = this.query().select('*')

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value)
        }
      })
    }

    const { data, error } = await query

    if (error) throw this.handleError(error)
    return data || []
  }

  /**
   * Search {{pluralName}} by name or description
   */
  async search(searchTerm: string): Promise<{{interfaceName}}[]> {
    const { data, error } = await this.query()
      .select('*')
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .limit(20)

    if (error) throw this.handleError(error)
    return data || []
  }

  // TODO: Add custom repository methods as needed
}

export type {{interfaceName}}Repository = {{className}}Repository
```

### Phase 3: Generator Implementation (Day 3)

#### 3.1 API Generator
```typescript
// scripts/generators/api.ts
import fs from 'fs-extra'
import path from 'path'
import Handlebars from 'handlebars'
import chalk from 'chalk'
import ora from 'ora'
import { formatCode } from '../utils/formatter'
import { validatePath } from '../utils/validator'

export async function generateAPI(name: string, options: any) {
  const spinner = ora('Generating API route...').start()

  try {
    // Parse the name for nested routes
    const parts = name.split('/')
    const baseName = parts[parts.length - 1]
    const routePath = path.join('app', 'api', ...parts)

    // Validate path
    if (!validatePath(routePath)) {
      throw new Error('Invalid API route path')
    }

    // Create directory
    await fs.ensureDir(routePath)

    // Check if route already exists
    const routeFile = path.join(routePath, 'route.ts')
    if (await fs.pathExists(routeFile)) {
      throw new Error(`API route already exists at ${routeFile}`)
    }

    // Load and compile template
    const templatePath = path.join(__dirname, '../../templates/api-route.hbs')
    const templateContent = await fs.readFile(templatePath, 'utf-8')
    const template = Handlebars.compile(templateContent)

    // Prepare template data
    const templateData = {
      name: baseName,
      camelCase: toCamelCase(baseName),
      className: toPascalCase(baseName),
      interfaceName: toPascalCase(baseName),
      serviceName: `${toPascalCase(baseName)}Service`,
      repositoryName: `${toPascalCase(baseName)}Repository`,
      methods: options.methods.split(',').map((m: string) => m.trim().toUpperCase()),
      public: options.public,
      admin: options.admin
    }

    // Generate content
    const content = template(templateData)
    const formattedContent = await formatCode(content, 'typescript')

    // Write file
    await fs.writeFile(routeFile, formattedContent)

    // Generate test file
    await generateAPITest(routePath, baseName, templateData)

    spinner.succeed(chalk.green(`✅ Generated API route: ${routeFile}`))

    // Show next steps
    console.log(chalk.cyan('\nNext steps:'))
    console.log(`1. Update the schema in ${chalk.yellow(routeFile)}`)
    console.log(`2. Implement any custom business logic`)
    console.log(`3. Run tests: ${chalk.yellow(`npm test ${routePath}`)}`)
    
    if (!options.public) {
      console.log(`4. Route is protected by auth - test with authenticated user`)
    }

  } catch (error) {
    spinner.fail(chalk.red('Failed to generate API route'))
    console.error(error)
    process.exit(1)
  }
}

async function generateAPITest(routePath: string, name: string, data: any) {
  const testDir = path.join(routePath, '__tests__')
  await fs.ensureDir(testDir)

  const testTemplate = `
import { NextRequest } from 'next/server'
import { GET, POST, PUT, DELETE } from '../route'

describe('${data.className} API', () => {
  ${data.methods.includes('GET') ? `
  describe('GET', () => {
    it('should return ${data.name} list', async () => {
      const request = new NextRequest('http://localhost/api/${data.name}')
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
    })
  })
  ` : ''}

  ${data.methods.includes('POST') ? `
  describe('POST', () => {
    it('should create a new ${data.name}', async () => {
      const body = {
        name: 'Test ${data.className}',
        description: 'Test description'
      }
      
      const request = new NextRequest('http://localhost/api/${data.name}', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data.name).toBe(body.name)
    })
  })
  ` : ''}

  // TODO: Add more tests
})
`

  const formattedTest = await formatCode(testTemplate, 'typescript')
  await fs.writeFile(path.join(testDir, `${name}.test.ts`), formattedTest)
}

// Helper functions
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}
```

### Phase 4: Complete Feature Generator (Day 4)

#### 4.1 Feature Generator
```typescript
// scripts/generators/feature.ts
import inquirer from 'inquirer'
import chalk from 'chalk'
import { generateAPI } from './api'
import { generateService } from './service'
import { generateRepository } from './repository'
import { generateComponent } from './component'
import { generateTypes } from './types'

export async function generateFeature(name: string) {
  console.log(chalk.cyan('🚀 Generating complete feature stack...\n'))

  // Interactive prompts
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Feature description:',
      default: `${name} management`
    },
    {
      type: 'input',
      name: 'tableName',
      message: 'Database table name:',
      default: `${name}s`
    },
    {
      type: 'checkbox',
      name: 'methods',
      message: 'Select API methods:',
      choices: ['GET', 'POST', 'PUT', 'DELETE'],
      default: ['GET', 'POST', 'PUT', 'DELETE']
    },
    {
      type: 'confirm',
      name: 'includeUI',
      message: 'Include UI components?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeTests',
      message: 'Generate test files?',
      default: true
    }
  ])

  try {
    // Generate in order
    console.log(chalk.yellow('\n📁 Generating types...'))
    await generateTypes(answers.tableName)

    console.log(chalk.yellow('\n📁 Generating repository...'))
    await generateRepository(name, { table: answers.tableName })

    console.log(chalk.yellow('\n📁 Generating service...'))
    await generateService(name, { repository: false })

    console.log(chalk.yellow('\n📁 Generating API routes...'))
    await generateAPI(name, { methods: answers.methods.join(',') })

    if (answers.includeUI) {
      console.log(chalk.yellow('\n📁 Generating UI components...'))
      await generateComponent(name, { type: 'feature' })
    }

    // Success message
    console.log(chalk.green('\n✅ Feature generation complete!\n'))
    console.log(chalk.cyan('Generated files:'))
    console.log(`  📄 types/${name}.types.ts`)
    console.log(`  📄 lib/repositories/${name}.repository.ts`)
    console.log(`  📄 lib/services/${name}.service.ts`)
    console.log(`  📄 app/api/${name}/route.ts`)
    
    if (answers.includeUI) {
      console.log(`  📄 components/features/${name}/`)
    }

    console.log(chalk.cyan('\nNext steps:'))
    console.log('1. Run database migrations for your new table')
    console.log('2. Update the generated schemas with your specific fields')
    console.log('3. Implement any custom business logic')
    console.log(`4. Test your feature: ${chalk.yellow(`npm test ${name}`)}`)

  } catch (error) {
    console.error(chalk.red('Feature generation failed:'), error)
    process.exit(1)
  }
}
```

### Phase 5: Helper Utilities (Day 4)

#### 5.1 Code Formatter
```typescript
// scripts/utils/formatter.ts
import prettier from 'prettier'

export async function formatCode(code: string, parser: string = 'typescript'): Promise<string> {
  const config = await prettier.resolveConfig(process.cwd())
  
  return prettier.format(code, {
    ...config,
    parser
  })
}
```

#### 5.2 Handlebars Helpers
```typescript
// scripts/utils/handlebars-helpers.ts
import Handlebars from 'handlebars'

// Register custom helpers
Handlebars.registerHelper('eq', (a, b) => a === b)
Handlebars.registerHelper('includes', (arr, val) => arr.includes(val))
Handlebars.registerHelper('pluralize', (str) => {
  if (str.endsWith('y')) {
    return str.slice(0, -1) + 'ies'
  }
  return str + 's'
})
```

## Validation

### Automated Checks
```bash
# Test all generators
npm run generate:api test/api-route
npm run generate:service test-service
npm run generate:repository test-repo
npm run generate:component test-component
npm run generate:feature test-feature

# Verify generated files compile
npm run type-check

# Run generated tests
npm test
```

### Manual Testing
1. Generate a complete feature: `npm run generate:feature products`
2. Check that all files are created with proper imports
3. Verify TypeScript compilation succeeds
4. Test that generated API routes work
5. Confirm base classes are properly extended

## Success Criteria

- [ ] CLI tool generates working code that compiles without errors
- [ ] Generated code extends base classes (BaseService, BaseRepository)
- [ ] API routes use createRouteHandler with proper options
- [ ] Templates include comprehensive error handling
- [ ] Generated tests provide basic coverage
- [ ] Feature generator creates complete, integrated stack
- [ ] Documentation is auto-generated in code comments
- [ ] Import paths are validated and correct
- [ ] Generated code passes all lint rules

## Dependencies

- **Requires**: PRP-018A (Base infrastructure - COMPLETED)
- **NPM Packages**: commander, handlebars, inquirer, ora, chalk, fs-extra
- **Base Classes**: Already implemented in lib/base/

## Implementation Order

1. **CLI Foundation** (4 hours)
   - Set up commander.js structure
   - Create package.json scripts
   - Basic command routing

2. **Template System** (6 hours)
   - Create Handlebars templates
   - Add helper functions
   - Template compilation

3. **Individual Generators** (8 hours)
   - API generator
   - Service generator
   - Repository generator
   - Component generator

4. **Feature Generator** (4 hours)
   - Interactive prompts
   - Orchestrate sub-generators
   - Progress reporting

5. **Testing & Polish** (4 hours)
   - Test all generators
   - Error handling
   - Documentation

Total: ~26 hours (3-4 days)

## Confidence Score: 9/10

**Scoring Breakdown:**
- **Automation**: 9/10 - Generates 90% of boilerplate code
- **Clarity**: 9/10 - Clear examples and comprehensive templates
- **Speed**: 10/10 - 5-minute feature scaffolding achieved
- **Quality**: 9/10 - All security/monitoring built into templates
- **Completeness**: 9/10 - Full implementation blueprint provided

**Why 9/10**: This PRP leverages existing infrastructure perfectly, provides complete implementation details, and enables rapid feature development. The only reason it's not 10/10 is that some template customization may be needed for complex features.