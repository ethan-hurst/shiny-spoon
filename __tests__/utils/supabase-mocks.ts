import { jest } from '@jest/globals'

// Supabase mocks for testing
export function createMockQueryBuilder() {
  return {
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
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    then: jest.fn(),
    catch: jest.fn(),
  }
}

export function setupSupabaseMocks() {
  // Mock Supabase client
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
      signInWithPassword: jest.fn(),
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
        updateUser: jest.fn(),
      },
    },
    from: jest.fn(() => createMockQueryBuilder()),
    rpc: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  }

  return mockSupabase
}

export function createMockSupabaseResponse(data: any, error: any = null) {
  return {
    data,
    error,
  }
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
