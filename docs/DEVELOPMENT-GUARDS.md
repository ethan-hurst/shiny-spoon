# Development Guards System

Real-time development monitoring and quality enforcement for Next.js applications. Catches security, performance, and quality issues during development with immediate visual feedback and automated fixes.

## Quick Start

### 1. Setup Enhanced Pre-commit Hooks

```bash
npm run setup:hooks
```

This installs comprehensive quality gates that block problematic code from being committed.

### 2. Quick Analysis

Analyze your codebase for violations:

```bash
# Analyze all files
npm run dev:guards:quick analyze

# Analyze specific file
npm run dev:guards:quick analyze app/api/products/route.ts
```

### 3. Real-time Monitoring (Coming Soon)

```bash
# Start real-time development guards
npm run dev:guards start

# Start with verbose logging
npm run dev:guards start --verbose

# Disable specific guards
npm run dev:guards start --no-org-isolation --no-rate-limiting
```

## Features

### 🔒 Security Guards

#### Organization Isolation Guard
- **Detects**: Missing `organization_id` filters in database queries
- **Prevents**: Data leakage between organizations
- **Auto-fix**: Adds `.eq('organization_id', organizationId)` to queries

```typescript
// ❌ VIOLATION DETECTED
const products = await supabase
  .from('products')
  .select('*') // Missing organization filter

// ✅ AUTO-FIXED
const products = await supabase
  .from('products')
  .select('*')
  .eq('organization_id', organizationId)
```

#### Rate Limiting Guard
- **Detects**: API routes without rate limiting
- **Prevents**: DoS attacks and API abuse
- **Auto-fix**: Converts to `createRouteHandler` with rate limits

```typescript
// ❌ VIOLATION DETECTED
export async function POST(request: NextRequest) {
  // No rate limiting
}

// ✅ AUTO-FIXED
export const POST = createRouteHandler(
  async ({ body }) => {
    // Handler logic
  },
  { rateLimit: { requests: 100, window: '1h' } }
)
```

### ⚡ Performance Guards

#### N+1 Query Detector
- **Detects**: Database queries inside loops
- **Prevents**: Performance degradation
- **Suggests**: Batch queries with `.in()` operations

```typescript
// ❌ VIOLATION DETECTED
for (const product of products) {
  const price = await supabase
    .from('pricing')
    .select('*')
    .eq('product_id', product.id) // N+1 query pattern
}

// ✅ SUGGESTED FIX
const productIds = products.map(p => p.id)
const prices = await supabase
  .from('pricing')
  .select('*')
  .in('product_id', productIds) // Single batch query
```

### ✨ Quality Guards

#### TypeScript Strict Mode Enforcer
- Prevents use of `any` types
- Ensures proper error handling
- Validates function return types

#### Missing Error Handling Detector
- Detects unhandled async operations
- Suggests try/catch or .catch() patterns

## Configuration

### Environment Variables

```bash
# Enable/disable development guards
DEV_GUARDS=true

# WebSocket port for browser communication
DEV_GUARDS_PORT=3001

# Enable verbose logging
DEV_GUARDS_VERBOSE=true

# Disable specific guards
DEV_GUARDS_ORG_ISOLATION=false
DEV_GUARDS_RATE_LIMITING=false
DEV_GUARDS_N_PLUS_ONE=false
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev:guards": "node scripts/dev-guards.js",
    "dev:guards:quick": "node scripts/dev-guards-quick.js",
    "setup:hooks": "node scripts/setup-enhanced-hooks.js"
  }
}
```

## Browser Integration

### Development Toolbar

Add the development toolbar to your app layout:

```tsx
import { DevGuardsProvider } from '@/lib/dev'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <DevGuardsProvider>
          {children}
        </DevGuardsProvider>
      </body>
    </html>
  )
}
```

The toolbar provides:
- Real-time violation notifications
- Quick fix buttons
- One-click VS Code integration
- Performance metrics display
- Violation history and statistics

## Pre-commit Quality Gates

The enhanced pre-commit hooks run automatically on every commit:

1. **TypeScript Compilation** - Strict mode validation
2. **Security Patterns** - Organization isolation, rate limiting
3. **Performance Checks** - N+1 queries, large imports
4. **Code Quality** - ESLint rules, formatting
5. **Test Coverage** - Minimum 80% threshold

### Bypassing Hooks (Not Recommended)

```bash
# Emergency bypass (use sparingly)
git commit --no-verify -m "Emergency fix"
```

## Analysis Results

Recent analysis of the codebase found:

- **📊 479 files analyzed**
- **🚨 7 violations found**
- **❌ 5 security issues** (API routes missing rate limiting)
- **⚠️ 2 performance issues** (potential N+1 queries)

### Identified Issues

1. **Missing Rate Limiting** (Security - Error)
   - `app/api/rss/route.ts`
   - `app/api/playground/route.ts`
   - `app/api/health/route.ts`
   - `app/api/feedback/route.ts`
   - `app/api/contact/route.ts`

2. **Potential N+1 Queries** (Performance - Warning)
   - `app/actions/pricing.ts`
   - `lib/bulk/bulk-operations-engine.ts`

## Fixing Violations

### 1. Use createRouteHandler for API Routes

Replace manual function exports with the secure route handler:

```typescript
// Before
export async function GET(request: NextRequest) {
  // Logic here
  return NextResponse.json(data)
}

// After
export const GET = createRouteHandler(
  async ({ request, query, user }) => {
    // Logic here with automatic auth, rate limiting, validation
    return NextResponse.json(data)
  },
  {
    auth: true, // Automatic authentication
    rateLimit: { requests: 1000, window: '1h' },
    schema: {
      query: z.object({
        id: z.string()
      })
    }
  }
)
```

### 2. Add Organization Filters

Ensure all database queries include organization isolation:

```typescript
// Before
const products = await supabase
  .from('products')
  .select('*')

// After
const products = await supabase
  .from('products')
  .select('*')
  .eq('organization_id', user.organizationId)
```

### 3. Optimize Database Queries

Replace loops with batch operations:

```typescript
// Before - N+1 Query
const productPrices = []
for (const product of products) {
  const price = await getProductPrice(product.id)
  productPrices.push(price)
}

// After - Batch Query
const productIds = products.map(p => p.id)
const prices = await getProductPrices(productIds)
const priceMap = new Map(prices.map(p => [p.productId, p]))
const productPrices = products.map(p => priceMap.get(p.id))
```

## Architecture

### File Watcher Service
- Uses `chokidar` for efficient file monitoring
- Debounces changes to avoid excessive processing
- Supports incremental analysis

### AST Analysis Engine
- TypeScript Compiler API for deep code analysis
- Pattern matching for security violations
- Context-aware violation detection

### WebSocket Communication
- Real-time browser ↔ development server communication
- Instant violation notifications
- Quick fix command execution

### Guard System
- Pluggable architecture for custom guards
- Severity levels (error, warning, info)
- Auto-fix capabilities where possible

## Development

### Adding Custom Guards

1. Extend the `BaseGuard` class:

```typescript
import { BaseGuard } from '@/lib/dev/base-guard'
import { AST, Violation } from '@/lib/dev/ast-analyzer'

export class CustomGuard extends BaseGuard {
  constructor() {
    super('CustomGuard')
  }

  async check(ast: AST, filePath: string): Promise<Violation[]> {
    const violations: Violation[] = []
    
    // Custom analysis logic here
    
    return violations
  }
}
```

2. Register the guard:

```typescript
import { getDevGuards } from '@/lib/dev'
import { CustomGuard } from './custom-guard'

const devGuards = getDevGuards()
devGuards.addGuard(new CustomGuard())
```

### Testing Guards

```bash
# Test specific guard
npm run dev:guards analyze path/to/file.ts

# Test all guards
npm run dev:guards analyze

# Verbose output
npm run dev:guards analyze --verbose
```

## Troubleshooting

### WebSocket Connection Issues

1. Check if port 3001 is available
2. Verify firewall settings
3. Ensure development server is running

### Performance Impact

The development guards are designed to have minimal impact:
- File watching with debouncing
- Incremental AST analysis
- Only runs in development mode
- WebSocket communication is async

### False Positives

If a guard reports false positives:
1. Check the guard configuration
2. Add file/pattern exclusions
3. Disable specific guards if needed
4. Report issues for improvement

## Contributing

To contribute to the development guards system:

1. Add new guards in `lib/dev/guards/`
2. Update the configuration in `lib/dev/index.ts`
3. Add tests for new functionality
4. Update this documentation

## License

Part of the shiny-spoon project. See main project license.