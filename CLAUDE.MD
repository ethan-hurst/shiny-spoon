# TruthSource AI Assistant Context (Next.js + Supabase)

## 🎯 Project Overview

You are working on **TruthSource**, a B2B e-commerce data accuracy platform built with **Next.js 14+** and **Supabase**. It prevents costly order errors by synchronizing inventory, pricing, and delivery data between ERPs and e-commerce platforms.

**Core Problem**: 33% of B2B e-commerce orders contain errors, costing distributors $400,000/year on average.

## 📋 Critical Context

### Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Deployment**: Vercel (frontend) + Supabase (backend)
- **State Management**: Zustand + React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **Testing**: Playwright (E2E), React Testing Library
- **Caching**: Redis (Upstash) with in-memory fallback

### Architecture Principles

1. **Server Components by Default** - Use Client Components only when needed
2. **Data Accuracy First** - Show loading states rather than stale data
3. **RLS Everything** - All tables must have Row Level Security policies
4. **Type Safety** - Generate types from Supabase schema
5. **Real-time When Needed** - Use Supabase Realtime for inventory/pricing

## 🏗 Project Structure

```
app/
├── (auth)/                 # Public auth routes
│   ├── login/
│   ├── signup/
│   └── reset-password/
├── (dashboard)/           # Protected routes (with layout)
│   ├── layout.tsx         # Dashboard layout with sidebar
│   ├── inventory/
│   ├── pricing/
│   ├── settings/
│   └── sync/
├── api/                   # API routes for webhooks
│   ├── webhooks/
│   │   ├── netsuite/
│   │   └── shopify/
│   └── cron/             # Scheduled jobs
└── actions/              # Server actions
    ├── inventory.ts
    ├── pricing.ts
    └── sync.ts

components/
├── ui/                   # shadcn/ui components
├── features/             # Feature-specific components
│   ├── inventory/
│   ├── pricing/
│   └── sync/
└── layouts/              # Layout components

lib/
├── supabase/            # Supabase clients
│   ├── client.ts        # Browser client
│   ├── server.ts        # Server client
│   ├── admin.ts         # Admin client (service role)
│   └── middleware.ts    # Auth middleware
├── integrations/        # External APIs
│   ├── netsuite/
│   ├── shopify/
│   └── types.ts
└── utils/               # Helper functions

supabase/
├── migrations/          # SQL migrations
├── functions/           # Edge Functions
└── types/              # Generated types
```

## 💻 Code Patterns

### Server Component Pattern

```tsx
// app/(dashboard)/inventory/page.tsx
import { InventoryTable } from '@/components/features/inventory/inventory-table'
import { createServerClient } from '@/lib/supabase/server'

export default async function InventoryPage() {
  const supabase = createServerClient()

  // Fetch data on server
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('*, products(name, sku)')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error('Failed to load inventory')
  }

  // Pass to Client Component for interactivity
  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Inventory Management</h1>
      <InventoryTable initialData={inventory} />
    </div>
  )
}
```

### Client Component with Real-time

```tsx
'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function InventoryTable({ initialData }: { initialData: Inventory[] }) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `organization_id=eq.${user.organizationId}`
        },
        (payload) => {
          // Invalidate and refetch
          queryClient.invalidateQueries({ queryKey: ['inventory'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return (
    // Table implementation
  )
}
```

### Server Action Pattern

```typescript
// app/actions/inventory.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const updateInventorySchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().min(0),
  warehouseId: z.string().uuid(),
  reason: z.enum(['sale', 'return', 'adjustment', 'transfer']),
})

export async function updateInventory(formData: FormData) {
  const supabase = createServerClient()

  // Get session
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Validate input
  const parsed = updateInventorySchema.parse({
    id: formData.get('id'),
    quantity: Number(formData.get('quantity')),
    warehouseId: formData.get('warehouseId'),
    reason: formData.get('reason'),
  })

  // Update with RLS
  const { error } = await supabase
    .from('inventory')
    .update({
      quantity: parsed.quantity,
      warehouse_id: parsed.warehouseId,
      updated_by: user.id,
    })
    .eq('id', parsed.id)

  if (error) throw error

  // Trigger sync to external systems
  await supabase.functions.invoke('sync-inventory', {
    body: { inventoryId: parsed.id },
  })

  // Revalidate cache
  revalidatePath('/inventory')
}
```

### API Route for Webhooks

```typescript
// app/api/webhooks/shopify/route.ts
import crypto from 'crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get('x-shopify-hmac-sha256')

  // Verify webhook
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(body, 'utf8')
    .digest('base64')

  if (hash !== signature) {
    return new Response('Unauthorized', { status: 401 })
  }

  const data = JSON.parse(body)
  const supabase = createAdminClient()

  // Process inventory update
  if (data.topic === 'inventory_levels/update') {
    await supabase.from('inventory').upsert({
      external_id: data.inventory_item_id,
      quantity: data.available,
      location_id: data.location_id,
      platform: 'shopify',
      last_sync: new Date().toISOString(),
    })
  }

  return new Response('OK', { status: 200 })
}
```

### Database Schema with RLS

```sql
-- Inventory table with multi-tenancy
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER,
  reorder_quantity INTEGER,
  last_sync TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Users can only see their organization's inventory
CREATE POLICY "Users can view own organization inventory" ON inventory
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their organization's inventory
CREATE POLICY "Users can update own organization inventory" ON inventory
  FOR UPDATE USING (
    organization_id = (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_inventory_org_product ON inventory(organization_id, product_id);
CREATE INDEX idx_inventory_sync_status ON inventory(sync_status) WHERE sync_status = 'pending';
```

### Custom Hook Pattern

```typescript
// hooks/use-inventory.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'

export function useInventory(warehouseId?: string) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['inventory', warehouseId],
    queryFn: async () => {
      let query = supabase
        .from('inventory')
        .select('*, products(*), warehouses(*)')

      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (update: InventoryUpdate) => {
      const { error } = await supabase
        .from('inventory')
        .update(update)
        .eq('id', update.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  return {
    inventory: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateInventory: updateMutation.mutate,
  }
}
```

## 🚨 Critical Rules

### Supabase Specific

1. **ALWAYS use RLS** - Every table needs Row Level Security policies
2. **Organization isolation** - Filter by organization_id in all queries
3. **Type safety** - Generate types with `supabase gen types`
4. **Service role carefully** - Only use admin client in secure server contexts
5. **Handle auth states** - Check user session before mutations

### Next.js Specific

1. **Server Components default** - Only use 'use client' when needed
2. **No sensitive data in client** - API keys only in server components/actions
3. **Revalidate after mutations** - Use revalidatePath or revalidateTag
4. **Error boundaries** - Wrap pages in error boundaries
5. **Loading states** - Always show loading.tsx for async operations

### General Rules

1. **Never trust user input** - Validate with Zod
2. **Never log sensitive data** - No passwords, API keys, tokens
3. **Always handle errors** - Show user-friendly messages
4. **Test critical paths** - E2E tests for core workflows
5. **Document complex logic** - Future you will thank you

### 🔒 TYPE SAFETY REQUIREMENTS

1. **STRICT TypeScript** - All code must pass strict TypeScript checks
2. **NO any types** - Never use `any` - use `unknown` if type is truly unknown
3. **EXPLICIT types** - All function parameters and return values must be typed
4. **TYPE imports** - Import types from correct locations (e.g., `@/supabase/types/database`)
5. **COMPLETE implementations** - No partial implementations or placeholders
6. **TYPE guards** - Use type guards for runtime type checking
7. **GENERIC types** - Use generics for reusable components/hooks
8. **VALIDATE inputs** - Use Zod schemas for all user inputs and API responses

### 🚫 NO MOCK IMPLEMENTATIONS

1. **NO setTimeout for fake progress** - Use real progress tracking
2. **NO placeholder data** - Connect to real database/APIs
3. **NO console.log simulations** - Implement actual functionality
4. **NO hardcoded delays** - Use actual async operations
5. **NO commented "TODO" in production code** - Complete all features
6. **NO stub functions** - Implement complete logic
7. **NO fake API responses** - Use real endpoints
8. **NO placeholder UI** - Build actual components

#### Examples of What NOT to Do:

```typescript
// ❌ BAD - Simulated progress
setTimeout(() => setProgress((index + 1) / total * 100), index * 100)

// ✅ GOOD - Real progress tracking
const result = await updateItem(item)
setProgress((index + 1) / total * 100)

// ❌ BAD - Mock data
const mockUsers = [{id: 1, name: 'Test User'}]
const fakeProducts = generateMockProducts(10)
const dummyResponse = { success: true, data: [] }

// ✅ GOOD - Real data
const { data: users } = await supabase.from('users').select('*')
const { data: products } = await fetchProductsFromAPI()

// ❌ BAD - Fake async/delays
await new Promise(resolve => setTimeout(resolve, 1000))
await sleep(2000) // artificial delay
await delay(Math.random() * 1000)

// ✅ GOOD - Real operations
await supabase.from('products').update({ price: newPrice })
await fetch('/api/process', { method: 'POST', body })

// ❌ BAD - Stub functions
async function processOrder(order) {
  console.log('Processing order...', order)
  return { success: true }
}

// ✅ GOOD - Complete implementation
async function processOrder(order) {
  const validated = validateOrder(order)
  const { data, error } = await supabase
    .from('orders')
    .insert(validated)
  if (error) throw error
  await sendOrderConfirmation(data.id)
  return data
}

// ❌ BAD - Placeholder UI
<div>Loading animation here...</div>
<Button onClick={() => alert('Not implemented')}>Submit</Button>

// ✅ GOOD - Actual implementation
<Skeleton className="h-4 w-full" />
<Button onClick={handleSubmit} disabled={isSubmitting}>
  {isSubmitting ? <Spinner /> : 'Submit'}
</Button>

// ❌ BAD - Fake error handling
try {
  // operation
} catch (error) {
  console.error('Error occurred')
}

// ✅ GOOD - Proper error handling
try {
  // operation
} catch (error) {
  toast.error(error.message)
  await logError(error, { context: 'processOrder' })
  throw error
}

// ❌ BAD - Using any types
function processData(data: any) {
  return data.map((item: any) => item.value)
}

// ✅ GOOD - Properly typed
interface DataItem {
  id: string
  value: number
}

function processData(data: DataItem[]): number[] {
  return data.map((item) => item.value)
}

// ❌ BAD - Missing return types
async function fetchUser(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

// ✅ GOOD - Explicit return type
async function fetchUser(id: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}
```

## 📝 Common Patterns to Follow

### Form Handling

```tsx
// Always use React Hook Form + Zod
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const formSchema = z.object({
  quantity: z.number().min(0).max(999999),
  reason: z.string().min(1),
})

export function UpdateInventoryForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData()
    Object.entries(values).forEach(([key, value]) => {
      formData.append(key, value.toString())
    })

    await updateInventory(formData)
  }
}
```

### Error Handling

```tsx
// Global error boundary
export function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
```

### Data Fetching

```tsx
// Parallel data fetching in Server Components
export default async function DashboardPage() {
  const supabase = createServerClient()

  // Parallel fetching
  const [inventoryResult, ordersResult, alertsResult] = await Promise.all([
    supabase.from('inventory').select('*').limit(10),
    supabase.from('orders').select('*').limit(10),
    supabase.from('alerts').select('*').eq('status', 'active'),
  ])

  return (
    <Dashboard
      inventory={inventoryResult.data}
      orders={ordersResult.data}
      alerts={alertsResult.data}
    />
  )
}
```

## 🧪 Testing Approach

### E2E Tests with Playwright

```typescript
import { expect, test } from '@playwright/test'

test('update inventory quantity', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password')
  await page.click('button[type="submit"]')

  // Navigate to inventory
  await page.goto('/inventory')
  await page.waitForSelector('[data-testid="inventory-table"]')

  // Update quantity
  await page.click('[data-testid="edit-quantity-btn"]')
  await page.fill('[name="quantity"]', '150')
  await page.click('button[type="submit"]')

  // Verify update
  await expect(page.locator('[data-testid="quantity-display"]')).toHaveText(
    '150'
  )
})
```

## 🔍 Troubleshooting Guide

### Common Errors & Solutions

#### 1. RLS Policy Violations

**Error**: `new row violates row-level security policy`

```typescript
// Problem: User's organization_id doesn't match
// Solution: Ensure proper organization_id in insert/update
const { data: profile } = await supabase
  .from('user_profiles')
  .select('organization_id')
  .single()

await supabase.from('inventory').insert({
  ...data,
  organization_id: profile.organization_id,
})
```

#### 2. Hydration Mismatches

**Error**: `Text content does not match server-rendered HTML`

```tsx
// Problem: Date/time rendering differently on server/client
// Solution: Use consistent formatting
import { format } from 'date-fns'

// Bad
<span>{new Date().toLocaleString()}</span>

// Good
<span>{format(new Date(), 'PPP')}</span>
```

#### 3. Supabase Auth Token Errors

**Error**: `Invalid Refresh Token`

```typescript
// Problem: Stale auth session
// Solution: Refresh session in middleware
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient(request)

  // Refresh session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

#### 4. Type Errors After Schema Changes

**Error**: `Property does not exist on type`

```bash
# Solution: Regenerate types
pnpm supabase gen types typescript --local > supabase/types/database.ts

# Also restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

#### 5. CORS Errors with Edge Functions

**Error**: `CORS policy: No 'Access-Control-Allow-Origin'`

```typescript
// Solution: Add CORS headers in Edge Function
export async function handler(req: Request) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // Your function logic...
}
```

## ⚡ Performance Optimization

### 1. Database Query Optimization

```typescript
// Bad: N+1 queries
const products = await supabase.from('products').select('*')
for (const product of products.data) {
  const inventory = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', product.id)
}

// Good: Single query with join
const products = await supabase.from('products').select('*, inventory(*)')
```

### 2. Image Optimization

```tsx
// Use Next.js Image component
import Image from 'next/image'

;<Image
  src={product.image_url}
  alt={product.name}
  width={300}
  height={300}
  loading="lazy"
  placeholder="blur"
  blurDataURL={product.blur_data_url}
/>
```

### 3. Component Code Splitting

```tsx
// Lazy load heavy components
import dynamic from 'next/dynamic'

const HeavyChart = dynamic(
  () => import('@/components/features/analytics/heavy-chart'),
  {
    loading: () => <Skeleton className="h-96" />,
    ssr: false,
  }
)
```

### 4. Caching Strategy

```typescript
// Server-side caching with revalidation
export const revalidate = 3600 // 1 hour

// Or use React Query for client-side caching
const query = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
})
```

## 🔒 Security Checklist

### Pre-Deployment Security Review

- [ ] **RLS Policies** - All tables have appropriate RLS policies
- [ ] **API Keys** - No hardcoded keys, all in environment variables
- [ ] **Input Validation** - All forms use Zod validation
- [ ] **SQL Injection** - Using parameterized queries only
- [ ] **XSS Prevention** - No dangerouslySetInnerHTML without sanitization
- [ ] **CSRF Protection** - Server actions use built-in CSRF protection
- [ ] **Rate Limiting** - API routes have rate limiting
- [ ] **Error Messages** - No sensitive data in error messages
- [ ] **Logging** - No PII or sensitive data in logs
- [ ] **File Uploads** - Validated file types and sizes

### Security Headers (middleware.ts)

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}
```

## 🚀 Deployment Checklist

### Pre-Deployment Steps

1. **Environment Variables**

   ```bash
   # Verify all required env vars
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   DATABASE_URL=
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   ```

2. **Database Migrations**

   ```bash
   # Apply all pending migrations
   pnpm supabase db push

   # Verify RLS policies
   pnpm supabase db lint
   ```

3. **Build Verification**

   ```bash
   # Local build test
   pnpm build

   # Type check
   pnpm type-check

   # Lint check
   pnpm lint
   ```

4. **Edge Functions Deployment**

   ```bash
   # Deploy all Edge Functions
   pnpm supabase functions deploy
   ```

5. **Performance Audit**
   ```bash
   # Run Lighthouse CI
   pnpm lighthouse
   ```

## 👀 Code Review Guidelines

### PR Checklist

- [ ] **No `any` types** - All TypeScript properly typed
- [ ] **Error handling** - All async operations have try/catch
- [ ] **Loading states** - UI shows loading feedback
- [ ] **Mobile responsive** - Works on all screen sizes
- [ ] **Accessibility** - ARIA labels, keyboard navigation
- [ ] **Tests added** - New features have tests
- [ ] **Documentation** - Complex logic is documented
- [ ] **Performance** - No unnecessary re-renders
- [ ] **Security** - Input validation, RLS policies
- [ ] **Code style** - Follows project conventions

### Review Focus Areas

1. **Data Flow** - Server vs Client Components used appropriately
2. **State Management** - No prop drilling, proper state location
3. **Database Queries** - Efficient queries, proper indexes
4. **Error Boundaries** - User-friendly error handling
5. **Real-time Updates** - Subscriptions cleaned up properly

## 🔄 Migration Guide

### Adding New Tables

1. Create migration file
2. Add RLS policies
3. Generate TypeScript types
4. Create server actions
5. Build UI components
6. Add tests

### Example Migration Flow

```bash
# 1. Create migration
pnpm supabase migration new add_customer_groups

# 2. Edit migration file
# supabase/migrations/[timestamp]_add_customer_groups.sql

# 3. Apply migration
pnpm supabase db push

# 4. Generate types
pnpm supabase gen types typescript --local > supabase/types/database.ts

# 5. Create server actions
# app/actions/customer-groups.ts

# 6. Build components
# components/features/customers/customer-groups.tsx
```

## 💰 Pricing Rules Engine (PRP-010)

### Overview

The pricing engine supports dynamic B2B pricing with multiple rule types, quantity breaks, and customer-specific overrides. It includes Redis caching for performance and inventory integration for availability-based pricing.

### Key Features

- **Rule Types**: Customer, product, category, promotion, quantity-based
- **Discounts**: Percentage, fixed amount, or special price
- **Quantity Breaks**: Tiered pricing based on order quantity
- **Customer Overrides**: Custom pricing per customer/product
- **Caching**: Redis-backed with fallback to in-memory
- **Inventory Integration**: Dynamic pricing based on stock levels

### Server Actions

```typescript
// app/actions/pricing.ts
import {
  bulkUpdateCustomerPrices,
  calculatePrice,
  createCustomerPricing,
  createPricingRule,
  createProductPricing,
  deletePricingRule,
  deleteProductPricing,
  updateCustomerPricing,
  updatePricingRule,
  updateProductPricing,
} from '@/app/actions/pricing'
```

### Common Patterns

#### Calculate Price for Display

```typescript
import { calculatePrice } from '@/lib/pricing/calculate-price'

const result = await calculatePrice({
  product_id: 'xxx',
  customer_id: 'yyy',
  quantity: 10,
  requested_date: '2024-01-01',
})

console.log(result.final_price) // Final calculated price
console.log(result.applied_rules) // Rules that were applied
```

#### Clear Pricing Cache

```typescript
import {
  clearCustomerPricingCache,
  clearPricingCache,
} from '@/lib/pricing/calculate-price'

// Clear all pricing cache
await clearPricingCache()

// Clear cache for specific product
await clearPricingCache('product-id')

// Clear cache for specific customer
await clearCustomerPricingCache('customer-id')
```

#### Custom Pricing Conditions

The pricing engine supports custom conditions in rules:

- `min_order_value`: Minimum order value required
- `day_of_week`: Specific days (0-6, Sunday-Saturday)
- `hour_of_day`: Time range (e.g., { min: 9, max: 17 })
- `quantity_multiple`: Order quantity must be multiple of value
- `inventory_level`: Based on stock levels (critical/low/medium/high/excess)
- `min_available_inventory`: Minimum available stock required
- `warehouse_specific`: Specific warehouse ID

### Database Schema

```sql
-- Main pricing tables
product_pricing        -- Base product prices
pricing_rules         -- Dynamic pricing rules
quantity_breaks       -- Quantity-based discounts
customer_pricing      -- Customer-specific overrides
customer_price_history -- Price change audit trail
price_calculations    -- Price calculation log

-- Key functions
calculate_product_price() -- Database function for price calculation
```

### UI Components

```tsx
// Pricing rule management
import { BulkPriceUpdateDialog } from '@/components/features/pricing/bulk-price-update-dialog'
// Customer pricing
import { CustomerPriceList } from '@/components/features/pricing/customer-price-list'
import { MarginAlerts } from '@/components/features/pricing/margin-alerts'
// Tools
import { PriceCalculator } from '@/components/features/pricing/price-calculator'
import { PriceHistoryViewer } from '@/components/features/pricing/price-history-viewer'
import { PricingRuleForm } from '@/components/features/pricing/pricing-rule-form'
import { PricingRulesList } from '@/components/features/pricing/pricing-rules-list'
import { PromotionCalendar } from '@/components/features/pricing/promotion-calendar'
```

### Testing Pricing Rules

```bash
# Use the price calculator UI at /pricing/calculator
# Or via Edge Function:
curl -X POST https://your-project.supabase.co/functions/v1/calculate-price \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "xxx",
    "customer_id": "yyy",
    "quantity": 10
  }'
```

### Environment Variables

```env
# For Redis caching (optional - falls back to in-memory)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

## 🛠️ Development Commands

Always run these before committing to catch errors early:

```bash
# Check TypeScript errors
npm run type-check

# Check ESLint errors
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Run all checks in parallel (recommended)
npm run type-check && npm run lint
```

For continuous feedback during development:

```bash
# Watch for TypeScript errors in real-time
npx tsc --noEmit --watch
```

## 📚 Useful Commands Reference

### Supabase Commands

```bash
# Generate TypeScript types from database
pnpm supabase gen types typescript --local > supabase/types/database.ts

# Start local Supabase
pnpm supabase start

# Stop local Supabase
pnpm supabase stop

# Apply migrations to local database
pnpm supabase db push

# Create new migration
pnpm supabase migration new <migration_name>

# Reset local database
pnpm supabase db reset

# Deploy Edge Functions
pnpm supabase functions deploy

# Test Edge Functions locally
pnpm supabase functions serve
```

### Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Update dependencies
pnpm update

# Check for outdated packages
pnpm outdated
```

### Git Workflow Commands

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Stage changes
git add .

# Commit with conventional commits
git commit -m "feat: add new pricing calculator"
git commit -m "fix: resolve inventory sync issue"
git commit -m "docs: update README with setup instructions"

# Push to remote
git push -u origin feature/your-feature-name

# Create pull request
gh pr create --title "feat: add new pricing calculator" --body "Description..."
```

## 🏭 Production-Ready Checklist

Before marking any implementation as complete:

### Data Operations

- [ ] All database operations use real Supabase queries
- [ ] Progress tracking reflects actual operation status
- [ ] Error handling includes retry logic where appropriate
- [ ] Loading states show real operation progress
- [ ] Optimistic updates have proper rollback

### API Integration

- [ ] All external API calls are implemented
- [ ] Webhook handlers process real data
- [ ] Rate limiting is respected
- [ ] API errors are properly handled
- [ ] Response data is validated

### User Interface

- [ ] Forms submit real data to server actions
- [ ] Tables display actual database records
- [ ] Filters/search work with real queries
- [ ] Pagination uses database limits/offsets
- [ ] Real-time updates via Supabase subscriptions

### State Management

- [ ] No hardcoded test data in production code
- [ ] State reflects actual server responses
- [ ] Cache invalidation triggers real refetches
- [ ] Optimistic updates match server behavior
- [ ] Error states show actual error messages

### Testing & Validation

- [ ] Can create/read/update/delete real records
- [ ] Business logic matches requirements
- [ ] Edge cases are handled
- [ ] Performance meets requirements
- [ ] Security policies are enforced

### Type Safety

- [ ] All code passes `npm run type-check` with zero errors
- [ ] No `any` types used anywhere in the codebase
- [ ] All functions have explicit return types
- [ ] All API responses are properly typed
- [ ] Form inputs are validated with Zod schemas
- [ ] Database queries use generated types

---

**Remember**: You're building a system handling critical B2B data. Prioritize data accuracy, security (RLS), type safety, and user experience. When in doubt, choose reliability over complexity. **NEVER use mock implementations, simulated behavior, or untyped code in production.**

## ✅ Definition of Done - MANDATORY for ALL Features

Every feature/fix MUST include:

### 1. Core Implementation
- [ ] Feature code complete with proper error handling
- [ ] All TypeScript strict mode errors resolved
- [ ] No `any` types used
- [ ] All functions have explicit return types
- [ ] Input validation with Zod schemas

### 2. Testing (REQUIRED)
- [ ] Unit tests for business logic (min 80% coverage)
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical user flows
- [ ] Edge case testing (network failures, malformed data)
- [ ] Performance tests meet SLA requirements

### 3. Security
- [ ] Input validation with Zod schemas
- [ ] Rate limiting on all API endpoints
- [ ] CSRF protection for mutations
- [ ] Authorization checks at all layers
- [ ] Security review checklist completed
- [ ] No sensitive data in logs or errors

### 4. Performance & Scalability
- [ ] Load tested with expected volume (specify: ___ req/sec)
- [ ] Database queries optimized (no N+1)
- [ ] Proper indexes added and verified
- [ ] Memory usage profiled for large operations
- [ ] Response time < 200ms p95

### 5. Error Handling & Recovery
- [ ] Retry logic for transient failures
- [ ] Graceful degradation under load
- [ ] Rollback mechanism for failed operations
- [ ] Dead letter queue for failed records
- [ ] User-friendly error messages

### 6. Monitoring & Observability
- [ ] Structured logging implemented
- [ ] Key metrics instrumented
- [ ] Error tracking configured
- [ ] Alerts defined for failures
- [ ] Dashboard created

### 7. Documentation
- [ ] API documentation updated
- [ ] Error codes documented
- [ ] Runbook for troubleshooting
- [ ] CLAUDE.md context updated
- [ ] Architecture decision recorded

### 8. Operations
- [ ] Feature flags for gradual rollout
- [ ] Database migrations reversible
- [ ] Cleanup jobs for temporary data
- [ ] Resource limits configured
- [ ] Deployment instructions clear

## 🚀 Before Starting ANY Feature

### First, Try Code Generation (5-Minute Rule)
```bash
# Don't write from scratch! Generate with all requirements built-in:
npm run generate:feature <feature-name>

# Examples:
npm run generate:api products/bulk-upload
npm run generate:service inventory-sync
npm run generate:repository customers
```

### Enable Development Guards
```bash
# Run BEFORE coding to catch issues in real-time
npm run dev:guards
```

### Then Ask Yourself:

1. **Scale**: What happens with 1M records? Have I designed for this?
2. **Failure**: How does it fail gracefully? What's the recovery path?
3. **Security**: What are the attack vectors? How am I protecting against them?
4. **Testing**: How will I test edge cases? What could go wrong?
5. **Monitoring**: How will I know if it breaks in production?
6. **Recovery**: How do users recover from errors? Is there a manual override?
7. **Cost**: What's the computational/storage cost at scale?
8. **Compliance**: Does this meet our data handling requirements?

## ⚠️ Common Implementation Pitfalls

### Missing Rate Limiting
```typescript
// ❌ BAD - No rate limiting
export async function POST(request: Request) {
  const data = await request.json()
  return processRequest(data)
}

// ✅ GOOD - With rate limiting
import { ratelimit } from '@/lib/ratelimiter'

export async function POST(request: Request) {
  // Use IP or user ID as identifier
  const identifier = request.headers.get('x-forwarded-for') || 
    request.headers.get('x-real-ip') || 
    'anonymous'
  
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier)
  
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(reset).toISOString(),
          'Retry-After': Math.floor((reset - Date.now()) / 1000).toString()
        }
      }
    )
  }
  
  const data = await request.json()
  return processRequest(data)
}
```

### Missing Transaction Handling
```typescript
// ❌ BAD - Partial failure possible
async function createOrder(orderData: OrderInput) {
  const order = await supabase.from('orders').insert(orderData).single()
  
  // If this fails, order is created but inventory not updated!
  await supabase.from('inventory').update({ 
    quantity: quantity - orderData.quantity 
  })
  
  await sendOrderEmail(order.id) // If this fails, no rollback!
}

// ✅ GOOD - Atomic transaction with rollback
async function createOrder(orderData: OrderInput) {
  // Use database transaction
  const { data, error } = await supabase.rpc('create_order_transaction', {
    order_data: orderData,
    inventory_updates: calculateInventoryUpdates(orderData)
  })
  
  if (error) {
    throw new OrderError('Failed to create order', 'ORDER_CREATION_FAILED', 500)
  }
  
  // Non-critical operations outside transaction
  try {
    await sendOrderEmail(data.order_id)
  } catch (emailError) {
    // Log but don't fail the order
    await logError('email_failed', { orderId: data.order_id, error: emailError })
  }
  
  return data
}
```

### Missing Test Coverage
```typescript
// ❌ BAD - Feature without tests
export function calculateDiscount(price: number, quantity: number): number {
  return price * quantity * 0.1
}

// ✅ GOOD - With comprehensive tests
// calculate-discount.ts
export function calculateDiscount(
  price: number, 
  quantity: number, 
  customerTier?: 'bronze' | 'silver' | 'gold'
): number {
  if (price < 0 || quantity < 0) {
    throw new Error('Price and quantity must be positive')
  }
  
  const baseDiscount = 0.1
  const tierMultipliers = { bronze: 1, silver: 1.5, gold: 2 }
  const multiplier = tierMultipliers[customerTier || 'bronze']
  
  return Math.round(price * quantity * baseDiscount * multiplier * 100) / 100
}

// calculate-discount.test.ts
describe('calculateDiscount', () => {
  it('calculates standard discount correctly', () => {
    expect(calculateDiscount(100, 2)).toBe(20)
  })
  
  it('handles zero quantity', () => {
    expect(calculateDiscount(100, 0)).toBe(0)
  })
  
  it('throws on negative prices', () => {
    expect(() => calculateDiscount(-100, 2)).toThrow('positive')
  })
  
  it('handles tier multipliers', () => {
    expect(calculateDiscount(100, 1, 'gold')).toBe(20)
  })
  
  it('handles floating point precision', () => {
    expect(calculateDiscount(10.99, 3)).toBe(3.30)
  })
  
  it('handles maximum safe integer', () => {
    expect(calculateDiscount(Number.MAX_SAFE_INTEGER, 1)).toBeDefined()
  })
})
```

### Missing Error Recovery
```typescript
// ❌ BAD - No recovery mechanism
async function syncInventory() {
  const products = await fetchProducts()
  
  for (const product of products) {
    await updateInventory(product) // If one fails, rest are skipped
  }
}

// ✅ GOOD - With retry and error recovery
async function syncInventory() {
  const products = await fetchProducts()
  const errors: SyncError[] = []
  const maxRetries = 3
  
  // Process in batches with concurrency control
  const batchSize = 10
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize)
    
    await Promise.all(
      batch.map(async (product) => {
        let lastError: Error | null = null
        
        // Retry logic with exponential backoff
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            await updateInventory(product)
            return // Success
          } catch (error) {
            lastError = error as Error
            
            // Don't retry on permanent errors
            if (isPermanentError(error)) break
            
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
        
        // Track failed items for manual recovery
        errors.push({
          productId: product.id,
          error: lastError,
          timestamp: new Date(),
          attempts: maxRetries
        })
      })
    )
  }
  
  // Handle failures
  if (errors.length > 0) {
    await saveToDeadLetterQueue(errors)
    await notifyOpsTeam(errors)
  }
  
  return {
    total: products.length,
    successful: products.length - errors.length,
    failed: errors.length,
    errors
  }
}
```

### Missing Monitoring
```typescript
// ❌ BAD - No visibility into operations
async function processPayment(paymentData: PaymentInput) {
  const result = await paymentGateway.charge(paymentData)
  return result
}

// ✅ GOOD - Full observability
import { metrics, tracer, logger } from '@/lib/monitoring'

async function processPayment(paymentData: PaymentInput) {
  const span = tracer.startSpan('processPayment')
  const startTime = Date.now()
  
  try {
    // Log attempt
    logger.info('Processing payment', {
      amount: paymentData.amount,
      currency: paymentData.currency,
      customerId: paymentData.customerId
    })
    
    // Track attempt
    metrics.increment('payments.attempted', {
      currency: paymentData.currency
    })
    
    const result = await paymentGateway.charge(paymentData)
    
    // Track success
    metrics.increment('payments.succeeded', {
      currency: paymentData.currency
    })
    
    metrics.histogram('payments.amount', paymentData.amount, {
      currency: paymentData.currency
    })
    
    const duration = Date.now() - startTime
    metrics.histogram('payments.duration', duration)
    
    logger.info('Payment processed successfully', {
      paymentId: result.id,
      duration
    })
    
    return result
  } catch (error) {
    // Track failure
    metrics.increment('payments.failed', {
      currency: paymentData.currency,
      error_code: error.code || 'unknown'
    })
    
    logger.error('Payment processing failed', {
      error: error.message,
      code: error.code,
      customerId: paymentData.customerId
    })
    
    span.setStatus({ code: 2, message: error.message })
    throw error
  } finally {
    span.end()
  }
}
```

## 🎯 Production Readiness Scorecard

Rate each item 0-10. Feature is ready when all scores ≥ 8:

| Category | Score | Notes |
|----------|-------|-------|
| **Functionality** | _/10 | All requirements met? |
| **Performance** | _/10 | Meets SLA under load? |
| **Security** | _/10 | Threat model addressed? |
| **Reliability** | _/10 | <0.1% error rate? |
| **Observability** | _/10 | Can diagnose issues? |
| **Maintainability** | _/10 | Well documented/tested? |
| **Scalability** | _/10 | Works at 10x load? |
| **Recoverability** | _/10 | Can rollback/recover? |
| **Usability** | _/10 | Good user experience? |
| **Compliance** | _/10 | Meets requirements? |

**Total Score**: _/100 (Must be ≥ 80)

## 🚨 CRITICAL: When to STOP Development

IMMEDIATELY stop and escalate if you discover:

1. **Security Issues**
   - Authentication bypass possible
   - Data leakage between organizations
   - SQL injection vulnerability
   - Unencrypted sensitive data

2. **Data Integrity Issues**
   - Race conditions in critical paths
   - Missing transaction boundaries
   - Incorrect RLS policies
   - Data loss scenarios

3. **Performance Issues**
   - Response time >5x requirement
   - Memory leak detected
   - Unbounded query results
   - Missing database indexes

4. **Missing Core Requirements**
   - No error recovery mechanism
   - No monitoring/alerting
   - No rollback capability
   - No rate limiting on public endpoints

Remember: **It's better to delay a feature than to break production.** If in doubt, ask for help.

## 🤖 Automated Quality Enforcement

### Pre-Commit Hooks (Install Once)
```bash
npm run setup:hooks
```

This automatically checks before EVERY commit:
- ✅ TypeScript errors
- ✅ Missing tests for new files
- ✅ Rate limiting on APIs
- ✅ Organization filtering
- ✅ No `any` types

### Real-Time Development Monitoring
```bash
# Run in separate terminal
npm run dev:monitor
```

Shows live status:
- 🔴 Security violations
- 🟡 Performance issues
- 🔵 Missing tests
- 🟢 All good!

### Development Toolbar (Auto-Enabled in Dev)

The toolbar appears at the bottom of your screen showing:
```
⚠️ Fix before commit: 🔴 Missing rate limit: /api/products | 🟡 Untyped export: calculatePrice | 🔵 No test: inventory-service.ts
```

Click any issue for a quick fix!

### Base Classes & Templates

Always extend our base classes instead of writing from scratch:

```typescript
// ❌ BAD - Writing from scratch
export class ProductService {
  async createProduct(data: any) {
    try {
      return await supabase.from('products').insert(data)
    } catch (error) {
      console.error(error)
    }
  }
}

// ✅ GOOD - Extending BaseService
export class ProductService extends BaseService<Product> {
  protected entityName = 'product'
  
  async createProduct(data: CreateProductInput) {
    // Automatic: retry logic, monitoring, circuit breaker, proper errors
    return this.withRetry(() => 
      this.repository.create(data)
    )
  }
}
```

### Copy-Paste Templates

Located in `/templates` directory:
- `api-route.template.ts` - Rate-limited API routes
- `service.template.ts` - Service with retry/monitoring
- `repository.template.ts` - Repository with org isolation
- `component.template.tsx` - UI component with loading/error states

## 📚 Additional Resources

- [Execute PRP Guide](/.claude/commands/execute-prp.md) - Implementation automation
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [OWASP Security Checklist](https://owasp.org/www-project-web-security-testing-guide/)

## 🎯 Git Commit Strategy for TODO Items

### Automatic Commits on TODO Completion

When working through TODO items using the TodoWrite tool, Claude should create a commit when marking each significant TODO item as completed. This ensures clean, atomic commits with clear diffs.

### Commit Message Format

Follow the established project conventions:

```bash
# Feature additions
git commit -m "feat(module): implement feature description"

# Bug fixes
git commit -m "fix(module): resolve specific issue"

# Documentation
git commit -m "docs(module): update/add documentation"

# Code improvements
git commit -m "refactor(module): improve code structure"

# Tests
git commit -m "test(module): add/update tests"

# Build/tooling
git commit -m "chore(module): update build configuration"
```

### When to Commit

1. **After completing a TODO item** - When marking a TODO as completed
2. **Logical grouping** - Small related changes can be grouped
3. **Before switching context** - Always commit before moving to unrelated work

### Example Workflow

```typescript
// 1. Complete BaseRepository implementation
// Files: lib/base/base-repository.ts
await TodoWrite({ id: "3.1", status: "completed" })
// COMMIT: "feat(base): implement BaseRepository with org isolation"

// 2. Complete BaseService implementation
// Files: lib/base/base-service.ts, lib/resilience/circuit-breaker.ts
await TodoWrite({ id: "3.2", status: "completed" })
// COMMIT: "feat(base): add BaseService with retry logic and circuit breaker"

// 3. Complete API route handler
// Files: lib/api/route-handler.ts, lib/utils/ratelimit.ts
await TodoWrite({ id: "3.3", status: "completed" })
// COMMIT: "feat(api): create secure route handler with auth and rate limiting"
```

### Commit Guidelines

1. **Atomic commits** - Each commit should represent one logical change
2. **Clear messages** - Describe what and why, not how
3. **Reference PRPs** - Include PRP number when relevant: `"feat(api): implement rate limiting (PRP-018A)"`
4. **Test before commit** - Ensure TypeScript/lint checks pass
5. **No WIP commits** - Only commit completed, working code
