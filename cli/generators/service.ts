/**
 * Service Generator
 * Generates services with retry logic and monitoring
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as Handlebars from 'handlebars'
import { logger } from '../utils/logger'
import { toKebabCase, toPascalCase, toCamelCase, toSnakeCase } from '../utils/strings'
import { ensureDir, writeFile } from '../utils/files'

interface ServiceGeneratorOptions {
  type?: 'business' | 'integration'
  withRepository?: boolean
  withTypes?: boolean
  withCreate?: boolean
  withUpdate?: boolean
  withGet?: boolean
  withList?: boolean
  withDelete?: boolean
  description?: string
}

export const serviceGenerator = {
  async generate(name: string, options: ServiceGeneratorOptions = {}) {
    logger.info(`Generating service: ${name}`)
    
    const {
      type = 'business',
      withRepository = false,
      withTypes = true,
      withCreate = true,
      withUpdate = true,
      withGet = true,
      withList = true,
      withDelete = true,
      description = `${name} service`
    } = options

    try {
      // Generate file names and paths
      const kebabName = toKebabCase(name)
      const serviceName = toPascalCase(name) + 'Service'
      const entityName = toPascalCase(name)
      const typeName = toPascalCase(name)
      const repositoryName = toPascalCase(name) + 'Repository'
      const entityNamePlural = entityName.endsWith('s') ? entityName : entityName + 's'
      
      // Create service directory
      const servicesDir = path.join(process.cwd(), 'lib', 'services')
      await fs.mkdir(servicesDir, { recursive: true })
      
      // Generate service file
      const serviceFile = path.join(servicesDir, `${kebabName}.service.ts`)
      await this.generateServiceFile(serviceFile, {
        serviceName,
        entityName,
        entityNamePlural,
        typeName,
        repositoryName,
        kebabName,
        description,
        withRepository,
        withTypes,
        withCreate,
        withUpdate,
        withGet,
        withList,
        withDelete
      })
      
      // Generate types file if needed
      if (withTypes) {
        const typesDir = path.join(process.cwd(), 'types')
        await fs.mkdir(typesDir, { recursive: true })
        const typesFile = path.join(typesDir, `${kebabName}.types.ts`)
        await this.generateTypesFile(typesFile, {
          typeName,
          entityName,
          kebabName
        })
      }
      
      // Generate repository if needed
      if (withRepository) {
        const repositoriesDir = path.join(process.cwd(), 'lib', 'repositories')
        await fs.mkdir(repositoriesDir, { recursive: true })
        const repositoryFile = path.join(repositoriesDir, `${kebabName}.repository.ts`)
        await this.generateRepositoryFile(repositoryFile, {
          repositoryName,
          typeName,
          entityName,
          kebabName
        })
      }
      
      // Generate test file
      const testsDir = path.join(process.cwd(), '__tests__', 'services')
      await fs.mkdir(testsDir, { recursive: true })
      const testFile = path.join(testsDir, `${kebabName}.service.test.ts`)
      await this.generateTestFile(testFile, {
        serviceName,
        entityName,
        kebabName
      })
      
      logger.success(`Service ${serviceName} generated successfully!`)
      logger.info('Generated files:')
      logger.info(`  - ${path.relative(process.cwd(), serviceFile)}`)
      if (withTypes) {
        logger.info(`  - types/${kebabName}.types.ts`)
      }
      if (withRepository) {
        logger.info(`  - lib/repositories/${kebabName}.repository.ts`)
      }
      logger.info(`  - __tests__/services/${kebabName}.service.test.ts`)
      
      logger.info('\nNext steps:')
      logger.info('1. Update the types in the types file to match your data model')
      logger.info('2. Implement any custom business logic in the service')
      if (withRepository) {
        logger.info('3. Update the repository implementation for your database schema')
      }
      logger.info('4. Run the tests: npm test __tests__/services/' + kebabName + '.service.test.ts')
      
    } catch (error) {
      logger.error('Failed to generate service:', error)
      throw error
    }
  },

  async generateServiceFile(filePath: string, context: any) {
    const templatePath = path.join(__dirname, '../templates/service/service.hbs')
    const template = await fs.readFile(templatePath, 'utf-8')
    const compiled = Handlebars.compile(template)
    const content = compiled(context)
    await writeFile(filePath, content)
  },

  async generateTypesFile(filePath: string, context: any) {
    const content = `/**
 * ${context.typeName} types and schemas
 */

import { z } from 'zod'

// Database entity
export interface ${context.typeName} {
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

// Input types
export interface Create${context.typeName}Input {
  name: string
  description?: string
  // Add your fields here
}

export interface Update${context.typeName}Input {
  name?: string
  description?: string
  // Add your fields here
}

// Validation schemas
export const create${context.typeName}Schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional()
  // Add your validation rules here
})

export const update${context.typeName}Schema = create${context.typeName}Schema.partial()

// Type guards
export function is${context.typeName}(obj: any): obj is ${context.typeName} {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string'
}
`
    await writeFile(filePath, content)
  },

  async generateRepositoryFile(filePath: string, context: any) {
    const content = `/**
 * ${context.repositoryName} - Repository for ${context.entityName}
 */

import { BaseRepository } from '@/lib/base/base-repository'
import { createClient } from '@/lib/utils/supabase/server'
import type { ${context.typeName} } from '@/types/${context.kebabName}.types'

export class ${context.repositoryName} extends BaseRepository<${context.typeName}> {
  constructor() {
    super(createClient(), {
      tableName: '${toSnakeCase(context.entityName)}s',
      softDelete: true
    })
  }

  protected getOrganizationId(): string | null {
    // TODO: Implement organization context
    // This should come from auth context or request
    throw new Error('Organization context not implemented')
  }

  protected getCurrentUserId(): string | null {
    // TODO: Implement user context
    // This should come from auth context or request
    throw new Error('User context not implemented')
  }

  // Add custom repository methods here
  async findByName(name: string): Promise<${context.typeName} | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('name', name)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw this.handleError(error)
    }

    return data as ${context.typeName}
  }
}
`
    await writeFile(filePath, content)
  },

  async generateTestFile(filePath: string, context: any) {
    const content = `/**
 * ${context.serviceName} tests
 */

import { ${context.serviceName} } from '@/lib/services/${context.kebabName}.service'

describe('${context.serviceName}', () => {
  let service: ${context.serviceName}

  beforeEach(() => {
    service = new ${context.serviceName}()
  })

  describe('constructor', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(${context.serviceName})
    })
  })

  describe('getHealth', () => {
    it('should return health status', async () => {
      const health = await service.getHealth()
      expect(health.service).toBe('${context.serviceName}')
      expect(health.status).toBeDefined()
      expect(health.checks).toBeDefined()
    })
  })

  // TODO: Add more tests for your service methods
  // Example:
  // describe('create', () => {
  //   it('should create ${context.entityName.toLowerCase()}', async () => {
  //     const input = { name: 'Test ${context.entityName}' }
  //     const result = await service.create(input)
  //     expect(result.name).toBe(input.name)
  //   })
  // })
})
`
    await writeFile(filePath, content)
  },

  async interactive() {
    try {
      const inquirer = (await import('inquirer')).default
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Service name:',
          validate: (input: string) => input.trim().length > 0 || 'Service name is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Service description (optional):'
        },
        {
          type: 'list',
          name: 'type',
          message: 'Service type:',
          choices: [
            { name: 'Business Service', value: 'business' },
            { name: 'Integration Service', value: 'integration' }
          ]
        },
        {
          type: 'confirm',
          name: 'withRepository',
          message: 'Generate repository?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withTypes',
          message: 'Generate TypeScript types?',
          default: true
        },
        {
          type: 'checkbox',
          name: 'methods',
          message: 'Which CRUD methods to include?',
          choices: [
            { name: 'Create', value: 'create', checked: true },
            { name: 'Read/Get', value: 'get', checked: true },
            { name: 'Update', value: 'update', checked: true },
            { name: 'List', value: 'list', checked: true },
            { name: 'Delete', value: 'delete', checked: true }
          ]
        }
      ])

      const options = {
        type: answers.type,
        withRepository: answers.withRepository,
        withTypes: answers.withTypes,
        withCreate: answers.methods.includes('create'),
        withGet: answers.methods.includes('get'),
        withUpdate: answers.methods.includes('update'),
        withList: answers.methods.includes('list'),
        withDelete: answers.methods.includes('delete'),
        description: answers.description || `${answers.name} service`
      }

      await this.generate(answers.name, options)
    } catch (error) {
      logger.error('Interactive service generation failed:', error)
      throw error
    }
  }
}