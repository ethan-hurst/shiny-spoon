import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

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
  usePathname: () => '/dashboard',
}))

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
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
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
    })),
  }),
}))

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
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
}))

// Mock server actions
jest.mock('@/app/actions/auth', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  resetPassword: jest.fn(),
}))

jest.mock('@/app/actions/inventory', () => ({
  createInventoryItem: jest.fn(),
  updateInventoryItem: jest.fn(),
  deleteInventoryItem: jest.fn(),
  bulkUpdateInventory: jest.fn(),
}))

jest.mock('@/app/actions/orders', () => ({
  createOrder: jest.fn(),
  updateOrder: jest.fn(),
  deleteOrder: jest.fn(),
}))

jest.mock('@/app/actions/customers', () => ({
  createCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  deleteCustomer: jest.fn(),
}))

jest.mock('@/app/actions/products', () => ({
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
}))

jest.mock('@/app/actions/pricing', () => ({
  createPricingRule: jest.fn(),
  updatePricingRule: jest.fn(),
  deletePricingRule: jest.fn(),
}))

jest.mock('@/app/actions/analytics', () => ({
  getAnalyticsData: jest.fn(),
  getAccuracyMetrics: jest.fn(),
  getSyncStatus: jest.fn(),
}))

jest.mock('@/app/actions/audit', () => ({
  getAuditLogs: jest.fn(),
  createAuditLog: jest.fn(),
}))

jest.mock('@/app/actions/monitoring', () => ({
  getMonitoringData: jest.fn(),
  getAlertHistory: jest.fn(),
}))

jest.mock('@/app/actions/integrations', () => ({
  testConnection: jest.fn(),
  syncData: jest.fn(),
  getConnectionStatus: jest.fn(),
}))

jest.mock('@/app/actions/bulk-operations', () => ({
  bulkImport: jest.fn(),
  bulkExport: jest.fn(),
  validateBulkData: jest.fn(),
}))

jest.mock('@/app/actions/warehouses', () => ({
  createWarehouse: jest.fn(),
  updateWarehouse: jest.fn(),
  deleteWarehouse: jest.fn(),
}))

jest.mock('@/app/actions/reports', () => ({
  generateReport: jest.fn(),
  getReportHistory: jest.fn(),
}))

jest.mock('@/app/actions/settings', () => ({
  updateSettings: jest.fn(),
  getSettings: jest.fn(),
}))

jest.mock('@/app/actions/sync-engine', () => ({
  startSync: jest.fn(),
  stopSync: jest.fn(),
  getSyncProgress: jest.fn(),
}))

jest.mock('@/app/actions/insights', () => ({
  getInsights: jest.fn(),
  generateInsight: jest.fn(),
}))

jest.mock('@/app/actions/ai-insights', () => ({
  analyzeData: jest.fn(),
  generateRecommendations: jest.fn(),
}))

jest.mock('@/app/actions/advanced-analytics', () => ({
  getAdvancedMetrics: jest.fn(),
  generateCustomReport: jest.fn(),
}))

jest.mock('@/app/actions/billing', () => ({
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  getSubscription: jest.fn(),
}))

jest.mock('@/app/actions/notifications', () => ({
  sendNotification: jest.fn(),
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
}))

jest.mock('@/app/actions/team', () => ({
  inviteTeamMember: jest.fn(),
  updateTeamMember: jest.fn(),
  removeTeamMember: jest.fn(),
}))

jest.mock('@/app/actions/api-keys', () => ({
  createApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
  getApiKeys: jest.fn(),
}))

jest.mock('@/app/actions/webhooks', () => ({
  createWebhook: jest.fn(),
  updateWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
}))

jest.mock('@/app/actions/backup', () => ({
  createBackup: jest.fn(),
  restoreBackup: jest.fn(),
  getBackupHistory: jest.fn(),
}))

jest.mock('@/app/actions/security', () => ({
  enable2FA: jest.fn(),
  disable2FA: jest.fn(),
  getSecurityLogs: jest.fn(),
}))

jest.mock('@/app/actions/compliance', () => ({
  getComplianceReport: jest.fn(),
  validateCompliance: jest.fn(),
}))

jest.mock('@/app/actions/performance', () => ({
  getPerformanceMetrics: jest.fn(),
  optimizePerformance: jest.fn(),
}))

jest.mock('@/app/actions/health', () => ({
  getHealthStatus: jest.fn(),
  runHealthCheck: jest.fn(),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      mutations: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const user = userEvent.setup()
  return {
    user,
    ...render(ui, { wrapper: AllTheProviders, ...options }),
  }
}

// Mock data factories
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
  },
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
}

export const mockOrganization = {
  id: 'test-org-id',
  name: 'Test Organization',
  slug: 'test-org',
  plan: 'pro',
  settings: {
    timezone: 'UTC',
    currency: 'USD',
    language: 'en',
  },
}

export const mockInventoryItem = {
  id: 'test-inventory-id',
  organization_id: 'test-org-id',
  product_id: 'test-product-id',
  warehouse_id: 'test-warehouse-id',
  sku: 'TEST-SKU-001',
  quantity: 100,
  reserved_quantity: 10,
  available_quantity: 90,
  reorder_point: 20,
  max_stock: 200,
  unit_cost: 25.50,
  last_updated: '2024-01-15T10:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

export const mockProduct = {
  id: 'test-product-id',
  organization_id: 'test-org-id',
  name: 'Test Product',
  description: 'A test product for testing',
  sku: 'TEST-SKU-001',
  category: 'Electronics',
  brand: 'Test Brand',
  weight: 1.5,
  dimensions: '10x5x2',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

export const mockOrder = {
  id: 'test-order-id',
  organization_id: 'test-org-id',
  customer_id: 'test-customer-id',
  order_number: 'ORD-001',
  status: 'pending',
  total_amount: 150.00,
  currency: 'USD',
  items: [
    {
      product_id: 'test-product-id',
      quantity: 2,
      unit_price: 75.00,
      total_price: 150.00,
    },
  ],
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

export const mockCustomer = {
  id: 'test-customer-id',
  organization_id: 'test-org-id',
  name: 'Test Customer',
  email: 'customer@example.com',
  phone: '+1234567890',
  address: {
    street: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zip: '12345',
    country: 'US',
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

export const mockPricingRule = {
  id: 'test-pricing-rule-id',
  organization_id: 'test-org-id',
  name: 'Test Pricing Rule',
  type: 'percentage',
  value: 10,
  conditions: {
    customer_group: 'wholesale',
    min_quantity: 10,
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

export const mockWarehouse = {
  id: 'test-warehouse-id',
  organization_id: 'test-org-id',
  name: 'Test Warehouse',
  address: {
    street: '456 Warehouse St',
    city: 'Warehouse City',
    state: 'WS',
    zip: '67890',
    country: 'US',
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

export const mockAuditLog = {
  id: 'test-audit-log-id',
  organization_id: 'test-org-id',
  user_id: 'test-user-id',
  user_email: 'test@example.com',
  user_role: 'admin',
  action: 'create',
  entity_type: 'product',
  entity_id: 'test-product-id',
  entity_name: 'Test Product',
  old_values: null,
  new_values: { name: 'Test Product', status: 'active' },
  metadata: { source: 'test' },
  ip_address: '127.0.0.1',
  user_agent: 'Jest Test Runner',
  created_at: '2024-01-15T10:00:00Z',
}

export const mockAnalyticsData = {
  total_orders: 150,
  total_revenue: 15000.00,
  average_order_value: 100.00,
  accuracy_rate: 99.5,
  sync_status: 'healthy',
  last_sync: '2024-01-15T10:00:00Z',
}

export const mockMonitoringData = {
  system_status: 'healthy',
  api_response_time: 150,
  error_rate: 0.1,
  active_connections: 25,
  last_check: '2024-01-15T10:00:00Z',
}

// Helper functions
export const waitForLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 0))

export const mockServerAction = (actionName: string, returnValue: any) => {
  const mock = jest.fn().mockResolvedValue(returnValue)
  // This would need to be implemented based on your actual server action structure
  return mock
}

export const createMockSupabaseClient = () => ({
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signIn: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(),
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
  channel: jest.fn(() => ({
    on: jest.fn(() => ({
      subscribe: jest.fn(),
    })),
  })),
})

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }
export { userEvent }
