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

## 🔍 Debugging Tips

### Common Issues
1. **"RLS policy violation"** - Check user's organization_id matches
2. **"Hydration mismatch"** - Ensure consistent server/client rendering
3. **"Invalid auth token"** - Refresh session or check middleware
4. **"CORS error"** - Check Supabase URL configuration
5. **"Type error after schema change"** - Regenerate types

### Useful Commands
```bash
# Generate TypeScript types from Supabase
pnpm supabase gen types typescript --local > supabase/types/database.ts

# Run local Supabase
pnpm supabase start

# Apply migrations
pnpm supabase db push

# Create new migration
pnpm supabase migration new <name>

# Test Edge Functions locally
pnpm supabase functions serve
```

## 🛠️ Development Commands

Always run these before committing to catch errors early:

```bash
# Check TypeScript errors
npm run typecheck

# Check ESLint errors  
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Run all checks in parallel (recommended)
npm run typecheck && npm run lint
```

For continuous feedback during development:
```bash
# Watch for TypeScript errors in real-time
npx tsc --noEmit --watch
```

---

**Remember**: You're building a system handling critical B2B data. Prioritize data accuracy, security (RLS), and user experience. When in doubt, choose reliability over complexity.
