/**
 * Base Guard - Abstract class for all development guards
 */

import { AST, Violation } from './ast-analyzer'

export abstract class BaseGuard {
  protected name: string
  protected enabled: boolean

  constructor(name: string, enabled: boolean = true) {
    this.name = name
    this.enabled = enabled
  }

  /**
   * Check a file for violations
   */
  abstract check(ast: AST, filePath: string): Promise<Violation[]>

  /**
   * Get the guard name
   */
  getName(): string {
    return this.name
  }

  /**
   * Check if the guard is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Enable or disable the guard
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Create a violation object
   */
  protected createViolation(
    type: 'security' | 'performance' | 'quality',
    severity: 'error' | 'warning' | 'info',
    message: string,
    file: string,
    line: number,
    column: number,
    quickFix?: () => Promise<void>,
    suggestion?: string
  ): Violation {
    return {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      file,
      line,
      column,
      quickFix,
      suggestion
    }
  }

  /**
   * Check if a file should be processed by this guard
   */
  protected shouldProcessFile(filePath: string): boolean {
    // Default implementation - process all TypeScript/JavaScript files
    return /\.(ts|tsx|js|jsx)$/.test(filePath) && 
           !filePath.includes('node_modules') &&
           !filePath.includes('.next') &&
           !filePath.includes('dist') &&
           !filePath.includes('build')
  }

  /**
   * Log guard activity
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logData = {
      guard: this.name,
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    }
    
    switch (level) {
      case 'info':
        console.log(`[DEV-GUARD:${this.name}]`, logData)
        break
      case 'warn':
        console.warn(`[DEV-GUARD:${this.name}]`, logData)
        break
      case 'error':
        console.error(`[DEV-GUARD:${this.name}]`, logData)
        break
    }
  }
}