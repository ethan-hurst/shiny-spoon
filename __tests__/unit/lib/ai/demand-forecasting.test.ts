import { DemandForecaster } from '@/lib/ai/demand-forecasting'
import { createServerClient } from '@/lib/supabase/server'
import type { TimeSeriesData } from '@/types/ai.types'

// Mock dependencies
jest.mock('@/lib/supabase/server')

describe('DemandForecaster', () => {
  let forecaster: DemandForecaster
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    }
    
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    forecaster = new DemandForecaster()
  })

  describe('forecastDemand', () => {
    it('should generate forecast for product with sufficient history', async () => {
      // Mock historical data
      const mockHistoricalData = Array.from({ length: 60 }, (_, i) => ({
        quantity: Math.floor(Math.random() * 20) + 10,
        created_at: new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000).toISOString(),
        orders: {
          organization_id: 'org123',
          warehouse_id: 'warehouse123'
        }
      }))

      mockSupabase.select.mockResolvedValue({ data: mockHistoricalData, error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })

      const result = await forecaster.forecastDemand(
        'product123',
        'warehouse123',
        'org123',
        30
      )

      expect(result).toMatchObject({
        productId: 'product123',
        warehouseId: 'warehouse123',
        predictions: expect.any(Array),
        confidence: expect.any(Number),
        method: 'ensemble',
        generatedAt: expect.any(Date),
        horizonDays: 30
      })

      expect(result.predictions).toHaveLength(30)
      expect(result.confidence).toBeGreaterThanOrEqual(0.5)
      expect(result.confidence).toBeLessThanOrEqual(0.95)
    })

    it('should use simple moving average for products with limited history', async () => {
      // Mock limited historical data
      const mockHistoricalData = Array.from({ length: 10 }, (_, i) => ({
        quantity: 15,
        created_at: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString(),
        orders: {
          organization_id: 'org123',
          warehouse_id: 'warehouse123'
        }
      }))

      mockSupabase.select.mockResolvedValue({ data: mockHistoricalData, error: null })

      const result = await forecaster.forecastDemand(
        'product123',
        'warehouse123',
        'org123',
        14
      )

      expect(result.method).toBe('moving_average')
      expect(result.predictions).toHaveLength(14)
      expect(result.predictions.every(p => p === 15)).toBe(true)
      expect(result.confidence).toBe(0.6)
    })

    it('should handle empty historical data', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null })

      const result = await forecaster.forecastDemand(
        'product123',
        'warehouse123',
        'org123',
        7
      )

      expect(result.method).toBe('moving_average')
      expect(result.predictions).toHaveLength(7)
      expect(result.predictions.every(p => p === 0)).toBe(true)
    })

    it('should handle database errors', async () => {
      mockSupabase.select.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      })

      await expect(
        forecaster.forecastDemand('product123', 'warehouse123', 'org123', 30)
      ).rejects.toThrow('Database error')
    })
  })

  describe('private methods', () => {
    it('should prepare time series with filled gaps', () => {
      const data: TimeSeriesData[] = [
        { date: new Date('2024-01-01'), value: 10 },
        { date: new Date('2024-01-03'), value: 15 }, // Gap on Jan 2
        { date: new Date('2024-01-04'), value: 12 }
      ]

      // Access private method via prototype
      const prepareTimeSeries = (forecaster as any).prepareTimeSeries.bind(forecaster)
      const result = prepareTimeSeries(data)

      expect(result).toHaveLength(4) // Should include the missing day
      expect(result).toEqual([10, 0, 15, 12]) // 0 for missing day
    })

    it('should calculate confidence based on historical variance', () => {
      const historical: TimeSeriesData[] = [
        { date: new Date('2024-01-01'), value: 10 },
        { date: new Date('2024-01-02'), value: 12 },
        { date: new Date('2024-01-03'), value: 11 },
        { date: new Date('2024-01-04'), value: 10 },
        { date: new Date('2024-01-05'), value: 11 }
      ]

      const calculateConfidence = (forecaster as any).calculateConfidence.bind(forecaster)
      const confidence = calculateConfidence([11, 11, 11], historical)

      expect(confidence).toBeGreaterThan(0.5)
      expect(confidence).toBeLessThan(1)
    })

    it('should ensemble predictions correctly', () => {
      const predictions = [
        [10, 12, 14],
        [11, 13, 15],
        [12, 14, 16]
      ]

      const ensemblePredictions = (forecaster as any).ensemblePredictions.bind(forecaster)
      const result = ensemblePredictions(predictions)

      expect(result).toEqual([11, 13, 15]) // Average of each position
    })
  })
})