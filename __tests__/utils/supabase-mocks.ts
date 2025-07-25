import { jest } from '@jest/globals'

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(() =>
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
    getSession: jest.fn(() =>
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
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
  })),
  rpc: jest.fn(),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  })),
  removeChannel: jest.fn(),
  functions: {
    invoke: jest.fn(),
  },
}

// Mock createClient functions
export const mockCreateClient = jest.fn(() => mockSupabaseClient)
export const mockCreateServerClient = jest.fn(() => mockSupabaseClient)
export const mockCreateBrowserClient = jest.fn(() => mockSupabaseClient)
export const mockCreateAdminClient = jest.fn(() => mockSupabaseClient)

// Helper to set up Supabase mocks
export const setupSupabaseMocks = () => {
  jest.mock('@/lib/supabase/client', () => ({
    createClient: mockCreateBrowserClient,
    createBrowserClient: mockCreateBrowserClient,
  }))

  jest.mock('@/lib/supabase/server', () => ({
    createClient: mockCreateServerClient,
    createServerClient: mockCreateServerClient,
  }))

  jest.mock('@/lib/supabase/admin', () => ({
    createAdminClient: mockCreateAdminClient,
  }))
}

// Helper to create a mock query builder
export const createMockQueryBuilder = (data: any = null, error: any = null) => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data, error })),
    maybeSingle: jest.fn(() => Promise.resolve({ data, error })),
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
