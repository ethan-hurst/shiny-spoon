import { AnomalyDetector } from '@/lib/monitoring/anomaly-detector'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DiscrepancyResult, AnomalyResult } from '@/lib/monitoring/types'

// Mock dependencies
jest.mock('@/lib/supabase/admin')

interface HistoricalDiscrepancy {
  entityType: string
  fieldName: string
  discrepancyType: string
  count: number
  avgSeverity: number
  timestamp: Date
}

describe('AnomalyDetector', () => {
  let anomalyDetector: AnomalyDetector
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockDiscrepancies: DiscrepancyResult[] = [
    {
      entityType: 'inventory',
      entityId: 'inv-123',
      fieldName: 'quantity',
      sourceValue: 100,
      targetValue: 95,
      discrepancyType: 'mismatch',
      severity: 'high',
      confidence: 0.95
    },
    {
      entityType: 'inventory',
      entityId: 'inv-456',
      fieldName: 'quantity',
      sourceValue: 50,
      targetValue: 45,
      discrepancyType: 'mismatch',
      severity: 'medium',
      confidence: 0.85
    },
    {
      entityType: 'pricing',
      entityId: 'price-789',
      fieldName: 'price',
      sourceValue: 99.99,
      targetValue: null,
      discrepancyType: 'missing',
      severity: 'critical',
      confidence: 1.0
    },
    {
      entityType: 'pricing',
      entityId: 'price-101',
      fieldName: 'price',
      sourceValue: 79.99,
      targetValue: 79.99,
      discrepancyType: 'stale',
      severity: 'low',
      confidence: 0.7
    }
  ]

  const mockHistoricalData: HistoricalDiscrepancy[] = [
    {
      entityType: 'inventory',
      fieldName: 'quantity',
      discrepancyType: 'mismatch',
      count: 5,
      avgSeverity: 0.4,
      timestamp: new Date('2024-01-01')
    },
    {
      entityType: 'inventory',
      fieldName: 'quantity',
      discrepancyType: 'mismatch',
      count: 7,
      avgSeverity: 0.5,
      timestamp: new Date('2024-01-02')
    },
    {
      entityType: 'inventory',
      fieldName: 'quantity',
      discrepancyType: 'mismatch',
      count: 6,
      avgSeverity: 0.45,
      timestamp: new Date('2024-01-03')
    },
    // Add more historical data points for statistical analysis
    ...Array(10).fill(null).map((_, i) => ({
      entityType: 'inventory',
      fieldName: 'quantity',
      discrepancyType: 'mismatch',
      count: 5 + Math.floor(Math.random() * 3),
      avgSeverity: 0.4 + Math.random() * 0.2,
      timestamp: new Date(`2024-01-${4 + i}`)
    }))
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = createMockSupabase()
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)
    
    anomalyDetector = new AnomalyDetector()
  })

  describe('detectAnomalies', () => {
    it('should detect multiple types of anomalies', async () => {
      const config = {
        discrepancies: mockDiscrepancies,
        historicalData: mockHistoricalData
      }

      const anomalies = await anomalyDetector.detectAnomalies(config)

      expect(anomalies.length).toBeGreaterThan(0)
      
      // Should have different anomaly types
      const anomalyTypes = new Set(anomalies.map(a => a.anomalyType))
      expect(anomalyTypes.size).toBeGreaterThan(0)
    })

    it('should group discrepancies by entity type and field', async () => {
      const config = {
        discrepancies: mockDiscrepancies,
        historicalData: mockHistoricalData
      }

      const anomalies = await anomalyDetector.detectAnomalies(config)

      // Should have anomalies for both inventory and pricing
      const entityTypes = new Set(anomalies.map(a => a.entityId))
      expect(entityTypes.has('inventory')).toBe(true)
      expect(entityTypes.has('pricing')).toBe(true)
    })

    it('should handle empty discrepancies', async () => {
      const config = {
        discrepancies: [],
        historicalData: mockHistoricalData
      }

      const anomalies = await anomalyDetector.detectAnomalies(config)

      expect(anomalies).toEqual([])
    })

    it('should handle insufficient historical data', async () => {
      const config = {
        discrepancies: mockDiscrepancies,
        historicalData: mockHistoricalData.slice(0, 5) // Less than MIN_HISTORICAL_POINTS
      }

      const anomalies = await anomalyDetector.detectAnomalies(config)

      // Should only detect threshold anomalies, not statistical ones
      const statisticalAnomalies = anomalies.filter(a => a.anomalyType === 'statistical')
      expect(statisticalAnomalies).toHaveLength(0)
    })
  })

  describe('detectStatisticalAnomalies', () => {
    it('should detect high z-score anomalies', () => {
      const discrepancies = Array(50).fill(mockDiscrepancies[0]) // Many discrepancies
      
      const anomalies = (anomalyDetector as any).detectStatisticalAnomalies(
        discrepancies,
        mockHistoricalData,
        'inventory'
      )

      expect(anomalies.length).toBeGreaterThan(0)
      
      const statisticalAnomaly = anomalies.find(a => a.anomalyType === 'statistical')
      expect(statisticalAnomaly).toBeDefined()
      expect(statisticalAnomaly?.deviationScore).toBeGreaterThan(2.5)
      expect(statisticalAnomaly?.explanation).toContain('standard deviations')
    })

    it('should detect severity distribution anomalies', () => {
      const highSeverityDiscrepancies = [
        ...mockDiscrepancies.filter(d => d.entityType === 'inventory'),
        // Add more high severity items
        ...Array(10).fill(null).map(() => ({
          ...mockDiscrepancies[0],
          severity: 'critical' as const,
          entityId: `inv-${Math.random()}`
        }))
      ]

      const anomalies = (anomalyDetector as any).detectStatisticalAnomalies(
        highSeverityDiscrepancies,
        mockHistoricalData,
        'inventory'
      )

      const severityAnomaly = anomalies.find(a => 
        a.explanation.includes('Average severity score')
      )
      expect(severityAnomaly).toBeDefined()
    })

    it('should calculate z-score correctly', () => {
      const values = [10, 12, 11, 9, 10, 13, 11, 10, 12, 11]
      const mean = (anomalyDetector as any).calculateMean(values)
      const stdDev = (anomalyDetector as any).calculateStandardDeviation(values, mean)
      
      const currentValue = 20 // Outlier
      const zScore = (currentValue - mean) / stdDev
      
      expect(zScore).toBeGreaterThan(2)
    })
  })

  describe('detectPatternAnomalies', () => {
    it('should detect weekly pattern anomalies', () => {
      // Create historical data with weekly pattern
      const weeklyHistoricalData: HistoricalDiscrepancy[] = []
      
      // Generate 4 weeks of data with higher counts on weekdays
      for (let week = 0; week < 4; week++) {
        for (let day = 0; day < 7; day++) {
          const date = new Date('2024-01-01')
          date.setDate(date.getDate() + week * 7 + day)
          
          weeklyHistoricalData.push({
            entityType: 'inventory',
            fieldName: 'quantity',
            discrepancyType: 'mismatch',
            count: day >= 1 && day <= 5 ? 10 + Math.random() * 2 : 2 + Math.random(),
            avgSeverity: 0.5,
            timestamp: date
          })
        }
      }

      // Current is weekend but has weekday-level discrepancies
      const currentDate = new Date('2024-01-28') // Sunday
      const weekdayLevelDiscrepancies = Array(11).fill(mockDiscrepancies[0])

      const anomalies = (anomalyDetector as any).detectPatternAnomalies(
        weekdayLevelDiscrepancies,
        weeklyHistoricalData,
        'inventory'
      )

      expect(anomalies.length).toBeGreaterThan(0)
      const patternAnomaly = anomalies.find(a => a.anomalyType === 'pattern')
      expect(patternAnomaly).toBeDefined()
    })

    it('should detect sudden changes', () => {
      const recentHistoricalData = [
        {
          entityType: 'inventory',
          fieldName: 'quantity',
          discrepancyType: 'mismatch',
          count: 5,
          avgSeverity: 0.4,
          timestamp: new Date(Date.now() - 3600000) // 1 hour ago
        },
        ...mockHistoricalData
      ]

      const manyDiscrepancies = Array(20).fill(mockDiscrepancies[0]) // 4x increase

      const anomalies = (anomalyDetector as any).detectPatternAnomalies(
        manyDiscrepancies,
        recentHistoricalData,
        'inventory'
      )

      const suddenChangeAnomaly = anomalies.find(a => 
        a.explanation.includes('Sudden')
      )
      expect(suddenChangeAnomaly).toBeDefined()
      expect(suddenChangeAnomaly?.deviationScore).toBeGreaterThan(1)
    })
  })

  describe('detectThresholdAnomalies', () => {
    it('should detect critical severity anomalies', () => {
      const criticalDiscrepancies = [
        {
          ...mockDiscrepancies[0],
          severity: 'critical' as const
        },
        {
          ...mockDiscrepancies[1],
          severity: 'critical' as const
        }
      ]

      const anomalies = (anomalyDetector as any).detectThresholdAnomalies(
        criticalDiscrepancies,
        'inventory'
      )

      expect(anomalies.length).toBeGreaterThan(0)
      
      const criticalAnomaly = anomalies.find(a => 
        a.explanation.includes('critical severity')
      )
      expect(criticalAnomaly).toBeDefined()
      expect(criticalAnomaly?.confidence).toBe(1.0)
    })

    it('should detect high confidence mismatches', () => {
      const highConfidenceDiscrepancies = Array(10).fill(null).map(() => ({
        ...mockDiscrepancies[0],
        discrepancyType: 'mismatch' as const,
        confidence: 0.95,
        entityId: `inv-${Math.random()}`
      }))

      const anomalies = (anomalyDetector as any).detectThresholdAnomalies(
        highConfidenceDiscrepancies,
        'inventory'
      )

      const mismatchAnomaly = anomalies.find(a => 
        a.explanation.includes('high-confidence data mismatches')
      )
      expect(mismatchAnomaly).toBeDefined()
    })

    it('should detect high stale data percentage', () => {
      const staleDiscrepancies = Array(10).fill(null).map((_, i) => ({
        ...mockDiscrepancies[0],
        discrepancyType: i < 4 ? 'stale' as const : 'mismatch' as const,
        entityId: `inv-${i}`
      }))

      const anomalies = (anomalyDetector as any).detectThresholdAnomalies(
        staleDiscrepancies,
        'inventory'
      )

      const staleAnomaly = anomalies.find(a => 
        a.explanation.includes('data is stale')
      )
      expect(staleAnomaly).toBeDefined()
      expect(staleAnomaly?.currentValue).toBeGreaterThan(30)
    })
  })

  describe('Time pattern detection', () => {
    it('should detect weekly patterns with high confidence', () => {
      const weeklyData: HistoricalDiscrepancy[] = []
      
      // Generate consistent weekly pattern
      for (let week = 0; week < 4; week++) {
        for (let day = 0; day < 7; day++) {
          const date = new Date('2024-01-01')
          date.setDate(date.getDate() + week * 7 + day)
          
          weeklyData.push({
            entityType: 'inventory',
            fieldName: 'quantity',
            discrepancyType: 'mismatch',
            count: day === 0 || day === 6 ? 2 : 10, // Low on weekends
            avgSeverity: 0.5,
            timestamp: date
          })
        }
      }

      const pattern = (anomalyDetector as any).detectTimePattern(weeklyData)
      
      expect(pattern).toBeDefined()
      expect(pattern?.type).toBe('weekly')
      expect(pattern?.confidence).toBeGreaterThan(0.8)
    })

    it('should detect daily patterns', () => {
      const dailyData: HistoricalDiscrepancy[] = []
      
      // Generate hourly pattern over 2 weeks
      for (let day = 0; day < 14; day++) {
        for (let hour = 0; hour < 24; hour += 4) { // Sample every 4 hours
          const date = new Date('2024-01-01')
          date.setDate(date.getDate() + day)
          date.setHours(hour)
          
          dailyData.push({
            entityType: 'inventory',
            fieldName: 'quantity',
            discrepancyType: 'mismatch',
            count: hour >= 9 && hour <= 17 ? 15 : 3, // High during business hours
            avgSeverity: 0.5,
            timestamp: date
          })
        }
      }

      const pattern = (anomalyDetector as any).detectTimePattern(dailyData)
      
      expect(pattern).toBeDefined()
      expect(pattern?.type).toBe('daily')
      expect(pattern?.confidence).toBeGreaterThan(0.8)
    })

    it('should return null for insufficient data', () => {
      const insufficientData = mockHistoricalData.slice(0, 5)
      
      const pattern = (anomalyDetector as any).detectTimePattern(insufficientData)
      
      expect(pattern).toBeNull()
    })
  })

  describe('Statistical calculations', () => {
    it('should calculate mean correctly', () => {
      const values = [10, 20, 30, 40, 50]
      const mean = (anomalyDetector as any).calculateMean(values)
      
      expect(mean).toBe(30)
    })

    it('should calculate standard deviation correctly', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9]
      const mean = (anomalyDetector as any).calculateMean(values)
      const stdDev = (anomalyDetector as any).calculateStandardDeviation(values, mean)
      
      expect(stdDev).toBeCloseTo(2.0, 1)
    })

    it('should calculate variance correctly', () => {
      const values = [1, 2, 3, 4, 5]
      const mean = (anomalyDetector as any).calculateMean(values)
      const variance = (anomalyDetector as any).calculateVariance(values, mean)
      
      expect(variance).toBeCloseTo(2.5, 1)
    })

    it('should handle empty arrays', () => {
      const mean = (anomalyDetector as any).calculateMean([])
      const stdDev = (anomalyDetector as any).calculateStandardDeviation([], 0)
      const variance = (anomalyDetector as any).calculateVariance([], 0)
      
      expect(mean).toBe(0)
      expect(stdDev).toBe(0)
      expect(variance).toBe(0)
    })

    it('should handle single value arrays', () => {
      const values = [42]
      const mean = (anomalyDetector as any).calculateMean(values)
      const stdDev = (anomalyDetector as any).calculateStandardDeviation(values, mean)
      
      expect(mean).toBe(42)
      expect(stdDev).toBe(0)
    })
  })

  describe('zScoreToConfidence', () => {
    it('should map z-scores to confidence levels correctly', () => {
      const testCases = [
        { zScore: 3.5, expectedConfidence: 0.99 },
        { zScore: 2.7, expectedConfidence: 0.95 },
        { zScore: 2.2, expectedConfidence: 0.90 },
        { zScore: 1.7, expectedConfidence: 0.80 },
        { zScore: 1.0, expectedConfidence: 0.70 },
        { zScore: -3.0, expectedConfidence: 0.99 }, // Should use absolute value
      ]

      for (const { zScore, expectedConfidence } of testCases) {
        const confidence = (anomalyDetector as any).zScoreToConfidence(zScore)
        expect(confidence).toBe(expectedConfidence)
      }
    })
  })

  describe('deduplicateAndRankAnomalies', () => {
    it('should remove duplicates keeping highest confidence', () => {
      const anomalies: AnomalyResult[] = [
        {
          entityId: 'inventory',
          anomalyType: 'statistical',
          confidence: 0.8,
          deviationScore: 2.5,
          currentValue: 50,
          explanation: 'First anomaly'
        },
        {
          entityId: 'inventory',
          anomalyType: 'statistical',
          confidence: 0.9,
          deviationScore: 3.0,
          currentValue: 50,
          explanation: 'Second anomaly'
        },
        {
          entityId: 'pricing',
          anomalyType: 'threshold',
          confidence: 0.95,
          deviationScore: 1.5,
          currentValue: 10,
          explanation: 'Different entity'
        }
      ]

      const deduplicated = (anomalyDetector as any).deduplicateAndRankAnomalies(anomalies)
      
      expect(deduplicated).toHaveLength(2)
      expect(deduplicated[0].confidence).toBe(0.95) // Highest confidence first
      expect(deduplicated[1].confidence).toBe(0.9) // Kept higher confidence duplicate
    })

    it('should sort by confidence descending', () => {
      const anomalies: AnomalyResult[] = [
        { entityId: 'a', anomalyType: 'statistical', confidence: 0.7, deviationScore: 1, currentValue: 1, explanation: '' },
        { entityId: 'b', anomalyType: 'pattern', confidence: 0.9, deviationScore: 1, currentValue: 1, explanation: '' },
        { entityId: 'c', anomalyType: 'threshold', confidence: 0.8, deviationScore: 1, currentValue: 1, explanation: '' }
      ]

      const sorted = (anomalyDetector as any).deduplicateAndRankAnomalies(anomalies)
      
      expect(sorted[0].confidence).toBe(0.9)
      expect(sorted[1].confidence).toBe(0.8)
      expect(sorted[2].confidence).toBe(0.7)
    })
  })

  describe('calculateSeverityScore', () => {
    it('should calculate weighted severity score', () => {
      const discrepancies: DiscrepancyResult[] = [
        { ...mockDiscrepancies[0], severity: 'critical' }, // 1.0
        { ...mockDiscrepancies[1], severity: 'high' },     // 0.7
        { ...mockDiscrepancies[2], severity: 'medium' },   // 0.4
        { ...mockDiscrepancies[3], severity: 'low' }       // 0.1
      ]

      const score = (anomalyDetector as any).calculateSeverityScore(discrepancies)
      
      // (1.0 + 0.7 + 0.4 + 0.1) / 4 = 0.55
      expect(score).toBeCloseTo(0.55, 2)
    })

    it('should handle empty discrepancies', () => {
      const score = (anomalyDetector as any).calculateSeverityScore([])
      expect(score).toBe(0)
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn(),
    rpc: jest.fn()
  }
}