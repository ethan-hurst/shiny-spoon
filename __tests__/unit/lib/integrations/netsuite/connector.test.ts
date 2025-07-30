import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { NetSuiteConnector } from '@/lib/integrations/netsuite/connector'

// Mock the API client
const mockApiClient = {
  initialize: jest.fn(),
  testConnection: jest.fn(),
  executeSuiteQL: jest.fn(),
  getAllSuiteQLResults: jest.fn(),
  iterateSuiteQLResults: jest.fn(),
  getRecordMetadata: jest.fn(),
} as any

jest.mock('@/lib/integrations/netsuite/api-client', () => ({
  NetSuiteApiClient: jest.fn(() => mockApiClient),
}))

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    upsert: jest.fn().mockReturnThis(),
  })),
  auth: {
    getUser: jest.fn(),
  },
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}))

// Mock auth manager
jest.mock('@/lib/integrations/auth-manager', () => ({
  AuthManager: jest.fn().mockImplementation(() => ({
    getCredentials: jest.fn().mockResolvedValue({
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      account_id: 'test-account-id',
    }),
  })),
}))

describe('NetSuiteConnector', () => {
  let connector: NetSuiteConnector

  const testConfig = {
    integrationId: 'int-123',
    organizationId: 'org-456',
    credentials: {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      account_id: 'test-account-id',
    },
    settings: {
      account_id: 'test-account-id',
      api_version: '2023.2',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock responses
    mockApiClient.initialize.mockResolvedValue(undefined)
    mockApiClient.testConnection.mockResolvedValue(true)
    mockApiClient.executeSuiteQL.mockResolvedValue({
      items: [{ id: 'ITEM123' }],
    })
    
    // Mock the actual API client methods that are called
    mockApiClient.getValidAccessToken = jest.fn().mockResolvedValue('test-token')
    mockApiClient.executeSuiteQL = jest.fn().mockResolvedValue({
      items: [{ id: 'ITEM123' }],
    })

    // Setup Supabase mocks
    mockSupabase.from.mockImplementation((table) => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn().mockReturnThis(),
      }
      
      if (table === 'sync_states') {
        queryBuilder.select.mockResolvedValue({
          data: [{ cursor: null, last_sync: null }],
          error: null,
        })
      }
      
      if (table === 'products') {
        queryBuilder.insert.mockResolvedValue({
          data: [{ id: 'prod-123' }],
          error: null,
        })
      }
      
      if (table === 'inventory_levels') {
        queryBuilder.upsert.mockResolvedValue({
          data: [{ id: 'inv-123' }],
          error: null,
        })
      }
      
      return queryBuilder
    })

    connector = new NetSuiteConnector(testConfig)
  })

  describe('initialization', () => {
    it('should create a connector instance', () => {
      expect(connector).toBeInstanceOf(NetSuiteConnector)
    })

    it('should have the correct platform', () => {
      expect(connector.platform).toBe('netsuite')
    })

    it('should have the correct integration ID', () => {
      expect(connector.getMetadata().integrationId).toBe('int-123')
    })

    it('should have the correct organization ID', () => {
      expect(connector.getMetadata().organizationId).toBe('org-456')
    })
  })

  describe('connection management', () => {
    it('should have testConnection method', () => {
      expect(typeof connector.testConnection).toBe('function')
    })

    it('should handle connection test failures', async () => {
      mockApiClient.testConnection.mockRejectedValueOnce(new Error('Connection failed'))
      
      const isConnected = await connector.testConnection()
      
      expect(isConnected).toBe(false)
    })
  })

  describe('metadata', () => {
    it('should return correct metadata', () => {
      const metadata = connector.getMetadata()
      
      expect(metadata).toEqual({
        platform: 'netsuite',
        integrationId: 'int-123',
        organizationId: 'org-456',
        authenticated: false,
      })
    })
  })

  describe('sync operations', () => {
    it('should have syncProducts method', () => {
      expect(typeof connector.syncProducts).toBe('function')
    })

    it('should have syncInventory method', () => {
      expect(typeof connector.syncInventory).toBe('function')
    })

    it('should have syncPricing method', () => {
      expect(typeof connector.syncPricing).toBe('function')
    })
  })

  describe('connection management', () => {
    it('should disconnect gracefully', async () => {
      await connector.disconnect()
      
      // Should not throw
      expect(true).toBe(true)
    })
  })
})