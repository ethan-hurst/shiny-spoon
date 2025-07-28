# PRP-018D: Fix TypeScript Type Safety Issues

## 🚀 Quick Start

```bash
# This PRP eliminates all 'any' types and improves type safety
# Automatic benefits:
✅ Full TypeScript strict mode compliance
✅ Runtime type validation with Zod schemas
✅ Generated types from Supabase schema
✅ Type-safe API calls and responses
✅ Elimination of all 'any' types
✅ Comprehensive interface definitions
```

## Goal

Eliminate all `any` types throughout the codebase and implement comprehensive TypeScript type safety, including proper interfaces, strict type checking, and runtime validation to prevent type-related bugs in production.

## Why This Matters

- **Runtime Safety**: `any` types bypass TypeScript checking, leading to runtime errors
- **Developer Experience**: Poor type safety makes refactoring dangerous and autocomplete unreliable
- **Bug Prevention**: Proper types catch errors at compile time instead of production
- **Code Quality**: Type safety indicates code maturity and maintainability
- **Team Productivity**: Well-typed code is easier to understand and modify

Our audit found multiple `any` types in critical areas:
- `types/netsuite.types.ts`: 6 instances
- `types/realtime.types.ts`: 3 instances  
- `types/integration.types.ts`: 6 instances
- `types/bulk-operations.types.ts`: 4 instances
- Various UI components with loose typing

## What We're Building

### Type Safety Improvements

#### 1. NetSuite Integration Types
- Replace `any` with proper NetSuite API interfaces
- Add runtime validation for external API responses
- Type-safe custom field definitions

#### 2. Real-time System Types
- Generic types for Supabase real-time events
- Proper payload typing for different event types
- Type-safe subscription handlers

#### 3. Integration Framework Types
- Strict typing for integration payloads
- Error type definitions with proper inheritance
- Event data interfaces

#### 4. Bulk Operations Types
- Type-safe record validation and processing
- Proper function signature typing
- Generic batch operation interfaces

#### 5. UI Component Types
- Replace loose object types with proper interfaces
- Add prop type definitions
- Type-safe event handlers

## Context & References

### Current Type Issues Found
- **NetSuite Types**: `/types/netsuite.types.ts:1,3,4,5,13,15` - Custom fields and API responses
- **Realtime Types**: `/types/realtime.types.ts:7,9,11` - Generic event handlers
- **Integration Types**: `/types/integration.types.ts:10,11,14,16,18,20` - Payloads and errors
- **Bulk Operations**: `/types/bulk-operations.types.ts:15,17,19,21` - Record processing
- **UI Components**: `/components/portal/usage/usage-breakdown.tsx:22` - Trend data

### TypeScript Configuration
- Current: Strict mode enabled in `tsconfig.json`
- Target: Zero tolerance for `any` types
- Validation: Runtime checks with Zod where needed

## Implementation Blueprint

### Phase 1: NetSuite Type Safety

#### 1.1 Custom Field Types
```typescript
// types/netsuite.types.ts (BEFORE)
export interface NetSuiteItem {
  [key: `custitem_${string}`]: any // ❌ any type
  id: string
  itemid: string
  displayname: string
}

// types/netsuite.types.ts (AFTER)
// Define known custom field types
export interface NetSuiteCustomFields {
  custitem_supplier_part_number?: string
  custitem_weight_lbs?: number
  custitem_hazmat_class?: 'A' | 'B' | 'C' | 'D'
  custitem_country_origin?: string
  custitem_purchase_price?: number
  custitem_reorder_point?: number
  custitem_abc_classification?: 'A' | 'B' | 'C'
}

// Generic custom field type for unknown fields
export type NetSuiteCustomFieldValue = string | number | boolean | null

export interface NetSuiteItem {
  // Standard NetSuite fields
  id: string
  itemid: string
  displayname: string
  description?: string
  
  // Known custom fields (typed)
  ...NetSuiteCustomFields
  
  // Unknown custom fields (still typed, not any)
  [key: `custitem_${string}`]: NetSuiteCustomFieldValue
}

// Runtime validation schema
export const netSuiteItemSchema = z.object({
  id: z.string(),
  itemid: z.string(),
  displayname: z.string(),
  description: z.string().optional(),
  // Custom fields validation
  custitem_supplier_part_number: z.string().optional(),
  custitem_weight_lbs: z.number().positive().optional(),
  custitem_hazmat_class: z.enum(['A', 'B', 'C', 'D']).optional(),
  // Allow additional custom fields
}).passthrough()

export type ValidatedNetSuiteItem = z.infer<typeof netSuiteItemSchema>
```

#### 1.2 API Response Types
```typescript
// types/netsuite.types.ts (BEFORE)
export interface NetSuiteFieldChange {
  field: string
  oldValue: any // ❌ any type
  newValue: any // ❌ any type
  timestamp: string
}

// types/netsuite.types.ts (AFTER)
export type NetSuiteFieldValue = 
  | string 
  | number 
  | boolean 
  | null 
  | Date
  | { id: string; name: string } // For record references

export interface NetSuiteFieldChange<T = NetSuiteFieldValue> {
  field: string
  oldValue: T | null
  newValue: T | null
  timestamp: string
  changedBy?: {
    id: string
    name: string
  }
}

// Specific field change types
export interface NetSuitePriceChange extends NetSuiteFieldChange<number> {
  field: 'price' | 'cost' | 'listprice'
  currency?: string
}

export interface NetSuiteStatusChange extends NetSuiteFieldChange<string> {
  field: 'status' | 'inactive'
  oldValue: 'active' | 'inactive' | null
  newValue: 'active' | 'inactive' | null
}

// Validation schemas
export const netSuiteFieldChangeSchema = z.object({
  field: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  timestamp: z.string().datetime(),
  changedBy: z.object({
    id: z.string(),
    name: z.string()
  }).optional()
})
```

#### 1.3 Type Guards and Validation
```typescript
// types/netsuite.types.ts
export function isNetSuiteItem(obj: unknown): obj is NetSuiteItem {
  try {
    netSuiteItemSchema.parse(obj)
    return true
  } catch {
    return false
  }
}

export function validateNetSuiteResponse<T>(
  data: unknown, 
  schema: z.ZodSchema<T>
): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new NetSuiteValidationError(
      'Invalid NetSuite response format',
      result.error.errors
    )
  }
  return result.data
}

// Enhanced error with validation details
export class NetSuiteValidationError extends Error {
  constructor(
    message: string,
    public validationErrors: z.ZodIssue[]
  ) {
    super(message)
    this.name = 'NetSuiteValidationError'
  }
}
```

### Phase 2: Real-time System Types

#### 2.1 Generic Event Types
```typescript
// types/realtime.types.ts (BEFORE)
export type RealtimeChangePayload<T extends { [key: string]: any }> = RealtimePostgresChangesPayload<T> // ❌ any type

// types/realtime.types.ts (AFTER)
// Base record interface that all database records must extend
export interface BaseRecord {
  id: string
  created_at: string
  updated_at: string
  organization_id?: string
}

// Specific payload types for different operations
export interface RealtimeInsertPayload<T extends BaseRecord> {
  eventType: 'INSERT'
  new: T
  old: null
  schema: string
  table: string
  commit_timestamp: string
}

export interface RealtimeUpdatePayload<T extends BaseRecord> {
  eventType: 'UPDATE'
  new: T
  old: Partial<T>
  schema: string
  table: string
  commit_timestamp: string
}

export interface RealtimeDeletePayload<T extends BaseRecord> {
  eventType: 'DELETE'
  new: null
  old: T
  schema: string
  table: string
  commit_timestamp: string
}

export type RealtimePayload<T extends BaseRecord> = 
  | RealtimeInsertPayload<T>
  | RealtimeUpdatePayload<T>
  | RealtimeDeletePayload<T>

// Type-safe event handler
export interface RealtimeEventHandler<T extends BaseRecord> {
  onInsert?: (payload: RealtimeInsertPayload<T>) => void | Promise<void>
  onUpdate?: (payload: RealtimeUpdatePayload<T>) => void | Promise<void>
  onDelete?: (payload: RealtimeDeletePayload<T>) => void | Promise<void>
}
```

#### 2.2 Table-Specific Types
```typescript
// types/realtime.types.ts
// Import your actual database types
import type { Database } from '@/types/database.types'

export type Product = Database['public']['Tables']['products']['Row']
export type Inventory = Database['public']['Tables']['inventory']['Row']
export type PricingRule = Database['public']['Tables']['pricing_rules']['Row']

// Specialized handlers for specific tables
export type ProductRealtimeHandler = RealtimeEventHandler<Product>
export type InventoryRealtimeHandler = RealtimeEventHandler<Inventory>
export type PricingRealtimeHandler = RealtimeEventHandler<PricingRule>

// Channel configuration with proper typing
export interface RealtimeChannelConfig<T extends BaseRecord> {
  table: string
  schema?: string
  filter?: string
  handler: RealtimeEventHandler<T>
}

// Example usage in React components
export function useRealtimeSubscription<T extends BaseRecord>(
  config: RealtimeChannelConfig<T>
) {
  // Implementation with proper type safety
}
```

### Phase 3: Integration Framework Types

#### 3.1 Integration Payload Types
```typescript
// types/integration.types.ts (BEFORE)
export interface IntegrationEvent {
  id: string
  type: string
  payload: any // ❌ any type
  timestamp: string
}

// types/integration.types.ts (AFTER)
// Base integration payload
export interface BaseIntegrationPayload {
  source: 'shopify' | 'netsuite' | 'manual' | 'api'
  timestamp: string
  version: string
}

// Specific payload types
export interface ProductSyncPayload extends BaseIntegrationPayload {
  type: 'product.sync'
  products: Array<{
    external_id: string
    sku: string
    name: string
    price?: number
    inventory_quantity?: number
    status: 'active' | 'inactive'
    metadata?: Record<string, string | number | boolean>
  }>
}

export interface InventoryUpdatePayload extends BaseIntegrationPayload {
  type: 'inventory.update'
  updates: Array<{
    sku: string
    warehouse_code?: string
    quantity: number
    location?: string
    reason?: string
  }>
}

export interface OrderSyncPayload extends BaseIntegrationPayload {
  type: 'order.sync'
  orders: Array<{
    external_id: string
    order_number: string
    customer_id?: string
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
    line_items: Array<{
      sku: string
      quantity: number
      price: number
    }>
    shipping_address?: {
      name: string
      address1: string
      address2?: string
      city: string
      state: string
      zip: string
      country: string
    }
  }>
}

// Union type for all payloads
export type IntegrationPayload = 
  | ProductSyncPayload 
  | InventoryUpdatePayload 
  | OrderSyncPayload

// Type-safe event interface
export interface IntegrationEvent<T extends IntegrationPayload = IntegrationPayload> {
  id: string
  type: T['type']
  payload: T
  timestamp: string
  processed: boolean
  error?: string
}

// Validation schemas
export const productSyncPayloadSchema = z.object({
  type: z.literal('product.sync'),
  source: z.enum(['shopify', 'netsuite', 'manual', 'api']),
  timestamp: z.string().datetime(),
  version: z.string(),
  products: z.array(z.object({
    external_id: z.string(),
    sku: z.string().min(1),
    name: z.string().min(1),
    price: z.number().positive().optional(),
    inventory_quantity: z.number().nonnegative().optional(),
    status: z.enum(['active', 'inactive']),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
  }))
})
```

#### 3.2 Error Type Hierarchy
```typescript
// types/integration.types.ts (BEFORE)
export class IntegrationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any // ❌ any type
  ) {
    super(message)
  }
}

// types/integration.types.ts (AFTER)
// Base error with proper typing
export interface ErrorDetails {
  field?: string
  value?: unknown
  expected?: string
  received?: string
  context?: Record<string, string | number | boolean>
}

export abstract class BaseIntegrationError extends Error {
  abstract readonly code: string
  abstract readonly category: 'validation' | 'network' | 'auth' | 'business' | 'system'
  
  constructor(
    message: string,
    public readonly details?: ErrorDetails,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

// Specific error types
export class ValidationError extends BaseIntegrationError {
  readonly code = 'VALIDATION_ERROR'
  readonly category = 'validation' as const
  
  constructor(message: string, details?: ErrorDetails) {
    super(message, details, false) // Validation errors are not retryable
  }
}

export class NetworkError extends BaseIntegrationError {
  readonly code = 'NETWORK_ERROR'
  readonly category = 'network' as const
  
  constructor(message: string, details?: ErrorDetails) {
    super(message, details, true) // Network errors are retryable
  }
}

export class AuthenticationError extends BaseIntegrationError {
  readonly code = 'AUTH_ERROR'
  readonly category = 'auth' as const
  
  constructor(message: string, details?: ErrorDetails) {
    super(message, details, false) // Auth errors are not retryable
  }
}

export class BusinessLogicError extends BaseIntegrationError {
  readonly code = 'BUSINESS_ERROR'
  readonly category = 'business' as const
  
  constructor(message: string, details?: ErrorDetails) {
    super(message, details, false) // Business logic errors are not retryable
  }
}

// Type guards
export function isRetryableError(error: unknown): error is BaseIntegrationError {
  return error instanceof BaseIntegrationError && error.retryable
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}
```

### Phase 4: Bulk Operations Types

#### 4.1 Record Processing Types
```typescript
// types/bulk-operations.types.ts (BEFORE)
export interface BulkOperationRecord {
  id: string
  status: 'pending' | 'processing' | 'success' | 'error'
  data: any // ❌ any type
  error?: string
  value?: any // ❌ any type
}

// types/bulk-operations.types.ts (AFTER)
// Generic record type with proper constraints
export interface BaseBulkRecord {
  id: string
  row_number: number
  validation_errors: string[]
  processing_errors: string[]
}

// Specific record types for different operations
export interface ProductBulkRecord extends BaseBulkRecord {
  operation_type: 'product'
  data: {
    sku: string
    name: string
    description?: string
    price?: number
    category?: string
    active: boolean
  }
  result?: {
    product_id: string
    created: boolean
    updated_fields: string[]
  }
}

export interface InventoryBulkRecord extends BaseBulkRecord {
  operation_type: 'inventory'
  data: {
    sku: string
    warehouse_code: string
    quantity: number
    reason: string
  }
  result?: {
    previous_quantity: number
    new_quantity: number
    adjustment_id: string
  }
}

export interface PricingBulkRecord extends BaseBulkRecord {
  operation_type: 'pricing'
  data: {
    sku: string
    customer_group?: string
    price: number
    effective_date: string
    expiry_date?: string
  }
  result?: {
    pricing_rule_id: string
    previous_price?: number
  }
}

// Union type for all bulk records
export type BulkOperationRecord = 
  | ProductBulkRecord 
  | InventoryBulkRecord 
  | PricingBulkRecord

// Processor interface with proper typing
export interface BulkOperationProcessor<T extends BulkOperationRecord> {
  validateRecord(record: Omit<T, 'id' | 'validation_errors' | 'processing_errors'>): Promise<string[]>
  processRecord(record: T, supabase: SupabaseClient): Promise<T>
  rollbackRecord?(record: T, supabase: SupabaseClient): Promise<void>
}

// Type-safe batch validation
export interface BatchValidationResult<T extends BulkOperationRecord> {
  valid_records: T[]
  invalid_records: T[]
  total_records: number
  validation_summary: {
    [K in T['operation_type']]: number
  }
}
```

#### 4.2 Operation Configuration Types
```typescript
// types/bulk-operations.types.ts
export interface BulkOperationConfig<T extends BulkOperationRecord> {
  operation_type: T['operation_type']
  batch_size: number
  max_concurrent: number
  validate_only: boolean
  rollback_on_error: boolean
  processor: BulkOperationProcessor<T>
  progress_callback?: (progress: BulkOperationProgress) => void
}

export interface BulkOperationProgress {
  operation_id: string
  total_records: number
  processed_records: number
  successful_records: number
  failed_records: number
  current_batch: number
  total_batches: number
  estimated_completion: string
  status: 'validating' | 'processing' | 'completed' | 'failed' | 'cancelled'
}

// Factory function with proper typing
export function createBulkOperation<T extends BulkOperationRecord>(
  config: BulkOperationConfig<T>
): BulkOperationEngine<T> {
  return new BulkOperationEngine<T>(config)
}
```

### Phase 5: UI Component Types

#### 5.1 Component Props and State
```typescript
// components/portal/usage/usage-breakdown.tsx (BEFORE)
const getMethodBadge = (endpoint: string) => {
  const method = endpoint.split(' ')[0]
  const variants: Record<string, any> = { // ❌ any type
    GET: 'secondary',
    POST: 'default',
    // ...
  }
}

// components/portal/usage/usage-breakdown.tsx (AFTER)
import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/ui/badge'

type BadgeVariant = VariantProps<typeof badgeVariants>['variant']

interface UsageBreakdownProps {
  topEndpoints: Array<{
    endpoint: string
    count: number
    change_percentage?: number
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  }>
  totalApiCalls: number
  timeframe: '24h' | '7d' | '30d'
  loading?: boolean
}

interface TrendData {
  percentage: number
  direction: 'up' | 'down' | 'neutral'
  period: string
}

export function UsageBreakdown({ 
  topEndpoints, 
  totalApiCalls, 
  timeframe,
  loading = false 
}: UsageBreakdownProps) {
  const getMethodBadge = (method: string): { variant: BadgeVariant; className?: string } => {
    const methodBadges: Record<string, { variant: BadgeVariant; className?: string }> = {
      GET: { variant: 'secondary' },
      POST: { variant: 'default' },
      PUT: { variant: 'outline' },
      DELETE: { variant: 'destructive' },
      PATCH: { variant: 'outline' },
    }
    
    return methodBadges[method] || { variant: 'outline' }
  }

  const getTrendData = (endpoint: (typeof topEndpoints)[0]): TrendData => {
    if (!endpoint.change_percentage) {
      return { percentage: 0, direction: 'neutral', period: timeframe }
    }
    
    return {
      percentage: Math.abs(endpoint.change_percentage),
      direction: endpoint.change_percentage > 0 ? 'up' : 'down',
      period: timeframe
    }
  }

  // ... rest of component with proper typing
}
```

### Implementation Strategy

#### 1. Automated Type Generation
```bash
# Generate fresh types from Supabase
npx supabase gen types typescript --local > types/database.types.ts

# Validate all TypeScript files
npx tsc --noEmit --strict

# Check for any remaining 'any' types
npx eslint . --ext .ts,.tsx --rule "@typescript-eslint/no-explicit-any: error"
```

#### 2. Runtime Validation Integration
```typescript
// lib/validation/runtime-validator.ts
export function createValidatedApiResponse<T>(
  schema: z.ZodSchema<T>
) {
  return (data: unknown): T => {
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new ValidationError(
        'Invalid API response format',
        {
          expected: schema.description || 'Valid data structure',
          received: typeof data,
          context: { errors: result.error.errors }
        }
      )
    }
    return result.data
  }
}

// Usage in API clients
const validateNetSuiteResponse = createValidatedApiResponse(netSuiteItemSchema)

async function fetchNetSuiteItems(): Promise<NetSuiteItem[]> {
  const response = await fetch('/api/netsuite/items')
  const data = await response.json()
  
  // Runtime validation ensures type safety
  return data.map(validateNetSuiteResponse)
}
```

#### 3. Migration Process
1. **Analysis**: Use TypeScript compiler to find all `any` usages
2. **Categorization**: Group by domain (NetSuite, Realtime, etc.)
3. **Schema Definition**: Create proper interfaces and validation
4. **Incremental Replacement**: Replace `any` types one by one
5. **Testing**: Ensure no runtime breakage
6. **Validation**: Confirm zero `any` types remain

## Validation

### Automated Checks
```bash
# TypeScript compilation with strict mode
npm run type-check

# ESLint rule to prevent 'any' types
npm run lint -- --rule "@typescript-eslint/no-explicit-any: error"

# Runtime validation tests
npm run test:validation

# Integration tests with new types
npm run test:integration
```

### Type Coverage Analysis
```bash
# Check type coverage percentage
npx type-coverage --strict --ignore-files "**/*.test.ts"

# Should achieve 100% type coverage
```

## Success Criteria

- [ ] Zero `any` types in the entire codebase
- [ ] 100% TypeScript strict mode compliance
- [ ] All external API responses have runtime validation
- [ ] Proper error type hierarchy implemented
- [ ] UI components fully typed with prop interfaces
- [ ] Integration payloads properly typed and validated
- [ ] Real-time events type-safe end-to-end
- [ ] Bulk operations fully generic and type-safe
- [ ] Type coverage reaches 100%
- [ ] All tests passing with new types

## Dependencies

- TypeScript 5.0+ with strict mode
- Zod for runtime validation
- Supabase CLI for type generation
- ESLint TypeScript rules

## Implementation Order

1. **NetSuite types** (1 day) - External API interfaces
2. **Integration framework** (1 day) - Payload and error types
3. **Real-time types** (1 day) - Event system typing
4. **Bulk operations** (1 day) - Generic record processing
5. **UI components** (1 day) - Component props and state
6. **Runtime validation** (1 day) - Validation integration
7. **Testing and validation** (1 day) - Ensure no regressions

Total: ~7 days for complete type safety

## Risk Mitigation

- **Breaking Changes**: Use type guards for gradual migration
- **Performance**: Runtime validation only in dev/test environments
- **Complexity**: Start with simple interfaces, add complexity gradually
- **Team Adoption**: Provide clear migration examples and documentation