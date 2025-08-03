import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/audit',
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log during tests
  log: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
}

// Mock date to ensure consistent test results
const mockDate = new Date('2024-01-15T10:00:00Z')
jest.useFakeTimers()
jest.setSystemTime(mockDate)

// Cleanup function to reset state between tests
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

// Global test timeout
jest.setTimeout(30000)

// Audit trail specific test utilities
global.auditTestUtils = {
  createMockAuditLog: (overrides = {}) => ({
    id: 'test-log-id',
    organization_id: 'test-org',
    user_id: 'test-user',
    user_email: 'test@example.com',
    user_role: 'admin',
    action: 'create',
    entity_type: 'product',
    entity_id: 'test-entity',
    entity_name: 'Test Entity',
    old_values: null,
    new_values: { name: 'Test Entity', status: 'active' },
    metadata: { source: 'test' },
    ip_address: '127.0.0.1',
    user_agent: 'Jest Test Runner',
    created_at: mockDate.toISOString(),
    ...overrides,
  }),

  createMockUser: (overrides = {}) => ({
    id: 'test-user',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User' },
    ...overrides,
  }),

  createMockSupabaseClient: () => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          limit: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn(),
          })),
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(),
            })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
      upsert: jest.fn(),
    })),
    rpc: jest.fn(),
  }),
}

// Declare global types for TypeScript
declare global {
  var auditTestUtils: {
    createMockAuditLog: (overrides?: any) => any
    createMockUser: (overrides?: any) => any
    createMockSupabaseClient: () => any
  }
}
