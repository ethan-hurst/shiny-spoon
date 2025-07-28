/**
 * N+1 Query Guard - Detects potential N+1 query patterns in database operations
 * Helps prevent performance issues by identifying loops with database queries
 */

import * as ts from 'typescript'
import { writeFile, readFile } from 'fs/promises'
import { BaseGuard } from '../base-guard'
import { AST, Violation, findNodes, getNodePosition, containsPattern } from '../ast-analyzer'

export class NPlusOneQueryGuard extends BaseGuard {
  constructor() {
    super('NPlusOneQuery')
  }

  async check(ast: AST, filePath: string): Promise<Violation[]> {
    if (!this.shouldProcessFile(filePath)) {
      return []
    }

    const violations: Violation[] = []
    
    // Find all loop statements
    const loops = this.findAllLoops(ast)
    
    for (const loop of loops) {
      const hasQuery = this.containsDatabaseQuery(loop)
      
      if (hasQuery) {
        const position = getNodePosition(ast.sourceFile, loop)
        const loopType = this.getLoopType(loop)
        
        violations.push(this.createViolation(
          'performance',
          'warning',
          `Potential N+1 query pattern detected in ${loopType} loop. Consider using batch queries or joins instead.`,
          filePath,
          position.line,
          position.column,
          () => this.suggestBatchQuery(loop, filePath),
          `Replace individual queries with a single batch query using .in() or similar operations`
        ))
      }
    }
    
    // Check for array.map() with queries
    const mapQueries = this.findMapWithQueries(ast)
    for (const mapQuery of mapQueries) {
      const position = getNodePosition(ast.sourceFile, mapQuery)
      
      violations.push(this.createViolation(
        'performance',
        'warning',
        `Potential N+1 query pattern in array.map(). Consider using batch queries.`,
        filePath,
        position.line,
        position.column,
        undefined,
        `Extract IDs first, then use a single query with .in() to fetch all related data`
      ))
    }
    
    return violations
  }

  /**
   * Find all types of loops in the AST
   */
  private findAllLoops(ast: AST): ts.Node[] {
    const loops: ts.Node[] = []
    
    // Find for loops
    loops.push(...findNodes<ts.ForStatement>(ast.sourceFile, ts.SyntaxKind.ForStatement))
    
    // Find for-of loops
    loops.push(...findNodes<ts.ForOfStatement>(ast.sourceFile, ts.SyntaxKind.ForOfStatement))
    
    // Find for-in loops
    loops.push(...findNodes<ts.ForInStatement>(ast.sourceFile, ts.SyntaxKind.ForInStatement))
    
    // Find while loops
    loops.push(...findNodes<ts.WhileStatement>(ast.sourceFile, ts.SyntaxKind.WhileStatement))
    
    return loops
  }

  /**
   * Check if a loop contains database queries
   */
  private containsDatabaseQuery(loop: ts.Node): boolean {
    let hasQuery = false
    
    function visit(node: ts.Node) {
      // Check for Supabase queries
      if (ts.isCallExpression(node)) {
        const text = node.getText()
        
        // Supabase patterns
        if ((text.includes('supabase') && 
             (text.includes('.select') || text.includes('.from') || 
              text.includes('.insert') || text.includes('.update') || 
              text.includes('.delete')))) {
          hasQuery = true
          return
        }
        
        // Other database patterns
        if (text.includes('.query(') || 
            text.includes('.findMany(') || 
            text.includes('.findUnique(') || 
            text.includes('.findFirst(') ||
            text.includes('prisma.')) {
          hasQuery = true
          return
        }
        
        // Fetch to API endpoints that might hit database
        if (text.includes('fetch(') && 
            (text.includes('/api/') || text.includes('${id}') || text.includes('`/api'))) {
          hasQuery = true
          return
        }
      }
      
      ts.forEachChild(node, visit)
    }
    
    visit(loop)
    return hasQuery
  }

  /**
   * Find array.map() calls that contain queries
   */
  private findMapWithQueries(ast: AST): ts.CallExpression[] {
    const mapQueries: ts.CallExpression[] = []
    
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && 
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'map') {
        
        // Check if the map callback contains a query
        if (node.arguments.length > 0) {
          const callback = node.arguments[0]
          if (this.containsDatabaseQuery(callback)) {
            mapQueries.push(node)
          }
        }
      }
      
      ts.forEachChild(node, visit)
    }
    
    visit(ast.sourceFile)
    return mapQueries
  }

  /**
   * Get the type of loop for better error messages
   */
  private getLoopType(loop: ts.Node): string {
    if (ts.isForStatement(loop)) return 'for'
    if (ts.isForOfStatement(loop)) return 'for-of'
    if (ts.isForInStatement(loop)) return 'for-in'
    if (ts.isWhileStatement(loop)) return 'while'
    return 'loop'
  }

  /**
   * Suggest a batch query solution
   */
  private async suggestBatchQuery(loop: ts.Node, filePath: string): Promise<void> {
    try {
      const sourceFile = await readFile(filePath, 'utf-8')
      const lines = sourceFile.split('\n')
      const position = getNodePosition(loop.getSourceFile(), loop)
      
      // Add a comment with batch query suggestion
      const lineIndex = position.line - 1
      const indentation = this.getIndentation(lines[lineIndex])
      
      const suggestion = [
        `${indentation}// TODO: Consider replacing this loop with a batch query`,
        `${indentation}// Example: const ids = items.map(item => item.id)`,
        `${indentation}//         const results = await supabase.from('table').select('*').in('item_id', ids)`,
        `${indentation}//         const resultsMap = new Map(results.data.map(r => [r.item_id, r]))`
      ]
      
      lines.splice(lineIndex, 0, ...suggestion)
      
      await writeFile(filePath, lines.join('\n'))
      
      console.log(`💡 Added batch query suggestion to ${filePath}`)
      
    } catch (error) {
      console.error(`❌ Failed to add batch query suggestion in ${filePath}:`, error)
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
    // Focus on files that likely contain business logic with database queries
    return super.shouldProcessFile(filePath) && 
           (filePath.includes('/api/') || 
            filePath.includes('/actions/') ||
            filePath.includes('/services/') ||
            filePath.includes('/repositories/') ||
            filePath.includes('/lib/') ||
            filePath.includes('/hooks/'))
  }
}