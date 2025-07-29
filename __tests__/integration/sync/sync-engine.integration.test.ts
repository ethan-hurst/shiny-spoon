import { SyncEngine } from '@/lib/sync/sync-engine'
import { DataSyncService } from '@/lib/sync/services/data-sync-service'
import { ConflictResolutionService } from '@/lib/sync/services/conflict-resolution-service'
import { WebhookService } from '@/lib/sync/services/webhook-service'
import { SyncScheduler } from '@/lib/sync/services/sync-scheduler'
import { createServerClient } from '@/lib/supabase/server'
import { SyncType, SyncStatus, ConflictResolution } from '@/lib/sync/types'
import { setupTestDatabase, cleanupTestDatabase } from '@/tests/helpers/database'
import { mockExternalAPI } from '@/tests/helpers/mock-api'

// Mock the external API modules
jest.mock('@/lib/integrations/shopify/client')
jest.mock('@/lib/integrations/netsuite/client')

describe('SyncEngine Integration Tests', () => {
  let syncEngine: SyncEngine
  let supabase: any
  let testOrgId: string
  let testIntegrationId: string

  beforeAll(async () => {
    // Set up test database with test data
    const testData = await setupTestDatabase()
    testOrgId = testData.organizationId
    testIntegrationId = testData.integrationId
    supabase = createServerClient()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(() => {
    // Initialize sync engine with real services
    syncEngine = new SyncEngine(
      new DataSyncService(),
      new ConflictResolutionService(),
      new WebhookService(),
      new SyncScheduler()
    )

    // Set up external API mocks
    mockExternalAPI.reset()
  })

  describe('Full Sync Flow', () => {
    it('should perform a complete inventory sync from external platform', async () => {
      // Set up mock external API response
      mockExternalAPI.mockInventoryResponse([
        {
          sku: 'TEST-SKU-001',
          quantity: 100,
          warehouse_id: 'wh-001',
          updated_at: new Date().toISOString()
        },
        {
          sku: 'TEST-SKU-002',
          quantity: 50,
          warehouse_id: 'wh-001',
          updated_at: new Date().toISOString()
        }
      ])

      // Create sync configuration
      const { data: syncConfig } = await supabase
        .from('sync_configs')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          sync_type: SyncType.INVENTORY,
          active: true,
          settings: {
            conflict_resolution: ConflictResolution.EXTERNAL_WINS,
            batch_size: 100
          }
        })
        .select()
        .single()

      // Execute sync
      const result = await syncEngine.executeSync(syncConfig.id)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(2)
      expect(result.data?.status).toBe(SyncStatus.COMPLETED)

      // Verify data was synced to database
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('organization_id', testOrgId)
        .order('sku')

      expect(inventory).toHaveLength(2)
      expect(inventory[0].sku).toBe('TEST-SKU-001')
      expect(inventory[0].quantity).toBe(100)
      expect(inventory[1].sku).toBe('TEST-SKU-002')
      expect(inventory[1].quantity).toBe(50)

      // Verify sync log was created
      const { data: syncLog } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('sync_config_id', syncConfig.id)
        .single()

      expect(syncLog.status).toBe(SyncStatus.COMPLETED)
      expect(syncLog.records_synced).toBe(2)
      expect(syncLog.errors).toBeNull()
    })

    it('should handle pricing sync with conflict resolution', async () => {
      // Set up existing pricing data
      await supabase
        .from('product_pricing')
        .insert([
          {
            organization_id: testOrgId,
            sku: 'TEST-SKU-001',
            base_price: 100.00,
            updated_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
          }
        ])

      // Mock external API with newer pricing
      mockExternalAPI.mockPricingResponse([
        {
          sku: 'TEST-SKU-001',
          price: 95.00,
          currency: 'USD',
          updated_at: new Date().toISOString()
        }
      ])

      // Create sync config with external wins resolution
      const { data: syncConfig } = await supabase
        .from('sync_configs')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          sync_type: SyncType.PRICING,
          active: true,
          settings: {
            conflict_resolution: ConflictResolution.EXTERNAL_WINS
          }
        })
        .select()
        .single()

      // Execute sync
      const result = await syncEngine.executeSync(syncConfig.id)

      expect(result.success).toBe(true)

      // Verify price was updated
      const { data: pricing } = await supabase
        .from('product_pricing')
        .select('*')
        .eq('sku', 'TEST-SKU-001')
        .single()

      expect(pricing.base_price).toBe(95.00)

      // Verify conflict was logged
      const { data: conflicts } = await supabase
        .from('sync_conflicts')
        .select('*')
        .eq('sync_log_id', result.data?.id)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].resolution_action).toBe('accepted_external')
    })

    it('should handle batch processing for large datasets', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 500 }, (_, i) => ({
        sku: `TEST-SKU-${String(i).padStart(3, '0')}`,
        quantity: Math.floor(Math.random() * 1000),
        warehouse_id: 'wh-001',
        updated_at: new Date().toISOString()
      }))

      mockExternalAPI.mockInventoryResponse(largeDataset)

      // Create sync config with batch size
      const { data: syncConfig } = await supabase
        .from('sync_configs')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          sync_type: SyncType.INVENTORY,
          active: true,
          settings: {
            batch_size: 50,
            rate_limit: 10 // 10 requests per second
          }
        })
        .select()
        .single()

      // Execute sync
      const result = await syncEngine.executeSync(syncConfig.id)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(500)

      // Verify all records were synced
      const { count } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', testOrgId)

      expect(count).toBe(500)
    })
  })

  describe('Webhook Processing', () => {
    it('should process incoming webhooks and trigger sync', async () => {
      // Create webhook configuration
      const { data: webhookConfig } = await supabase
        .from('webhook_configs')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          webhook_url: 'https://api.example.com/webhooks',
          events: ['inventory.updated', 'product.created'],
          active: true
        })
        .select()
        .single()

      // Simulate webhook event
      const webhookEvent = {
        id: 'evt_123',
        type: 'inventory.updated',
        data: {
          sku: 'TEST-SKU-001',
          quantity: 75,
          warehouse_id: 'wh-001'
        },
        created_at: new Date().toISOString()
      }

      // Process webhook
      const result = await syncEngine.processWebhook(
        webhookConfig.id,
        webhookEvent
      )

      expect(result.success).toBe(true)

      // Verify inventory was updated
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', 'TEST-SKU-001')
        .single()

      expect(inventory.quantity).toBe(75)

      // Verify webhook was logged
      const { data: webhookLog } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_config_id', webhookConfig.id)
        .single()

      expect(webhookLog.event_type).toBe('inventory.updated')
      expect(webhookLog.status).toBe('processed')
    })
  })

  describe('Scheduled Sync', () => {
    it('should execute scheduled syncs based on configuration', async () => {
      // Create sync config with schedule
      const { data: syncConfig } = await supabase
        .from('sync_configs')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          sync_type: SyncType.INVENTORY,
          active: true,
          schedule: {
            interval: 'hourly',
            time: null,
            timezone: 'UTC'
          }
        })
        .select()
        .single()

      // Schedule sync
      const scheduleResult = await syncEngine.scheduleSync(syncConfig.id)
      expect(scheduleResult.success).toBe(true)

      // Fast forward time
      const now = new Date()
      const oneHourLater = new Date(now.getTime() + 3600000)
      jest.setSystemTime(oneHourLater)

      // Process scheduled syncs
      const processResult = await syncEngine.processScheduledSyncs()
      expect(processResult.success).toBe(true)
      expect(processResult.data?.executed).toBeGreaterThan(0)

      // Verify sync was executed
      const { data: syncLogs } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('sync_config_id', syncConfig.id)
        .order('created_at', { ascending: false })
        .limit(1)

      expect(syncLogs).toHaveLength(1)
      expect(syncLogs[0].status).toBe(SyncStatus.COMPLETED)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle API failures with retry logic', async () => {
      // Mock API to fail first 2 attempts, succeed on 3rd
      let attemptCount = 0
      mockExternalAPI.mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('API temporarily unavailable')
        }
        return [
          {
            sku: 'TEST-SKU-001',
            quantity: 100,
            warehouse_id: 'wh-001'
          }
        ]
      })

      // Create sync config with retry settings
      const { data: syncConfig } = await supabase
        .from('sync_configs')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          sync_type: SyncType.INVENTORY,
          active: true,
          settings: {
            retry_attempts: 3,
            retry_delay: 1000
          }
        })
        .select()
        .single()

      // Execute sync
      const result = await syncEngine.executeSync(syncConfig.id)

      expect(result.success).toBe(true)
      expect(attemptCount).toBe(3)

      // Verify sync log shows retries
      const { data: syncLog } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('sync_config_id', syncConfig.id)
        .single()

      expect(syncLog.retry_count).toBe(2)
      expect(syncLog.status).toBe(SyncStatus.COMPLETED)
    })

    it('should handle partial sync failures', async () => {
      // Mock API to return mix of valid and invalid data
      mockExternalAPI.mockInventoryResponse([
        {
          sku: 'TEST-SKU-001',
          quantity: 100,
          warehouse_id: 'wh-001'
        },
        {
          sku: 'TEST-SKU-002',
          quantity: -50, // Invalid quantity
          warehouse_id: 'wh-001'
        },
        {
          sku: 'TEST-SKU-003',
          quantity: 75,
          warehouse_id: 'wh-001'
        }
      ])

      // Create sync config
      const { data: syncConfig } = await supabase
        .from('sync_configs')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          sync_type: SyncType.INVENTORY,
          active: true,
          settings: {
            continue_on_error: true
          }
        })
        .select()
        .single()

      // Execute sync
      const result = await syncEngine.executeSync(syncConfig.id)

      expect(result.success).toBe(true)
      expect(result.data?.records_synced).toBe(2)
      expect(result.data?.records_failed).toBe(1)

      // Verify only valid records were synced
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('organization_id', testOrgId)
        .order('sku')

      expect(inventory).toHaveLength(2)
      expect(inventory.map(i => i.sku)).toEqual(['TEST-SKU-001', 'TEST-SKU-003'])

      // Verify error was logged
      const { data: syncLog } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('sync_config_id', syncConfig.id)
        .single()

      expect(syncLog.errors).toContain('Invalid quantity')
    })
  })
})