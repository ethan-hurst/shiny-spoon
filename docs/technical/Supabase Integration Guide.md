# TruthSource - Supabase Integration Guide

This document replaces the traditional API specification with Supabase-specific integration patterns, schemas, and usage examples for the TruthSource platform.

## Overview

TruthSource uses Supabase as its backend, providing:

- **Auto-generated REST APIs** from PostgreSQL schemas
- **GraphQL API** (if enabled)
- **Real-time subscriptions** for live data updates
- **Row Level Security (RLS)** for multi-tenant data isolation
- **Edge Functions** for complex business logic
- **Built-in Auth** with JWT tokens

## Authentication

### Supabase Auth Setup

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Sign Up Flow

```typescript
const supabase = createClient()

// Sign up with email/password
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      organization_name: 'Acme Corp',
      full_name: 'John Doe',
      role: 'admin',
    },
  },
})

// Email confirmation will be sent
```

### Sign In Flow

```typescript
// Email/Password
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
})

// OAuth (Google, Microsoft, etc.)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

### Session Management

```typescript
// Get current user
const {
  data: { user },
} = await supabase.auth.getUser()

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Handle sign in
  } else if (event === 'SIGNED_OUT') {
    // Handle sign out
  }
})
```

## Database Schema

### Core Tables

#### Organizations

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_tier TEXT DEFAULT 'starter',
  subscription_status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );
```

#### User Profiles

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());
```

#### Products

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  base_price DECIMAL(10,2),
  cost DECIMAL(10,2),
  weight DECIMAL(10,3),
  dimensions JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, sku)
);

-- Indexes
CREATE INDEX idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX idx_products_category ON products(organization_id, category);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view products" ON products
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );
```

#### Inventory

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER,
  reorder_quantity INTEGER,
  sync_status TEXT DEFAULT 'pending',
  last_sync_at TIMESTAMPTZ,
  external_id TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_inventory_org_product ON inventory(organization_id, product_id);
CREATE INDEX idx_inventory_sync_status ON inventory(sync_status)
  WHERE sync_status IN ('pending', 'error');
CREATE INDEX idx_inventory_low_stock ON inventory(organization_id, warehouse_id)
  WHERE quantity <= reorder_point;

-- RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can manage inventory" ON inventory
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );
```

#### Pricing Rules

```sql
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'tier', 'quantity', 'promotional')),
  priority INTEGER DEFAULT 0,
  conditions JSONB NOT NULL,
  adjustments JSONB NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example conditions JSON:
-- {
--   "customer_tier": "gold",
--   "min_quantity": 100,
--   "product_categories": ["electronics", "accessories"]
-- }

-- Example adjustments JSON:
-- {
--   "type": "percentage",
--   "value": -15,
--   "apply_to": "base_price"
-- }
```

### Real-time Subscriptions

#### Subscribe to Inventory Changes

```typescript
// In a Client Component
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function InventoryRealtime({ warehouseId }: { warehouseId: string }) {
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to specific warehouse inventory changes
    const channel = supabase
      .channel(`inventory:${warehouseId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'inventory',
          filter: `warehouse_id=eq.${warehouseId}`
        },
        (payload) => {
          console.log('Inventory changed:', payload)

          if (payload.eventType === 'UPDATE') {
            // Handle inventory update
            if (payload.new.quantity <= payload.new.reorder_point) {
              // Trigger low stock alert
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [warehouseId])

  return <div>Real-time inventory monitor active</div>
}
```

#### Subscribe to Sync Status

```typescript
const channel = supabase
  .channel('sync-status')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'sync_jobs',
      filter: 'status=eq.completed',
    },
    (payload) => {
      toast.success(`Sync completed for ${payload.new.entity_type}`)
    }
  )
  .subscribe()
```

## Edge Functions

### Inventory Sync Function

```typescript
// supabase/functions/sync-inventory/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SyncRequest {
  organizationId: string
  platform: 'netsuite' | 'shopify' | 'sap'
  warehouseId?: string
}

serve(async (req) => {
  try {
    const { organizationId, platform, warehouseId } =
      (await req.json()) as SyncRequest

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get integration credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('platform', platform)
      .single()

    if (!integration) {
      throw new Error('Integration not found')
    }

    // Fetch from external system
    const externalInventory = await fetchExternalInventory(
      platform,
      integration.credentials
    )

    // Bulk upsert inventory
    const { error } = await supabase.from('inventory').upsert(
      externalInventory.map((item) => ({
        organization_id: organizationId,
        external_id: item.id,
        product_id: item.productId,
        warehouse_id: warehouseId || item.warehouseId,
        quantity: item.quantity,
        platform,
        last_sync_at: new Date().toISOString(),
        sync_status: 'synced',
      })),
      { onConflict: 'organization_id,external_id,platform' }
    )

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, count: externalInventory.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### Price Calculation Function

```typescript
// supabase/functions/calculate-price/index.ts
serve(async (req) => {
  const { productId, customerId, quantity } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get base price
  const { data: product } = await supabase
    .from('products')
    .select('base_price')
    .eq('id', productId)
    .single()

  // Get applicable pricing rules
  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('active', true)
    .or(
      `conditions->customer_id.eq.${customerId},conditions->customer_id.is.null`
    )
    .order('priority', { ascending: false })

  let finalPrice = product.base_price

  // Apply pricing rules
  for (const rule of rules) {
    if (evaluateConditions(rule.conditions, { customerId, quantity })) {
      finalPrice = applyAdjustment(finalPrice, rule.adjustments)
    }
  }

  return new Response(
    JSON.stringify({
      productId,
      basePrice: product.base_price,
      finalPrice,
      appliedRules: rules.map((r) => r.name),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

## Client SDK Usage

### TypeScript Types Generation

```bash
# Generate types from your database schema
npx supabase gen types typescript --project-id your-project-id > lib/database.types.ts
```

### Typed Client

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### CRUD Operations

#### Fetch with Relations

```typescript
// Get inventory with product and warehouse details
const { data, error } = await supabase
  .from('inventory')
  .select(
    `
    *,
    product:products (
      sku,
      name,
      base_price
    ),
    warehouse:warehouses (
      name,
      location
    )
  `
  )
  .eq('quantity', 0) // Out of stock items
  .order('updated_at', { ascending: false })
  .limit(20)
```

#### Insert with Return

```typescript
const { data, error } = await supabase
  .from('products')
  .insert({
    organization_id: user.organizationId,
    sku: 'WIDGET-001',
    name: 'Premium Widget',
    base_price: 49.99,
    category: 'widgets',
  })
  .select()
  .single()
```

#### Update with Conditions

```typescript
const { data, error } = await supabase
  .from('inventory')
  .update({
    quantity: newQuantity,
    updated_at: new Date().toISOString(),
  })
  .eq('id', inventoryId)
  .eq('organization_id', user.organizationId) // Ensure org isolation
  .gte('quantity', quantityToDeduct) // Ensure sufficient stock
  .select()
  .single()

if (error?.code === 'PGRST116') {
  throw new Error('Insufficient inventory')
}
```

#### Batch Operations

```typescript
// Bulk update prices
const updates = products.map((product) => ({
  id: product.id,
  base_price: product.base_price * 1.1, // 10% increase
  updated_at: new Date().toISOString(),
}))

const { error } = await supabase.from('products').upsert(updates, {
  onConflict: 'id',
  ignoreDuplicates: false,
})
```

### RPC Functions

#### Complex Inventory Transfer

```sql
-- Create stored procedure
CREATE OR REPLACE FUNCTION transfer_inventory(
  p_from_warehouse UUID,
  p_to_warehouse UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_from_inventory inventory%ROWTYPE;
  v_result JSON;
BEGIN
  -- Lock the source inventory row
  SELECT * INTO v_from_inventory
  FROM inventory
  WHERE warehouse_id = p_from_warehouse
    AND product_id = p_product_id
  FOR UPDATE;

  -- Check sufficient quantity
  IF v_from_inventory.quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory';
  END IF;

  -- Deduct from source
  UPDATE inventory
  SET quantity = quantity - p_quantity
  WHERE id = v_from_inventory.id;

  -- Add to destination
  INSERT INTO inventory (
    organization_id, product_id, warehouse_id, quantity
  ) VALUES (
    v_from_inventory.organization_id, p_product_id, p_to_warehouse, p_quantity
  )
  ON CONFLICT (organization_id, product_id, warehouse_id)
  DO UPDATE SET quantity = inventory.quantity + p_quantity;

  -- Log the transfer
  INSERT INTO inventory_transfers (
    from_warehouse_id, to_warehouse_id, product_id, quantity, transferred_by
  ) VALUES (
    p_from_warehouse, p_to_warehouse, p_product_id, p_quantity, p_user_id
  );

  v_result := json_build_object(
    'success', true,
    'transferred', p_quantity
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Call RPC from Client

```typescript
const { data, error } = await supabase.rpc('transfer_inventory', {
  p_from_warehouse: fromId,
  p_to_warehouse: toId,
  p_product_id: productId,
  p_quantity: quantity,
  p_user_id: user.id,
})
```

## Error Handling

### Common Error Codes

```typescript
interface SupabaseError {
  code: string
  message: string
  details: string
  hint: string
}

// Handle specific errors
if (error) {
  switch (error.code) {
    case '23505': // Unique violation
      throw new Error('This SKU already exists')

    case '23503': // Foreign key violation
      throw new Error('Related record not found')

    case '23514': // Check violation
      throw new Error('Invalid data provided')

    case 'PGRST116': // No rows returned
      throw new Error('Record not found')

    case '42501': // Insufficient privilege (RLS)
      throw new Error('Access denied')

    default:
      console.error('Database error:', error)
      throw new Error('An unexpected error occurred')
  }
}
```

## Performance Optimization

### Indexes

```sql
-- Composite indexes for common queries
CREATE INDEX idx_inventory_low_stock
  ON inventory(organization_id, warehouse_id)
  WHERE quantity <= reorder_point;

CREATE INDEX idx_products_search
  ON products USING gin(
    to_tsvector('english', name || ' ' || coalesce(description, ''))
  );

CREATE INDEX idx_orders_date_range
  ON orders(organization_id, created_at)
  WHERE status != 'cancelled';
```

### Query Optimization

```typescript
// Bad - N+1 query problem
const products = await supabase.from('products').select('*')
for (const product of products.data) {
  const inventory = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', product.id)
}

// Good - Single query with join
const { data } = await supabase.from('products').select(`
    *,
    inventory (
      quantity,
      warehouse_id,
      warehouses (name)
    )
  `)
```

### Connection Pooling

```typescript
// For server-side operations, reuse clients
import { createServerClient } from '@/lib/supabase/server'

// This creates a new client for each request
// but Supabase handles connection pooling internally
export async function GET(request: Request) {
  const supabase = createServerClient()
  // Use supabase client
}
```

## Security Best Practices

### RLS Policy Examples

```sql
-- Multi-tenant isolation
CREATE POLICY "Tenant isolation" ON ALL TABLES
  FOR ALL USING (
    organization_id = current_setting('app.current_organization_id')::uuid
  );

-- Role-based access
CREATE POLICY "Admins can manage all products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND organization_id = products.organization_id
        AND role = 'admin'
    )
  );

-- Time-based access
CREATE POLICY "View active pricing only" ON pricing_rules
  FOR SELECT USING (
    active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW())
  );
```

### API Security Headers

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')

  return response
}
```

## Testing

### Test Helpers

```typescript
// tests/helpers/supabase.ts
import { createClient } from '@supabase/supabase-js'

export function createTestClient(userId?: string) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )

  if (userId) {
    // Mock authenticated user
    client.auth.getUser = async () => ({
      data: {
        user: {
          id: userId,
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
      },
      error: null,
    })
  }

  return client
}
```

### Integration Tests

```typescript
import { createTestClient } from '@/tests/helpers/supabase'

describe('Inventory Management', () => {
  it('should update inventory quantity', async () => {
    const supabase = createTestClient('test-user-id')

    const { data, error } = await supabase
      .from('inventory')
      .update({ quantity: 100 })
      .eq('id', 'test-inventory-id')
      .select()
      .single()

    expect(error).toBeNull()
    expect(data.quantity).toBe(100)
  })
})
```

## Migration Examples

### Create Migration

```bash
supabase migration new add_inventory_tracking
```

### Migration File

```sql
-- supabase/migrations/20240315_add_inventory_tracking.sql

-- Add tracking fields
ALTER TABLE inventory
ADD COLUMN tracked_at TIMESTAMPTZ,
ADD COLUMN tracked_by UUID REFERENCES auth.users(id),
ADD COLUMN tracking_notes TEXT;

-- Create tracking history table
CREATE TABLE inventory_tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  tracked_by UUID REFERENCES auth.users(id),
  tracked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for history queries
CREATE INDEX idx_tracking_history_inventory
  ON inventory_tracking_history(inventory_id, tracked_at DESC);

-- RLS for tracking history
ALTER TABLE inventory_tracking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracking history" ON inventory_tracking_history
  FOR SELECT USING (
    inventory_id IN (
      SELECT id FROM inventory
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles
        WHERE user_id = auth.uid()
      )
    )
  );
```

---

This guide covers the essential Supabase integration patterns for TruthSource. For more details, see the [Supabase documentation](https://supabase.com/docs).
