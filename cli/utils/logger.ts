/**
 * CLI Logger Utility
 * Provides colored console output for the CLI
 */

import chalk from 'chalk'

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(chalk.blue('ℹ'), message, ...args)
  },

  success: (message: string, ...args: any[]) => {
    console.log(chalk.green('✓'), message, ...args)
  },

  warning: (message: string, ...args: any[]) => {
    console.log(chalk.yellow('⚠'), message, ...args)
  },

  error: (message: string, error?: any) => {
    console.error(chalk.red('✗'), message)
    if (error && error instanceof Error) {
      console.error(chalk.red('  →'), error.message)
      if (process.env.DEBUG) {
        console.error(chalk.gray(error.stack))
      }
    }
  },

  debug: (message: string, data?: any) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('[DEBUG]'), message)
      if (data) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)))
      }
    }
  },

  step: (step: number, total: number, message: string) => {
    console.log(chalk.cyan(`[${step}/${total}]`), message)
  },

  code: (code: string) => {
    console.log(chalk.gray(code))
  },

  file: (path: string) => {
    console.log(chalk.magenta('  →'), path)
  }
}