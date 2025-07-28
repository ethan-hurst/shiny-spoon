# PRP-018B: Refactor All API Routes to Use createRouteHandler

## 🚀 Quick Start

```bash
# This PRP refactors all 37 existing API routes to use the createRouteHandler wrapper
# Automatic benefits for each route:
✅ Rate limiting (configurable per route)
✅ CSRF protection for mutations
✅ Authentication & organization checks
✅ Input validation with Zod schemas
✅ Consistent error handling
✅ Request monitoring & metrics
✅ TypeScript type safety
```

## Goal

Refactor all 37 existing API routes in the codebase to use the `createRouteHandler` wrapper, ensuring consistent security, rate limiting, validation, and monitoring across all endpoints.

## Why This Matters

- **Security**: Currently, many routes lack rate limiting and some are missing CSRF protection
- **Consistency**: Each route implements auth/validation differently, leading to bugs
- **Monitoring**: No unified request tracking or metrics collection
- **Developer Experience**: Reduces boilerplate and prevents security oversights
- **Type Safety**: Automatic validation with Zod schemas ensures type safety

Currently, 0 out of 37 API routes use the new wrapper, leaving significant security and consistency gaps.

## What We're Building

### Routes to Refactor (37 total)

#### Health & Monitoring (4)
- `/api/health/route.ts`
- `/api/monitoring/status/route.ts`
- `/api/monitoring/alerts/route.ts`
- `/api/monitoring/alerts/[id]/acknowledge/route.ts`

#### Authentication & Billing (7)
- `/api/auth/callback/route.ts`
- `/api/billing/usage/route.ts`
- `/api/billing/subscription/route.ts`
- `/api/billing/invoices/route.ts`
- `/api/payments/create-checkout-session/route.ts`
- `/api/payments/webhook/route.ts`
- `/api/webhooks/stripe/route.ts`

#### Bulk Operations (4)
- `/api/bulk/upload/route.ts` ✓ (already has CSRF)
- `/api/bulk/cancel/route.ts`
- `/api/bulk/rollback/route.ts`
- `/api/bulk/progress/[operationId]/route.ts`

#### Integrations (7)
- `/api/integrations/[id]/route.ts`
- `/api/integrations/[id]/sync/route.ts`
- `/api/integrations/netsuite/auth/route.ts`
- `/api/integrations/netsuite/health/route.ts`
- `/api/integrations/netsuite/test/route.ts`
- `/api/webhooks/shopify/route.ts`
- `/api/webhooks/netsuite/route.ts`

#### Portal & Public (7)
- `/api/portal/validate-key/route.ts`
- `/api/portal/organization/route.ts`
- `/api/portal/export/route.ts`
- `/api/portal/team/stats/route.ts`
- `/api/contact/route.ts`
- `/api/feedback/route.ts`
- `/api/rss/route.ts`

#### Cron Jobs (3)
- `/api/cron/cleanup/route.ts`
- `/api/cron/health-check/route.ts`
- `/api/cron/accuracy/route.ts`
- `/api/cron/sync/[frequency]/route.ts`

#### Other (2)
- `/api/playground/route.ts`
- `/api/webhooks/[platform]/route.ts`
- `/api/monitoring/accuracy/check/route.ts`

## Context & References

### Existing Infrastructure
- **createRouteHandler**: `/lib/api/route-handler.ts:44-371` - Already implemented wrapper
- **Rate Limiter**: `/lib/utils/ratelimit.ts` - Upstash Redis rate limiter
- **CSRF Validation**: `/lib/utils/csrf.ts` - Token validation utility
- **Auth Pattern**: `/app/api/bulk/upload/route.ts:46-78` - Good example of current auth

### Documentation
- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Zod Validation: https://zod.dev/
- Rate Limiting Best Practices: https://github.com/upstash/ratelimit

## Implementation Blueprint

### Phase 1: Public & Health Routes (Low Risk)

#### 1.1 Health Check Route
```typescript
// app/api/health/route.ts
import { createPublicRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

const querySchema = z.object({
  detailed: z.enum(['true', 'false']).optional()
})

export const GET = createPublicRouteHandler(
  async ({ query }) => {
    const detailed = query?.detailed === 'true'
    
    // Existing health check logic...
    const health = await checkSystemHealth()
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ...(detailed && { details: health })
    })
  },
  {
    schema: { query: querySchema },
    rateLimit: { requests: 100, window: '1m' }
  }
)
```

#### 1.2 Contact Form Route
```typescript
// app/api/contact/route.ts
import { createPublicRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(1000),
  company: z.string().optional()
})

export const POST = createPublicRouteHandler(
  async ({ body }) => {
    // Send email logic
    await sendContactEmail(body)
    
    return NextResponse.json({ 
      success: true,
      message: 'Thank you for contacting us' 
    })
  },
  {
    schema: { body: contactSchema },
    rateLimit: { 
      requests: 5, 
      window: '1h',
      identifier: (req) => req.headers.get('x-forwarded-for') || 'anonymous'
    }
  }
)
```

### Phase 2: Authenticated Routes

#### 2.1 Monitoring Alerts
```typescript
// app/api/monitoring/alerts/route.ts
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

const querySchema = z.object({
  status: z.enum(['all', 'active', 'acknowledged', 'resolved']).default('active'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  integrationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
})

export const GET = createRouteHandler(
  async ({ user, query }) => {
    const supabase = createServerClient()
    
    // Build query with org isolation (automatic from context)
    let alertQuery = supabase
      .from('alerts')
      .select('*, alert_rules(*), integrations(*)')
      .eq('organization_id', user.organizationId)
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1)
    
    // Apply filters...
    if (query.status !== 'all') {
      alertQuery = alertQuery.eq('status', query.status)
    }
    
    const { data: alerts, error } = await alertQuery
    if (error) throw error
    
    return NextResponse.json({ 
      status: 'success',
      data: { alerts }
    })
  },
  {
    schema: { query: querySchema },
    rateLimit: { requests: 100, window: '1m' }
  }
)
```

#### 2.2 Integration Sync
```typescript
// app/api/integrations/[id]/sync/route.ts
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

const bodySchema = z.object({
  entityType: z.enum(['products', 'inventory', 'orders', 'customers', 'pricing']).optional()
})

const paramsSchema = z.object({
  id: z.string().uuid()
})

export const POST = createRouteHandler(
  async ({ params, body, user }) => {
    // Verify user has access to this integration
    const hasAccess = await verifyIntegrationAccess(params.id, user.organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Trigger sync
    const result = await triggerSync(params.id, body?.entityType)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: true,
      jobId: result.jobId,
      message: 'Sync job created successfully'
    })
  },
  {
    schema: { 
      body: bodySchema,
      params: paramsSchema 
    },
    rateLimit: { 
      requests: 10, 
      window: '5m',
      identifier: (req) => `sync:${req.params.id}`
    }
  }
)
```

### Phase 3: Webhook Routes (Special Handling)

```typescript
// app/api/webhooks/shopify/route.ts
import { createPublicRouteHandler } from '@/lib/api/route-handler'
import crypto from 'crypto'

// Webhooks need raw body, not parsed JSON
export const POST = createPublicRouteHandler(
  async ({ request }) => {
    const body = await request.text()
    const signature = request.headers.get('x-shopify-hmac-sha256')
    
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
      .update(body, 'utf8')
      .digest('base64')
    
    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const data = JSON.parse(body)
    await processShopifyWebhook(data)
    
    return NextResponse.json({ received: true })
  },
  {
    // No body parsing for webhooks
    rateLimit: { requests: 100, window: '1m' }
  }
)
```

### Phase 4: Bulk Operations (Complex)

```typescript
// app/api/bulk/upload/route.ts
import { createRouteHandler } from '@/lib/api/route-handler'
import { z } from 'zod'

// Note: File uploads need special handling
export const POST = createRouteHandler(
  async ({ request, user }) => {
    // Parse multipart form data
    const formData = await request.formData()
    
    // Manual validation for file upload
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 })
    }
    
    // Validate file
    const validation = validateCSVFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    
    // Process upload...
    const engine = new BulkOperationsEngine()
    const operationId = await engine.startOperation(file, config, user.id)
    
    return NextResponse.json({ 
      success: true,
      operationId 
    })
  },
  {
    // No body schema for multipart
    rateLimit: { 
      requests: 5, 
      window: '1h',
      identifier: (req) => req.user?.id || 'anonymous'
    }
  }
)
```

### Migration Strategy

1. **Test First**: Create tests for each route before refactoring
2. **Gradual Rollout**: Use feature flags to switch between old and new
3. **Monitor**: Track errors and performance during migration
4. **Rollback Plan**: Keep old code commented until stable

### Rate Limiting Guidelines

```typescript
// Rate limit recommendations by route type:
const rateLimits = {
  // Public routes
  health: { requests: 100, window: '1m' },
  contact: { requests: 5, window: '1h' },
  
  // Auth required
  read: { requests: 100, window: '1m' },
  write: { requests: 50, window: '1m' },
  bulk: { requests: 10, window: '1h' },
  
  // Webhooks
  webhook: { requests: 100, window: '1m' },
  
  // Admin
  admin: { requests: 20, window: '1m' }
}
```

## Validation

### Automated Testing
```bash
# Test all routes after refactoring
npm run test:api

# Verify rate limiting
npm run test:rate-limits

# Check auth flows
npm run test:auth
```

### Manual Verification
- [ ] All routes return proper error codes
- [ ] Rate limiting headers present
- [ ] CSRF protection on mutations
- [ ] Auth working correctly
- [ ] Monitoring logs requests

## Success Criteria

- [ ] All 37 routes use createRouteHandler or variant
- [ ] 100% routes have rate limiting
- [ ] All mutations have CSRF protection
- [ ] All authenticated routes verify org access
- [ ] Request monitoring enabled
- [ ] TypeScript compilation passes
- [ ] All existing tests still pass
- [ ] No breaking changes to API contracts

## Dependencies

- PRP-018A must be completed (base infrastructure)
- Existing createRouteHandler implementation
- Rate limiter (Upstash) configuration

## Implementation Order

1. **Public routes** (7 routes) - Low risk, good practice
2. **Read-only authenticated** (10 routes) - Medium risk
3. **Mutations** (15 routes) - Higher risk, need careful testing  
4. **Webhooks** (5 routes) - Special handling required

Total effort: ~3-4 days for safe migration of all routes