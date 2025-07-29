import { InventorySyncService } from '@/lib/sync/services/inventory-sync-service'
import { SyncJob, SyncResult } from '@/types/sync.types'
import { createServerClient } from '@/lib/supabase/server'
import { NetSuiteClient } from '@/lib/integrations/netsuite/client'
import { ShopifyClient } from '@/lib/integrations/shopify/client'

jest.mock('@/lib/supabase/server')
jest.mock('@/lib/integrations/netsuite/client')
jest.mock('@/lib/integrations/shopify/client')

describe('InventorySyncService', () => {
  let service: InventorySyncService
  let mockSupabase: any
  let mockNetSuiteClient: jest.Mocked<NetSuiteClient>
  let mockShopifyClient: jest.Mocked<ShopifyClient>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock external clients
    mockNetSuiteClient = new NetSuiteClient({} as any) as jest.Mocked<NetSuiteClient>
    mockShopifyClient = new ShopifyClient({} as any) as jest.Mocked<ShopifyClient>

    // Initialize service
    service = new InventorySyncService()
    ;(service as any).netsuiteClient = mockNetSuiteClient
    ;(service as any).shopifyClient = mockShopifyClient
  })

  describe('sync', () => {
    const baseSyncJob: SyncJob = {
      id: 'sync-123',
      organization_id: 'org-123',
      sync_type: 'inventory',
      source_system: 'netsuite',
      target_system: 'shopify',
      status: 'in_progress',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    it('should sync inventory from NetSuite to Shopify', async () => {
      const mockInventoryData = [
        {
          item_id: 'NS001',
          quantity_available: 100,
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        },
        {
          item_id: 'NS002',
          quantity_available: 50,
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        },
      ]

      const mockProductMappings = [
        {
          id: 'map-1',
          netsuite_id: 'NS001',
          shopify_id: 'gid://shopify/Product/1234',
          organization_id: 'org-123',
        },
        {
          id: 'map-2',
          netsuite_id: 'NS002',
          shopify_id: 'gid://shopify/Product/5678',
          organization_id: 'org-123',
        },
      ]

      // Mock NetSuite inventory fetch
      mockNetSuiteClient.getInventory = jest.fn().mockResolvedValue({
        items: mockInventoryData,
        hasMore: false,
      })

      // Mock product mappings fetch
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'product_mappings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: mockProductMappings,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      // Mock Shopify update
      mockShopifyClient.updateInventory = jest.fn().mockResolvedValue({
        success: true,
        inventoryLevelId: 'inv-level-123',
      })

      // Mock inventory upsert
      mockSupabase.upsert.mockResolvedValue({
        data: null,
        error: null,
      })

      const onProgress = jest.fn()
      const result = await service.sync(baseSyncJob, onProgress)

      expect(result.success).toBe(true)
      expect(result.records_processed).toBe(2)
      expect(result.records_updated).toBe(2)
      expect(result.records_failed).toBe(0)
      expect(onProgress).toHaveBeenCalledWith(100)

      // Verify NetSuite was called
      expect(mockNetSuiteClient.getInventory).toHaveBeenCalledWith({
        modifiedAfter: undefined,
        locationId: undefined,
      })

      // Verify Shopify updates
      expect(mockShopifyClient.updateInventory).toHaveBeenCalledTimes(2)
    })

    it('should handle partial sync failures', async () => {
      const mockInventoryData = [
        {
          item_id: 'NS001',
          quantity_available: 100,
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        },
        {
          item_id: 'NS002',
          quantity_available: 50,
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        },
      ]

      const mockProductMappings = [
        {
          id: 'map-1',
          netsuite_id: 'NS001',
          shopify_id: 'gid://shopify/Product/1234',
          organization_id: 'org-123',
        },
      ]

      mockNetSuiteClient.getInventory = jest.fn().mockResolvedValue({
        items: mockInventoryData,
        hasMore: false,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'product_mappings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: mockProductMappings,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      // First update succeeds, second fails
      mockShopifyClient.updateInventory
        .mockResolvedValueOnce({ success: true, inventoryLevelId: 'inv-1' })
        .mockRejectedValueOnce(new Error('Shopify API error'))

      const onProgress = jest.fn()
      const result = await service.sync(baseSyncJob, onProgress)

      expect(result.success).toBe(false)
      expect(result.records_processed).toBe(2)
      expect(result.records_updated).toBe(1)
      expect(result.records_failed).toBe(1)
      expect(result.errors).toContain('Failed to sync NS002: Shopify API error')
    })

    it('should sync from Shopify to NetSuite', async () => {
      const reverseJob: SyncJob = {
        ...baseSyncJob,
        source_system: 'shopify',
        target_system: 'netsuite',
      }

      const mockShopifyInventory = [
        {
          inventoryItemId: 'gid://shopify/InventoryItem/1111',
          available: 75,
          locationId: 'gid://shopify/Location/2222',
          updatedAt: new Date().toISOString(),
        },
      ]

      const mockProductMappings = [
        {
          id: 'map-1',
          shopify_variant_id: 'gid://shopify/InventoryItem/1111',
          netsuite_id: 'NS001',
          organization_id: 'org-123',
        },
      ]

      // Mock Shopify inventory fetch
      mockShopifyClient.getInventoryLevels = jest.fn().mockResolvedValue({
        inventoryLevels: mockShopifyInventory,
        hasNextPage: false,
      })

      // Mock product mappings
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'product_mappings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: mockProductMappings,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      // Mock NetSuite update
      mockNetSuiteClient.updateInventory = jest.fn().mockResolvedValue({
        success: true,
        internalId: 'NS001',
      })

      const onProgress = jest.fn()
      const result = await service.sync(reverseJob, onProgress)

      expect(result.success).toBe(true)
      expect(result.records_processed).toBe(1)
      expect(mockShopifyClient.getInventoryLevels).toHaveBeenCalled()
      expect(mockNetSuiteClient.updateInventory).toHaveBeenCalledWith({
        itemId: 'NS001',
        quantity: 75,
        locationId: expect.any(String),
      })
    })

    it('should handle sync with filters', async () => {
      const filteredJob: SyncJob = {
        ...baseSyncJob,
        filters: {
          warehouse_id: 'wh-123',
          product_ids: ['prod-1', 'prod-2'],
        },
      }

      const mockInventoryData = [
        {
          item_id: 'NS001',
          quantity_available: 100,
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        },
      ]

      mockNetSuiteClient.getInventory = jest.fn().mockResolvedValue({
        items: mockInventoryData,
        hasMore: false,
      })

      // Mock filtered product mappings
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'product_mappings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'map-1',
                  netsuite_id: 'NS001',
                  shopify_id: 'gid://shopify/Product/1234',
                  product_id: 'prod-1',
                },
              ],
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      mockShopifyClient.updateInventory = jest.fn().mockResolvedValue({
        success: true,
        inventoryLevelId: 'inv-1',
      })

      const result = await service.sync(filteredJob, jest.fn())

      expect(result.success).toBe(true)
      expect(mockSupabase.in).toHaveBeenCalledWith('product_id', ['prod-1', 'prod-2'])
    })

    it('should detect and report conflicts', async () => {
      const mockInventoryData = [
        {
          item_id: 'NS001',
          quantity_available: 100,
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        },
      ]

      const mockExistingInventory = {
        id: 'inv-123',
        product_id: 'prod-1',
        quantity: 95,
        shopify_quantity: 90,
        netsuite_quantity: 95,
        last_shopify_sync: new Date().toISOString(),
        last_netsuite_sync: new Date().toISOString(),
      }

      mockNetSuiteClient.getInventory = jest.fn().mockResolvedValue({
        items: mockInventoryData,
        hasMore: false,
      })

      // Mock existing inventory check
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockExistingInventory,
              error: null,
            }),
          }
        }
        if (table === 'product_mappings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'map-1',
                  netsuite_id: 'NS001',
                  shopify_id: 'gid://shopify/Product/1234',
                  product_id: 'prod-1',
                },
              ],
              error: null,
            }),
          }
        }
        if (table === 'sync_conflicts') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      const result = await service.sync(baseSyncJob, jest.fn())

      // Should detect quantity mismatch
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_conflicts')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_job_id: baseSyncJob.id,
          record_type: 'inventory',
          conflict_type: 'value_mismatch',
        })
      )
    })

    it('should handle pagination for large datasets', async () => {
      const firstBatch = Array(100)
        .fill(null)
        .map((_, i) => ({
          item_id: `NS${i.toString().padStart(3, '0')}`,
          quantity_available: Math.floor(Math.random() * 100),
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        }))

      const secondBatch = Array(50)
        .fill(null)
        .map((_, i) => ({
          item_id: `NS${(i + 100).toString().padStart(3, '0')}`,
          quantity_available: Math.floor(Math.random() * 100),
          location_id: 'LOC1',
          last_modified: new Date().toISOString(),
        }))

      // Mock paginated responses
      mockNetSuiteClient.getInventory
        .mockResolvedValueOnce({
          items: firstBatch,
          hasMore: true,
          cursor: 'next-page-1',
        })
        .mockResolvedValueOnce({
          items: secondBatch,
          hasMore: false,
        })

      // Mock product mappings for all items
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'product_mappings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [...firstBatch, ...secondBatch].map((item, i) => ({
                id: `map-${i}`,
                netsuite_id: item.item_id,
                shopify_id: `gid://shopify/Product/${1000 + i}`,
              })),
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      mockShopifyClient.updateInventory = jest.fn().mockResolvedValue({
        success: true,
        inventoryLevelId: 'inv-1',
      })

      const onProgress = jest.fn()
      const result = await service.sync(baseSyncJob, onProgress)

      expect(result.success).toBe(true)
      expect(result.records_processed).toBe(150)
      expect(mockNetSuiteClient.getInventory).toHaveBeenCalledTimes(2)
      
      // Verify progress was reported during pagination
      expect(onProgress).toHaveBeenCalledWith(expect.any(Number))
    })
  })

  describe('validateInventoryData', () => {
    it('should validate correct inventory data', () => {
      const validData = {
        item_id: 'NS001',
        quantity_available: 100,
        location_id: 'LOC1',
        last_modified: new Date().toISOString(),
      }

      const result = (service as any).validateInventoryData(validData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should reject negative quantities', () => {
      const invalidData = {
        item_id: 'NS001',
        quantity_available: -10,
        location_id: 'LOC1',
        last_modified: new Date().toISOString(),
      }

      const result = (service as any).validateInventoryData(invalidData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Negative quantity not allowed')
    })

    it('should reject missing required fields', () => {
      const invalidData = {
        quantity_available: 100,
        last_modified: new Date().toISOString(),
      }

      const result = (service as any).validateInventoryData(invalidData)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Missing required field: item_id')
      expect(result.errors).toContain('Missing required field: location_id')
    })
  })

  describe('calculateInventoryDelta', () => {
    it('should calculate correct delta for inventory changes', () => {
      const current = {
        product_id: 'prod-1',
        quantity: 100,
        netsuite_quantity: 100,
        shopify_quantity: 95,
      }

      const newQuantity = 110

      const delta = (service as any).calculateInventoryDelta(current, newQuantity)

      expect(delta.quantityChange).toBe(10)
      expect(delta.percentageChange).toBe(10)
      expect(delta.requiresAlert).toBe(true) // > 5% change
    })

    it('should not flag small changes as requiring alerts', () => {
      const current = {
        product_id: 'prod-1',
        quantity: 100,
        netsuite_quantity: 100,
        shopify_quantity: 100,
      }

      const newQuantity = 102

      const delta = (service as any).calculateInventoryDelta(current, newQuantity)

      expect(delta.quantityChange).toBe(2)
      expect(delta.percentageChange).toBe(2)
      expect(delta.requiresAlert).toBe(false)
    })
  })
})