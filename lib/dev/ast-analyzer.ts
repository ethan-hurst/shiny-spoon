/**
 * AST Analyzer - Core TypeScript/JavaScript analysis for development guards
 */

import * as ts from 'typescript'
import { readFile } from 'fs/promises'

export interface AST {
  sourceFile: ts.SourceFile
  typeChecker: ts.TypeChecker
  program: ts.Program
  filePath: string
}

export interface Violation {
  id: string
  type: 'security' | 'performance' | 'quality'
  severity: 'error' | 'warning' | 'info'
  message: string
  file: string
  line: number
  column: number
  quickFix?: () => Promise<void>
  suggestion?: string
}

/**
 * Analyze a TypeScript/JavaScript file and return AST information
 */
export async function analyze(filePath: string): Promise<AST> {
  try {
    const sourceCode = await readFile(filePath, 'utf-8')
    
    // Create TypeScript program for type checking
    const compilerOptions: ts.CompilerOptions = {
      allowJs: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      strict: true,
      target: ts.ScriptTarget.ES2020,
      skipLibCheck: true,
      skipDefaultLibCheck: true
    }
    
    const program = ts.createProgram([filePath], compilerOptions)
    const sourceFile = program.getSourceFile(filePath)
    
    if (!sourceFile) {
      throw new Error(`Could not create source file for ${filePath}`)
    }
    
    const typeChecker = program.getTypeChecker()
    
    return {
      sourceFile,
      typeChecker,
      program,
      filePath
    }
  } catch (error) {
    throw new Error(`Failed to analyze ${filePath}: ${error}`)
  }
}

/**
 * Find nodes of a specific kind in the AST
 */
export function findNodes<T extends ts.Node>(
  sourceFile: ts.SourceFile,
  kind: ts.SyntaxKind
): T[] {
  const nodes: T[] = []
  
  function visit(node: ts.Node) {
    if (node.kind === kind) {
      nodes.push(node as T)
    }
    ts.forEachChild(node, visit)
  }
  
  visit(sourceFile)
  return nodes
}

/**
 * Find call expressions for a specific method name
 */
export function findCallExpressions(
  sourceFile: ts.SourceFile,
  methodName: string
): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      
      // Direct method call: methodName()
      if (ts.isIdentifier(expression) && expression.text === methodName) {
        calls.push(node)
      }
      
      // Property access: obj.methodName()
      if (ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.name) &&
          expression.name.text === methodName) {
        calls.push(node)
      }
    }
    ts.forEachChild(node, visit)
  }
  
  visit(sourceFile)
  return calls
}

/**
 * Find method calls in a chain (e.g., obj.method1().method2())
 */
export function findChainedCalls(
  expression: ts.PropertyAccessExpression,
  methodNames: string[]
): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  let current: ts.Node = expression
  
  while (current) {
    if (ts.isCallExpression(current) && 
        ts.isPropertyAccessExpression(current.expression)) {
      const methodName = current.expression.name.text
      if (methodNames.includes(methodName)) {
        calls.push(current)
      }
      current = current.expression.expression
    } else {
      break
    }
  }
  
  return calls
}

/**
 * Check if a file is a system file that should be skipped
 */
export function isSystemFile(filePath: string): boolean {
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
    'tailwind.config'
  ]
  
  return systemPatterns.some(pattern => filePath.includes(pattern))
}

/**
 * Get line and column information for a node
 */
export function getNodePosition(sourceFile: ts.SourceFile, node: ts.Node): {
  line: number
  column: number
} {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
  return { line: line + 1, column: character + 1 }
}

/**
 * Extract string literal value from a node
 */
export function getStringLiteralValue(node: ts.Node): string | null {
  if (ts.isStringLiteral(node)) {
    return node.text
  }
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  return null
}

/**
 * Check if a node contains a specific pattern
 */
export function containsPattern(node: ts.Node, pattern: RegExp): boolean {
  const text = node.getText()
  return pattern.test(text)
}

/**
 * Find imports in a source file
 */
export function findImports(sourceFile: ts.SourceFile): {
  module: string
  imports: string[]
  isDefault: boolean
}[] {
  const imports: { module: string; imports: string[]; isDefault: boolean }[] = []
  
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text
      const importClause = node.importClause
      
      if (importClause) {
        const importedNames: string[] = []
        let isDefault = false
        
        // Default import
        if (importClause.name) {
          importedNames.push(importClause.name.text)
          isDefault = true
        }
        
        // Named imports
        if (importClause.namedBindings) {
          if (ts.isNamedImports(importClause.namedBindings)) {
            importClause.namedBindings.elements.forEach(element => {
              importedNames.push(element.name.text)
            })
          } else if (ts.isNamespaceImport(importClause.namedBindings)) {
            importedNames.push(importClause.namedBindings.name.text)
          }
        }
        
        imports.push({
          module: moduleName,
          imports: importedNames,
          isDefault
        })
      }
    }
    
    ts.forEachChild(node, visit)
  }
  
  visit(sourceFile)
  return imports
}

/**
 * Check if a function has error handling (try/catch or .catch())
 */
export function hasErrorHandling(node: ts.Node): boolean {
  let hasHandling = false
  
  function visit(child: ts.Node) {
    // Check for try/catch statements
    if (ts.isTryStatement(child)) {
      hasHandling = true
      return
    }
    
    // Check for .catch() method calls
    if (ts.isCallExpression(child) && 
        ts.isPropertyAccessExpression(child.expression) &&
        child.expression.name.text === 'catch') {
      hasHandling = true
      return
    }
    
    ts.forEachChild(child, visit)
  }
  
  visit(node)
  return hasHandling
}