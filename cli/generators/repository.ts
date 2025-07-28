/**
 * Repository Generator
 * Generates repositories with organization isolation
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as Handlebars from 'handlebars'
import { writeFile } from '../utils/files'
import { registerHelpers } from '../utils/handlebars-helpers'
import { logger } from '../utils/logger'
import { toKebabCase, toPascalCase, toSnakeCase } from '../utils/strings'

// Register Handlebars helpers
registerHelpers()

interface RepositoryGeneratorOptions {
  table?: string
  softDelete?: boolean
  withTypes?: boolean
  withValidation?: boolean
  withTests?: boolean
  description?: string
}

export const repositoryGenerator = {
  async generate(name: string, options: RepositoryGeneratorOptions = {}) {
    logger.info(`Generating repository: ${name}`)

    const {
      table,
      softDelete = true,
      withTypes = true,
      withValidation = true,
      withTests = true,
      description = `${name} repository`,
    } = options

    try {
      // Generate file names and paths
      const kebabName = toKebabCase(name)
      const repositoryName = toPascalCase(name) + 'Repository'
      const entityName = toPascalCase(name)
      const tableName = table || toSnakeCase(name) + 's'

      // Create repository directory
      const repositoriesDir = path.join(process.cwd(), 'lib', 'repositories')
      await fs.mkdir(repositoriesDir, { recursive: true })

      // Generate repository file
      const repositoryFile = path.join(
        repositoriesDir,
        `${kebabName}.repository.ts`
      )
      await this.generateRepositoryFile(repositoryFile, {
        repositoryName,
        entityName,
        kebabName,
        tableName,
        description,
        softDelete,
        withValidation,
      })

      // Generate types file if needed
      if (withTypes) {
        const typesDir = path.join(process.cwd(), 'types')
        await fs.mkdir(typesDir, { recursive: true })
        const typesFile = path.join(typesDir, `${kebabName}.types.ts`)
        await this.generateTypesFile(typesFile, {
          entityName,
          kebabName,
          tableName,
        })
      }

      // Generate test file if needed
      if (withTests) {
        const testsDir = path.join(process.cwd(), '__tests__', 'repositories')
        await fs.mkdir(testsDir, { recursive: true })
        const testFile = path.join(testsDir, `${kebabName}.repository.test.ts`)
        await this.generateTestFile(testFile, {
          repositoryName,
          entityName,
          kebabName,
        })
      }

      logger.success(`Repository ${repositoryName} generated successfully!`)
      logger.info('Generated files:')
      logger.info(`  - ${path.relative(process.cwd(), repositoryFile)}`)
      if (withTypes) {
        logger.info(`  - types/${kebabName}.types.ts`)
      }
      if (withTests) {
        logger.info(
          `  - __tests__/repositories/${kebabName}.repository.test.ts`
        )
      }

      logger.info('\nNext steps:')
      logger.info(
        '1. Update the types in the types file to match your database schema'
      )
      logger.info('2. Implement any custom query methods in the repository')
      logger.info('3. Create the corresponding database table/migration')
      logger.info(
        '4. Run the tests: npm test __tests__/repositories/' +
          kebabName +
          '.repository.test.ts'
      )
    } catch (error) {
      logger.error('Failed to generate repository:', error)
      throw error
    }
  },

  async generateRepositoryFile(filePath: string, context: any) {
    const templatePath = path.join(
      __dirname,
      '../templates/repository/repository.hbs'
    )

    // Check if template exists, if not use inline template
    let template: string
    try {
      template = await fs.readFile(templatePath, 'utf-8')
    } catch {
      // Use inline template as fallback
      template = this.getRepositoryTemplate()
    }

    const compiled = Handlebars.compile(template)
    const content = compiled(context)
    await writeFile(filePath, content)
  },

  async generateTypesFile(filePath: string, context: any) {
    const content = `/**
 * ${context.entityName} types and schemas
 */

import { z } from 'zod'

// Database entity type
export interface ${context.entityName} {
  id: string
  name: string
  description?: string
  organization_id: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  deleted_at?: string | null
  deleted_by?: string | null
}

// Input types for creating/updating
export interface Create${context.entityName}Input {
  name: string
  description?: string
  organization_id: string
  created_by: string
}

export interface Update${context.entityName}Input {
  name?: string
  description?: string
  updated_by: string
}

// Repository query options
export interface ${context.entityName}QueryOptions {
  organizationId?: string
  search?: string
  limit?: number
  offset?: number
  includeDeleted?: boolean
}

// Validation schemas
export const create${context.entityName}Schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  organization_id: z.string().uuid(),
  created_by: z.string().uuid()
})

export const update${context.entityName}Schema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  updated_by: z.string().uuid()
})

export const queryOptionsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
  includeDeleted: z.boolean().default(false)
})

// Type guards
export function is${context.entityName}(obj: any): obj is ${context.entityName} {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' &&
    typeof obj.organization_id === 'string'
}
`
    await writeFile(filePath, content)
  },

  async generateTestFile(filePath: string, context: any) {
    const content = `/**
 * ${context.repositoryName} tests
 */

import { ${context.repositoryName} } from '@/lib/repositories/${context.kebabName}.repository'
import { createClient } from '@/lib/utils/supabase/server'

// Mock Supabase client
jest.mock('@/lib/utils/supabase/server', () => ({
  createClient: jest.fn()
}))

describe('${context.repositoryName}', () => {
  let repository: ${context.repositoryName}
  let mockSupabaseClient: any

  beforeEach(() => {
    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockReturnThis()
      }))
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabaseClient)
    repository = new ${context.repositoryName}()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create repository instance', () => {
      expect(repository).toBeInstanceOf(${context.repositoryName})
    })
  })

  describe('create', () => {
    it('should create new ${context.entityName.toLowerCase()}', async () => {
      const input = {
        name: 'Test ${context.entityName}',
        organization_id: 'org-123',
        created_by: 'user-123'
      }
      
      const mockResult = { id: 'id-123', ...input }
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: mockResult,
        error: null
      })

      const result = await repository.create(input)
      
      expect(result).toEqual(mockResult)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(repository.tableName)
    })

    it('should handle creation errors', async () => {
      const input = {
        name: 'Test ${context.entityName}',
        organization_id: 'org-123',
        created_by: 'user-123'
      }
      
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Creation failed' }
      })

      await expect(repository.create(input)).rejects.toThrow()
    })
  })

  describe('findById', () => {
    it('should find ${context.entityName.toLowerCase()} by id', async () => {
      const mockResult = {
        id: 'id-123',
        name: 'Test ${context.entityName}',
        organization_id: 'org-123'
      }
      
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockResult,
        error: null
      })

      const result = await repository.findById('id-123')
      
      expect(result).toEqual(mockResult)
    })

    it('should return null when not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })

      const result = await repository.findById('nonexistent')
      
      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should list ${context.entityName.toLowerCase()}s with pagination', async () => {
      const mockResults = [
        { id: 'id-1', name: 'Item 1', organization_id: 'org-123' },
        { id: 'id-2', name: 'Item 2', organization_id: 'org-123' }
      ]
      
      mockSupabaseClient.from().select().eq().order().range.mockResolvedValue({
        data: mockResults,
        error: null
      })

      const result = await repository.findAll({
        organizationId: 'org-123',
        limit: 10,
        offset: 0
      })
      
      expect(result).toEqual(mockResults)
    })
  })

  // TODO: Add more tests for update, delete, count, and custom methods
})
`
    await writeFile(filePath, content)
  },

  getRepositoryTemplate(): string {
    return `/**
 * {{repositoryName}} - Repository for {{entityName}}
 * {{description}}
 */

import { BaseRepository } from '@/lib/base/base-repository'
import { createClient } from '@/lib/utils/supabase/server'
import type { 
  {{entityName}}, 
  Create{{entityName}}Input, 
  Update{{entityName}}Input,
  {{entityName}}QueryOptions 
} from '@/types/{{kebabName}}.types'

export class {{repositoryName}} extends BaseRepository<{{entityName}}> {
  constructor() {
    super(createClient(), {
      tableName: '{{tableName}}',
      softDelete: {{softDelete}}
    })
  }

  protected getOrganizationId(): string | null {
    // TODO: Implement organization context retrieval
    // This should come from auth context or request headers
    throw new Error('Organization context not implemented. Please inject organization ID.')
  }

  protected getCurrentUserId(): string | null {
    // TODO: Implement user context retrieval  
    // This should come from auth context or request headers
    throw new Error('User context not implemented. Please inject user ID.')
  }

  /**
   * Find {{entityName}} by name within organization
   */
  async findByName(name: string, organizationId?: string): Promise<{{entityName}} | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('name', name)
      .eq('organization_id', organizationId || this.getOrganizationId())
      {{#if softDelete}}
      .is('deleted_at', null)
      {{/if}}
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw this.handleError(error)
    }

    return data as {{entityName}}
  }

  /**
   * Search {{entityName}}s by name
   */
  async searchByName(searchTerm: string, options: {{entityName}}QueryOptions = {}): Promise<{{entityName}}[]> {
    const query = this.query()
      .select('*')
      .eq('organization_id', options.organizationId || this.getOrganizationId())
      .ilike('name', \`%\${searchTerm}%\`)

    {{#if softDelete}}
    if (!options.includeDeleted) {
      query.is('deleted_at', null)
    }
    {{/if}}

    if (options.limit) {
      query.limit(options.limit)
    }

    if (options.offset) {
      query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, error } = await query.order('name')

    if (error) {
      throw this.handleError(error)
    }

    return data as {{entityName}}[]
  }

  /**
   * Get {{entityName}} count for organization
   */
  async getCountByOrganization(organizationId?: string): Promise<number> {
    const query = this.query()
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId || this.getOrganizationId())

    {{#if softDelete}}
    query.is('deleted_at', null)
    {{/if}}

    const { count, error } = await query

    if (error) {
      throw this.handleError(error)
    }

    return count || 0
  }

  {{#if withValidation}}
  /**
   * Validate {{entityName}} data before operations
   */
  protected async validateData(data: Partial<{{entityName}}>): Promise<void> {
    // Check for duplicate names within organization
    if (data.name) {
      const existing = await this.findByName(data.name, data.organization_id)
      if (existing && existing.id !== data.id) {
        throw new Error(\`{{entityName}} with name '\${data.name}' already exists\`)
      }
    }

    // Add custom validation logic here
  }

  /**
   * Override create to include validation
   */
  async create(data: Create{{entityName}}Input): Promise<{{entityName}}> {
    await this.validateData(data)
    return super.create(data)
  }

  /**
   * Override update to include validation
   */
  async update(id: string, data: Update{{entityName}}Input): Promise<{{entityName}}> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new Error('{{entityName}} not found')
    }

    await this.validateData({ ...existing, ...data })
    return super.update(id, data)
  }
  {{/if}}
}
`
  },

  async interactive() {
    try {
      const inquirer = (await import('inquirer')).default

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Repository name:',
          validate: (input: string) =>
            input.trim().length > 0 || 'Repository name is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Repository description (optional):',
        },
        {
          type: 'input',
          name: 'table',
          message:
            'Database table name (optional, will auto-generate if empty):',
        },
        {
          type: 'confirm',
          name: 'softDelete',
          message: 'Enable soft deletes?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'withTypes',
          message: 'Generate TypeScript types?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'withValidation',
          message: 'Include data validation?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'withTests',
          message: 'Generate test file?',
          default: true,
        },
      ])

      const options = {
        table: answers.table || undefined,
        softDelete: answers.softDelete,
        withTypes: answers.withTypes,
        withValidation: answers.withValidation,
        withTests: answers.withTests,
        description: answers.description || `${answers.name} repository`,
      }

      await this.generate(answers.name, options)
    } catch (error) {
      logger.error('Interactive repository generation failed:', error)
      throw error
    }
  },
}
