# TruthSource AI Assistant Context (Next.js + Supabase)

This document provides essential context for AI assistants working on the TruthSource codebase. Read this first before making any code changes or architectural decisions.

## 🎯 Core Mission

**Problem**: 33% of B2B e-commerce orders contain errors (inventory, pricing, or delivery data mismatches between systems)  
**Impact**: Average distributor loses $400,000/year to these errors  
**Solution**: Real-time data synchronization using Next.js + Supabase with 99.9% accuracy

## 🏗 Architecture Principles

### 1. **Server Components First**

- Use Server Components by default for better performance
- Only use Client Components when you need interactivity
- Server Actions for all mutations
- No API routes except for webhooks

### 2. **Data Security via RLS**

- Every Supabase table MUST have Row Level Security
- All queries automatically filtered by organization_id
- Never use service role key in client code
- Trust Supabase Auth for user management

### 3. **Real-time When It Matters**

- Use Supabase Realtime for inventory updates
- Use React Query for client-side caching
- Implement optimistic updates for better UX
- WebSocket connections only in Client Components

### 4. **Type Safety Throughout**

- Generate types from Supabase schema
- Use Zod for runtime validation
- Strict TypeScript configuration
- Never use `any` type

## 💻 Technical Stack

### Core Technologies

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (client) + React Query
- **Forms**: React Hook Form + Zod
- **Testing**: Playwright + React Testing Library
- **Deployment**: Vercel + Supabase Cloud

### Key Patterns

#### Server Component Data Fetching

```tsx
// app/(dashboard)/inventory/page.tsx
import { createServerClient } from '@/lib/supabase/server'

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { warehouse?: string }
}) {
  const supabase = createServerClient()

  // Data fetching happens on the server
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select(
      `
      *,
      product:products!inner (
        sku,
        name,
        category
      ),
      warehouse:warehouses!inner (
        name,
        location
      )
    `
    )
    .eq(
      searchParams.warehouse ? 'warehouse_id' : '',
      searchParams.warehouse || ''
    )
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error('Failed to load inventory')
  }

  // Pass to Client Component only if interactivity needed
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Inventory Management</h1>
      <InventoryTable initialData={inventory} />
    </div>
  )
}
```

#### Client Component with Realtime

```tsx
'use client'

import { useEffect, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'

interface InventoryTableProps {
  initialData: InventoryWithRelations[]
}

export function InventoryTable({ initialData }: InventoryTableProps) {
  const [inventory, setInventory] = useState(initialData)
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to realtime changes
    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          // RLS automatically filters by user's org
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setInventory((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? { ...item, ...payload.new } : item
              )
            )
          }
          // Invalidate React Query cache
          queryClient.invalidateQueries({ queryKey: ['inventory'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return <div className="rounded-md border">{/* Table implementation */}</div>
}
```

#### Server Actions Pattern

```typescript
// app/actions/inventory.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

// Input validation schema
const updateInventorySchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(0).max(999999),
  reason: z.enum(['sale', 'return', 'adjustment', 'transfer', 'damage']),
  notes: z.string().optional(),
})

export async function updateInventory(formData: FormData) {
  const supabase = createServerClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  try {
    // Validate input
    const validatedData = updateInventorySchema.parse({
      id: formData.get('id'),
      quantity: parseInt(formData.get('quantity') as string),
      reason: formData.get('reason'),
      notes: formData.get('notes'),
    })

    // Start transaction
    const { data: oldInventory } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('id', validatedData.id)
      .single()

    if (!oldInventory) {
      throw new Error('Inventory item not found')
    }

    // Update inventory (RLS ensures org isolation)
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        quantity: validatedData.quantity,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', validatedData.id)

    if (updateError) throw updateError

    // Log the change
    const { error: logError } = await supabase.from('inventory_logs').insert({
      inventory_id: validatedData.id,
      previous_quantity: oldInventory.quantity,
      new_quantity: validatedData.quantity,
      reason: validatedData.reason,
      notes: validatedData.notes,
      user_id: user.id,
    })

    if (logError) throw logError

    // Trigger sync to external systems
    await supabase.functions.invoke('sync-inventory-change', {
      body: { inventoryId: validatedData.id },
    })

    // Revalidate the inventory page
    revalidatePath('/inventory')

    return { success: true }
  } catch (error) {
    console.error('Inventory update failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
    }
  }
}
```

#### Database Schema with RLS

```sql
-- Organizations table (multi-tenancy root)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own organization
CREATE POLICY "Users see own org" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id
      FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Products table with org isolation
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_sku_per_org UNIQUE(organization_id, sku)
);

-- Index for performance
CREATE INDEX idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX idx_products_search ON products
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- RLS for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access products" ON products
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id
      FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );
```

## ❌ Anti-Patterns to Avoid

### Never Do This:

```typescript
// ❌ Client-side data fetching in Server Components
export default function Page() {
  useEffect(() => {
    fetch('/api/data') // WRONG! Use server-side fetching
  }, [])
}

// ❌ Using service role key in browser
const supabase = createClient(
  url,
  SERVICE_ROLE_KEY // NEVER expose this!
)

// ❌ Forgetting RLS on tables
CREATE TABLE sensitive_data (
  id UUID PRIMARY KEY
  -- No RLS = security vulnerability!
);

// ❌ Not validating user input
export async function updateData(data: any) { // any type = bad!
  await supabase.from('table').update(data) // No validation!
}

// ❌ Synchronous external API calls
export default async function Page() {
  const inventory = await fetchNetSuiteInventory() // Blocks rendering!
  return <div>{inventory}</div>
}

// ❌ Not handling errors properly
const { data } = await supabase.from('products').select()
// What if there's an error?

// ❌ Forgetting to revalidate after mutations
await supabase.from('products').update(...)
// Page shows stale data!
```

## 📊 Business Context

### Customer Personas

1. **IT Director "Tom"**: Wants reliability, security, clear documentation
2. **E-commerce Manager "Sarah"**: Wants real-time accuracy, easy UI
3. **Operations Manager "Mike"**: Wants inventory visibility, audit trails

### Pricing Tiers (per month)

- **Starter**: $499 - up to 5,000 SKUs
- **Professional**: $1,499 - up to 50,000 SKUs (most popular)
- **Enterprise**: $3,999+ - unlimited SKUs, custom features

### Key Metrics We Track

- **Order Error Rate**: Must be <1% (from 33%)
- **Sync Latency**: Must be <30 seconds
- **Data Accuracy**: Must be 99.9%
- **System Uptime**: Must be 99.9%

## 🔧 Common Tasks

### Adding a New Feature

1. **Plan the database schema**

   ```sql
   -- Create migration: pnpm supabase migration new feature_name
   CREATE TABLE feature_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID REFERENCES organizations(id),
     -- fields
   );

   ALTER TABLE feature_table ENABLE ROW LEVEL SECURITY;
   ```

2. **Generate TypeScript types**

   ```bash
   pnpm db:generate-types
   ```

3. **Create Server Component for display**

   ```tsx
   // app/(dashboard)/feature/page.tsx
   export default async function FeaturePage() {
     const supabase = createServerClient()
     const { data } = await supabase.from('feature_table').select()
     return <FeatureList data={data} />
   }
   ```

4. **Add Server Actions for mutations**

   ```tsx
   // app/actions/feature.ts
   'use server'
   export async function createFeature(formData: FormData) {
     // Validate, insert, revalidate
   }
   ```

5. **Add tests**
   ```tsx
   // tests/e2e/feature.spec.ts
   test('creates new feature', async ({ page }) => {
     // Test implementation
   })
   ```

### Debugging Common Issues

**"RLS policy violation"**

- Check user's organization_id
- Verify RLS policies on the table
- Use Supabase Dashboard SQL editor to test

**"Hydration mismatch"**

- Check for client-only code in Server Components
- Ensure consistent rendering between server/client
- Look for date/time formatting issues

**"Type error after schema change"**

- Run `pnpm db:generate-types`
- Restart TypeScript server in VS Code
- Check for nullable fields

**"Supabase auth error"**

- Check auth session in browser DevTools
- Verify environment variables
- Check redirect URLs in Supabase Dashboard

## 📚 Key Documentation

**Start Here**:

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [Supabase Integration Guide](../docs/technical/supabase-integration-guide.md)
- [README.md](../README.md) - Project overview

**For Specific Tasks**:

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

## 🚨 Critical Rules

1. **Always use Server Components by default** - Better performance
2. **Always enable RLS on tables** - Security requirement
3. **Always validate input with Zod** - Type safety at runtime
4. **Always handle auth state** - Check user before mutations
5. **Always revalidate after mutations** - Keep UI in sync
6. **Never expose service role key** - Use it only in Edge Functions
7. **Never trust user input** - Validate everything
8. **Never skip error handling** - Users need feedback

## 💡 Decision Log

### Why Next.js App Router?

- Server Components = better performance
- Built-in data fetching patterns
- Streaming and Suspense support
- Great developer experience

### Why Supabase?

- PostgreSQL with automatic APIs
- Built-in auth and RLS
- Real-time subscriptions
- Scales automatically
- Open source

### Why Tailwind + shadcn/ui?

- Consistent design system
- Accessible components
- Easy customization
- Small bundle size

### Why Server Actions?

- Progressive enhancement
- Type-safe mutations
- No API routes needed
- Built-in CSRF protection

## 🔍 Performance Tips

### Database Queries

```typescript
// ❌ Bad: N+1 queries
const products = await supabase.from('products').select()
for (const product of products.data) {
  const inventory = await supabase
    .from('inventory')
    .select()
    .eq('product_id', product.id)
}

// ✅ Good: Single query with joins
const { data } = await supabase.from('products').select(`
    *,
    inventory (
      quantity,
      warehouse_id
    )
  `)
```

### Component Optimization

```tsx
// ✅ Split interactive parts into Client Components
// Server Component
export default async function ProductPage() {
  const products = await fetchProducts()
  return (
    <>
      <ProductList products={products} />
      <AddProductButton /> {/* Client Component */}
    </>
  )
}
```

### Image Optimization

```tsx
import Image from 'next/image'

// ✅ Always use Next.js Image component

;<Image
  src={product.image}
  alt={product.name}
  width={200}
  height={200}
  className="rounded-lg"
/>
```

## 📞 Getting Help

- **Next.js questions**: Check App Router docs first
- **Supabase questions**: Check Supabase docs and Discord
- **Business logic**: Refer to PRD
- **UI components**: Check shadcn/ui docs
- **Urgent issues**: Post in #help channel

---

Remember: You're building a system that handles critical B2B data. Every order error costs real money. Prioritize accuracy, security (RLS!), and user experience. Server Components by default, Client Components when needed.
