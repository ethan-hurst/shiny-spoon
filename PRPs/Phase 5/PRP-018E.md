# PRP-018E: Real-Time Development Guards & Quality Enforcement

## 🚀 Quick Start

```bash
# This PRP implements real-time development guards that catch issues immediately:
npm run dev:guards          # Enable real-time development monitoring
npm run setup:hooks         # Install pre-commit quality gates
npm run generate:template    # Create guard templates for new features

# Your development environment will automatically get:
✅ Real-time security violation detection (missing org isolation, rate limits)
✅ Performance issue alerts (N+1 queries, large bundle sizes)
✅ Code quality enforcement (TypeScript strict mode, missing tests)
✅ Visual feedback in browser toolbar with instant fix suggestions
✅ Pre-commit hooks that block bad code from being committed
✅ Automated fixes for common violations with one-click apply
```

## Goal

Build a comprehensive real-time development guard system that catches security, performance, and quality issues during development with immediate visual feedback, automated fixes, and pre-commit enforcement to prevent bad code from ever reaching production.

## Why This Matters

- **Security Prevention**: 95% of security issues can be caught during development, not in production
- **Developer Velocity**: Fix issues immediately vs. hours later during code review
- **Code Quality**: Enforce standards automatically rather than relying on manual review
- **Learning Acceleration**: Real-time feedback teaches best practices as developers code
- **Production Stability**: Block problematic code from ever being committed

Currently, developers discover issues during CI/CD, code review, or worse - in production. With real-time guards, violations are caught within seconds of being written, with contextual guidance on how to fix them.

## What We're Building

### 1. File Watcher System with AST Analysis
- Real-time TypeScript/JavaScript file monitoring
- AST-based pattern detection for security and quality violations
- Incremental analysis for performance
- Support for all file types (API routes, components, services, etc.)

### 2. Security Guards (Real-Time)
#### 2.1 Organization Isolation Guard
```typescript
// Detects queries missing organization_id filter
// VIOLATION DETECTED in products.ts:
const products = await supabase
  .from('products')
  .select('*') // ❌ Missing organization filter

// SUGGESTED FIX:
const products = await supabase
  .from('products')
  .select('*')
  .eq('organization_id', organizationId) // ✅ Auto-added
```

#### 2.2 Rate Limiting Guard
```typescript
// VIOLATION DETECTED in /api/products/route.ts:
export async function POST(request: NextRequest) { // ❌ No rate limiting

// SUGGESTED FIX:
export const POST = createRouteHandler(
  async ({ body }) => {
    // Handler logic
  },
  { rateLimit: { requests: 100, window: '1h' } } // ✅ Auto-added
)
```

#### 2.3 Authentication Guard
```typescript
// VIOLATION DETECTED in sensitive-action.ts:
export async function deleteUser(userId: string) { // ❌ No auth check

// SUGGESTED FIX:
export const deleteUser = createRouteHandler(
  async ({ user, body }) => {
    // Handler logic with authenticated user
  },
  { auth: true, requiredPermissions: ['admin'] } // ✅ Auto-added
)
```

### 3. Performance Guards (Real-Time)
#### 3.1 N+1 Query Detector
```typescript
// VIOLATION DETECTED:
for (const product of products) {
  const price = await supabase
    .from('pricing')
    .select('*')
    .eq('product_id', product.id) // ❌ N+1 query pattern
}

// SUGGESTED FIX:
const productIds = products.map(p => p.id)
const prices = await supabase
  .from('pricing')
  .select('*')
  .in('product_id', productIds) // ✅ Single batch query
```

#### 3.2 Bundle Size Monitor
```typescript
// VIOLATION DETECTED in large-component.tsx:
import * as lodash from 'lodash' // ❌ Importing entire library (50KB+)

// SUGGESTED FIX:
import { debounce } from 'lodash' // ✅ Tree-shakable import
```

#### 3.3 Memory Leak Detector
```typescript
// VIOLATION DETECTED in useEffect:
useEffect(() => {
  const interval = setInterval(() => {
    // Some logic
  }, 1000)
  // ❌ Missing cleanup
}, [])

// SUGGESTED FIX:
useEffect(() => {
  const interval = setInterval(() => {
    // Some logic
  }, 1000)
  
  return () => clearInterval(interval) // ✅ Cleanup added
}, [])
```

### 4. Code Quality Guards (Real-Time)
#### 4.1 TypeScript Strict Mode Enforcer
```typescript
// VIOLATION DETECTED:
function processData(data: any) { // ❌ Using 'any' type

// SUGGESTED FIX:
function processData<T extends Record<string, unknown>>(data: T) { // ✅ Generic constraint
```

#### 4.2 Missing Error Handling Detector
```typescript
// VIOLATION DETECTED:
const data = await fetch('/api/data') // ❌ No error handling

// SUGGESTED FIX:
try {
  const data = await fetch('/api/data')
  // Handle success
} catch (error) {
  console.error('Failed to fetch data:', error)
  // Handle error
} // ✅ Proper error handling
```

#### 4.3 Test Coverage Guard
```typescript
// VIOLATION DETECTED in product-service.ts:
export class ProductService {
  async createProduct() { // ❌ No test file found
    // Implementation
  }
}

// AUTO-GENERATED: __tests__/product-service.test.ts
describe('ProductService', () => {
  it('should create product successfully', () => {
    // TODO: Implement test
  })
})
```

### 5. Visual Development Toolbar
```tsx
// Real-time browser overlay showing current violations
interface DevToolbarProps {
  violations: Array<{
    type: 'security' | 'performance' | 'quality'
    severity: 'error' | 'warning' | 'info'
    message: string
    file: string
    line: number
    quickFix?: () => void
  }>
}

// Features:
// - Collapsible interface that doesn't interfere with development
// - One-click fixes for common violations
// - Integration with VS Code (open file at specific line)
// - Performance metrics (bundle size, query count, render time)
// - Quick access to documentation for best practices
```

### 6. Pre-Commit Quality Gates
```bash
# Automated checks before each commit:
✅ TypeScript compilation (strict mode)
✅ ESLint rules (custom security rules)
✅ Test coverage threshold (80% minimum)
✅ Bundle size limits (per-route analysis)
✅ Security pattern verification
✅ Performance benchmark compliance
✅ API rate limiting verification
✅ Database query organization filtering

# If any check fails:
❌ Commit blocked with specific error messages
💡 Suggested fixes provided
🔧 Auto-fix available for simple violations
📖 Documentation links for complex issues
```

## Context & References

### Existing Infrastructure to Build Upon
- **BaseService**: `/lib/base/base-service.ts` - Service patterns to detect
- **BaseRepository**: `/lib/base/base-repository.ts` - Repository patterns to enforce
- **createRouteHandler**: `/lib/api/route-handler.ts` - Route patterns to validate
- **CircuitBreaker**: `/lib/resilience/circuit-breaker.ts` - Resilience patterns
- **Rate Limiter**: `/lib/ratelimiter.ts` - Rate limiting patterns

### File Patterns to Monitor
- **API Routes**: `app/api/**/route.ts` - Check auth, rate limiting, validation
- **Server Actions**: `app/actions/*.ts` - Check org isolation, error handling
- **Components**: `components/**/*.tsx` - Check performance, accessibility
- **Services**: `lib/services/*.ts` - Check BaseService usage, patterns
- **Repositories**: `lib/repositories/*.ts` - Check BaseRepository usage

### External Tools Integration
- **TypeScript Compiler API**: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- **ESTree AST**: https://github.com/estree/estree - JavaScript AST specification
- **Chokidar**: https://github.com/paulmillr/chokidar - File watching
- **VS Code Extension API**: For IDE integration
- **Husky**: Already installed for git hooks

## Implementation Blueprint

### Phase 1: File Watching & AST Analysis Infrastructure

#### 1.1 File Watcher Service
```typescript
// lib/dev/file-watcher.ts
import chokidar from 'chokidar'
import { AST, analyze } from './ast-analyzer'
import { SecurityGuards } from './guards/security'
import { PerformanceGuards } from './guards/performance'
import { QualityGuards } from './guards/quality'

export class FileWatcherService {
  private watcher: chokidar.FSWatcher
  private guards: Array<BaseGuard>
  
  constructor() {
    this.guards = [
      new SecurityGuards(),
      new PerformanceGuards(),
      new QualityGuards()
    ]
  }
  
  async start() {
    if (process.env.NODE_ENV !== 'development') return
    if (!process.env.DEV_GUARDS) return
    
    console.log('🛡️  Starting development guards...')
    
    this.watcher = chokidar.watch([
      'app/**/*.{ts,tsx,js,jsx}',
      'lib/**/*.{ts,tsx,js,jsx}',
      'components/**/*.{ts,tsx,js,jsx}'
    ], {
      ignored: [
        'node_modules/**',
        '.next/**',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.d.ts'
      ],
      persistent: true,
      ignoreInitial: false
    })
    
    this.watcher
      .on('add', this.analyzeFile.bind(this))
      .on('change', this.analyzeFile.bind(this))
      .on('unlink', this.removeFile.bind(this))
  }
  
  private async analyzeFile(filePath: string) {
    try {
      const ast = await analyze(filePath)
      const violations = await this.runGuards(ast, filePath)
      
      if (violations.length > 0) {
        this.reportViolations(filePath, violations)
      }
    } catch (error) {
      console.error(`Failed to analyze ${filePath}:`, error)
    }
  }
  
  private async runGuards(ast: AST, filePath: string): Promise<Violation[]> {
    const violations: Violation[] = []
    
    for (const guard of this.guards) {
      const guardViolations = await guard.check(ast, filePath)
      violations.push(...guardViolations)
    }
    
    return violations
  }
  
  private reportViolations(filePath: string, violations: Violation[]) {
    // Send to browser via WebSocket for real-time display
    this.sendToBrowser({
      type: 'violations',
      file: filePath,
      violations
    })
    
    // Log to console with colors
    console.log(`\n🚨 ${violations.length} violation(s) in ${filePath}:`)
    violations.forEach(v => {
      console.log(`  ${v.severity === 'error' ? '❌' : '⚠️'} ${v.message}`)
      if (v.quickFix) {
        console.log(`     💡 Quick fix available`)
      }
    })
  }
}
```

#### 1.2 AST Analyzer
```typescript
// lib/dev/ast-analyzer.ts
import * as ts from 'typescript'
import { readFile } from 'fs/promises'

export interface AST {
  sourceFile: ts.SourceFile
  typeChecker: ts.TypeChecker
  program: ts.Program
}

export async function analyze(filePath: string): Promise<AST> {
  const sourceCode = await readFile(filePath, 'utf-8')
  
  // Create TypeScript program for type checking
  const program = ts.createProgram([filePath], {
    allowJs: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    target: ts.ScriptTarget.ES2020
  })
  
  const sourceFile = program.getSourceFile(filePath)!
  const typeChecker = program.getTypeChecker()
  
  return {
    sourceFile,
    typeChecker,
    program
  }
}

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

export function findCallExpressions(
  sourceFile: ts.SourceFile,
  methodName: string
): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      
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
```

### Phase 2: Security Guards Implementation

#### 2.1 Organization Isolation Guard
```typescript
// lib/dev/guards/organization-isolation.ts
import { BaseGuard, Violation } from './base-guard'
import { AST, findCallExpressions } from '../ast-analyzer'
import * as ts from 'typescript'

export class OrganizationIsolationGuard extends BaseGuard {
  async check(ast: AST, filePath: string): Promise<Violation[]> {
    const violations: Violation[] = []
    
    // Skip system tables and test files
    if (this.isSystemFile(filePath)) return violations
    
    // Find all Supabase queries
    const supabaseCalls = this.findSupabaseQueries(ast.sourceFile)
    
    for (const call of supabaseCalls) {
      const hasOrgFilter = this.checkOrganizationFilter(call, ast)
      
      if (!hasOrgFilter) {
        violations.push({
          type: 'security',
          severity: 'error',
          message: 'Missing organization_id filter in database query',
          file: filePath,
          line: ast.sourceFile.getLineAndCharacterOfPosition(call.getStart()).line + 1,
          quickFix: () => this.addOrganizationFilter(call, filePath)
        })
      }
    }
    
    return violations
  }
  
  private findSupabaseQueries(sourceFile: ts.SourceFile): ts.CallExpression[] {
    const queries: ts.CallExpression[] = []
    
    // Look for .from('table_name') calls
    const fromCalls = findCallExpressions(sourceFile, 'from')
    
    // Look for .select() calls that follow .from()
    fromCalls.forEach(fromCall => {
      // Find subsequent .select() calls in the chain
      const parent = fromCall.parent
      if (ts.isPropertyAccessExpression(parent)) {
        const selectCalls = this.findChainedCalls(parent, ['select', 'insert', 'update', 'delete'])
        queries.push(...selectCalls)
      }
    })
    
    return queries
  }
  
  private checkOrganizationFilter(call: ts.CallExpression, ast: AST): boolean {
    // Check if the query chain includes .eq('organization_id', ...)
    let current = call.parent
    
    while (current && ts.isCallExpression(current)) {
      if (ts.isPropertyAccessExpression(current.expression)) {
        const methodName = current.expression.name.text
        
        if (methodName === 'eq' && current.arguments.length >= 1) {
          const firstArg = current.arguments[0]
          if (ts.isStringLiteral(firstArg) && 
              firstArg.text === 'organization_id') {
            return true
          }
        }
      }
      
      current = current.parent
    }
    
    return false
  }
  
  private async addOrganizationFilter(call: ts.CallExpression, filePath: string) {
    // Auto-fix: Add .eq('organization_id', organizationId) to the query
    const sourceFile = await readFile(filePath, 'utf-8')
    const lines = sourceFile.split('\n')
    
    const lineNumber = call.getSourceFile().getLineAndCharacterOfPosition(call.getStart()).line
    const line = lines[lineNumber]
    
    // Insert organization filter
    const modifiedLine = line.replace(
      /\.select\((.*?)\)/,
      `.select($1)\n      .eq('organization_id', organizationId)`
    )
    
    lines[lineNumber] = modifiedLine
    
    // Also ensure organizationId is available in scope
    if (!sourceFile.includes('organizationId')) {
      // Add organizationId parameter or context
      this.addOrganizationIdToScope(lines, filePath)
    }
    
    await writeFile(filePath, lines.join('\n'))
    console.log(`✅ Auto-fixed organization isolation in ${filePath}`)
  }
}
```

#### 2.2 Rate Limiting Guard
```typescript
// lib/dev/guards/rate-limiting.ts
export class RateLimitingGuard extends BaseGuard {
  async check(ast: AST, filePath: string): Promise<Violation[]> {
    const violations: Violation[] = []
    
    // Only check API route files
    if (!filePath.includes('/api/') || !filePath.endsWith('/route.ts')) {
      return violations
    }
    
    // Find HTTP method exports
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    const exports = findNodes<ts.FunctionDeclaration>(ast.sourceFile, ts.SyntaxKind.ExportAssignment)
    
    for (const method of httpMethods) {
      const hasMethod = this.hasHttpMethodExport(ast.sourceFile, method)
      
      if (hasMethod && !this.hasRateLimit(ast.sourceFile, method)) {
        violations.push({
          type: 'security',
          severity: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? 'error' : 'warning',
          message: `Missing rate limiting on ${method} endpoint`,
          file: filePath,
          line: this.getMethodLine(ast.sourceFile, method),
          quickFix: () => this.addRateLimit(filePath, method)
        })
      }
    }
    
    return violations
  }
  
  private hasHttpMethodExport(sourceFile: ts.SourceFile, method: string): boolean {
    // Check for export const GET = ... or export async function GET
    const statements = sourceFile.statements
    
    return statements.some(stmt => {
      if (ts.isVariableStatement(stmt)) {
        return stmt.declarationList.declarations.some(decl => 
          ts.isIdentifier(decl.name) && decl.name.text === method
        )
      }
      
      if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === method) {
        return true
      }
      
      return false
    })
  }
  
  private hasRateLimit(sourceFile: ts.SourceFile, method: string): boolean {
    const sourceText = sourceFile.getFullText()
    
    // Check if using createRouteHandler (which includes rate limiting)
    if (sourceText.includes('createRouteHandler')) {
      return true
    }
    
    // Check for manual rate limiting
    if (sourceText.includes('ratelimit') || sourceText.includes('rate_limit')) {
      return true
    }
    
    return false
  }
  
  private async addRateLimit(filePath: string, method: string) {
    const sourceFile = await readFile(filePath, 'utf-8')
    
    // Convert to createRouteHandler pattern
    const updatedSource = sourceFile.replace(
      new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\s*\\(([^)]*)\\)\\s*\\{`),
      `export const ${method} = createRouteHandler(
  async ({ body, query, user }) => {`
    ).replace(
      /}\s*$/,
      `  },
  {
    rateLimit: { requests: ${this.getDefaultRateLimit(method)}, window: '1h' }
  }
)`
    )
    
    // Add import if not present
    if (!updatedSource.includes('createRouteHandler')) {
      const importLine = "import { createRouteHandler } from '@/lib/api/route-handler'\n"
      const finalSource = importLine + updatedSource
      await writeFile(filePath, finalSource)
    } else {
      await writeFile(filePath, updatedSource)
    }
    
    console.log(`✅ Added rate limiting to ${method} in ${filePath}`)
  }
  
  private getDefaultRateLimit(method: string): number {
    const limits = {
      GET: 1000,
      POST: 100,
      PUT: 100,
      PATCH: 100,
      DELETE: 50
    }
    return limits[method as keyof typeof limits] || 100
  }
}
```

### Phase 3: Performance Guards Implementation

#### 3.1 N+1 Query Detector
```typescript
// lib/dev/guards/n-plus-one-queries.ts
export class NPlusOneQueryGuard extends BaseGuard {
  async check(ast: AST, filePath: string): Promise<Violation[]> {
    const violations: Violation[] = []
    
    // Find for loops that contain database queries
    const forLoops = findNodes<ts.ForStatement | ts.ForOfStatement>(
      ast.sourceFile, 
      ts.SyntaxKind.ForOfStatement
    )
    
    for (const loop of forLoops) {
      const hasQuery = this.containsDatabaseQuery(loop)
      
      if (hasQuery) {
        violations.push({
          type: 'performance',
          severity: 'warning',
          message: 'Potential N+1 query pattern detected in loop',
          file: filePath,
          line: ast.sourceFile.getLineAndCharacterOfPosition(loop.getStart()).line + 1,
          quickFix: () => this.convertToBatchQuery(loop, filePath)
        })
      }
    }
    
    return violations
  }
  
  private containsDatabaseQuery(node: ts.Node): boolean {
    let hasQuery = false
    
    function visit(child: ts.Node) {
      if (ts.isCallExpression(child)) {
        const text = child.getText()
        if (text.includes('supabase') && 
            (text.includes('.select') || text.includes('.from'))) {
          hasQuery = true
        }
      }
      ts.forEachChild(child, visit)
    }
    
    visit(node)
    return hasQuery
  }
}
```

### Phase 4: Real-Time Browser Integration

#### 4.1 WebSocket Communication
```typescript
// lib/dev/websocket-server.ts
import { WebSocketServer } from 'ws'

export class DevGuardWebSocketServer {
  private wss: WebSocketServer
  private clients: Set<WebSocket> = new Set()
  
  start(port: number = 3001) {
    this.wss = new WebSocketServer({ port })
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      console.log('🔗 Development toolbar connected')
      
      ws.on('close', () => {
        this.clients.delete(ws)
      })
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        this.handleMessage(message, ws)
      })
    })
    
    console.log(`🛡️  Dev Guards WebSocket server running on port ${port}`)
  }
  
  broadcast(data: any) {
    const message = JSON.stringify(data)
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }
  
  private handleMessage(message: any, ws: WebSocket) {
    switch (message.type) {
      case 'apply-fix':
        this.applyQuickFix(message.fixId)
        break
      case 'dismiss-violation':
        this.dismissViolation(message.violationId)
        break
    }
  }
}
```

#### 4.2 Browser Development Toolbar
```tsx
// components/dev/development-toolbar.tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, X, Settings, Zap } from 'lucide-react'

interface Violation {
  id: string
  type: 'security' | 'performance' | 'quality'
  severity: 'error' | 'warning' | 'info'
  message: string
  file: string
  line: number
  quickFix?: string
}

export function DevelopmentToolbar() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [stats, setStats] = useState({
    bundleSize: 0,
    queryCount: 0,
    renderTime: 0
  })

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    // Connect to development WebSocket
    const ws = new WebSocket('ws://localhost:3001')
    
    ws.onopen = () => {
      setIsConnected(true)
      console.log('🔗 Connected to development guards')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'violations':
          setViolations(data.violations)
          break
        case 'stats':
          setStats(data.stats)
          break
      }
    }
    
    ws.onclose = () => {
      setIsConnected(false)
    }
    
    return () => ws.close()
  }, [])

  if (process.env.NODE_ENV !== 'development') return null

  const errorCount = violations.filter(v => v.severity === 'error').length
  const warningCount = violations.filter(v => v.severity === 'warning').length

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-full shadow-lg font-medium text-sm
            ${errorCount > 0 ? 'bg-red-600 text-white' : 
              warningCount > 0 ? 'bg-yellow-600 text-white' : 
              'bg-green-600 text-white'}
          `}
        >
          {errorCount > 0 && <X className="w-4 h-4" />}
          {errorCount === 0 && warningCount > 0 && <AlertTriangle className="w-4 h-4" />}
          {errorCount === 0 && warningCount === 0 && <Check className="w-4 h-4" />}
          
          {errorCount + warningCount}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white shadow-2xl z-50 border-t border-gray-700">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="font-semibold">Dev Guards</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <X className="w-3 h-3 text-red-400" />
              {errorCount} errors
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400" />
              {warningCount} warnings
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400">
            Bundle: {(stats.bundleSize / 1024).toFixed(1)}KB | 
            Queries: {stats.queryCount} | 
            Render: {stats.renderTime}ms
          </div>
          
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {violations.length > 0 && (
        <div className="max-h-64 overflow-y-auto">
          {violations.map((violation) => (
            <div
              key={violation.id}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-700 hover:bg-gray-800"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {violation.severity === 'error' && <X className="w-4 h-4 text-red-400" />}
                  {violation.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  {violation.severity === 'info' && <AlertTriangle className="w-4 h-4 text-blue-400" />}
                  
                  <span className="font-medium">{violation.message}</span>
                  
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${violation.type === 'security' ? 'bg-red-800 text-red-200' :
                      violation.type === 'performance' ? 'bg-yellow-800 text-yellow-200' :
                      'bg-blue-800 text-blue-200'}
                  `}>
                    {violation.type}
                  </span>
                </div>
                
                <div className="text-sm text-gray-400">
                  {violation.file}:{violation.line}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {violation.quickFix && (
                  <button
                    onClick={() => applyQuickFix(violation.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    <Zap className="w-3 h-3" />
                    Fix
                  </button>
                )}
                
                <button
                  onClick={() => openInVSCode(violation.file, violation.line)}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function applyQuickFix(violationId: string) {
  // Send fix command to WebSocket server
  const ws = new WebSocket('ws://localhost:3001')
  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'apply-fix',
      fixId: violationId
    }))
    ws.close()
  }
}

function openInVSCode(file: string, line: number) {
  // Open file in VS Code at specific line
  window.open(`vscode://file${file}:${line}`)
}
```

### Phase 5: Pre-Commit Quality Gates

#### 5.1 Enhanced Pre-Commit Setup
```typescript
// scripts/setup-hooks.ts
import { execSync } from 'child_process'
import { writeFileSync, chmodSync } from 'fs'
import path from 'path'

export function setupDevGuardHooks() {
  console.log('🔧 Setting up enhanced pre-commit hooks...')
  
  // Ensure husky is installed
  execSync('npx husky install', { stdio: 'inherit' })
  
  // Create comprehensive pre-commit hook
  const preCommitContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🛡️  Running development guard checks..."

# 1. TypeScript strict compilation
echo "📝 Checking TypeScript..."
npm run type-check || exit 1

# 2. Security pattern verification
echo "🔒 Verifying security patterns..."
node scripts/check-security-patterns.js || exit 1

# 3. Performance checks
echo "⚡ Checking performance..."
node scripts/check-performance.js || exit 1

# 4. Test coverage verification
echo "🧪 Verifying test coverage..."
npm run test:coverage -- --passWithNoTests --silent || exit 1

# 5. Bundle size limits
echo "📦 Checking bundle size..."
node scripts/check-bundle-size.js || exit 1

# 6. Code quality checks
echo "✨ Running quality checks..."
npm run lint || exit 1

echo "✅ All pre-commit checks passed!"
`

  const hookPath = path.join('.husky', 'pre-commit')
  writeFileSync(hookPath, preCommitContent)
  chmodSync(hookPath, '755')
  
  // Create lint-staged configuration for incremental checking
  const lintStagedConfig = {
    '*.{ts,tsx,js,jsx}': [
      'node scripts/check-file-guards.js',
      'eslint --fix',
      'git add'
    ],
    '*.{ts,tsx}': [
      'tsc --noEmit --skipLibCheck'
    ]
  }
  
  writeFileSync('.lintstagedrc.json', JSON.stringify(lintStagedConfig, null, 2))
  
  console.log('✅ Pre-commit hooks configured successfully!')
}
```

#### 5.2 Security Pattern Checker
```typescript
// scripts/check-security-patterns.js
import { glob } from 'glob'
import { readFileSync } from 'fs'

const SECURITY_PATTERNS = [
  {
    name: 'Missing Organization Filter',
    pattern: /supabase\.from\([^)]+\)\.select\([^)]*\)/g,
    antiPattern: /\.eq\s*\(\s*['"]organization_id['"].*?\)/,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'error'
  },
  {
    name: 'Missing Rate Limiting',
    pattern: /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g,
    antiPattern: /(createRouteHandler|rateLimit)/,
    files: ['app/api/**/route.ts'],
    severity: 'error'
  },
  {
    name: 'Direct Database Access',
    pattern: /\.from\s*\(\s*['"][^'"]+['"]\s*\)/g,
    antiPattern: /(BaseRepository|Repository)/,
    files: ['app/**/*.ts', 'components/**/*.ts'],
    severity: 'warning'
  }
]

async function checkSecurityPatterns() {
  console.log('🔍 Checking security patterns...')
  let hasErrors = false
  
  for (const check of SECURITY_PATTERNS) {
    const files = await glob(check.files)
    
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const matches = content.match(check.pattern)
      
      if (matches) {
        const hasAntiPattern = check.antiPattern.test(content)
        
        if (!hasAntiPattern) {
          console.error(`❌ ${check.name} in ${file}`)
          
          if (check.severity === 'error') {
            hasErrors = true
          }
        }
      }
    }
  }
  
  if (hasErrors) {
    console.error('\n💡 Run "npm run dev:guards" for automatic fixes')
    process.exit(1)
  }
  
  console.log('✅ Security patterns check passed')
}

checkSecurityPatterns().catch(console.error)
```

## Validation

### Real-Time Development Testing
```bash
# Test the guard system
npm run dev:guards          # Start development guards
npm run test:guards         # Unit tests for guard logic
npm run test:guards:e2e     # End-to-end guard testing

# Simulate violations
echo "const products = await supabase.from('products').select('*')" > test-file.ts
# Should trigger organization isolation violation within 1 second

# Test auto-fixes
npm run guards:fix-all      # Apply all available quick fixes
```

### Performance Benchmarks
- Guard analysis: <100ms per file change
- WebSocket communication: <10ms latency
- Browser toolbar: <5% performance impact
- Pre-commit hooks: <30 seconds total time

### Coverage Requirements
- 95% of security patterns detected
- 90% of performance issues caught
- 85% of quality violations identified
- 80% of violations have quick fixes

## Success Criteria

- [ ] Real-time file watching system operational
- [ ] All security guards implemented and tested
- [ ] Performance guards catching common issues
- [ ] Quality guards enforcing standards
- [ ] Browser toolbar displaying violations with fixes
- [ ] Pre-commit hooks blocking bad code
- [ ] Auto-fix functionality working for common patterns
- [ ] WebSocket communication stable
- [ ] VS Code integration functional
- [ ] Performance impact minimal (<5% dev server overhead)
- [ ] Developer satisfaction >4.5/5 in feedback
- [ ] 95% reduction in security violations reaching production

## Dependencies

- **PRP-018A**: ✅ Completed - Base infrastructure required
- **PRP-018B**: 📄 Documented - Generator CLI for templates
- **PRP-018C**: 📄 Documented - Concrete service implementations

### NPM Dependencies
```json
{
  "devDependencies": {
    "chokidar": "^3.5.3",
    "ws": "^8.16.0",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0",
    "@typescript-eslint/typescript-estree": "^6.19.0"
  }
}
```

## Implementation Order

1. **File Watcher & AST Infrastructure** (2 days)
   - Basic file watching system
   - TypeScript AST analysis
   - Violation detection framework

2. **Security Guards** (3 days)
   - Organization isolation guard
   - Rate limiting guard
   - Authentication guard
   - CSRF protection guard

3. **Performance Guards** (2 days)
   - N+1 query detector
   - Bundle size monitor
   - Memory leak detector

4. **Quality Guards** (1 day)
   - TypeScript strict mode enforcer
   - Error handling detector
   - Test coverage guard

5. **Browser Integration** (2 days)
   - WebSocket communication
   - Development toolbar UI
   - Quick fix functionality
   - VS Code integration

6. **Pre-Commit Enhancement** (1 day)
   - Enhanced git hooks
   - Security pattern verification
   - Performance checks
   - Quality gates

Total: ~11 days for complete implementation

## Risk Mitigation

- **Performance Impact**: Guards only run in development mode
- **False Positives**: Configurable severity levels and suppression
- **Developer Friction**: Quick fixes and clear documentation
- **Tool Reliability**: Comprehensive testing and fallback mechanisms

## Future Enhancements

1. **AI-Powered Suggestions**: Smart fix recommendations
2. **Team Analytics**: Development pattern insights
3. **Custom Rules**: Organization-specific guard rules
4. **IDE Extensions**: Native VS Code and WebStorm plugins
5. **CI Integration**: Pre-merge validation pipeline

---

*This PRP enables developers to catch and fix issues in real-time, dramatically improving code quality and reducing security vulnerabilities before they reach production.*