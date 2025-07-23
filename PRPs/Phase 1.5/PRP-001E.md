# PRP-015: Strict Type Safety Implementation

## Overview
This PRP addresses the widespread type safety issues throughout the TruthSource application by implementing strict TypeScript configurations and eliminating all implicit `any` types. The goal is to achieve complete type safety across the codebase, improving developer experience, reducing runtime errors, and ensuring code maintainability.

## Goals
- Enable strict TypeScript configuration
- Eliminate all implicit and explicit `any` types
- Implement proper type definitions for all external data sources
- Ensure complete type coverage for Supabase operations
- Fix all existing type errors in the codebase
- Establish type safety best practices and guidelines

## Technical Implementation

### 1. TypeScript Configuration Updates

#### Update tsconfig.json
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

### 2. Supabase Type Definitions

#### Generate and maintain database types
```bash
# Generate types from Supabase
pnpm supabase gen types typescript --local > supabase/types/database.ts
```

#### Create typed Supabase clients
```typescript
// lib/supabase/typed-client.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/supabase/types/database'

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseConfigError'
  }
}

// Option 1: Throw early with clear error messages
export const createTypedClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new SupabaseConfigError(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.'
    )
  }

  if (!anonKey) {
    throw new SupabaseConfigError(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.'
    )
  }

  return createClient<Database>(url, anonKey)
}

// Option 2: Accept parameters with defaults
export const createTypedClientWithParams = (
  url?: string,
  anonKey?: string
) => {
  const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new SupabaseConfigError(
      'Supabase URL and anon key are required. Provide them as parameters or set environment variables.'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Option 3: Return null for graceful handling
export const createTypedClientSafe = (): ReturnType<typeof createClient<Database>> | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error(
      'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
    return null
  }

  return createClient<Database>(url, anonKey)
}
```

### 3. Common Type Definitions

#### Create shared types for real-time events
```typescript
// types/realtime.types.ts
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type RealtimeChangePayload<T> = RealtimePostgresChangesPayload<T>

export type RealtimeEventHandler<T> = (
  payload: RealtimeChangePayload<T>
) => void | Promise<void>

export interface RealtimeChannelConfig<T> {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  filter?: string
  handler: RealtimeEventHandler<T>
}
```

#### Create auth event types
```typescript
// types/auth.types.ts
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

export type AuthChangeHandler = (
  event: AuthChangeEvent,
  session: Session | null
) => void | Promise<void>

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: Error | null
}
```

### 4. Component Type Safety

#### Form component types
```typescript
// types/form.types.ts
import { FieldError, Path, UseFormRegister } from 'react-hook-form'

export interface FormFieldProps<TFieldValues> {
  name: Path<TFieldValues>
  register: UseFormRegister<TFieldValues>
  error?: FieldError
  label: string
  required?: boolean
}

export interface FormState<T> {
  data: T
  errors: Record<string, string>
  isSubmitting: boolean
  isValid: boolean
}
```

#### Table component types
```typescript
// types/table.types.ts
export interface Column<T> {
  id: keyof T | string
  header: string
  accessor: (row: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
}

export interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
}
```

### 5. Hook Type Safety

#### Typed query hooks
```typescript
// hooks/use-typed-query.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { PostgrestError } from '@supabase/supabase-js'

export function useTypedQuery<TData, TError = PostgrestError>(
  key: unknown[],
  fn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TData, TError>({
    queryKey: key,
    queryFn: fn,
    ...options
  })
}
```

### 6. API Response Types

#### Create standardized API response types
```typescript
// types/api.types.ts
export interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
  count?: number
}

export interface ApiError {
  message: string
  code: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
```

### 7. Type Guards and Utilities

#### Create type guard utilities
```typescript
// lib/type-guards.ts
export function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function hasProperty<T, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return obj != null && prop in obj
}
```

### 8. Fix Existing Type Errors

#### Common patterns to fix:

1. **Replace implicit any in event handlers**
```typescript
// Before
onAuthStateChange((event, session) => {})

// After
onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {})
```

2. **Type array methods properly**
```typescript
// Before
data.filter(item => item.active)

// After
data.filter((item: Product): boolean => item.active)
```

3. **Type async functions**
```typescript
// Before
async function fetchData() { }

// After
async function fetchData(): Promise<Product[]> { }
```

4. **Type component props**
```typescript
// Before
export function MyComponent({ data, onUpdate }) { }

// After
interface MyComponentProps {
  data: Product[]
  onUpdate: (id: string, updates: Partial<Product>) => void
}

export function MyComponent({ data, onUpdate }: MyComponentProps) { }
```

### 9. Testing Type Safety

#### Create type-safe test utilities
```typescript
// test-utils/typed-render.tsx
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers>{children}</Providers>
    ),
    ...options
  })
}
```

### 10. Documentation and Guidelines

#### Type safety guidelines:
- Never use `any` - use `unknown` if type is truly unknown
- Always type function parameters and return values
- Use generic types for reusable components/hooks
- Prefer interfaces over type aliases for object shapes
- Use const assertions for literal types
- Document complex types with JSDoc comments

## Implementation Steps

### Phase 1: Configuration (Day 1)
1. Update tsconfig.json with strict settings
2. Set up pre-commit hooks for type checking
3. Configure ESLint rules for TypeScript

### Phase 2: Core Types (Days 2-3)
1. Generate and update Supabase types
2. Create shared type definitions
3. Implement type guards and utilities

### Phase 3: Fix Existing Errors (Days 4-7)
1. Fix type errors in hooks (use-*.ts files)
2. Fix type errors in components
3. Fix type errors in API routes and server actions
4. Fix type errors in utility functions

### Phase 4: Testing and Documentation (Day 8)
1. Add type tests for critical functions
2. Document type patterns and guidelines
3. Set up CI/CD type checking

## Success Criteria
- Zero TypeScript errors with strict mode enabled
- 100% of files have explicit types (no implicit any)
- All Supabase queries are fully typed
- All event handlers have proper types
- Type checking passes in CI/CD pipeline
- Developer productivity improved with better IDE support

## Error Handling
- Use discriminated unions for error states
- Implement proper error boundaries with typed errors
- Create typed error classes for different error scenarios

## Performance Considerations
- Type checking should not impact runtime performance
- Use type-only imports where possible
- Lazy load type definitions for large schemas

## Security Benefits
- Prevent type confusion vulnerabilities
- Ensure proper validation through types
- Reduce attack surface with strict null checks

## Dependencies
- TypeScript 5.x
- @types/* packages for all dependencies
- Latest Supabase client with TypeScript support

## Validation
- Run `npm run type-check` with zero errors
- All PRs must pass type checking
- Regular type coverage reports
- No `@ts-ignore` or `@ts-expect-error` comments without justification

This PRP ensures the TruthSource application maintains the highest standards of type safety, reducing bugs, improving developer experience, and ensuring long-term maintainability.