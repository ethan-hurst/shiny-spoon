#!/usr/bin/env node

/**
 * TruthSource Code Generator CLI
 * Generates boilerplate code following best practices
 */

import { Command } from 'commander'
import { apiGenerator } from './generators/api'
import { serviceGenerator } from './generators/service'
import { repositoryGenerator } from './generators/repository'
import { integrationGenerator } from './generators/integration'
import { componentGenerator } from './generators/component'
import { checkPrerequisites } from './utils/checks'
import { logger } from './utils/logger'

const program = new Command()

program
  .name('truthsource')
  .description('TruthSource code generator - create components following best practices')
  .version('1.0.0')

// API Route Generator
program
  .command('api <name>')
  .description('Generate a new API route with security and error handling')
  .option('-m, --methods <methods>', 'HTTP methods (comma-separated)', 'GET,POST')
  .option('-a, --auth', 'Require authentication (default: true)', true)
  .option('-r, --rate-limit', 'Enable rate limiting', false)
  .option('-p, --path <path>', 'Custom path (default: /api/<name>)')
  .action(async (name, options) => {
    try {
      await checkPrerequisites()
      await apiGenerator.generate(name, options)
      logger.success(`API route '${name}' generated successfully!`)
    } catch (error) {
      logger.error('Failed to generate API route:', error)
      process.exit(1)
    }
  })

// Service Generator
program
  .command('service <name>')
  .description('Generate a new service with retry logic and monitoring')
  .option('-t, --type <type>', 'Service type (business, integration)', 'business')
  .option('-r, --with-repository', 'Include repository', false)
  .action(async (name, options) => {
    try {
      await checkPrerequisites()
      await serviceGenerator.generate(name, options)
      logger.success(`Service '${name}' generated successfully!`)
    } catch (error) {
      logger.error('Failed to generate service:', error)
      process.exit(1)
    }
  })

// Repository Generator
program
  .command('repository <name>')
  .description('Generate a new repository with organization isolation')
  .option('-t, --table <table>', 'Database table name')
  .option('-s, --soft-delete', 'Enable soft deletes', true)
  .action(async (name, options) => {
    try {
      await checkPrerequisites()
      await repositoryGenerator.generate(name, options)
      logger.success(`Repository '${name}' generated successfully!`)
    } catch (error) {
      logger.error('Failed to generate repository:', error)
      process.exit(1)
    }
  })

// Integration Generator
program
  .command('integration <name>')
  .description('Generate a new integration with auth and sync')
  .option('-t, --type <type>', 'Integration type (oauth, api-key)', 'api-key')
  .option('-w, --webhook', 'Include webhook support', false)
  .action(async (name, options) => {
    try {
      await checkPrerequisites()
      await integrationGenerator.generate(name, options)
      logger.success(`Integration '${name}' generated successfully!`)
    } catch (error) {
      logger.error('Failed to generate integration:', error)
      process.exit(1)
    }
  })

// Component Generator
program
  .command('component <name>')
  .description('Generate a new React component')
  .option('-t, --type <type>', 'Component type (page, feature, ui)', 'feature')
  .option('-s, --server', 'Server component', false)
  .option('-f, --with-form', 'Include form handling', false)
  .action(async (name, options) => {
    try {
      await checkPrerequisites()
      await componentGenerator.generate(name, options)
      logger.success(`Component '${name}' generated successfully!`)
    } catch (error) {
      logger.error('Failed to generate component:', error)
      process.exit(1)
    }
  })

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Run in interactive mode')
  .action(async () => {
    try {
      const inquirer = (await import('inquirer')).default
      
      const { generatorType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'generatorType',
          message: 'What would you like to generate?',
          choices: [
            { name: 'API Route', value: 'api' },
            { name: 'Service', value: 'service' },
            { name: 'Repository', value: 'repository' },
            { name: 'Integration', value: 'integration' },
            { name: 'Component', value: 'component' }
          ]
        }
      ])

      // Route to appropriate generator in interactive mode
      switch (generatorType) {
        case 'api':
          await apiGenerator.interactive()
          break
        case 'service':
          await serviceGenerator.interactive()
          break
        case 'repository':
          await repositoryGenerator.interactive()
          break
        case 'integration':
          await integrationGenerator.interactive()
          break
        case 'component':
          await componentGenerator.interactive()
          break
      }
    } catch (error) {
      logger.error('Interactive mode failed:', error)
      process.exit(1)
    }
  })

// Check command - verify setup
program
  .command('check')
  .description('Check if all prerequisites are met')
  .action(async () => {
    try {
      await checkPrerequisites(true)
      logger.success('All checks passed!')
    } catch (error) {
      logger.error('Prerequisites check failed:', error)
      process.exit(1)
    }
  })

// List command - show available templates
program
  .command('list')
  .description('List all available templates')
  .action(() => {
    logger.info('Available generators:')
    logger.info('  - api: API routes with auth, rate limiting, validation')
    logger.info('  - service: Business services with retry logic')
    logger.info('  - repository: Data repositories with org isolation')
    logger.info('  - integration: External integrations with sync')
    logger.info('  - component: React components with TypeScript')
  })

program.parse(process.argv)