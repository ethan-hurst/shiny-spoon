import { AnalyticsCalculator, DateRange } from '@/lib/analytics/calculate-metrics'
import { createServerClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('date-fns', () => ({
  format: jest.fn()
}))

describe('AnalyticsCalculator', () => {
  let analyticsCalculator: AnalyticsCalculator
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let mockFormat: jest.MockedFunction<typeof format>
  
  const mockDateRange: DateRange = {
    from: new Date('2024-01-01T00:00:00Z'),
    to: new Date('2024-01-31T23:59:59Z')
  }

  const mockOrders = [
    {
      id: 'order-1',
      created_at: '2024-01-15T10:00:00Z',
      metadata: { hasError: false }
    },
    {
      id: 'order-2',
      created_at: '2024-01-15T11:00:00Z',
      metadata: { hasError: true, errors: ['Price mismatch'] }
    },
    {
      id: 'order-3',
      created_at: '2024-01-16T10:00:00Z',
      metadata: { hasError: false }
    },
    {
      id: 'order-4',
      created_at: '2024-01-16T11:00:00Z',
      metadata: { errors: ['Inventory error', 'Delivery issue'] }
    }
  ]

  const mockSyncJobs = [
    {
      id: 'sync-1',
      created_at: '2024-01-15T09:00:00Z',
      updated_at: '2024-01-15T09:05:00Z',
      status: 'completed',
      metadata: {}
    },
    {
      id: 'sync-2',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:03:00Z',
      status: 'completed',
      metadata: {}
    },
    {
      id: 'sync-3',
      created_at: '2024-01-16T09:00:00Z',
      updated_at: '2024-01-16T09:10:00Z',
      status: 'failed',
      metadata: {}
    }
  ]

  const mockSyncPerformanceLogs = [
    {
      id: 'log-1',
      started_at: '2024-01-15T09:00:00Z',
      duration_ms: 300000,
      status: 'completed'
    },
    {
      id: 'log-2',
      started_at: '2024-01-15T10:00:00Z',
      duration_ms: 180000,
      status: 'completed'
    },
    {
      id: 'log-3',
      started_at: '2024-01-16T09:00:00Z',
      duration_ms: 600000,
      status: 'failed'
    }
  ]

  const mockInventory = [
    {
      quantity: 100,
      available_quantity: 95,
      updated_at: '2024-01-15T12:00:00Z',
      metadata: { price: 25.99 }
    },
    {
      quantity: 50,
      available_quantity: 0,
      updated_at: '2024-01-15T12:00:00Z',
      metadata: { price: 15.50 }
    },
    {
      quantity: 20,
      available_quantity: 5,
      updated_at: '2024-01-15T12:00:00Z',
      metadata: { price: 45.00 }
    }
  ]

  const mockInventorySnapshots = [
    {
      snapshot_date: '2024-01-15',
      quantity: 100,
      value: 2599,
      organization_id: 'org-123'
    },
    {
      snapshot_date: '2024-01-15',
      quantity: 0,
      value: 0,
      organization_id: 'org-123'
    },
    {
      snapshot_date: '2024-01-16',
      quantity: 5,
      value: 225,
      organization_id: 'org-123'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = createMockSupabase()
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    
    mockFormat = format as jest.MockedFunction<typeof format>
    mockFormat.mockImplementation((date: Date | string, formatStr: string) => {
      const d = new Date(date)
      if (formatStr === 'yyyy-MM-dd') {
        return d.toISOString().split('T')[0]
      }
      return d.toISOString()
    })
    
    analyticsCalculator = new AnalyticsCalculator()
  })

  describe('constructor', () => {
    it('should use provided supabase client', () => {
      const customSupabase = createMockSupabase()
      const calculator = new AnalyticsCalculator(customSupabase)
      
      expect(calculator['supabase']).toBe(customSupabase)
    })

    it('should create default supabase client when none provided', () => {
      const calculator = new AnalyticsCalculator()
      
      expect(createServerClient).toHaveBeenCalled()
      expect(calculator['supabase']).toBeDefined()
    })
  })

  describe('calculateOrderAccuracy', () => {
    it('should calculate order accuracy metrics by date', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockOrders,
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await analyticsCalculator.calculateOrderAccuracy('org-123', mockDateRange)

      expect(result).toHaveLength(2)
      
      // First date (2024-01-15): 2 orders, 1 accurate, 1 error
      expect(result[0]).toEqual({
        date: '2024-01-15',
        totalOrders: 2,
        accurateOrders: 1,
        errorCount: 1,
        accuracyRate: 50
      })

      // Second date (2024-01-16): 2 orders, 1 accurate, 2 errors
      expect(result[1]).toEqual({
        date: '2024-01-16',
        totalOrders: 2,
        accurateOrders: 1,
        errorCount: 2,
        accuracyRate: 50
      })
    })

    it('should handle orders with no errors', async () => {
      const accurateOrders = [
        {
          id: 'order-1',
          created_at: '2024-01-15T10:00:00Z',
          metadata: { hasError: false }
        },
        {
          id: 'order-2',
          created_at: '2024-01-15T11:00:00Z',
          metadata: {}
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: accurateOrders,
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await analyticsCalculator.calculateOrderAccuracy('org-123', mockDateRange)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        date: '2024-01-15',
        totalOrders: 2,
        accurateOrders: 2,
        errorCount: 0,
        accuracyRate: 100
      })
    })

    it('should handle orders with multiple errors', async () => {
      const ordersWithMultipleErrors = [
        {
          id: 'order-1',
          created_at: '2024-01-15T10:00:00Z',
          metadata: { errors: ['Error 1', 'Error 2', 'Error 3'] }
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: ordersWithMultipleErrors,
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await analyticsCalculator.calculateOrderAccuracy('org-123', mockDateRange)

      expect(result[0]).toEqual({
        date: '2024-01-15',
        totalOrders: 1,
        accurateOrders: 0,
        errorCount: 3,
        accuracyRate: 0
      })
    })

    it('should handle empty order data', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await analyticsCalculator.calculateOrderAccuracy('org-123', mockDateRange)

      expect(result).toHaveLength(0)
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' }
                })
              })
            })
          })
        })
      } as any)

      await expect(
        analyticsCalculator.calculateOrderAccuracy('org-123', mockDateRange)
      ).rejects.toEqual({ message: 'Database error' })
    })

    it('should use correct date range in query', async () => {
      const mockGte = jest.fn().mockReturnValue({
        lte: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      })
      const mockLte = jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: mockGte,
            lte: mockLte
          })
        })
      } as any)

      await analyticsCalculator.calculateOrderAccuracy('org-123', mockDateRange)

      expect(mockGte).toHaveBeenCalledWith('created_at', mockDateRange.from.toISOString())
      expect(mockGte().lte).toHaveBeenCalledWith('created_at', mockDateRange.to.toISOString())
    })
  })

  describe('calculateSyncPerformance', () => {
    it('should use sync_performance_logs when available', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockSyncPerformanceLogs,
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await analyticsCalculator.calculateSyncPerformance('org-123', mockDateRange)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        date: '2024-01-15',
        syncCount: 2,
        avgDuration: 240000, // Average of 300000 and 180000
        successRate: 100
      })
      expect(result[1]).toEqual({
        date: '2024-01-16',
        syncCount: 1,
        avgDuration: 600000,
        successRate: 0
      })
    })

    it('should fall back to sync_jobs when sync_performance_logs not available', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'sync_performance_logs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Table not found' }
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'sync_jobs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: mockSyncJobs,
                      error: null
                    })
                  })
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await analyticsCalculator.calculateSyncPerformance('org-123', mockDateRange)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        date: '2024-01-15',
        syncCount: 2,
        avgDuration: 240000, // Average duration calculation
        successRate: 100
      })
      expect(result[1]).toEqual({
        date: '2024-01-16',
        syncCount: 1,
        avgDuration: 600000,
        successRate: 0
      })
    })

    it('should handle missing timestamps in sync jobs', async () => {
      const jobsWithMissingTimestamps = [
        {
          id: 'sync-1',
          created_at: '2024-01-15T09:00:00Z',
          updated_at: null,
          status: 'running',
          metadata: {}
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'sync_performance_logs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Table not found' }
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'sync_jobs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: jobsWithMissingTimestamps,
                      error: null
                    })
                  })
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const result = await analyticsCalculator.calculateSyncPerformance('org-123', mockDateRange)

      expect(result[0]).toEqual({
        date: '2024-01-15',
        syncCount: 1,
        avgDuration: 0,
        successRate: 0
      })
    })

    it('should handle sync_jobs database error', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'sync_performance_logs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Table not found' }
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'sync_jobs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Sync jobs error' }
                    })
                  })
                })
              })
            })
          } as any
        }
        return {} as any
      })

      await expect(
        analyticsCalculator.calculateSyncPerformance('org-123', mockDateRange)
      ).rejects.toEqual({ message: 'Sync jobs error' })
    })

    it('should handle empty sync data', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await analyticsCalculator.calculateSyncPerformance('org-123', mockDateRange)

      expect(result).toHaveLength(0)
    })
  })

  describe('calculateInventoryTrends', () => {
    it('should use inventory_snapshots when available', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockInventorySnapshots,
                  error: null
                })
              })
            })
          })
        })
      } as any)

      const result = await analyticsCalculator.calculateInventoryTrends('org-123', mockDateRange)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        date: '2024-01-15',
        totalValue: 2599,
        lowStockCount: 0,
        outOfStockCount: 1
      })
      expect(result[1]).toEqual({
        date: '2024-01-16',
        totalValue: 225,
        lowStockCount: 1,
        outOfStockCount: 0
      })
    })

    it('should fall back to current inventory when snapshots not available', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory_snapshots') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Table not found' }
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'inventory') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockInventory,
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })

      // Mock date range to have 2 days
      const shortDateRange = {
        from: new Date('2024-01-15T00:00:00Z'),
        to: new Date('2024-01-16T23:59:59Z')
      }

      const result = await analyticsCalculator.calculateInventoryTrends('org-123', shortDateRange)

      expect(result).toHaveLength(2)
      // Each day should have the same synthetic data
      result.forEach(dayMetrics => {
        expect(dayMetrics.totalValue).toBeCloseTo(2692.25, 2) // 95*25.99 + 0*15.50 + 5*45.00
        expect(dayMetrics.lowStockCount).toBe(1) // One item with quantity < 10
        expect(dayMetrics.outOfStockCount).toBe(1) // One item with quantity = 0
      })
    })

    it('should handle inventory with missing price metadata', async () => {
      const inventoryWithoutPrice = [
        {
          quantity: 100,
          available_quantity: 95,
          updated_at: '2024-01-15T12:00:00Z',
          metadata: {}
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory_snapshots') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Table not found' }
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'inventory') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: inventoryWithoutPrice,
                  error: null
                })
              })
            })
          } as any
        }
        return {} as any
      })

      const shortDateRange = {
        from: new Date('2024-01-15T00:00:00Z'),
        to: new Date('2024-01-15T23:59:59Z')
      }

      const result = await analyticsCalculator.calculateInventoryTrends('org-123', shortDateRange)

      expect(result[0].totalValue).toBe(950) // 95 * 10 (default price)
    })

    it('should handle inventory database error', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory_snapshots') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Snapshots not found' }
                    })
                  })
                })
              })
            })
          } as any
        }
        if (table === 'inventory') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Inventory error' }
                })
              })
            })
          } as any
        }
        return {} as any
      })

      await expect(
        analyticsCalculator.calculateInventoryTrends('org-123', mockDateRange)
      ).rejects.toEqual({ message: 'Inventory error' })
    })
  })

  describe('calculateRevenueImpact', () => {
    it('should calculate revenue impact metrics', async () => {
      // Mock the calculateOrderAccuracy method to return predictable data
      jest.spyOn(analyticsCalculator, 'calculateOrderAccuracy')
        .mockResolvedValueOnce([
          { date: '2024-01-01', totalOrders: 100, accurateOrders: 80, errorCount: 20, accuracyRate: 80 },
          { date: '2024-01-02', totalOrders: 100, accurateOrders: 85, errorCount: 15, accuracyRate: 85 }
        ])
        .mockResolvedValueOnce([
          { date: '2024-01-16', totalOrders: 100, accurateOrders: 90, errorCount: 10, accuracyRate: 90 },
          { date: '2024-01-17', totalOrders: 100, accurateOrders: 95, errorCount: 5, accuracyRate: 95 }
        ])

      const result = await analyticsCalculator.calculateRevenueImpact('org-123', mockDateRange)

      // Expected: before avg = 82.5%, after avg = 92.5%, improvement = 10%
      // Errors prevented = 200 orders * 10% = 20
      // Total saved = 20 * $12,000 = $240,000
      // Annual projection = $240,000 / 31 days * 365 = ~$2,838,710

      expect(result.accuracyImprovement).toBe(10)
      expect(result.errorsPrevented).toBe(20)
      expect(result.totalSaved).toBe(240000)
      expect(result.projectedAnnualSavings).toBeCloseTo(2825806.45, 0)
    })

    it('should handle zero improvement', async () => {
      jest.spyOn(analyticsCalculator, 'calculateOrderAccuracy')
        .mockResolvedValueOnce([
          { date: '2024-01-01', totalOrders: 100, accurateOrders: 90, errorCount: 10, accuracyRate: 90 }
        ])
        .mockResolvedValueOnce([
          { date: '2024-01-16', totalOrders: 100, accurateOrders: 90, errorCount: 10, accuracyRate: 90 }
        ])

      const result = await analyticsCalculator.calculateRevenueImpact('org-123', mockDateRange)

      expect(result.accuracyImprovement).toBe(0)
      expect(result.errorsPrevented).toBe(0)
      expect(result.totalSaved).toBe(0)
      expect(result.projectedAnnualSavings).toBe(0)
    })

    it('should handle empty metrics', async () => {
      jest.spyOn(analyticsCalculator, 'calculateOrderAccuracy')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await analyticsCalculator.calculateRevenueImpact('org-123', mockDateRange)

      expect(result.accuracyImprovement).toBe(0)
      expect(result.errorsPrevented).toBe(0)
      expect(result.totalSaved).toBe(0)
      expect(result.projectedAnnualSavings).toBe(0)
    })

    it('should split date range correctly', async () => {
      const calculateOrderAccuracy = jest.spyOn(analyticsCalculator, 'calculateOrderAccuracy')
        .mockResolvedValue([])

      await analyticsCalculator.calculateRevenueImpact('org-123', mockDateRange)

      expect(calculateOrderAccuracy).toHaveBeenCalledTimes(2)
      
      const firstCall = calculateOrderAccuracy.mock.calls[0]
      const secondCall = calculateOrderAccuracy.mock.calls[1]
      
      expect(firstCall[1].from).toEqual(mockDateRange.from)
      expect(secondCall[1].to).toEqual(mockDateRange.to)
      
      // Verify the midpoint is calculated correctly
      const expectedMidpoint = new Date(
        mockDateRange.from.getTime() + (mockDateRange.to.getTime() - mockDateRange.from.getTime()) / 2
      )
      expect(firstCall[1].to.getTime()).toBeCloseTo(expectedMidpoint.getTime(), -1)
      expect(secondCall[1].from.getTime()).toBeCloseTo(expectedMidpoint.getTime(), -1)
    })
  })

  describe('cacheMetrics', () => {
    it('should cache order accuracy metrics', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      const date = new Date('2024-01-15T00:00:00Z')
      const metrics = {
        orderAccuracy: {
          date: '2024-01-15',
          totalOrders: 100,
          accurateOrders: 95,
          errorCount: 5,
          accuracyRate: 95
        }
      }

      await analyticsCalculator.cacheMetrics('org-123', date, metrics)

      expect(mockUpsert).toHaveBeenCalledWith([{
        organization_id: 'org-123',
        metric_type: 'order_accuracy',
        metric_date: '2024-01-15',
        total_orders: 100,
        accurate_orders: 95,
        error_count: 5,
        accuracy_rate: 95
      }], {
        onConflict: 'organization_id,metric_type,metric_date'
      })
    })

    it('should cache sync performance metrics', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      const date = new Date('2024-01-15T00:00:00Z')
      const metrics = {
        syncPerformance: {
          date: '2024-01-15',
          syncCount: 10,
          avgDuration: 300000,
          successRate: 95
        }
      }

      await analyticsCalculator.cacheMetrics('org-123', date, metrics)

      expect(mockUpsert).toHaveBeenCalledWith([{
        organization_id: 'org-123',
        metric_type: 'sync_performance',
        metric_date: '2024-01-15',
        sync_count: 10,
        sync_duration_ms: 300000,
        metadata: { success_rate: 95 }
      }], {
        onConflict: 'organization_id,metric_type,metric_date'
      })
    })

    it('should cache multiple metrics together', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      const date = new Date('2024-01-15T00:00:00Z')
      const metrics = {
        orderAccuracy: {
          date: '2024-01-15',
          totalOrders: 100,
          accurateOrders: 95,
          errorCount: 5,
          accuracyRate: 95
        },
        syncPerformance: {
          date: '2024-01-15',
          syncCount: 10,
          avgDuration: 300000,
          successRate: 95
        }
      }

      await analyticsCalculator.cacheMetrics('org-123', date, metrics)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ metric_type: 'order_accuracy' }),
          expect.objectContaining({ metric_type: 'sync_performance' })
        ]),
        { onConflict: 'organization_id,metric_type,metric_date' }
      )
    })

    it('should not cache when no metrics provided', async () => {
      const mockUpsert = jest.fn()
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      const date = new Date('2024-01-15T00:00:00Z')
      const metrics = {}

      await analyticsCalculator.cacheMetrics('org-123', date, metrics)

      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('should format date correctly for caching', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      } as any)

      const date = new Date('2024-01-15T12:30:45Z')
      const metrics = {
        orderAccuracy: {
          date: '2024-01-15',
          totalOrders: 100,
          accurateOrders: 95,
          errorCount: 5,
          accuracyRate: 95
        }
      }

      await analyticsCalculator.cacheMetrics('org-123', date, metrics)

      expect(mockFormat).toHaveBeenCalledWith(date, 'yyyy-MM-dd')
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ metric_date: '2024-01-15' })
        ]),
        expect.any(Object)
      )
    })
  })
})

// Helper function to create mock Supabase client
function createMockSupabase() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn()
            })
          })
        })
      }),
      upsert: jest.fn()
    })
  }
}