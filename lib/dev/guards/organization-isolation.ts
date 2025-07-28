/**
 * Organization Isolation Guard - Ensures all database queries include organization_id filter
 * Prevents data leakage between organizations
 */

import * as ts from 'typescript'
import { writeFile, readFile } from 'fs/promises'
import { BaseGuard } from '../base-guard'
import { AST, Violation, findCallExpressions, getNodePosition, getStringLiteralValue } from '../ast-analyzer'

export class OrganizationIsolationGuard extends BaseGuard {
  private readonly organizationTables = [
    'products', 'customers', 'orders', 'inventory', 'pricing', 'users',
    'product_pricing', 'pricing_rules', 'quantity_breaks', 'warehouses',
    'user_profiles', 'integrations', 'sync_logs', 'notifications'
  ]

  constructor() {
    super('OrganizationIsolation')
  }

  async check(ast: AST, filePath: string): Promise<Violation[]> {
    if (!this.shouldProcessFile(filePath)) {
      return []
    }

    const violations: Violation[] = []
    
    // Skip system files and test files
    if (this.isSystemFile(filePath)) {
      return violations
    }

    // Find all Supabase queries
    const supabaseQueries = this.findSupabaseQueries(ast)
    
    for (const query of supabaseQueries) {
      const tableName = this.extractTableName(query)
      
      if (tableName && this.requiresOrganizationFilter(tableName)) {
        const hasOrgFilter = this.checkOrganizationFilter(query, ast)
        
        if (!hasOrgFilter) {
          const position = getNodePosition(ast.sourceFile, query)
          
          violations.push(this.createViolation(
            'security',
            'error',
            `Missing organization_id filter for table '${tableName}'. This can cause data leakage between organizations.`,
            filePath,
            position.line,
            position.column,
            () => this.addOrganizationFilter(query, filePath, tableName),
            `Add .eq('organization_id', organizationId) to the query chain`
          ))
        }
      }
    }
    
    return violations
  }

  /**
   * Find all Supabase database queries in the file
   */
  private findSupabaseQueries(ast: AST): ts.CallExpression[] {
    const queries: ts.CallExpression[] = []
    
    // Look for .from('table_name') calls
    const fromCalls = findCallExpressions(ast.sourceFile, 'from')
    
    fromCalls.forEach(fromCall => {
      // Check if it's a Supabase call by looking for supabase in the chain
      if (this.isSupabaseCall(fromCall)) {
        queries.push(fromCall)
      }
    })
    
    return queries
  }

  /**
   * Check if a call expression is part of a Supabase query chain
   */
  private isSupabaseCall(call: ts.CallExpression): boolean {
    let current: ts.Node = call
    
    while (current) {
      const text = current.getText()
      if (text.includes('supabase')) {
        return true
      }
      current = current.parent
    }
    
    return false
  }

  /**
   * Extract table name from a .from() call
   */
  private extractTableName(fromCall: ts.CallExpression): string | null {
    if (fromCall.arguments.length > 0) {
      const firstArg = fromCall.arguments[0]
      return getStringLiteralValue(firstArg)
    }
    return null
  }

  /**
   * Check if a table requires organization filtering
   */
  private requiresOrganizationFilter(tableName: string): boolean {
    return this.organizationTables.includes(tableName)
  }

  /**
   * Check if the query chain includes organization_id filter
   */
  private checkOrganizationFilter(fromCall: ts.CallExpression, ast: AST): boolean {
    // Look for .eq('organization_id', ...) in the query chain
    let current: ts.Node = fromCall.parent
    
    while (current && this.isPartOfQueryChain(current)) {
      if (ts.isCallExpression(current) && 
          ts.isPropertyAccessExpression(current.expression)) {
        
        const methodName = current.expression.name.text
        
        // Check for .eq('organization_id', ...)
        if (methodName === 'eq' && current.arguments.length >= 2) {
          const fieldArg = current.arguments[0]
          const fieldName = getStringLiteralValue(fieldArg)
          
          if (fieldName === 'organization_id') {
            return true
          }
        }
        
        // Check for .match({ organization_id: ... })
        if (methodName === 'match' && current.arguments.length >= 1) {
          const matchArg = current.arguments[0]
          if (ts.isObjectLiteralExpression(matchArg)) {
            const hasOrgId = matchArg.properties.some(prop => {
              if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                return prop.name.text === 'organization_id'
              }
              return false
            })
            if (hasOrgId) return true
          }
        }
      }
      
      current = current.parent
    }
    
    return false
  }

  /**
   * Check if a node is part of a query chain
   */
  private isPartOfQueryChain(node: ts.Node): boolean {
    return ts.isCallExpression(node) && 
           ts.isPropertyAccessExpression(node.expression)
  }

  /**
   * Auto-fix: Add organization filter to the query
   */
  private async addOrganizationFilter(
    fromCall: ts.CallExpression, 
    filePath: string, 
    tableName: string
  ): Promise<void> {
    try {
      const sourceFile = await readFile(filePath, 'utf-8')
      const lines = sourceFile.split('\n')
      
      // Find the line containing the .from() call
      const position = getNodePosition(fromCall.getSourceFile(), fromCall)
      const lineIndex = position.line - 1
      const line = lines[lineIndex]
      
      // Find the end of the query chain to add the organization filter
      let modifiedLines = [...lines]
      let insertIndex = lineIndex
      
      // Look for the next lines that are part of the query chain
      for (let i = lineIndex + 1; i < lines.length; i++) {
        const nextLine = lines[i].trim()
        if (nextLine.startsWith('.') && 
            (nextLine.includes('.select') || nextLine.includes('.insert') || 
             nextLine.includes('.update') || nextLine.includes('.delete'))) {
          insertIndex = i
          break
        }
        if (!nextLine.startsWith('.')) {
          break
        }
      }
      
      // Insert the organization filter
      const indentation = this.getIndentation(lines[insertIndex])
      const orgFilter = `${indentation}.eq('organization_id', organizationId)`
      
      modifiedLines.splice(insertIndex + 1, 0, orgFilter)
      
      // Ensure organizationId is available in scope
      if (!sourceFile.includes('organizationId')) {
        this.addOrganizationIdToScope(modifiedLines, filePath)
      }
      
      await writeFile(filePath, modifiedLines.join('\n'))
      
      console.log(`✅ Auto-fixed organization isolation in ${filePath} for table '${tableName}'`)
      
    } catch (error) {
      console.error(`❌ Failed to auto-fix organization isolation in ${filePath}:`, error)
    }
  }

  /**
   * Get the indentation of a line
   */
  private getIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }

  /**
   * Add organizationId to the function scope if not present
   */
  private addOrganizationIdToScope(lines: string[], filePath: string): void {
    // Look for function declarations to add organizationId parameter
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Check for route handler functions
      if (line.includes('createRouteHandler') || 
          line.includes('export async function')) {
        
        // Add organizationId extraction
        const indentation = this.getIndentation(line)
        const orgIdExtraction = [
          `${indentation}// Extract organization ID from user context`,
          `${indentation}const organizationId = user?.organizationId`
        ]
        
        // Find the opening brace and add after it
        for (let j = i; j < lines.length; j++) {
          if (lines[j].includes('{')) {
            lines.splice(j + 1, 0, ...orgIdExtraction)
            break
          }
        }
        break
      }
    }
  }

  /**
   * Check if a file is a system file
   */
  private isSystemFile(filePath: string): boolean {
    const systemPatterns = [
      '/node_modules/',
      '/.next/',
      '/dist/',
      '/build/',
      '.test.',
      '.spec.',
      '.d.ts',
      '__tests__/',
      'jest.config',
      'next.config',
      'tailwind.config',
      'migrations/',
      'seeds/',
      'types/'
    ]
    
    return systemPatterns.some(pattern => filePath.includes(pattern))
  }

  protected shouldProcessFile(filePath: string): boolean {
    // Only process files that likely contain database queries
    return super.shouldProcessFile(filePath) && 
           (filePath.includes('/api/') || 
            filePath.includes('/actions/') ||
            filePath.includes('/services/') ||
            filePath.includes('/repositories/') ||
            filePath.includes('/lib/'))
  }
}