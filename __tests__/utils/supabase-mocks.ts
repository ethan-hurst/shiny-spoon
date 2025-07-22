import { vi } from '@jest/globals'

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
        error: null,
      })
    ),
    getSession: vi.fn(() =>
      Promise.resolve({
        data: {
          session: {
            access_token: 'test-token',
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
        },
        error: null,
      })
    ),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
  rpc: vi.fn(),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
}

// Mock createClient functions
export const mockCreateClient = vi.fn(() => mockSupabaseClient)
export const mockCreateServerClient = vi.fn(() => mockSupabaseClient)
export const mockCreateBrowserClient = vi.fn(() => mockSupabaseClient)
export const mockCreateAdminClient = vi.fn(() => mockSupabaseClient)

// Helper to set up Supabase mocks
export const setupSupabaseMocks = () => {
  vi.mock('@/lib/supabase/client', () => ({
    createClient: mockCreateBrowserClient,
    createBrowserClient: mockCreateBrowserClient,
  }))

  vi.mock('@/lib/supabase/server', () => ({
    createClient: mockCreateServerClient,
    createServerClient: mockCreateServerClient,
  }))

  vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: mockCreateAdminClient,
  }))
}

// Helper to create a mock query builder
export const createMockQueryBuilder = (data: any = null, error: any = null) => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data, error })),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
    then: vi.fn((callback) => callback({ data, error })),
  }
  return queryBuilder
}

// Test data factories
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createTestOrganization = (overrides = {}) => ({
  id: 'test-org-id',
  name: 'Test Organization',
  slug: 'test-org',
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createTestProduct = (overrides = {}) => ({
  id: 'test-product-id',
  organization_id: 'test-org-id',
  sku: 'TEST-SKU-001',
  name: 'Test Product',
  active: true,
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createTestWarehouse = (overrides = {}) => ({
  id: 'test-warehouse-id',
  organization_id: 'test-org-id',
  name: 'Test Warehouse',
  code: 'TEST-WH',
  active: true,
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createTestInventory = (overrides = {}) => ({
  id: 'test-inventory-id',
  organization_id: 'test-org-id',
  product_id: 'test-product-id',
  warehouse_id: 'test-warehouse-id',
  quantity: 100,
  reserved_quantity: 0,
  created_at: new Date().toISOString(),
  ...overrides,
})
