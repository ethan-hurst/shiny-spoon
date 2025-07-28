/**
 * Prerequisites Checker
 * Verifies the environment is properly set up
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { logger } from './logger'

export async function checkPrerequisites(verbose = false): Promise<void> {
  const checks = [
    {
      name: 'Next.js project',
      check: () => existsSync(join(process.cwd(), 'next.config.js')) || 
                   existsSync(join(process.cwd(), 'next.config.mjs')),
      error: 'Not in a Next.js project directory'
    },
    {
      name: 'TypeScript configuration',
      check: () => existsSync(join(process.cwd(), 'tsconfig.json')),
      error: 'TypeScript not configured'
    },
    {
      name: 'Base classes',
      check: () => existsSync(join(process.cwd(), 'lib/base/base-repository.ts')) &&
                   existsSync(join(process.cwd(), 'lib/base/base-service.ts')),
      error: 'Base classes not found. Please ensure base classes are installed.'
    },
    {
      name: 'API utilities',
      check: () => existsSync(join(process.cwd(), 'lib/api/route-handler.ts')),
      error: 'API utilities not found'
    },
    {
      name: 'Supabase configuration',
      check: () => existsSync(join(process.cwd(), 'lib/supabase')),
      error: 'Supabase not configured'
    }
  ]

  let allPassed = true

  for (const { name, check, error } of checks) {
    try {
      if (check()) {
        if (verbose) {
          logger.success(`${name} - OK`)
        }
      } else {
        logger.error(`${name} - FAILED: ${error}`)
        allPassed = false
      }
    } catch (err) {
      logger.error(`${name} - ERROR: ${err}`)
      allPassed = false
    }
  }

  if (!allPassed) {
    throw new Error('Prerequisites check failed')
  }
}