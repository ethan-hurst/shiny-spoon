import { AccuracyChecker } from '@/lib/monitoring/accuracy-checker'
import { createAdminClient } from '@/lib/supabase/admin'
import type { 
  AccuracyCheckConfig, 
  DiscrepancyResult, 
  CheckProgressEvent,
  CheckResultSummary 
} from '@/lib/monitoring/types'

jest.mock('@/lib/supabase/admin')

describe('AccuracyChecker', () => {
  let checker: AccuracyChecker
  let mockSupabase: any
  let mockAuth: any
  let mockEmit: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock auth
    mockAuth = {
      getUser: jest.fn().mockResolvedValue({
        user: { id: 'user-123' }
      })
    }
    
    // Mock Supabase queries
    mockSupabase = {
      auth: mockAuth,
      from: jest.fn((table: string) => {
        switch (table) {
          case 'organization_users':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { organization_id: 'org-123' }
              })
            }
            
          case 'accuracy_checks':
            return {
              insert: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { 
                  id: 'check-123', 
                  organization_id: 'org-123' 
                }
              })
            }
            
          case 'integrations':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({
                data: [{
                  id: 'int-123',
                  platform: 'shopify',
                  is_active: true
                }]
              })
            }
            
          case 'products':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: [
                  { id: 'prod-1', name: 'Product 1', sku: 'SKU-001' },
                  { id: 'prod-2', name: 'Product 2', sku: 'SKU-002' }
                ]
              })
            }
            
          case 'shopify_product_mapping':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    internal_product_id: 'prod-1',
                    external_name: 'Product 1',
                    external_sku: 'SKU-001',
                    external_description: 'Description 1'
                  }
                ]
              })
            }
            
          case 'inventory':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: [
                  { 
                    id: 'inv-1', 
                    quantity: 100,
                    products: { sku: 'SKU-001' },
                    warehouses: { name: 'Main' }
                  }
                ]
              })
            }
            
          case 'sync_history':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  data: { quantity: 95 },
                  synced_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
                }
              })
            }
            
          case 'inventory_transactions':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockResolvedValue({
                data: [
                  { quantity_change: 5 }
                ]
              })
            }
            
          case 'pricing_rules':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'price-1',
                    price: 99.99,
                    products: { id: 'prod-1', sku: 'SKU-001' },
                    customer_tiers: { id: 'tier-1', name: 'VIP' }
                  }
                ]
              }),
              single: jest.fn().mockResolvedValue({
                data: { updated_at: new Date(Date.now() - 7200000).toISOString() }
              })
            }
            
          case 'integration_price_sync':
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  price: 89.99,
                  synced_at: new Date(Date.now() - 1800000).toISOString()
                }
              })
            }
            
          case 'discrepancies':
            return {
              insert: jest.fn().mockResolvedValue({ error: null })
            }
            
          case 'accuracy_metrics':
            return {
              insert: jest.fn().mockResolvedValue({ error: null })
            }
            
          default:
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null })
            }
        }
      })
    }
    
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)
    
    checker = new AccuracyChecker()
    mockEmit = jest.spyOn(checker, 'emit')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('runCheck', () => {
    it('should initialize and start accuracy check', async () => {
      const config: AccuracyCheckConfig = {
        scope: 'full',
        integrationId: 'int-123',
        sampleSize: 100
      }
      
      const checkId = await checker.runCheck(config)
      
      expect(checkId).toBe('check-123')
      expect(mockSupabase.from).toHaveBeenCalledWith('accuracy_checks')
      
      // Wait for async processing to start
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(mockEmit).toHaveBeenCalledWith('check:started', {
        checkId: 'check-123',
        config
      })
    })

    it('should handle initialization errors', async () => {
      mockAuth.getUser.mockResolvedValueOnce({ user: null })
      
      await expect(checker.runCheck({ scope: 'full' })).rejects.toThrow('Not authenticated')
    })
  })

  describe('performCheck', () => {
    const config: AccuracyCheckConfig = {
      scope: 'full',
      integrationId: 'int-123',
      sampleSize: 10
    }

    it('should check products and find discrepancies', async () => {
      const checkId = await checker.runCheck(config)
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify progress was emitted
      const progressCalls = mockEmit.mock.calls.filter(
        call => call[0] === 'check:progress'
      )
      expect(progressCalls.length).toBeGreaterThan(0)
      
      // Verify discrepancies were stored
      expect(mockSupabase.from).toHaveBeenCalledWith('discrepancies')
      
      // Verify check was completed
      const completedCalls = mockEmit.mock.calls.filter(
        call => call[0] === 'check:completed'
      )
      expect(completedCalls.length).toBe(1)
      
      const result = completedCalls[0][1] as CheckResultSummary
      expect(result.checkId).toBe('check-123')
      expect(result.discrepanciesFound).toBeGreaterThan(0)
    })

    it('should handle inventory discrepancies', async () => {
      const inventoryConfig: AccuracyCheckConfig = {
        scope: 'inventory',
        integrationId: 'int-123'
      }
      
      await checker.runCheck(inventoryConfig)
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should have checked inventory
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_history')
    })

    it('should handle pricing discrepancies', async () => {
      const pricingConfig: AccuracyCheckConfig = {
        scope: 'pricing',
        integrationId: 'int-123'
      }
      
      await checker.runCheck(pricingConfig)
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should have checked pricing
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
      expect(mockSupabase.from).toHaveBeenCalledWith('integration_price_sync')
    })

    it('should handle check abortion', async () => {
      const checkId = await checker.runCheck(config)
      
      // Abort immediately
      await checker.abortCheck(checkId)
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check should be marked as failed
      const updateCalls = mockSupabase.from('accuracy_checks').update.mock.calls
      const failedUpdate = updateCalls.find(
        call => call[0].status === 'failed' && call[0].error === 'Check aborted by user'
      )
      expect(failedUpdate).toBeDefined()
    })
  })

  describe('discrepancy detection', () => {
    it('should detect missing products', async () => {
      // Mock missing mapping
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'shopify_product_mapping') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [] }) // No mappings
          }
        }
        return mockSupabase.from(table)
      })
      
      await checker.runCheck({ scope: 'products' })
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should have detected missing products
      const insertCalls = mockSupabase.from('discrepancies').insert.mock.calls
      expect(insertCalls.length).toBeGreaterThan(0)
      
      const discrepancies = insertCalls[0][0]
      const missingDiscrepancy = discrepancies.find(
        (d: any) => d.discrepancy_type === 'missing'
      )
      expect(missingDiscrepancy).toBeDefined()
    })

    it('should detect SKU mismatches', async () => {
      // Mock mismatched SKU
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'shopify_product_mapping') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [{
                internal_product_id: 'prod-1',
                external_sku: 'WRONG-SKU' // Different SKU
              }]
            })
          }
        }
        return mockSupabase.from(table)
      })
      
      await checker.runCheck({ scope: 'products' })
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const insertCalls = mockSupabase.from('discrepancies').insert.mock.calls
      const discrepancies = insertCalls[0][0]
      const skuDiscrepancy = discrepancies.find(
        (d: any) => d.fieldName === 'sku' && d.severity === 'critical'
      )
      expect(skuDiscrepancy).toBeDefined()
    })

    it('should detect stale inventory data', async () => {
      // Mock very old sync
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'sync_history') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                data: { quantity: 100 },
                synced_at: new Date(Date.now() - 96 * 3600000).toISOString() // 4 days ago
              }
            })
          }
        }
        return mockSupabase.from(table)
      })
      
      await checker.runCheck({ scope: 'inventory' })
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const insertCalls = mockSupabase.from('discrepancies').insert.mock.calls
      const discrepancies = insertCalls[0][0]
      const staleDiscrepancy = discrepancies.find(
        (d: any) => d.discrepancy_type === 'stale' && d.severity === 'high'
      )
      expect(staleDiscrepancy).toBeDefined()
    })
  })

  describe('accuracy calculations', () => {
    it('should calculate accuracy score correctly', () => {
      const score = (checker as any).calculateAccuracyScore(100, 5)
      expect(score).toBe(95)
      
      const perfectScore = (checker as any).calculateAccuracyScore(100, 0)
      expect(perfectScore).toBe(100)
      
      const zeroScore = (checker as any).calculateAccuracyScore(0, 0)
      expect(zeroScore).toBe(100) // No records = perfect accuracy
    })

    it('should calculate inventory severity correctly', () => {
      const critical = (checker as any).calculateInventorySeverity(60, 100)
      expect(critical).toBe('critical')
      
      const high = (checker as any).calculateInventorySeverity(25, 100)
      expect(high).toBe('high')
      
      const medium = (checker as any).calculateInventorySeverity(10, 100)
      expect(medium).toBe('medium')
      
      const low = (checker as any).calculateInventorySeverity(3, 100)
      expect(low).toBe('low')
    })

    it('should calculate pricing severity correctly', () => {
      const critical = (checker as any).calculatePricingSeverity(15, 100)
      expect(critical).toBe('critical')
      
      const high = (checker as any).calculatePricingSeverity(7, 100)
      expect(high).toBe('high')
      
      const medium = (checker as any).calculatePricingSeverity(2, 100)
      expect(medium).toBe('medium')
      
      const low = (checker as any).calculatePricingSeverity(0.5, 100)
      expect(low).toBe('low')
    })
  })

  describe('string similarity', () => {
    it('should calculate string similarity correctly', () => {
      const identical = (checker as any).calculateStringSimilarity('test', 'test')
      expect(identical).toBe(1.0)
      
      const similar = (checker as any).calculateStringSimilarity('hello', 'hallo')
      expect(similar).toBeGreaterThan(0.7)
      
      const different = (checker as any).calculateStringSimilarity('abc', 'xyz')
      expect(different).toBeLessThan(0.3)
      
      const empty = (checker as any).calculateStringSimilarity('', '')
      expect(empty).toBe(1.0)
    })
  })

  describe('result grouping', () => {
    it('should group discrepancies by severity', () => {
      const discrepancies: DiscrepancyResult[] = [
        { severity: 'critical' } as DiscrepancyResult,
        { severity: 'critical' } as DiscrepancyResult,
        { severity: 'high' } as DiscrepancyResult,
        { severity: 'medium' } as DiscrepancyResult,
        { severity: 'low' } as DiscrepancyResult,
      ]
      
      const grouped = (checker as any).groupBySeverity(discrepancies)
      
      expect(grouped).toEqual({
        critical: 2,
        high: 1,
        medium: 1,
        low: 1
      })
    })

    it('should group discrepancies by type', () => {
      const discrepancies: DiscrepancyResult[] = [
        { discrepancyType: 'missing' } as DiscrepancyResult,
        { discrepancyType: 'missing' } as DiscrepancyResult,
        { discrepancyType: 'mismatch' } as DiscrepancyResult,
        { discrepancyType: 'stale' } as DiscrepancyResult,
      ]
      
      const grouped = (checker as any).groupByType(discrepancies)
      
      expect(grouped).toEqual({
        missing: 2,
        mismatch: 1,
        stale: 1,
        duplicate: 0
      })
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed')
      })
      
      const checkId = await checker.runCheck({ scope: 'full' })
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should have updated status to failed
      expect(mockSupabase.from).toHaveBeenCalledWith('accuracy_checks')
    })

    it('should continue checking even if one integration fails', async () => {
      // Mock multiple integrations, one failing
      let callCount = 0
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'integrations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [
                { id: 'int-1', platform: 'shopify' },
                { id: 'int-2', platform: 'netsuite' }
              ]
            })
          }
        }
        if (table === 'products' && callCount++ === 0) {
          throw new Error('First integration failed')
        }
        return mockSupabase.from(table)
      })
      
      await checker.runCheck({ scope: 'products' })
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should still have progress events
      const progressCalls = mockEmit.mock.calls.filter(
        call => call[0] === 'check:progress'
      )
      expect(progressCalls.length).toBeGreaterThan(0)
    })
  })
})