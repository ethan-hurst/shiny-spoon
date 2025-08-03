import { AnomalyDetector } from '@/lib/ai/anomaly-detection'
import { createServerClient } from '@/lib/supabase/server'
import type { AnomalyAlert } from '@/types/ai.types'

// Mock dependencies
jest.mock('@/lib/supabase/server')

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    }
    
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    detector = new AnomalyDetector()
  })

  describe('detectAnomalies', () => {
    it('should detect all types of anomalies when scope is "all"', async () => {
      // Mock data for different anomaly types
      mockSupabase.select
        .mockResolvedValueOnce({ data: [], error: null }) // inventory adjustments
        .mockResolvedValueOnce({ data: [], error: null }) // inventory
        .mockResolvedValueOnce({ data: [], error: null }) // recent orders
        .mockResolvedValueOnce({ data: [], error: null }) // historical orders
        .mockResolvedValueOnce({ data: [], error: null }) // price changes

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'all')

      expect(result).toEqual([])
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_adjustments')
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.from).toHaveBeenCalledWith('orders')
      expect(mockSupabase.from).toHaveBeenCalledWith('product_pricing_history')
    })

    it('should only detect inventory anomalies when scope is "inventory"', async () => {
      mockSupabase.select
        .mockResolvedValueOnce({ data: [], error: null }) // inventory adjustments
        .mockResolvedValueOnce({ data: [], error: null }) // inventory

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'inventory')

      expect(result).toEqual([])
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory_adjustments')
      expect(mockSupabase.from).toHaveBeenCalledWith('inventory')
      expect(mockSupabase.from).not.toHaveBeenCalledWith('orders')
    })
  })

  describe('detectInventoryAnomalies', () => {
    it('should detect large inventory adjustments', async () => {
      const mockAdjustments = [{
        id: 'adj1',
        adjustment: 600,
        inventory: {
          product_id: 'prod1',
          products: { id: 'prod1', name: 'Test Product', sku: 'SKU001' }
        },
        warehouse_id: 'warehouse1'
      }]

      mockSupabase.select
        .mockResolvedValueOnce({ data: mockAdjustments, error: null })
        .mockResolvedValueOnce({ data: [], error: null })

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'inventory')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'inventory_spike',
        severity: 'critical',
        title: 'Unusual Inventory Adjustment',
        description: expect.stringContaining('600 units'),
        confidence: 0.9
      })
    })

    it('should detect repeated adjustments pattern', async () => {
      const mockAdjustments = Array.from({ length: 6 }, (_, i) => ({
        id: `adj${i}`,
        adjustment: 10,
        inventory: {
          product_id: 'prod1',
          warehouse_id: 'warehouse1',
          products: { id: 'prod1', name: 'Test Product', sku: 'SKU001' }
        },
        warehouse_id: 'warehouse1'
      }))

      mockSupabase.select
        .mockResolvedValueOnce({ data: mockAdjustments, error: null })
        .mockResolvedValueOnce({ data: [], error: null })

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'inventory')

      expect(result.some(a => a.type === 'adjustment_pattern')).toBe(true)
      const patternAnomaly = result.find(a => a.type === 'adjustment_pattern')
      expect(patternAnomaly).toMatchObject({
        severity: 'warning',
        title: 'Frequent Inventory Adjustments',
        description: expect.stringContaining('6 adjustments'),
        confidence: 0.85
      })
    })

    it('should detect stock out situations', async () => {
      const mockInventory = [{
        id: 'inv1',
        product_id: 'prod1',
        quantity: 0,
        products: { id: 'prod1', name: 'Test Product', is_active: true }
      }]

      mockSupabase.select
        .mockResolvedValueOnce({ data: [], error: null }) // adjustments
        .mockResolvedValueOnce({ data: mockInventory, error: null }) // inventory
        .mockResolvedValueOnce({ data: [], error: null }) // orders for months supply

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'inventory')

      expect(result.some(a => a.type === 'stock_out')).toBe(true)
      const stockOutAnomaly = result.find(a => a.type === 'stock_out')
      expect(stockOutAnomaly).toMatchObject({
        severity: 'critical',
        title: 'Product Out of Stock',
        confidence: 1.0
      })
    })

    it('should detect excess inventory', async () => {
      const mockInventory = [{
        id: 'inv1',
        product_id: 'prod1',
        quantity: 1000,
        products: { id: 'prod1', name: 'Test Product' }
      }]

      const mockOrders = [{
        product_id: 'prod1',
        quantity: 10,
        created_at: new Date().toISOString()
      }]

      mockSupabase.select
        .mockResolvedValueOnce({ data: [], error: null }) // adjustments
        .mockResolvedValueOnce({ data: mockInventory, error: null }) // inventory
        .mockResolvedValueOnce({ data: mockOrders, error: null }) // orders

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'inventory')

      expect(result.some(a => a.type === 'excess_inventory')).toBe(true)
    })
  })

  describe('detectOrderAnomalies', () => {
    it('should detect order spikes', async () => {
      const recentOrders = Array.from({ length: 50 }, (_, i) => ({
        id: `order${i}`,
        created_at: new Date().toISOString(),
        total: 1000
      }))

      const historicalOrders = Array.from({ length: 30 }, (_, i) => ({
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        total: 500
      }))

      mockSupabase.select
        .mockResolvedValueOnce({ data: recentOrders, error: null })
        .mockResolvedValueOnce({ data: historicalOrders, error: null })

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'orders')

      expect(result.some(a => a.type === 'order_spike')).toBe(true)
    })

    it('should detect large orders', async () => {
      const largeOrder = {
        id: 'order1',
        order_number: 'ORD-001',
        total: 15000,
        created_at: new Date().toISOString()
      }

      mockSupabase.select
        .mockResolvedValueOnce({ data: [largeOrder], error: null })
        .mockResolvedValueOnce({ data: [], error: null })

      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'orders')

      expect(result.some(a => a.type === 'large_order')).toBe(true)
      const largeOrderAnomaly = result.find(a => a.type === 'large_order')
      expect(largeOrderAnomaly).toMatchObject({
        severity: 'info',
        title: 'Large Order Detected',
        description: expect.stringContaining('$15,000'),
        confidence: 1.0
      })
    })
  })

  describe('detectPricingAnomalies', () => {
    it('should detect price volatility', async () => {
      const priceChanges = Array.from({ length: 5 }, (_, i) => ({
        id: `price${i}`,
        product_id: 'prod1',
        price: 100 + i * 10,
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        product: { id: 'prod1', name: 'Test Product' }
      }))

      mockSupabase.select.mockResolvedValueOnce({ data: priceChanges, error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'pricing')

      expect(result.some(a => a.type === 'price_volatility')).toBe(true)
    })

    it('should detect large price changes', async () => {
      const priceChanges = [
        {
          id: 'price1',
          product_id: 'prod1',
          price: 100,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          product: { id: 'prod1', name: 'Test Product' }
        },
        {
          id: 'price2',
          product_id: 'prod1',
          price: 130,
          created_at: new Date().toISOString(),
          product: { id: 'prod1', name: 'Test Product' }
        }
      ]

      mockSupabase.select.mockResolvedValueOnce({ data: priceChanges, error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await detector.detectAnomalies('org123', 'pricing')

      expect(result.some(a => a.type === 'large_price_change')).toBe(true)
      const priceChangeAnomaly = result.find(a => a.type === 'large_price_change')
      expect(priceChangeAnomaly).toMatchObject({
        severity: 'warning',
        title: 'Significant Price Change',
        description: expect.stringContaining('30%'),
        confidence: 1.0
      })
    })
  })
})