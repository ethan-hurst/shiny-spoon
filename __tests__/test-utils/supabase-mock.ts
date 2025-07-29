import type { SupabaseClient, PostgrestQueryBuilder, PostgrestResponse } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types/database'

type Tables = Database['public']['Tables']
type TableName = keyof Tables

// Properly typed mock query builder
export interface MockQueryBuilder<T> {
  select: jest.Mock<MockQueryBuilder<T>>
  insert: jest.Mock<MockQueryBuilder<T>>
  update: jest.Mock<MockQueryBuilder<T>>
  delete: jest.Mock<MockQueryBuilder<T>>
  upsert: jest.Mock<MockQueryBuilder<T>>
  eq: jest.Mock<MockQueryBuilder<T>>
  neq: jest.Mock<MockQueryBuilder<T>>
  gt: jest.Mock<MockQueryBuilder<T>>
  gte: jest.Mock<MockQueryBuilder<T>>
  lt: jest.Mock<MockQueryBuilder<T>>
  lte: jest.Mock<MockQueryBuilder<T>>
  like: jest.Mock<MockQueryBuilder<T>>
  ilike: jest.Mock<MockQueryBuilder<T>>
  is: jest.Mock<MockQueryBuilder<T>>
  in: jest.Mock<MockQueryBuilder<T>>
  contains: jest.Mock<MockQueryBuilder<T>>
  containedBy: jest.Mock<MockQueryBuilder<T>>
  range: jest.Mock<MockQueryBuilder<T>>
  overlaps: jest.Mock<MockQueryBuilder<T>>
  match: jest.Mock<MockQueryBuilder<T>>
  not: jest.Mock<MockQueryBuilder<T>>
  or: jest.Mock<MockQueryBuilder<T>>
  filter: jest.Mock<MockQueryBuilder<T>>
  single: jest.Mock<Promise<PostgrestResponse<T>>>
  maybeSingle: jest.Mock<Promise<PostgrestResponse<T | null>>>
  limit: jest.Mock<MockQueryBuilder<T>>
  order: jest.Mock<MockQueryBuilder<T>>
}

// Type-safe mock Supabase client
export interface MockSupabaseClient {
  from: <T extends TableName>(
    table: T
  ) => MockQueryBuilder<Tables[T]['Row']>
  rpc: jest.Mock<Promise<PostgrestResponse<any>>>
  auth: {
    getUser: jest.Mock<Promise<{
      data: { user: Database['public']['Tables']['user_profiles']['Row'] | null }
      error: Error | null
    }>>
    signOut: jest.Mock<Promise<{ error: Error | null }>>
  }
}

export function createMockSupabaseClient(): MockSupabaseClient {
  function createMockQueryBuilder<T>(): MockQueryBuilder<T> {
    const builder: MockQueryBuilder<T> = {
      select: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      upsert: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      neq: jest.fn(() => builder),
      gt: jest.fn(() => builder),
      gte: jest.fn(() => builder),
      lt: jest.fn(() => builder),
      lte: jest.fn(() => builder),
      like: jest.fn(() => builder),
      ilike: jest.fn(() => builder),
      is: jest.fn(() => builder),
      in: jest.fn(() => builder),
      contains: jest.fn(() => builder),
      containedBy: jest.fn(() => builder),
      range: jest.fn(() => builder),
      overlaps: jest.fn(() => builder),
      match: jest.fn(() => builder),
      not: jest.fn(() => builder),
      or: jest.fn(() => builder),
      filter: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      limit: jest.fn(() => builder),
      order: jest.fn(() => builder),
    }
    return builder
  }

  const mockClient: MockSupabaseClient = {
    from: jest.fn((table) => createMockQueryBuilder()),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: jest.fn(() => 
        Promise.resolve({
          data: { 
            user: { 
              user_id: 'test-user-id',
              organization_id: 'test-org-id',
              email: 'test@example.com',
              role: 'admin' as const,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } 
          }, 
          error: null 
        })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
  }
  
  return mockClient
}

// Type-safe response factory
export function mockSupabaseResponse<T>(
  data: T,
  error: null
): PostgrestResponse<T>
export function mockSupabaseResponse<T>(
  data: null,
  error: Error
): PostgrestResponse<T>
export function mockSupabaseResponse<T>(
  data: T | null,
  error: Error | null
): PostgrestResponse<T> {
  return { 
    data: data as T, 
    error,
    count: null,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK'
  }
}

// Type-safe test data factories
export function createTestUser(overrides?: Partial<Database['public']['Tables']['user_profiles']['Row']>): Database['public']['Tables']['user_profiles']['Row'] {
  return {
    user_id: 'test-user-id',
    organization_id: 'test-org-id',
    email: 'test@example.com',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

export function createTestOrganization(overrides?: Partial<Database['public']['Tables']['organizations']['Row']>): Database['public']['Tables']['organizations']['Row'] {
  return {
    id: 'test-org-id',
    name: 'Test Organization',
    plan: 'enterprise',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

export function createTestProduct(overrides?: Partial<Database['public']['Tables']['products']['Row']>): Database['public']['Tables']['products']['Row'] {
  return {
    id: 'test-product-id',
    organization_id: 'test-org-id',
    sku: 'TEST-SKU-001',
    name: 'Test Product',
    description: 'Test product description',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}