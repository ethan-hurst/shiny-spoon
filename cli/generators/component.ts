/**
 * Component Generator
 * Generates React components with TypeScript
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as Handlebars from 'handlebars'
import { writeFile } from '../utils/files'
import { registerHelpers } from '../utils/handlebars-helpers'
import { logger } from '../utils/logger'
import { toKebabCase, toPascalCase } from '../utils/strings'

// Register Handlebars helpers
registerHelpers()

interface ComponentGeneratorOptions {
  type?: 'page' | 'feature' | 'ui'
  server?: boolean
  withForm?: boolean
  withState?: boolean
  withProps?: boolean
  withTests?: boolean
  withStorybook?: boolean
  description?: string
}

export const componentGenerator = {
  async generate(name: string, options: ComponentGeneratorOptions = {}) {
    logger.info(`Generating component: ${name}`)

    const {
      type = 'feature',
      server = false,
      withForm = false,
      withState = true,
      withProps = true,
      withTests = true,
      withStorybook = false,
      description = `${name} component`,
    } = options

    try {
      // Generate file names and paths
      const kebabName = toKebabCase(name)
      const componentName = toPascalCase(name)
      const fileName = kebabName

      // Determine base directory based on component type
      let baseDir: string
      switch (type) {
        case 'page':
          baseDir = path.join(process.cwd(), 'app', '(dashboard)', kebabName)
          break
        case 'ui':
          baseDir = path.join(process.cwd(), 'components', 'ui')
          break
        case 'feature':
        default:
          baseDir = path.join(
            process.cwd(),
            'components',
            'features',
            kebabName
          )
          break
      }

      await fs.mkdir(baseDir, { recursive: true })

      // Generate main component file
      const componentFile = path.join(
        baseDir,
        type === 'page' ? 'page.tsx' : `${fileName}.tsx`
      )
      await this.generateComponentFile(componentFile, {
        componentName,
        kebabName,
        fileName,
        description,
        type,
        server,
        withForm,
        withState,
        withProps,
      })

      // Generate types file if using props
      if (withProps && type !== 'page') {
        const typesFile = path.join(baseDir, `${fileName}.types.ts`)
        await this.generateTypesFile(typesFile, {
          componentName,
          kebabName,
          withForm,
          withState,
        })
      }

      // Generate index file for easier imports (except for pages)
      if (type !== 'page') {
        const indexFile = path.join(baseDir, 'index.ts')
        await this.generateIndexFile(indexFile, {
          componentName,
          fileName,
          withProps,
        })
      }

      // Generate test file if needed
      if (withTests) {
        const testsDir = path.join(
          process.cwd(),
          '__tests__',
          'components',
          type === 'ui' ? 'ui' : 'features'
        )
        await fs.mkdir(testsDir, { recursive: true })
        const testFile = path.join(testsDir, `${kebabName}.test.tsx`)
        await this.generateTestFile(testFile, {
          componentName,
          kebabName,
          withForm,
          withState,
          server,
        })
      }

      // Generate Storybook story if needed
      if (withStorybook && type !== 'page') {
        const storiesDir = path.join(process.cwd(), 'stories')
        await fs.mkdir(storiesDir, { recursive: true })
        const storyFile = path.join(storiesDir, `${componentName}.stories.tsx`)
        await this.generateStoryFile(storyFile, {
          componentName,
          kebabName,
          type,
          withProps,
          withForm,
        })
      }

      logger.success(`Component ${componentName} generated successfully!`)
      logger.info('Generated files:')
      logger.info(`  - ${path.relative(process.cwd(), componentFile)}`)

      if (withProps && type !== 'page') {
        logger.info(
          `  - ${path.relative(process.cwd(), baseDir)}/${fileName}.types.ts`
        )
      }
      if (type !== 'page') {
        logger.info(`  - ${path.relative(process.cwd(), baseDir)}/index.ts`)
      }
      if (withTests) {
        logger.info(
          `  - __tests__/components/${type === 'ui' ? 'ui' : 'features'}/${kebabName}.test.tsx`
        )
      }
      if (withStorybook && type !== 'page') {
        logger.info(`  - stories/${componentName}.stories.tsx`)
      }

      logger.info('\nNext steps:')
      logger.info('1. Customize the component logic and styling')
      if (withForm) {
        logger.info('2. Update form validation schema and handling')
      }
      if (withTests) {
        logger.info('3. Run tests: npm test ' + kebabName)
      }
      if (type === 'ui') {
        logger.info('4. Add component to ui/index.ts for easier imports')
      }
    } catch (error) {
      logger.error('Failed to generate component:', error)
      throw error
    }
  },

  async generateComponentFile(filePath: string, context: any) {
    const template = this.getComponentTemplate()
    const compiled = Handlebars.compile(template)
    const content = compiled(context)
    await writeFile(filePath, content)
  },

  async generateTypesFile(filePath: string, context: any) {
    const content = `/**
 * ${context.componentName} types and interfaces
 */

import { ReactNode } from 'react'
${context.withForm ? "import { z } from 'zod'" : ''}

// Base props interface
export interface ${context.componentName}Props {
  className?: string
  children?: ReactNode
  ${context.withForm ? 'onSubmit?: (data: FormData) => void | Promise<void>' : ''}
  // Add your custom props here
}

${
  context.withForm
    ? `
// Form data interface
export interface FormData {
  // Define your form fields here
  name: string
  email?: string
  description?: string
}

// Form validation schema
export const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email').optional(),
  description: z.string().max(500).optional()
})

export type FormData = z.infer<typeof formSchema>
`
    : ''
}

${
  context.withState
    ? `
// Component state interface
export interface ${context.componentName}State {
  loading: boolean
  error: string | null
  // Add your state properties here
}
`
    : ''
}

// Event handler types
export interface ${context.componentName}Handlers {
  onClick?: () => void
  onChange?: (value: any) => void
  onClose?: () => void
  // Add your event handlers here
}

// Utility types
export type ${context.componentName}Variant = 'default' | 'primary' | 'secondary' | 'destructive'
export type ${context.componentName}Size = 'sm' | 'md' | 'lg'
`
    await writeFile(filePath, content)
  },

  async generateIndexFile(filePath: string, context: any) {
    const content = `/**
 * ${context.componentName} exports
 */

export { ${context.componentName} } from './${context.fileName}'
${context.withProps ? `export type { ${context.componentName}Props } from './${context.fileName}.types'` : ''}
`
    await writeFile(filePath, content)
  },

  async generateTestFile(filePath: string, context: any) {
    const content = `/**
 * ${context.componentName} tests
 */

import { render, screen${context.withForm ? ', fireEvent, waitFor' : ''} } from '@testing-library/react'
${context.withForm ? "import userEvent from '@testing-library/user-event'" : ''}
import { ${context.componentName} } from '@/components/features/${context.kebabName}'

${context.server ? '// Mock Next.js server components for testing' : ''}
${context.server ? "jest.mock('next/navigation', () => ({\n  useRouter: () => ({\n    push: jest.fn(),\n    refresh: jest.fn()\n  })\n}))" : ''}

describe('${context.componentName}', () => {
  ${
    context.withState
      ? `
  const defaultProps = {
    // Add default props here
  }
  `
      : ''
  }

  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<${context.componentName}${context.withState ? ' {...defaultProps}' : ''} />)
      expect(screen.getByTestId('${context.kebabName}')).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      const customClass = 'custom-class'
      render(<${context.componentName} className={customClass}${context.withState ? ' {...defaultProps}' : ''} />)
      expect(screen.getByTestId('${context.kebabName}')).toHaveClass(customClass)
    })

    ${
      context.withForm
        ? `
    it('should render form elements', () => {
      render(<${context.componentName}${context.withState ? ' {...defaultProps}' : ''} />)
      expect(screen.getByRole('form')).toBeInTheDocument()
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    })
    `
        : ''
    }
  })

  ${
    context.withForm
      ? `
  describe('form interaction', () => {
    it('should handle form submission', async () => {
      const user = userEvent.setup()
      const mockSubmit = jest.fn()
      
      render(<${context.componentName} onSubmit={mockSubmit}${context.withState ? ' {...defaultProps}' : ''} />)
      
      const nameInput = screen.getByLabelText(/name/i)
      const submitButton = screen.getByRole('button', { name: /submit/i })
      
      await user.type(nameInput, 'Test Name')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          name: 'Test Name'
        })
      })
    })

    it('should validate form fields', async () => {
      const user = userEvent.setup()
      
      render(<${context.componentName}${context.withState ? ' {...defaultProps}' : ''} />)
      
      const submitButton = screen.getByRole('button', { name: /submit/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      })
    })

    it('should show loading state during submission', async () => {
      const user = userEvent.setup()
      const mockSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<${context.componentName} onSubmit={mockSubmit}${context.withState ? ' {...defaultProps}' : ''} />)
      
      const nameInput = screen.getByLabelText(/name/i)
      const submitButton = screen.getByRole('button', { name: /submit/i })
      
      await user.type(nameInput, 'Test Name')
      await user.click(submitButton)
      
      expect(screen.getByRole('button', { name: /submitting/i })).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
      })
    })
  })
  `
      : ''
  }

  ${
    context.withState
      ? `
  describe('state management', () => {
    it('should handle loading state', () => {
      // Test loading state rendering
      render(<${context.componentName} {...defaultProps} />)
      // Add specific loading state tests
    })

    it('should handle error state', () => {
      // Test error state rendering
      render(<${context.componentName} {...defaultProps} />)
      // Add specific error state tests
    })
  })
  `
      : ''
  }

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<${context.componentName}${context.withState ? ' {...defaultProps}' : ''} />)
      const component = screen.getByTestId('${context.kebabName}')
      expect(component).toHaveAttribute('role')
    })

    ${
      context.withForm
        ? `
    it('should have proper form labels', () => {
      render(<${context.componentName}${context.withState ? ' {...defaultProps}' : ''} />)
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    })
    `
        : ''
    }
  })

  describe('user interactions', () => {
    it('should handle click events', async () => {
      const user = userEvent.setup()
      const mockClick = jest.fn()
      
      render(<${context.componentName} onClick={mockClick}${context.withState ? ' {...defaultProps}' : ''} />)
      
      const element = screen.getByTestId('${context.kebabName}')
      await user.click(element)
      
      expect(mockClick).toHaveBeenCalledTimes(1)
    })
  })
})
`
    await writeFile(filePath, content)
  },

  async generateStoryFile(filePath: string, context: any) {
    const content = `/**
 * ${context.componentName} Storybook stories
 */

import type { Meta, StoryObj } from '@storybook/react'
import { ${context.componentName} } from '@/components/${context.type === 'ui' ? 'ui' : 'features'}/${context.kebabName}'

const meta: Meta<typeof ${context.componentName}> = {
  title: '${context.type === 'ui' ? 'UI' : 'Features'}/${context.componentName}',
  component: ${context.componentName},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '${context.componentName} component for the TruthSource application.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    }${
      context.withForm
        ? `,
    onSubmit: {
      action: 'submitted',
      description: 'Form submission handler'
    }`
        : ''
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// Default story
export const Default: Story = {
  args: {
    // Add default props here
  }
}

${
  context.withForm
    ? `
// Form story
export const WithForm: Story = {
  args: {
    onSubmit: (data) => {
      console.log('Form submitted:', data)
    }
  }
}

// Form with validation errors
export const WithValidationErrors: Story = {
  args: {
    onSubmit: () => {
      // This will trigger validation errors
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const submitButton = canvas.getByRole('button', { name: /submit/i })
    await userEvent.click(submitButton)
  }
}
`
    : ''
}

// Loading state story
export const Loading: Story = {
  args: {
    // Add loading state props
  }
}

// Error state story  
export const Error: Story = {
  args: {
    // Add error state props
  }
}

// Custom styling story
export const CustomStyling: Story = {
  args: {
    className: 'border-2 border-blue-500 bg-blue-50 p-4 rounded-lg'
  }
}

// Interactive story
export const Interactive: Story = {
  args: {
    // Add interactive props
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Add interaction tests
  }
}
`
    await writeFile(filePath, content)
  },

  getComponentTemplate(): string {
    return `/**
 * {{componentName}} Component
 * {{description}}
 */

{{#unless server}}'use client'{{/unless}}

{{#if withState}}import { useState } from 'react'{{/if}}
{{#if withForm}}import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'{{/if}}
import { cn } from '@/lib/utils'
{{#if withForm}}import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'{{/if}}
{{#if withProps}}import type { {{componentName}}Props{{#if withForm}}, FormData, formSchema{{/if}} } from './{{fileName}}.types'{{/if}}

{{#if (eq type 'page')}}
export default function {{componentName}}() {
{{else}}
export function {{componentName}}({{#if withProps}}{
  className,
  children,
  {{#if withForm}}onSubmit,{{/if}}
  ...props
}: {{componentName}}Props{{/if}}) {
{{/if}}
  {{#if withState}}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  {{/if}}

  {{#if withForm}}
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      description: ''
    }
  })

  const handleSubmit = async (data: FormData) => {
    try {
      setLoading(true)
      setError(null)
      
      if (onSubmit) {
        await onSubmit(data)
      }
      
      // Reset form on success
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }
  {{/if}}

  return (
    <div 
      data-testid="{{kebabName}}"
      className={cn(
        // Base styles
        "{{#if (eq type 'page')}}container mx-auto py-6{{else}}{{#if (eq type 'ui')}}inline-flex items-center justify-center{{else}}flex flex-col space-y-4{{/if}}{{/if}}",
        className
      )}
      {{#unless (eq type 'page')}}
      role="{{#if withForm}}form{{else}}region{{/if}}"
      aria-label="{{componentName}}"
      {...props}
      {{/unless}}
    >
      {{#if (eq type 'page')}}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{{componentName}}</h1>
          <p className="text-muted-foreground">
            {{description}}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {/* Page content goes here */}
        <div className="bg-card text-card-foreground rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Content</h2>
          <p>This is the {{componentName}} page content.</p>
        </div>
      </div>
      {{else}}
      {{#if withForm}}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter description"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </Form>
      {{else}}
      <div className="{{#if (eq type 'ui')}}text-center{{else}}space-y-2{{/if}}">
        <h3 className="text-lg font-semibold">{{componentName}}</h3>
        <p className="text-muted-foreground text-sm">
          {{description}}
        </p>
        {children}
      </div>
      {{/if}}
      {{/if}}
    </div>
  )
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
          message: 'Component name:',
          validate: (input: string) =>
            input.trim().length > 0 || 'Component name is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Component description (optional):',
        },
        {
          type: 'list',
          name: 'type',
          message: 'Component type:',
          choices: [
            { name: 'Page Component', value: 'page' },
            { name: 'Feature Component', value: 'feature' },
            { name: 'UI Component', value: 'ui' },
          ],
        },
        {
          type: 'confirm',
          name: 'server',
          message: 'Server component?',
          default: false,
          when: (answers) => answers.type === 'page',
        },
        {
          type: 'confirm',
          name: 'withForm',
          message: 'Include form handling?',
          default: false,
        },
        {
          type: 'confirm',
          name: 'withState',
          message: 'Include state management?',
          default: true,
          when: (answers) => !answers.server,
        },
        {
          type: 'confirm',
          name: 'withProps',
          message: 'Generate TypeScript props interface?',
          default: true,
          when: (answers) => answers.type !== 'page',
        },
        {
          type: 'confirm',
          name: 'withTests',
          message: 'Generate test file?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'withStorybook',
          message: 'Generate Storybook story?',
          default: false,
          when: (answers) => answers.type !== 'page',
        },
      ])

      const options = {
        type: answers.type,
        server: answers.server || false,
        withForm: answers.withForm,
        withState: answers.withState || false,
        withProps: answers.withProps || false,
        withTests: answers.withTests,
        withStorybook: answers.withStorybook || false,
        description: answers.description || `${answers.name} component`,
      }

      await this.generate(answers.name, options)
    } catch (error) {
      logger.error('Interactive component generation failed:', error)
      throw error
    }
  },
}
