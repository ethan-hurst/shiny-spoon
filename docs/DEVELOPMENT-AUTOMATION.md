# Development Automation Infrastructure

This document describes the automation infrastructure implemented in PRP-018A to enforce development best practices and quality standards.

## Overview

The development automation infrastructure provides:
- **Base Classes**: Enforce patterns automatically
- **Code Generators**: Scaffold components correctly from the start
- **Route Handler Wrapper**: Secure API routes by default
- **Development Guards**: Real-time validation
- **Pre-commit Hooks**: Block bad code before commit

## Quick Start

### Generate New Components

```bash
# Generate a new API route
npm run generate:api product

# Generate a new service
npm run generate:service inventory

# Generate a new repository
npm run generate:repository warehouse

# Check prerequisites
npm run generate:check

# Interactive mode
npm run generate
```

## Base Classes

### BaseRepository

All repositories extend `BaseRepository` which provides:
- Automatic organization isolation
- Soft delete functionality
- Audit fields (created_by, updated_by, etc.)
- Error handling
- Type safety

```typescript
import { BaseRepository } from '@/lib/base/base-repository'
import { createClient } from '@/lib/supabase/server'

interface Product {
  id: string
  name: string
  sku: string
  organization_id: string
  // ... other fields
}

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    const supabase = createClient()
    super(supabase, {
      tableName: 'products',
      softDelete: true
    })
  }

  protected getOrganizationId(): string | null {
    // Get from auth context
    return 'org-id'
  }

  protected getCurrentUserId(): string | null {
    // Get from auth context
    return 'user-id'
  }
}
```

### BaseService

All services extend `BaseService` which provides:
- Retry logic with exponential backoff
- Circuit breaker pattern
- Timeout handling
- Batch operations
- Parallel execution with concurrency control
- Monitoring and metrics

```typescript
import { BaseService } from '@/lib/base/base-service'
import { z } from 'zod'

const ProductSchema = z.object({
  name: z.string(),
  sku: z.string(),
  price: z.number()
})

export class ProductService extends BaseService {
  constructor() {
    super({
      serviceName: 'ProductService',
      maxRetries: 3,
      circuitBreakerEnabled: true
    })
  }

  async createProduct(data: unknown) {
    // Validation is automatic
    const validated = this.validateInput<z.infer<typeof ProductSchema>>(data)
    
    // Execute with retry and circuit breaker
    return this.execute(async () => {
      // Your business logic here
      const repository = new ProductRepository()
      return repository.create(validated)
    })
  }

  protected validateInput<T>(data: unknown): T {
    return ProductSchema.parse(data) as T
  }
}
```

## API Route Handler

The `createRouteHandler` wrapper provides:
- Authentication (automatic)
- Rate limiting
- Input validation (body, query, params)
- Error handling
- Request ID tracking
- Performance monitoring

```typescript
import { createRouteHandlers } from '@/lib/api/route-handler'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string(),
  price: z.number()
})

export const { GET, POST } = createRouteHandlers({
  GET: async ({ query, user }) => {
    // user is automatically populated
    // query is validated
    const products = await productService.list({
      organizationId: user!.organizationId
    })
    return NextResponse.json({ data: products })
  },

  POST: async ({ body, user }) => {
    // body is validated against schema
    const product = await productService.create({
      ...body,
      organizationId: user!.organizationId
    })
    return NextResponse.json({ data: product }, { status: 201 })
  }
}, {
  auth: true,           // Require authentication (default)
  rateLimit: {         // Optional rate limiting
    requests: 10,
    window: '1m'
  },
  schema: {
    body: createSchema,
    query: querySchema
  }
})
```

## Code Generators

### API Generator

Creates secure API routes with all best practices:

```bash
npm run generate:api product -- --methods GET,POST,PUT --rate-limit
```

Features:
- Authentication by default
- Input validation schemas
- Rate limiting (optional)
- Error handling
- TypeScript types

### Service Generator (Coming Soon)

Creates services with retry logic and monitoring:

```bash
npm run generate:service inventory -- --with-repository
```

### Repository Generator (Coming Soon)

Creates repositories with organization isolation:

```bash
npm run generate:repository warehouse -- --table warehouses
```

## Development Guards (Coming Soon)

Real-time checks during development:
- Missing authentication on API routes
- Unhandled promises
- Missing error boundaries
- SQL injection risks
- Missing input validation

## Pre-commit Hooks (Coming Soon)

Automated checks before commit:
- TypeScript errors
- ESLint violations
- Missing tests for new code
- Security vulnerabilities
- Large file detection

## Best Practices Enforced

1. **Security**
   - All API routes require authentication by default
   - Organization isolation is automatic
   - Input validation is mandatory
   - Rate limiting is easy to add

2. **Reliability**
   - Retry logic for transient failures
   - Circuit breakers prevent cascading failures
   - Timeouts prevent hanging requests
   - Error handling is consistent

3. **Monitoring**
   - Request IDs for tracing
   - Performance metrics automatic
   - Error tracking built-in
   - Health checks standardized

4. **Development Speed**
   - Generate boilerplate in seconds
   - Consistent patterns across codebase
   - Type safety everywhere
   - Less decision fatigue

## Migration Guide

### Migrating Existing API Routes

Before:
```typescript
export async function POST(request: Request) {
  const body = await request.json()
  // Manual auth check
  // Manual validation
  // Manual error handling
}
```

After:
```typescript
export const POST = createRouteHandler(async ({ body, user }) => {
  // Everything is handled!
  const result = await service.create(body)
  return NextResponse.json({ data: result })
}, {
  schema: { body: createSchema }
})
```

### Migrating Existing Services

Before:
```typescript
class ProductService {
  async create(data: any) {
    // Manual validation
    // Manual retry logic
    // Manual error handling
  }
}
```

After:
```typescript
class ProductService extends BaseService {
  async create(data: unknown) {
    const validated = this.validateInput(data)
    return this.execute(() => {
      // Just business logic!
    })
  }
}
```

## Troubleshooting

### Generator Issues

If generators fail:
1. Run `npm run generate:check` to verify setup
2. Ensure you're in the project root
3. Check that base classes exist

### TypeScript Errors

The base classes use generic types. If you see errors:
1. Override methods with proper types
2. Use type assertions where needed
3. Check the examples above

### Performance

If experiencing slow requests:
1. Check circuit breaker status
2. Review retry configuration
3. Monitor timeout settings

## Future Enhancements

- [ ] Complete all generators
- [ ] Add development guards
- [ ] Implement pre-commit hooks
- [ ] Create dev toolbar
- [ ] Add more templates
- [ ] Performance profiling
- [ ] Advanced monitoring integration