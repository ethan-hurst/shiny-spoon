import { AnomalyDetector } from '@/lib/ai/anomaly-detection'
import { createServerClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server')

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
    }

    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    detector = new AnomalyDetector()
  })

  describe('detectAnomalies', () => {
    const organizationId = 'org-123'

    it('should detect all types of anomalies when scope is "all"', async () => {
      // Mock inventory adjustments
      mockSupabase.select.mockImplementation(() => {
        const tableName = mockSupabase.from.mock.calls[mockSupabase.from.mock.calls.length - 1][0]
        
        if (tableName === 'inventory_adjustments') {
          return Promise.resolve({
            data: [
              {
                id: 'adj-1',
                adjustment: 500, // Large adjustment
                created_at: new Date().toISOString(),
                inventory: {
                  product_id: 'prod-1',
                  products: { id: 'prod-1', name: 'Product 1', sku: 'SKU1' }
                }
              }
            ]
          })
        }
        
        return Promise.resolve({ data: [] })
      })

      const anomalies = await detector.detectAnomalies(organizationId, 'all')

      expect(anomalies).toBeInstanceOf(Array)
      expect(anomalies.length).toBeGreaterThan(0)
      expect(mockSupabase.from).toHaveBeenCalledWith('ai_insights')
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it('should only detect inventory anomalies when scope is "inventory"', async () => {
      mockSupabase.select.mockResolvedValue({ data: [] })

      await detector.detectAnomalies(organizationId, 'inventory')

      // Should only query inventory-related tables
      const tableNames = mockSupabase.from.mock.calls.map(call => call[0])
      expect(tableNames).toContain('inventory_adjustments')
      expect(tableNames).toContain('inventory')
      expect(tableNames).not.toContain('orders')
      expect(tableNames).not.toContain('product_pricing_history')
    })
  })

  describe('inventory anomaly detection', () => {
    it('should detect large inventory adjustments', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [
          {
            id: 'adj-1',
            adjustment: 150, // Large positive adjustment
            created_at: new Date().toISOString(),
            inventory: {
              product_id: 'prod-1',
              warehouse_id: 'wh-1',
              products: { id: 'prod-1', name: 'Test Product', sku: 'TEST001' }
            }
          },
          {
            id: 'adj-2',
            adjustment: -600, // Very large negative adjustment
            created_at: new Date().toISOString(),
            inventory: {
              product_id: 'prod-2',
              warehouse_id: 'wh-1',
              products: { id: 'prod-2', name: 'Another Product', sku: 'TEST002' }
            }
          }
        ]
      })

      const anomalies = await (detector as any).detectInventoryAnomalies('org-123')

      expect(anomalies).toHaveLength(2)
      expect(anomalies[0]).toMatchObject({
        type: 'inventory_spike',
        severity: 'warning',
        title: 'Unusual Inventory Adjustment',
        confidence: 0.9,
        suggestedActions: expect.arrayContaining([
          'Verify the adjustment was intentional',
          'Check for data entry errors',
          'Review security logs for unauthorized access'
        ])
      })
      expect(anomalies[1].severity).toBe('critical') // Adjustment > 500
    })

    it('should detect frequent inventory adjustments', async () => {
      const productId = 'prod-1'
      const frequentAdjustments = Array.from({ length: 8 }, (_, i) => ({
        id: `adj-${i}`,
        adjustment: 10,
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        inventory: {
          product_id: productId,
          warehouse_id: 'wh-1',
          products: { id: productId, name: 'Frequently Adjusted Product', sku: 'FREQ001' }
        },
        warehouse_id: 'wh-1'
      }))

      mockSupabase.select.mockResolvedValue({ data: frequentAdjustments })

      const anomalies = await (detector as any).detectInventoryAnomalies('org-123')

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'adjustment_pattern',
          severity: 'warning',
          title: 'Frequent Inventory Adjustments',
          description: expect.stringContaining('8 adjustments in the last 7 days')
        })
      )
    })

    it('should detect stock-outs', async () => {
      mockSupabase.select.mockImplementation(() => {
        const tableName = mockSupabase.from.mock.calls[mockSupabase.from.mock.calls.length - 1][0]
        
        if (tableName === 'inventory') {
          return Promise.resolve({
            data: [
              {
                id: 'inv-1',
                product_id: 'prod-1',
                quantity: 0,
                products: { id: 'prod-1', name: 'Out of Stock Product', is_active: true }
              }
            ]
          })
        }
        
        return Promise.resolve({ data: [] })
      })

      const anomalies = await (detector as any).detectInventoryAnomalies('org-123')

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'stock_out',
          severity: 'critical',
          title: 'Product Out of Stock',
          confidence: 1.0,
          suggestedActions: expect.arrayContaining([
            'Place emergency reorder',
            'Check for pending shipments',
            'Update product availability status'
          ])
        })
      )
    })

    it('should detect excess inventory', async () => {
      // Mock inventory and order data for excess detection
      mockSupabase.select.mockImplementation(() => {
        const tableName = mockSupabase.from.mock.calls[mockSupabase.from.mock.calls.length - 1][0]
        
        if (tableName === 'inventory') {
          return Promise.resolve({
            data: [
              {
                id: 'inv-1',
                product_id: 'prod-1',
                quantity: 1000,
                products: { id: 'prod-1', name: 'Overstocked Product' }
              }
            ]
          })
        }
        
        if (tableName === 'order_items') {
          // Very low sales for high inventory
          return Promise.resolve({
            data: [
              { quantity: 5, created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
              { quantity: 3, created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() }
            ]
          })
        }
        
        return Promise.resolve({ data: [] })
      })

      const anomalies = await (detector as any).detectInventoryAnomalies('org-123')

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'excess_inventory',
          severity: 'warning',
          title: 'Excess Inventory Detected',
          description: expect.stringContaining('months of supply'),
          suggestedActions: expect.arrayContaining([
            'Consider promotional pricing',
            'Review demand forecast',
            'Evaluate storage costs'
          ])
        })
      )
    })
  })

  describe('order anomaly detection', () => {
    it('should detect order spikes', async () => {
      // Mock historical orders with normal volume
      const historicalOrders = Array.from({ length: 25 }, (_, i) => ({
        created_at: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
        total: 500
      }))

      // Mock today's orders with spike
      const todayOrders = Array.from({ length: 20 }, (_, i) => ({
        created_at: new Date().toISOString(),
        total: 750
      }))

      mockSupabase.select.mockImplementation(() => {
        const hasRecentFilter = mockSupabase.gte.mock.calls.some(call => 
          call[1]?.includes(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        )
        
        return Promise.resolve({
          data: hasRecentFilter ? todayOrders : [...todayOrders, ...historicalOrders]
        })
      })

      const anomalies = await (detector as any).detectOrderAnomalies('org-123')

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'order_spike',
          severity: 'info',
          title: 'Unusual Order Volume',
          description: expect.stringContaining("Today's order count")
        })
      )
    })

    it('should detect large orders', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [
          {
            id: 'order-1',
            order_number: 'ORD-001',
            total: 15000, // Large order
            created_at: new Date().toISOString()
          }
        ]
      })

      const anomalies = await (detector as any).detectOrderAnomalies('org-123')

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'large_order',
          severity: 'info',
          title: 'Large Order Detected',
          description: expect.stringContaining('$15,000'),
          suggestedActions: expect.arrayContaining([
            'Verify customer credit',
            'Confirm inventory availability',
            'Consider manual review'
          ])
        })
      )
    })
  })

  describe('pricing anomaly detection', () => {
    it('should detect price volatility', async () => {
      const productId = 'prod-1'
      const priceChanges = [
        { product_id: productId, price: 100, created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), product: { name: 'Volatile Product' } },
        { product_id: productId, price: 120, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), product: { name: 'Volatile Product' } },
        { product_id: productId, price: 90, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), product: { name: 'Volatile Product' } },
        { product_id: productId, price: 110, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), product: { name: 'Volatile Product' } },
      ]

      mockSupabase.select.mockResolvedValue({ data: priceChanges })

      const anomalies = await (detector as any).detectPricingAnomalies('org-123')

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'price_volatility',
          severity: 'warning',
          title: 'High Price Volatility',
          description: expect.stringContaining('4 price changes in 7 days'),
          confidence: 0.9
        })
      )
    })

    it('should detect large price changes', async () => {
      const priceChanges = [
        { id: '1', product_id: 'prod-1', price: 50, cost: 30, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), product: { name: 'Product 1' } },
        { id: '2', product_id: 'prod-1', price: 100, cost: 30, created_at: new Date().toISOString(), product: { name: 'Product 1' } }, // 100% increase
      ]

      mockSupabase.select.mockResolvedValue({ data: priceChanges })

      const anomalies = await (detector as any).detectPricingAnomalies('org-123')

      expect(anomalies).toContainEqual(
        expect.objectContaining({
          type: 'large_price_change',
          severity: 'warning',
          title: 'Significant Price Change',
          description: expect.stringContaining('increased by 100%'),
          confidence: 1.0,
          suggestedActions: expect.arrayContaining([
            'Verify price change was intentional',
            'Monitor sales impact',
            'Communicate change to sales team'
          ])
        })
      )
    })
  })

  describe('helper methods', () => {
    it('should aggregate data by day correctly', () => {
      const data = [
        { created_at: '2024-01-01T10:00:00Z' },
        { created_at: '2024-01-01T15:00:00Z' },
        { created_at: '2024-01-02T10:00:00Z' },
        { created_at: '2024-01-02T11:00:00Z' },
        { created_at: '2024-01-02T12:00:00Z' },
      ]

      const aggregated = (detector as any).aggregateByDay(data)

      expect(aggregated).toEqual([2, 3]) // 2 items on Jan 1, 3 items on Jan 2
    })

    it('should calculate statistics correctly', () => {
      const values = [10, 20, 30, 40, 50]

      const stats = (detector as any).calculateStats(values)

      expect(stats).toEqual({
        mean: 30,
        stdDev: expect.closeTo(14.14, 2),
        min: 10,
        max: 50
      })
    })

    it('should calculate months of supply correctly', async () => {
      const inventoryItem = {
        product_id: 'prod-1',
        quantity: 300
      }

      mockSupabase.select.mockResolvedValue({
        data: [
          { quantity: 30, created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
          { quantity: 40, created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
          { quantity: 20, created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
        ]
      })

      const monthsOfSupply = await (detector as any).calculateMonthsOfSupply(inventoryItem)

      // Total demand = 90 over 3 months = 30/month
      // 300 units / 30 per month = 10 months
      expect(monthsOfSupply).toBe(10)
    })
  })
})