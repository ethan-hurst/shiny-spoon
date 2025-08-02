import { DemandForecaster } from '@/lib/ai/demand-forecasting'
import { createServerClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server')

describe('DemandForecaster', () => {
  let forecaster: DemandForecaster
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

    forecaster = new DemandForecaster()
  })

  describe('forecastDemand', () => {
    const productId = 'product-123'
    const warehouseId = 'warehouse-123'
    const organizationId = 'org-123'
    const horizonDays = 30

    it('should generate demand forecast successfully', async () => {
      // Mock historical data
      const historicalData = Array.from({ length: 90 }, (_, i) => ({
        quantity: Math.floor(Math.random() * 50) + 10,
        created_at: new Date(Date.now() - (90 - i) * 24 * 60 * 60 * 1000).toISOString(),
        orders: {
          organization_id: organizationId,
          warehouse_id: warehouseId,
        },
      }))

      mockSupabase.select.mockResolvedValue({ data: historicalData })

      const result = await forecaster.forecastDemand(
        productId,
        warehouseId,
        organizationId,
        horizonDays
      )

      expect(result).toMatchObject({
        productId,
        warehouseId,
        predictions: expect.any(Array),
        confidence: expect.any(Number),
        method: 'ensemble',
        generatedAt: expect.any(Date),
        horizonDays,
      })

      expect(result.predictions).toHaveLength(horizonDays)
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should use simple moving average for products with limited history', async () => {
      // Mock limited historical data (less than 30 days)
      const limitedData = Array.from({ length: 15 }, (_, i) => ({
        quantity: 20,
        created_at: new Date(Date.now() - (15 - i) * 24 * 60 * 60 * 1000).toISOString(),
        orders: {
          organization_id: organizationId,
          warehouse_id: warehouseId,
        },
      }))

      mockSupabase.select.mockResolvedValue({ data: limitedData })

      const result = await forecaster.forecastDemand(
        productId,
        warehouseId,
        organizationId,
        horizonDays
      )

      expect(result.method).toBe('moving_average')
      expect(result.confidence).toBe(0.6) // Lower confidence for simple method
      expect(result.predictions).toHaveLength(horizonDays)
      expect(result.predictions.every(p => p === 20)).toBe(true) // All predictions should be the average
    })

    it('should handle products with no historical data', async () => {
      mockSupabase.select.mockResolvedValue({ data: [] })

      const result = await forecaster.forecastDemand(
        productId,
        warehouseId,
        organizationId,
        horizonDays
      )

      expect(result.method).toBe('moving_average')
      expect(result.predictions).toHaveLength(horizonDays)
      expect(result.predictions.every(p => p === 0)).toBe(true)
    })

    it('should store predictions in database', async () => {
      mockSupabase.select.mockResolvedValue({
        data: Array.from({ length: 60 }, (_, i) => ({
          quantity: 30,
          created_at: new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000).toISOString(),
          orders: { organization_id: organizationId, warehouse_id: warehouseId },
        })),
      })

      await forecaster.forecastDemand(productId, warehouseId, organizationId, horizonDays)

      expect(mockSupabase.from).toHaveBeenCalledWith('ai_predictions')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: organizationId,
          prediction_type: 'demand',
          entity_type: 'product',
          entity_id: productId,
          prediction_date: expect.any(String),
          prediction_value: expect.objectContaining({
            forecast: expect.any(Array),
            horizonDays,
            warehouseId,
          }),
          confidence_score: expect.any(Number),
          model_version: '1.0.0',
        })
      )
    })
  })

  describe('forecasting methods', () => {
    it('should apply ARIMA forecasting correctly', async () => {
      const timeSeries = [10, 12, 15, 14, 18, 20, 22, 25, 24, 28]
      const horizonDays = 5

      const predictions = await (forecaster as any).arimaForecast(timeSeries, horizonDays)

      expect(predictions).toHaveLength(horizonDays)
      expect(predictions.every(p => p >= 0)).toBe(true)
      // Should show an upward trend based on input data
      expect(predictions[predictions.length - 1]).toBeGreaterThan(timeSeries[timeSeries.length - 1] * 0.8)
    })

    it('should apply exponential smoothing correctly', async () => {
      const timeSeries = [10, 12, 15, 14, 18, 20]
      const horizonDays = 3

      const predictions = await (forecaster as any).exponentialSmoothingForecast(timeSeries, horizonDays)

      expect(predictions).toHaveLength(horizonDays)
      expect(predictions.every(p => p > 0)).toBe(true)
      // Exponential smoothing should produce constant forecast
      expect(new Set(predictions).size).toBe(1)
    })

    it('should apply linear regression correctly', async () => {
      const timeSeries = [10, 20, 30, 40, 50] // Perfect linear trend
      const horizonDays = 5

      const predictions = await (forecaster as any).linearRegressionForecast(timeSeries, horizonDays)

      expect(predictions).toHaveLength(horizonDays)
      expect(predictions[0]).toBeCloseTo(60, 0) // Next value in linear sequence
      expect(predictions[4]).toBeCloseTo(100, 0) // 5 days out
    })

    it('should ensemble predictions correctly', async () => {
      const predictions = [
        [10, 12, 14],
        [15, 15, 15],
        [20, 18, 16],
      ]

      const ensembled = (forecaster as any).ensemblePredictions(predictions)

      expect(ensembled).toHaveLength(3)
      expect(ensembled[0]).toBeCloseTo(15, 0) // Average of 10, 15, 20
      expect(ensembled[1]).toBeCloseTo(15, 0) // Average of 12, 15, 18
      expect(ensembled[2]).toBeCloseTo(15, 0) // Average of 14, 15, 16
    })
  })

  describe('helper methods', () => {
    it('should prepare time series with missing dates filled', () => {
      const data = [
        { date: new Date('2024-01-01'), value: 10 },
        { date: new Date('2024-01-03'), value: 30 }, // Gap on Jan 2
        { date: new Date('2024-01-04'), value: 40 },
      ]

      const timeSeries = (forecaster as any).prepareTimeSeries(data)

      expect(timeSeries).toHaveLength(4) // Should include the missing day
      expect(timeSeries).toEqual([10, 0, 30, 40]) // Missing day filled with 0
    })

    it('should calculate confidence based on historical variance', () => {
      const stableData = Array.from({ length: 30 }, () => ({
        date: new Date(),
        value: 100, // No variance
      }))

      const confidence1 = (forecaster as any).calculateConfidence([100, 100, 100], stableData)
      expect(confidence1).toBe(0.95) // High confidence for stable data

      const volatileData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(),
        value: i % 2 === 0 ? 50 : 150, // High variance
      }))

      const confidence2 = (forecaster as any).calculateConfidence([100, 100, 100], volatileData)
      expect(confidence2).toBeLessThan(0.7) // Lower confidence for volatile data
    })
  })
})