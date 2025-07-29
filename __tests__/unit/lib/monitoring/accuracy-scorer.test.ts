import { AccuracyScorer } from '@/lib/monitoring/accuracy-scorer'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DiscrepancyResult } from '@/lib/monitoring/types'

// Mock dependencies
jest.mock('@/lib/supabase/admin')

describe('AccuracyScorer', () => {
  let accuracyScorer: AccuracyScorer
  let mockSupabase: ReturnType<typeof createMockSupabase>
  
  const mockDiscrepancy: DiscrepancyResult = {
    id: 'disc-123',
    entityType: 'inventory',
    entityId: 'inv-456',
    severity: 'high',
    discrepancyType: 'mismatch',
    confidence: 0.95,
    sourceValue: 100,
    targetValue: 95,
    description: 'Quantity mismatch detected',
    createdAt: new Date('2024-01-15T10:00:00Z')
  }

  const mockScoringConfig = {
    organizationId: 'org-123',
    integrationId: 'integration-123',
    startDate: new Date('2024-01-01T00:00:00Z'),
    endDate: new Date('2024-01-31T23:59:59Z'),
    bucketDuration: 300
  }

  const mockAccuracyCheck = {
    id: 'check-123',
    organization_id: 'org-123',
    integration_id: 'integration-123',
    status: 'completed',
    accuracy_score: 95.5,
    records_checked: 1000,
    discrepancy_count: 15,
    completed_at: '2024-01-15T10:00:00Z'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = createMockSupabase()
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)
    
    accuracyScorer = new AccuracyScorer()
  })

  describe('calculateScore', () => {
    it('should return 100 for zero total records', async () => {
      const score = await accuracyScorer.calculateScore(0, [])
      
      expect(score).toBe(100)
    })

    it('should calculate score with single discrepancy', async () => {
      const score = await accuracyScorer.calculateScore(1000, [mockDiscrepancy])
      
      // Expected calculation:
      // severity weight (high) = 0.7
      // entity weight (inventory) = 1.0
      // confidence weight = 0.95
      // combined weight = 0.7 * 1.0 * 0.95 = 0.665
      // base score = 100 - (0.665 / 1000) * 100 = 99.9335
      // After adjustments (low discrepancy rate bonus): ~100
      expect(score).toBeGreaterThan(99)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should calculate score with multiple discrepancies', async () => {
      const discrepancies = [
        mockDiscrepancy,
        {
          ...mockDiscrepancy,
          id: 'disc-124',
          severity: 'critical',
          confidence: 0.9
        },
        {
          ...mockDiscrepancy,
          id: 'disc-125',
          severity: 'medium',
          entityType: 'pricing',
          confidence: 0.8
        }
      ]

      const score = await accuracyScorer.calculateScore(1000, discrepancies)
      
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should apply critical issue penalty', async () => {
      const criticalDiscrepancies = Array(20).fill(null).map((_, i) => ({
        ...mockDiscrepancy,
        id: `disc-${i}`,
        severity: 'critical',
        confidence: 0.95
      }))

      const score = await accuracyScorer.calculateScore(1000, criticalDiscrepancies)
      
      // Should have penalty for >1% critical issues
      expect(score).toBeLessThan(90)
    })

    it('should apply low discrepancy rate bonus', async () => {
      const singleDiscrepancy = [{
        ...mockDiscrepancy,
        severity: 'low',
        confidence: 0.5
      }]

      const score = await accuracyScorer.calculateScore(10000, singleDiscrepancy)
      
      // Should get bonus for <1% discrepancy rate
      expect(score).toBeGreaterThan(99)
    })

    it('should apply stale data penalty', async () => {
      const staleDiscrepancies = Array(60).fill(null).map((_, i) => ({
        ...mockDiscrepancy,
        id: `disc-${i}`,
        discrepancyType: 'stale',
        severity: 'medium',
        confidence: 0.8
      }))

      const score = await accuracyScorer.calculateScore(1000, staleDiscrepancies)
      
      // Should have penalty for >5% stale data
      expect(score).toBeLessThan(95)
    })

    it('should handle unknown severity and entity types', async () => {
      const unknownDiscrepancy = {
        ...mockDiscrepancy,
        severity: 'unknown' as any,
        entityType: 'unknown' as any,
        confidence: 0.9
      }

      const score = await accuracyScorer.calculateScore(1000, [unknownDiscrepancy])
      
      // Should use default weights (0.5) for unknown types
      expect(score).toBeGreaterThan(99)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should ensure score is between 0 and 100', async () => {
      // Extreme case with many critical discrepancies
      const extremeDiscrepancies = Array(1000).fill(null).map((_, i) => ({
        ...mockDiscrepancy,
        id: `disc-${i}`,
        severity: 'critical',
        confidence: 1.0
      }))

      const score = await accuracyScorer.calculateScore(1000, extremeDiscrepancies)
      
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('getAccuracyBreakdown', () => {
    it('should return breakdown with latest check', async () => {
      const mockDiscrepancies = [
        mockDiscrepancy,
        {
          ...mockDiscrepancy,
          id: 'disc-124',
          entity_type: 'pricing',
          severity: 'critical',
          discrepancy_type: 'missing'
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: mockAccuracyCheck,
                        error: null
                      })
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'discrepancies') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockDiscrepancies,
                error: null
              })
            })
          } as any
        }
        if (table === 'products' || table === 'inventory' || table === 'customers' || table === 'pricing_rules') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                count: 100
              })
            })
          } as any
        }
        return {} as any
      })

      const breakdown = await accuracyScorer.getAccuracyBreakdown(mockScoringConfig)

      expect(breakdown.overall).toBe(95.5)
      expect(breakdown.byEntityType).toBeDefined()
      expect(breakdown.bySeverity).toBeDefined()
      expect(breakdown.byDiscrepancyType).toBeDefined()
    })

    it('should return default breakdown when no checks exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                  })
                })
              })
            })
          })
        })
      } as any)

      const breakdown = await accuracyScorer.getAccuracyBreakdown(mockScoringConfig)

      expect(breakdown.overall).toBe(100)
      expect(breakdown.byEntityType).toEqual({})
      expect(breakdown.bySeverity).toEqual({})
      expect(breakdown.byDiscrepancyType).toEqual({})
    })

    it('should return breakdown when no discrepancies exist', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: mockAccuracyCheck,
                        error: null
                      })
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'discrepancies') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          } as any
        }
        return {} as any
      })

      const breakdown = await accuracyScorer.getAccuracyBreakdown(mockScoringConfig)

      expect(breakdown.overall).toBe(95.5)
      expect(breakdown.byEntityType).toEqual({})
      expect(breakdown.bySeverity).toEqual({})
      expect(breakdown.byDiscrepancyType).toEqual({})
    })

    it('should handle entity count fetching errors', async () => {
      const mockDiscrepancies = [mockDiscrepancy]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'accuracy_checks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: mockAccuracyCheck,
                        error: null
                      })
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'discrepancies') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockDiscrepancies,
                error: null
              })
            })
          } as any
        }
        // Mock error for entity count queries
        if (table === 'products' || table === 'inventory' || table === 'customers' || table === 'pricing_rules') {
          throw new Error('Database error')
        }
        return {} as any
      })

      const breakdown = await accuracyScorer.getAccuracyBreakdown(mockScoringConfig)

      expect(breakdown.overall).toBe(95.5)
      expect(breakdown.byEntityType).toBeDefined()
    })
  })

  describe('getTrendAnalysis', () => {
    it('should analyze trend with sufficient data', async () => {
      const mockMetrics = [
        { accuracy_score: 95.0, metric_timestamp: '2024-01-01T00:00:00Z' },
        { accuracy_score: 96.0, metric_timestamp: '2024-01-02T00:00:00Z' },
        { accuracy_score: 97.0, metric_timestamp: '2024-01-03T00:00:00Z' },
        { accuracy_score: 98.0, metric_timestamp: '2024-01-04T00:00:00Z' },
        { accuracy_score: 99.0, metric_timestamp: '2024-01-05T00:00:00Z' }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockResolvedValue({
                    data: mockMetrics,
                    error: null
                  })
                })
              })
            })
          })
        })
      } as any)

      const trend = await accuracyScorer.getTrendAnalysis(mockScoringConfig)

      expect(trend.trend).toBe('improving')
      expect(trend.changeRate).toBeGreaterThan(0)
      expect(trend.volatility).toBeGreaterThanOrEqual(0)
      expect(trend.forecast).toBeGreaterThan(95)
    })

    it('should return stable trend with insufficient data', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{ accuracy_score: 95.0 }],
                error: null
              })
            })
          })
        })
      } as any)

      const trend = await accuracyScorer.getTrendAnalysis(mockScoringConfig)

      expect(trend.trend).toBe('stable')
      expect(trend.changeRate).toBe(0)
      expect(trend.volatility).toBe(0)
      expect(trend.forecast).toBe(100)
    })

    it('should detect declining trend', async () => {
      const mockMetrics = [
        { accuracy_score: 99.0, metric_timestamp: '2024-01-01T00:00:00Z' },
        { accuracy_score: 97.0, metric_timestamp: '2024-01-02T00:00:00Z' },
        { accuracy_score: 95.0, metric_timestamp: '2024-01-03T00:00:00Z' },
        { accuracy_score: 93.0, metric_timestamp: '2024-01-04T00:00:00Z' },
        { accuracy_score: 91.0, metric_timestamp: '2024-01-05T00:00:00Z' }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockMetrics,
                error: null
              })
            })
          })
        })
      } as any)

      const trend = await accuracyScorer.getTrendAnalysis(mockScoringConfig)

      expect(trend.trend).toBe('declining')
      expect(trend.changeRate).toBeLessThan(0)
    })

    it('should apply query filters correctly', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((field: string, value: string) => {
            if (field === 'organization_id') expect(value).toBe('org-123')
            if (field === 'integration_id') expect(value).toBe('integration-123')
            return {
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    gte: jest.fn().mockReturnValue({
                      lte: jest.fn().mockResolvedValue({
                        data: [],
                        error: null
                      })
                    })
                  })
                })
              })
            }
          })
        })
      } as any)

      await accuracyScorer.getTrendAnalysis(mockScoringConfig)

      expect(mockSupabase.from).toHaveBeenCalledWith('accuracy_metrics')
    })
  })

  describe('getHistoricalTrend', () => {
    it('should return historical trend points', async () => {
      const mockMetrics = [
        {
          metric_timestamp: '2024-01-01T00:00:00Z',
          accuracy_score: 95.0,
          total_records: 1000,
          discrepancy_count: 50,
          integration_id: 'integration-123'
        },
        {
          metric_timestamp: '2024-01-02T00:00:00Z',
          accuracy_score: 96.0,
          total_records: 1100,
          discrepancy_count: 40,
          integration_id: 'integration-123'
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockResolvedValue({
                    data: mockMetrics,
                    error: null
                  })
                })
              })
            })
          })
        })
      } as any)

      const trendPoints = await accuracyScorer.getHistoricalTrend(mockScoringConfig)

      expect(trendPoints).toHaveLength(2)
      expect(trendPoints[0].timestamp).toBeInstanceOf(Date)
      expect(trendPoints[0].accuracyScore).toBe(95.0)
      expect(trendPoints[0].recordsChecked).toBe(1000)
      expect(trendPoints[0].discrepancyCount).toBe(50)
      expect(trendPoints[0].integrationId).toBe('integration-123')
    })

    it('should return empty array when no metrics exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any)

      const trendPoints = await accuracyScorer.getHistoricalTrend(mockScoringConfig)

      expect(trendPoints).toEqual([])
    })
  })

  describe('storeMetrics', () => {
    it('should store metrics successfully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await accuracyScorer.storeMetrics(
        'org-123',
        'integration-123',
        95.5,
        1000,
        45,
        { inventory: 94.0, pricing: 97.0 }
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('accuracy_metrics')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        organization_id: 'org-123',
        integration_id: 'integration-123',
        accuracy_score: 95.5,
        total_records: 1000,
        discrepancy_count: 45,
        metrics_by_type: { inventory: 94.0, pricing: 97.0 },
        metric_timestamp: expect.any(String),
        bucket_duration: 300
      })
    })

    it('should store metrics without integration ID', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await accuracyScorer.storeMetrics('org-123', undefined, 95.5, 1000, 45)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          integration_id: undefined
        })
      )
    })
  })

  describe('getBenchmarkComparison', () => {
    it('should return benchmark comparison', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { accuracy_score: 97.0 },
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const benchmark = await accuracyScorer.getBenchmarkComparison('org-123')

      expect(benchmark.organizationScore).toBe(97.0)
      expect(benchmark.industryAverage).toBe(95.5)
      expect(benchmark.percentile).toBeGreaterThan(50)
      expect(benchmark.percentile).toBeLessThanOrEqual(100)
    })

    it('should handle missing organization metrics', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const benchmark = await accuracyScorer.getBenchmarkComparison('org-123')

      expect(benchmark.organizationScore).toBe(100)
      expect(benchmark.industryAverage).toBe(95.5)
    })

    it('should calculate percentile correctly for below-average score', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { accuracy_score: 90.0 },
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const benchmark = await accuracyScorer.getBenchmarkComparison('org-123')

      expect(benchmark.organizationScore).toBe(90.0)
      expect(benchmark.percentile).toBeLessThan(50)
    })
  })

  describe('getAccuracyReport', () => {
    it('should generate comprehensive accuracy report', async () => {
      const mockBreakdown = {
        overall: 95.0,
        byEntityType: { inventory: 94.0, pricing: 96.0 },
        bySeverity: { critical: 98.0, high: 95.0, medium: 97.0, low: 99.0 },
        byDiscrepancyType: { missing: 96.0, mismatch: 94.0, stale: 97.0, duplicate: 99.0 }
      }

      const mockTrend = {
        trend: 'declining' as const,
        changeRate: -2.5,
        volatility: 8.0,
        forecast: 92.0
      }

      const mockBenchmark = {
        organizationScore: 95.0,
        industryAverage: 95.5,
        percentile: 45.0
      }

      jest.spyOn(accuracyScorer, 'getAccuracyBreakdown').mockResolvedValue(mockBreakdown)
      jest.spyOn(accuracyScorer, 'getTrendAnalysis').mockResolvedValue(mockTrend)
      jest.spyOn(accuracyScorer, 'getBenchmarkComparison').mockResolvedValue(mockBenchmark)

      const report = await accuracyScorer.getAccuracyReport(mockScoringConfig)

      expect(report.summary).toEqual(mockBreakdown)
      expect(report.trend).toEqual(mockTrend)
      expect(report.benchmark).toEqual(mockBenchmark)
      expect(report.recommendations).toBeInstanceOf(Array)
      expect(report.recommendations.length).toBeGreaterThan(0)
    })

    it('should generate relevant recommendations', async () => {
      const mockBreakdown = {
        overall: 90.0, // Below 95%
        byEntityType: { inventory: 85.0 }, // Below 90%
        bySeverity: { critical: 95.0, high: 92.0, medium: 88.0, low: 98.0 },
        byDiscrepancyType: { missing: 92.0, mismatch: 89.0, stale: 91.0, duplicate: 96.0 }
      }

      const mockTrend = {
        trend: 'declining' as const,
        changeRate: -5.0,
        volatility: 12.0, // High volatility
        forecast: 85.0
      }

      const mockBenchmark = {
        organizationScore: 90.0,
        industryAverage: 95.5,
        percentile: 25.0 // Below 50th percentile
      }

      jest.spyOn(accuracyScorer, 'getAccuracyBreakdown').mockResolvedValue(mockBreakdown)
      jest.spyOn(accuracyScorer, 'getTrendAnalysis').mockResolvedValue(mockTrend)
      jest.spyOn(accuracyScorer, 'getBenchmarkComparison').mockResolvedValue(mockBenchmark)

      const report = await accuracyScorer.getAccuracyReport(mockScoringConfig)

      expect(report.recommendations).toContain(
        expect.stringContaining('Accuracy is trending downward')
      )
      expect(report.recommendations).toContain(
        expect.stringContaining('High volatility detected')
      )
      expect(report.recommendations).toContain(
        expect.stringContaining('Overall accuracy below 95%')
      )
      expect(report.recommendations).toContain(
        expect.stringContaining('inventory accuracy is low')
      )
      expect(report.recommendations).toContain(
        expect.stringContaining('below industry average')
      )
    })

    it('should generate critical discrepancy recommendations', async () => {
      const mockBreakdown = {
        overall: 98.0,
        byEntityType: {},
        bySeverity: { critical: 90.0, high: 98.0, medium: 99.0, low: 100.0 }, // Critical issues present
        byDiscrepancyType: {}
      }

      const mockTrend = { trend: 'stable' as const, changeRate: 0, volatility: 1.0, forecast: 98.0 }
      const mockBenchmark = { organizationScore: 98.0, industryAverage: 95.5, percentile: 75.0 }

      jest.spyOn(accuracyScorer, 'getAccuracyBreakdown').mockResolvedValue(mockBreakdown)
      jest.spyOn(accuracyScorer, 'getTrendAnalysis').mockResolvedValue(mockTrend)
      jest.spyOn(accuracyScorer, 'getBenchmarkComparison').mockResolvedValue(mockBenchmark)

      const report = await accuracyScorer.getAccuracyReport(mockScoringConfig)

      expect(report.recommendations).toContain(
        expect.stringContaining('Critical discrepancies detected')
      )
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty severity breakdown', () => {
      const result = (accuracyScorer as any).calculateSeverityBreakdown([], 1000)
      
      expect(result.critical).toBe(100)
      expect(result.high).toBe(100)
      expect(result.medium).toBe(100)
      expect(result.low).toBe(100)
    })

    it('should handle empty type breakdown', () => {
      const result = (accuracyScorer as any).calculateTypeBreakdown([], 1000)
      
      expect(result.missing).toBe(100)
      expect(result.mismatch).toBe(100)
      expect(result.stale).toBe(100)
      expect(result.duplicate).toBe(100)
    })

    it('should handle single score trend calculation', () => {
      const trend = (accuracyScorer as any).calculateTrend([95.0])
      
      expect(trend).toBe(0)
    })

    it('should handle forecast with empty scores', () => {
      const forecast = (accuracyScorer as any).forecastNextScore([])
      
      expect(forecast).toBe(100)
    })

    it('should handle forecast with single score', () => {
      const forecast = (accuracyScorer as any).forecastNextScore([95.0])
      
      expect(forecast).toBe(95.0)
    })

    it('should handle z-score to percentile conversion edge cases', () => {
      const positiveZ = (accuracyScorer as any).zScoreToPercentile(2.0)
      const negativeZ = (accuracyScorer as any).zScoreToPercentile(-2.0)
      const zeroZ = (accuracyScorer as any).zScoreToPercentile(0.0)
      
      expect(positiveZ).toBeGreaterThan(95)
      expect(negativeZ).toBeLessThan(5)
      expect(zeroZ).toBeCloseTo(50, 1)
    })

    it('should handle division by zero in trend calculation', () => {
      // Create scores with same values (no variance)
      const sameScores = [95.0, 95.0, 95.0, 95.0, 95.0]
      const trend = (accuracyScorer as any).calculateTrend(sameScores)
      
      expect(trend).toBe(0)
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(),
          order: jest.fn(),
          limit: jest.fn(),
          gte: jest.fn(),
          lte: jest.fn()
        }),
        insert: jest.fn()
      })
    })
  }
}