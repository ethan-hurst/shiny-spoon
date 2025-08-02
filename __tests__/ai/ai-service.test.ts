import { AIService } from '@/lib/ai/ai-service'
import { createServerClient } from '@/lib/supabase/server'
import { generateText, streamText } from 'ai'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('ai')
jest.mock('openai')

describe('AIService', () => {
  let aiService: AIService
  let mockSupabase: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
    }

    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock AI responses
    ;(generateText as jest.Mock).mockResolvedValue({
      text: `Executive Summary: Inventory levels are healthy overall.
             
             Recommendations:
             1. Increase safety stock for high-demand products
             2. Review pricing for slow-moving items
             3. Optimize warehouse space utilization
             
             Alerts:
             No critical alerts at this time.`,
    })

    aiService = new AIService()
  })

  describe('generateInsights', () => {
    const organizationId = 'test-org-123'
    const dateRange = {
      from: new Date('2024-01-01'),
      to: new Date('2024-01-31'),
    }

    it('should generate insights successfully', async () => {
      // Mock data responses
      mockSupabase.select.mockImplementation(() => {
        if (mockSupabase.from.mock.calls[0][0] === 'inventory_snapshots') {
          return Promise.resolve({
            data: [
              { quantity: 100, value: 1000 },
              { quantity: 5, value: 50 },
            ],
          })
        }
        if (mockSupabase.from.mock.calls[0][0] === 'orders') {
          return Promise.resolve({
            data: [
              { total: 500, created_at: '2024-01-15T10:00:00Z' },
              { total: 750, created_at: '2024-01-16T10:00:00Z' },
            ],
          })
        }
        if (mockSupabase.from.mock.calls[0][0] === 'product_pricing_history') {
          return Promise.resolve({
            data: [
              { price: 10, cost: 6 },
              { price: 12, cost: 7 },
            ],
          })
        }
        return Promise.resolve({ data: [] })
      })

      const result = await aiService.generateInsights(organizationId, dateRange)

      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('alerts')
      expect(result.recommendations).toHaveLength(3)
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          system: expect.stringContaining('expert business analyst'),
          prompt: expect.stringContaining('Inventory Summary'),
          temperature: 0.7,
          maxTokens: 1000,
        })
      )
    })

    it('should store insights in database', async () => {
      mockSupabase.select.mockResolvedValue({ data: [] })

      await aiService.generateInsights(organizationId, dateRange)

      expect(mockSupabase.from).toHaveBeenCalledWith('ai_insights')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            organization_id: organizationId,
            insight_type: 'summary',
            title: 'Daily Business Summary',
          }),
        ])
      )
    })

    it('should handle errors gracefully', async () => {
      mockSupabase.select.mockRejectedValue(new Error('Database error'))

      await expect(
        aiService.generateInsights(organizationId, dateRange)
      ).rejects.toThrow('Database error')
    })
  })

  describe('streamInsights', () => {
    it('should stream AI responses', async () => {
      const mockStream = {
        toTextStreamResponse: jest.fn().mockReturnValue('stream-response'),
      }

      ;(streamText as jest.Mock).mockResolvedValue(mockStream)

      const organizationId = 'test-org-123'
      const context = {
        messages: [
          { role: 'user', content: 'What are my top selling products?' },
        ],
      }

      const result = await aiService.streamInsights(organizationId, context)

      expect(result).toBe('stream-response')
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          system: expect.stringContaining('AI assistant'),
          messages: context.messages,
          temperature: 0.7,
          maxTokens: 500,
        })
      )
    })
  })

  describe('helper methods', () => {
    it('should calculate inventory summary correctly', async () => {
      const mockData = [
        { quantity: 100, value: 1000 },
        { quantity: 5, value: 50 },
        { quantity: 200, value: 2000 },
      ]

      mockSupabase.select.mockResolvedValue({ data: mockData })

      const data = await (aiService as any).getInventoryData(
        'test-org',
        { from: new Date(), to: new Date() }
      )

      expect(data.summary).toEqual({
        totalProducts: 3,
        lowStockItems: 1,
        totalValue: 3050,
      })
    })

    it('should identify peak days correctly', () => {
      const orders = [
        { created_at: '2024-01-01T10:00:00Z' }, // Monday
        { created_at: '2024-01-01T11:00:00Z' }, // Monday
        { created_at: '2024-01-01T12:00:00Z' }, // Monday
        { created_at: '2024-01-02T10:00:00Z' }, // Tuesday
        { created_at: '2024-01-03T10:00:00Z' }, // Wednesday
      ]

      const peakDays = (aiService as any).identifyPeakDays(orders)

      expect(peakDays).toContain('Monday')
      expect(peakDays).not.toContain('Tuesday')
    })

    it('should calculate average margin correctly', () => {
      const pricingData = [
        { price: 10, cost: 6 }, // 40% margin
        { price: 20, cost: 15 }, // 25% margin
        { price: 100, cost: 70 }, // 30% margin
      ]

      const avgMargin = (aiService as any).calculateAverageMargin(pricingData)

      expect(avgMargin).toBeCloseTo(0.317, 2) // Average of 40%, 25%, 30%
    })
  })
})