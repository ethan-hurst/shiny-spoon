/**
 * Error Handling Guard - Ensures proper error handling in async operations
 * Prevents unhandled promise rejections and improves code reliability
 */

import * as ts from 'typescript'
import { writeFile, readFile } from 'fs/promises'
import { BaseGuard } from '../base-guard'
import { AST, Violation, findCallExpressions, getNodePosition, hasErrorHandling } from '../ast-analyzer'

export class ErrorHandlingGuard extends BaseGuard {
  constructor() {
    super('ErrorHandling')
  }

  async check(ast: AST, filePath: string): Promise<Violation[]> {
    if (!this.shouldProcessFile(filePath)) {
      return []
    }

    const violations: Violation[] = []
    
    // Find async operations that might need error handling
    const asyncOperations = this.findAsyncOperations(ast)
    
    for (const operation of asyncOperations) {
      if (!this.hasProperErrorHandling(operation)) {
        const position = getNodePosition(ast.sourceFile, operation)
        
        violations.push(this.createViolation(
          'quality',
          'warning',
          `Async operation without error handling. Consider adding try/catch or .catch()`,
          filePath,
          position.line,
          position.column,
          () => this.addErrorHandling(operation, filePath),
          `Wrap in try/catch block or add .catch() method`
        ))
      }
    }
    
    return violations
  }

  /**
   * Find async operations that should have error handling
   */
  private findAsyncOperations(ast: AST): ts.CallExpression[] {
    const operations: ts.CallExpression[] = []
    
    // Find fetch calls
    const fetchCalls = findCallExpressions(ast.sourceFile, 'fetch')
    operations.push(...fetchCalls)
    
    // Find database operations
    const supabaseCalls = this.findSupabaseOperations(ast.sourceFile)
    operations.push(...supabaseCalls)
    
    // Find other async operations
    const asyncCalls = this.findOtherAsyncOperations(ast.sourceFile)
    operations.push(...asyncCalls)
    
    return operations
  }

  /**
   * Find Supabase database operations
   */
  private findSupabaseOperations(sourceFile: ts.SourceFile): ts.CallExpression[] {
    const operations: ts.CallExpression[] = []
    
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const text = node.getText()
        if (text.includes('supabase') && 
            (text.includes('.select') || text.includes('.insert') || 
             text.includes('.update') || text.includes('.delete') ||
             text.includes('.from'))) {
          operations.push(node)
        }
      }
      ts.forEachChild(node, visit)
    }
    
    visit(sourceFile)
    return operations
  }

  /**
   * Find other async operations that need error handling
   */
  private findOtherAsyncOperations(sourceFile: ts.SourceFile): ts.CallExpression[] {
    const operations: ts.CallExpression[] = []
    
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const text = node.getText()
        
        // Axios calls
        if (text.includes('axios.') || text.includes('.get(') || 
            text.includes('.post(') || text.includes('.put(') || 
            text.includes('.delete(')) {
          operations.push(node)
        }
        
        // File system operations
        if (text.includes('fs.') || text.includes('readFile') || 
            text.includes('writeFile')) {
          operations.push(node)
        }
        
        // Database operations
        if (text.includes('prisma.') || text.includes('.query(') ||
            text.includes('.findMany(') || text.includes('.create(')) {
          operations.push(node)
        }
      }
      ts.forEachChild(node, visit)
    }
    
    visit(sourceFile)
    return operations
  }

  /**
   * Check if an operation has proper error handling
   */
  private hasProperErrorHandling(operation: ts.CallExpression): boolean {
    // Check if the operation is inside a try/catch block
    let current = operation.parent
    while (current) {
      if (ts.isTryStatement(current)) {
        return true
      }
      current = current.parent
    }
    
    // Check if the operation has a .catch() method
    let parent = operation.parent
    while (parent && ts.isPropertyAccessExpression(parent)) {
      if (parent.name.text === 'catch') {
        return true
      }
      parent = parent.parent
    }
    
    // Check if it's in an error boundary (React) or similar
    const text = operation.getText()
    if (text.includes('.catch(') || text.includes('ErrorBoundary')) {
      return true
    }
    
    return false
  }

  /**
   * Auto-fix: Add error handling to the operation
   */
  private async addErrorHandling(
    operation: ts.CallExpression, 
    filePath: string
  ): Promise<void> {
    try {
      const sourceFile = await readFile(filePath, 'utf-8')
      const lines = sourceFile.split('\n')
      const position = getNodePosition(operation.getSourceFile(), operation)
      
      // Find the statement containing the operation
      let statementLine = position.line - 1
      let statement = lines[statementLine].trim()
      
      // Look for the complete statement
      while (statementLine < lines.length - 1 && !statement.endsWith(';') && !statement.endsWith('}')) {
        statementLine++
        statement += ' ' + lines[statementLine].trim()
      }
      
      const indentation = this.getIndentation(lines[position.line - 1])
      
      // Check if it's an await operation
      if (statement.includes('await')) {
        // Add try/catch block
        const tryBlock = [
          `${indentation}try {`,
          `${indentation}  ${statement}`,
          `${indentation}} catch (error) {`,
          `${indentation}  console.error('Operation failed:', error)`,
          `${indentation}  // TODO: Handle error appropriately`,
          `${indentation}}`
        ]
        
        lines.splice(position.line - 1, 1, ...tryBlock)
      } else {
        // Add .catch() method
        const modifiedStatement = statement.replace(/;$/, '.catch(error => {\n' +
          `${indentation}  console.error('Operation failed:', error)\n` +
          `${indentation}  // TODO: Handle error appropriately\n` +
          `${indentation}});`)
        
        lines[position.line - 1] = indentation + modifiedStatement
      }
      
      await writeFile(filePath, lines.join('\n'))
      
      console.log(`✅ Added error handling to ${filePath}`)
      
    } catch (error) {
      console.error(`❌ Failed to add error handling in ${filePath}:`, error)
    }
  }

  /**
   * Get the indentation of a line
   */
  private getIndentation(line: string): string {
    const match = line.match(/^(\s*)/)
    return match ? match[1] : ''
  }

  protected shouldProcessFile(filePath: string): boolean {
    // Focus on files that likely contain async operations
    return super.shouldProcessFile(filePath) && 
           (filePath.includes('/api/') || 
            filePath.includes('/actions/') ||
            filePath.includes('/services/') ||
            filePath.includes('/lib/') ||
            filePath.includes('/hooks/') ||
            filePath.includes('/components/'))
  }
}