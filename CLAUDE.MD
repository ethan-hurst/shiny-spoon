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
import { createServerClient } from '@/lib/supabase/server'
import { InventoryTable } from '@/components/features/inventory/inventory-table'

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

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateInventorySchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().min(0),
  warehouseId: z.string().uuid(),
  reason: z.enum(['sale', 'return', 'adjustment', 'transfer'])
})

export async function updateInventory(formData: FormData) {
  const supabase = createServerClient()
  
  // Get session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Validate input
  const parsed = updateInventorySchema.parse({
    id: formData.get('id'),
    quantity: Number(formData.get('quantity')),
    warehouseId: formData.get('warehouseId'),
    reason: formData.get('reason')
  })

  // Update with RLS
  const { error } = await supabase
    .from('inventory')
    .update({ 
      quantity: parsed.quantity,
      warehouse_id: parsed.warehouseId,
      updated_by: user.id
    })
    .eq('id', parsed.id)

  if (error) throw error

  // Trigger sync to external systems
  await supabase.functions.invoke('sync-inventory', {
    body: { inventoryId: parsed.id }
  })

  // Revalidate cache
  revalidatePath('/inventory')
}
```

### API Route for Webhooks
```typescript
// app/api/webhooks/shopify/route.ts
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

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
    await supabase
      .from('inventory')
      .upsert({
        external_id: data.inventory_item_id,
        quantity: data.available,
        location_id: data.location_id,
        platform: 'shopify',
        last_sync: new Date().toISOString()
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
    }
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
    }
  })

  return {
    inventory: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateInventory: updateMutation.mutate
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
```

## 📝 Common Patterns to Follow

### Form Handling
```tsx
// Always use React Hook Form + Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const formSchema = z.object({
  quantity: z.number().min(0).max(999999),
  reason: z.string().min(1)
})

export function UpdateInventoryForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema)
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
    supabase.from('alerts').select('*').eq('status', 'active')
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
import { test, expect } from '@playwright/test'

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
  await expect(page.locator('[data-testid="quantity-display"]')).toHaveText('150')
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

await supabase
  .from('inventory')
  .insert({ 
    ...data, 
    organization_id: profile.organization_id 
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
  const { data: { session } } = await supabase.auth.getSession()
  
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
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
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
const products = await supabase
  .from('products')
  .select('*, inventory(*)')
```

### 2. Image Optimization
```tsx
// Use Next.js Image component
import Image from 'next/image'

<Image
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
    ssr: false 
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
  createProductPricing,
  updateProductPricing,
  deleteProductPricing,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  createCustomerPricing,
  updateCustomerPricing,
  bulkUpdateCustomerPrices,
  calculatePrice
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
  requested_date: '2024-01-01'
})

console.log(result.final_price) // Final calculated price
console.log(result.applied_rules) // Rules that were applied
```

#### Clear Pricing Cache
```typescript
import { clearPricingCache, clearCustomerPricingCache } from '@/lib/pricing/calculate-price'

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
import { PricingRulesList } from '@/components/features/pricing/pricing-rules-list'
import { PricingRuleForm } from '@/components/features/pricing/pricing-rule-form'

// Customer pricing
import { CustomerPriceList } from '@/components/features/pricing/customer-price-list'
import { PriceHistoryViewer } from '@/components/features/pricing/price-history-viewer'
import { BulkPriceUpdateDialog } from '@/components/features/pricing/bulk-price-update-dialog'

// Tools
import { PriceCalculator } from '@/components/features/pricing/price-calculator'
import { PromotionCalendar } from '@/components/features/pricing/promotion-calendar'
import { MarginAlerts } from '@/components/features/pricing/margin-alerts'
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

---

**Remember**: You're building a system handling critical B2B data. Prioritize data accuracy, security (RLS), and user experience. When in doubt, choose reliability over complexity. **NEVER use mock implementations or simulated behavior in production code.**