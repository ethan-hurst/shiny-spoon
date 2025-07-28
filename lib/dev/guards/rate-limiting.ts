/**
 * Rate Limiting Guard - Ensures all API routes have proper rate limiting
 * Prevents abuse and DoS attacks
 */

import * as ts from 'typescript'
import { writeFile, readFile } from 'fs/promises'
import { BaseGuard } from '../base-guard'
import { AST, Violation, findNodes, getNodePosition } from '../ast-analyzer'

export class RateLimitingGuard extends BaseGuard {
  private readonly httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  
  // Default rate limits per method
  private readonly defaultLimits = {
    GET: { requests: 1000, window: '1h' },
    POST: { requests: 100, window: '1h' },
    PUT: { requests: 100, window: '1h' },
    PATCH: { requests: 100, window: '1h' },
    DELETE: { requests: 50, window: '1h' }
  }

  constructor() {
    super('RateLimiting')
  }

  async check(ast: AST, filePath: string): Promise<Violation[]> {
    if (!this.shouldProcessFile(filePath)) {
      return []
    }

    const violations: Violation[] = []
    
    // Only check API route files
    if (!this.isApiRouteFile(filePath)) {
      return violations
    }

    // Find HTTP method exports
    for (const method of this.httpMethods) {
      const methodExport = this.findHttpMethodExport(ast, method)
      
      if (methodExport) {
        const hasRateLimit = this.hasRateLimitingImplemented(ast, method)
        
        if (!hasRateLimit) {
          const position = getNodePosition(ast.sourceFile, methodExport)
          const severity = this.getViolationSeverity(method)
          
          violations.push(this.createViolation(
            'security',
            severity,
            `Missing rate limiting on ${method} endpoint. This can lead to abuse and DoS attacks.`,
            filePath,
            position.line,
            position.column,
            () => this.addRateLimiting(filePath, method, methodExport),
            `Use createRouteHandler with rateLimit configuration or implement manual rate limiting`
          ))
        }
      }
    }
    
    return violations
  }

  /**
   * Check if a file is an API route file
   */
  private isApiRouteFile(filePath: string): boolean {
    return filePath.includes('/api/') && filePath.endsWith('/route.ts')
  }

  /**
   * Find HTTP method export in the AST
   */
  private findHttpMethodExport(ast: AST, method: string): ts.Node | null {
    const statements = ast.sourceFile.statements
    
    for (const statement of statements) {
      // Check for export const METHOD = ...
      if (ts.isVariableStatement(statement)) {
        const hasExportModifier = statement.modifiers?.some(
          mod => mod.kind === ts.SyntaxKind.ExportKeyword
        )
        
        if (hasExportModifier) {
          const declaration = statement.declarationList.declarations[0]
          if (declaration && ts.isIdentifier(declaration.name) && 
              declaration.name.text === method) {
            return statement
          }
        }
      }
      
      // Check for export async function METHOD
      if (ts.isFunctionDeclaration(statement)) {
        const hasExportModifier = statement.modifiers?.some(
          mod => mod.kind === ts.SyntaxKind.ExportKeyword
        )
        
        if (hasExportModifier && statement.name?.text === method) {
          return statement
        }
      }
    }
    
    return null
  }

  /**
   * Check if rate limiting is already implemented
   */
  private hasRateLimitingImplemented(ast: AST, method: string): boolean {
    const sourceText = ast.sourceFile.getFullText()
    
    // Check if using createRouteHandler (which includes rate limiting by default)
    if (sourceText.includes('createRouteHandler')) {
      return true
    }
    
    // Check for manual rate limiting implementation
    if (sourceText.includes('ratelimit') || 
        sourceText.includes('rate_limit') ||
        sourceText.includes('Ratelimit') ||
        sourceText.includes('@upstash/ratelimit')) {
      return true
    }
    
    // Check for other rate limiting libraries
    if (sourceText.includes('express-rate-limit') ||
        sourceText.includes('express-slow-down') ||
        sourceText.includes('rate-limiter-flexible')) {
      return true
    }
    
    return false
  }

  /**
   * Get violation severity based on HTTP method
   */
  private getViolationSeverity(method: string): 'error' | 'warning' {
    // Write operations are more critical
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? 'error' : 'warning'
  }

  /**
   * Auto-fix: Add rate limiting to the API route
   */
  private async addRateLimiting(
    filePath: string, 
    method: string, 
    methodExport: ts.Node
  ): Promise<void> {
    try {
      const sourceFile = await readFile(filePath, 'utf-8')
      const lines = sourceFile.split('\n')
      
      // Check if createRouteHandler is already imported
      const hasRouteHandlerImport = sourceFile.includes('createRouteHandler')
      
      if (!hasRouteHandlerImport) {
        // Add import at the top
        const importLine = "import { createRouteHandler } from '@/lib/api/route-handler'"
        lines.unshift(importLine)
      }
      
      // Convert the method export to use createRouteHandler
      const updatedLines = this.convertToCreateRouteHandler(lines, method)
      
      await writeFile(filePath, updatedLines.join('\n'))
      
      console.log(`✅ Auto-added rate limiting to ${method} endpoint in ${filePath}`)
      
    } catch (error) {
      console.error(`❌ Failed to auto-add rate limiting in ${filePath}:`, error)
    }
  }

  /**
   * Convert a manual function export to use createRouteHandler
   */
  private convertToCreateRouteHandler(lines: string[], method: string): string[] {
    const result = [...lines]
    const limit = this.defaultLimits[method as keyof typeof this.defaultLimits]
    
    for (let i = 0; i < result.length; i++) {
      const line = result[i]
      
      // Match export const METHOD = ... or export async function METHOD
      if (line.includes(`export`) && line.includes(method)) {
        
        // Handle export const METHOD = ...
        if (line.includes('export const') || line.includes('export let')) {
          const indentation = this.getIndentation(line)
          const newHandler = [
            `${indentation}export const ${method} = createRouteHandler(`,
            `${indentation}  async ({ request, body, query, user }) => {`,
            `${indentation}    // TODO: Implement ${method} logic here`,
            `${indentation}    return NextResponse.json({ message: 'Not implemented' })`,
            `${indentation}  },`,
            `${indentation}  {`,
            `${indentation}    rateLimit: { requests: ${limit.requests}, window: '${limit.window}' }`,
            `${indentation}  }`,
            `${indentation})`
          ]
          
          // Replace the line
          result.splice(i, 1, ...newHandler)
          break
        }
        
        // Handle export async function METHOD
        if (line.includes('export async function')) {
          const indentation = this.getIndentation(line)
          
          // Find the function body
          let functionEnd = i
          let braceCount = 0
          let foundStart = false
          
          for (let j = i; j < result.length; j++) {
            const currentLine = result[j]
            
            for (const char of currentLine) {
              if (char === '{') {
                braceCount++
                foundStart = true
              } else if (char === '}') {
                braceCount--
                if (foundStart && braceCount === 0) {
                  functionEnd = j
                  break
                }
              }
            }
            
            if (foundStart && braceCount === 0) break
          }
          
          // Replace the entire function
          const newHandler = [
            `${indentation}export const ${method} = createRouteHandler(`,
            `${indentation}  async ({ request, body, query, user }) => {`,
            `${indentation}    // TODO: Migrate existing logic here`,
            `${indentation}    return NextResponse.json({ message: 'Migrated to createRouteHandler' })`,
            `${indentation}  },`,
            `${indentation}  {`,
            `${indentation}    rateLimit: { requests: ${limit.requests}, window: '${limit.window}' }`,
            `${indentation}  }`,
            `${indentation})`
          ]
          
          result.splice(i, functionEnd - i + 1, ...newHandler)
          break
        }
      }
    }
    
    // Add NextResponse import if not present
    if (!result.some(line => line.includes('NextResponse'))) {
      const importIndex = result.findIndex(line => line.includes('import'))
      if (importIndex !== -1) {
        result.splice(importIndex + 1, 0, "import { NextResponse } from 'next/server'")
      }
    }
    
    return result
  }

  /**
   * Get the indentation of a line
   */
  private getIndentation(line: string): string {
    const match = line.match(/^(\s*)/)
    return match ? match[1] : ''
  }

  protected shouldProcessFile(filePath: string): boolean {
    return super.shouldProcessFile(filePath) && this.isApiRouteFile(filePath)
  }
}