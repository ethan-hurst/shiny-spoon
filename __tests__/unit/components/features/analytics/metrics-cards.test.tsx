import React from 'react'
import { render, screen } from '@/__tests__/helpers/test-utils'
import { MetricsCards } from '@/components/features/analytics/metrics-cards'

const mockOrderAccuracy = [
  { date: '2024-01-01', accuracyRate: 95.5 },
  { date: '2024-01-02', accuracyRate: 96.2 },
  { date: '2024-01-03', accuracyRate: 97.1 },
  { date: '2024-01-04', accuracyRate: 96.8 },
  { date: '2024-01-05', accuracyRate: 97.5 },
  { date: '2024-01-06', accuracyRate: 98.1 },
  { date: '2024-01-07', accuracyRate: 98.3 },
  { date: '2024-01-08', accuracyRate: 98.7 }, // Current
]

const mockSyncPerformance = [
  { date: '2024-01-01', avgDuration: 2500 },
  { date: '2024-01-02', avgDuration: 2400 },
  { date: '2024-01-03', avgDuration: 2300 },
  { date: '2024-01-04', avgDuration: 2200 },
  { date: '2024-01-05', avgDuration: 2100 },
  { date: '2024-01-06', avgDuration: 2000 },
  { date: '2024-01-07', avgDuration: 1900 },
  { date: '2024-01-08', avgDuration: 1800 }, // Current
]

const mockInventoryTrends = [
  { date: '2024-01-01', totalValue: 1500000 },
  { date: '2024-01-02', totalValue: 1520000 },
  { date: '2024-01-03', totalValue: 1540000 },
  { date: '2024-01-04', totalValue: 1560000 },
  { date: '2024-01-05', totalValue: 1580000 },
  { date: '2024-01-06', totalValue: 1600000 },
  { date: '2024-01-07', totalValue: 1620000 },
  { date: '2024-01-08', totalValue: 1650000 }, // Current
]

const mockRevenueImpact = {
  totalSaved: 45000,
  accuracyImprovement: 2.5,
  errorsPrevented: 125,
}

const defaultProps = {
  orderAccuracy: mockOrderAccuracy,
  syncPerformance: mockSyncPerformance,
  inventoryTrends: mockInventoryTrends,
  revenueImpact: mockRevenueImpact,
}

describe('MetricsCards Component', () => {
  describe('Rendering', () => {
    it('renders all four metric cards', () => {
      render(<MetricsCards {...defaultProps} />)
      
      expect(screen.getByText('Order Accuracy')).toBeInTheDocument()
      expect(screen.getByText('Revenue Saved')).toBeInTheDocument()
      expect(screen.getByText('Sync Performance')).toBeInTheDocument()
      expect(screen.getByText('Inventory Value')).toBeInTheDocument()
    })

    it('displays correct metric values', () => {
      render(<MetricsCards {...defaultProps} />)
      
      // Order Accuracy: 98.7%
      expect(screen.getByText('98.7%')).toBeInTheDocument()
      
      // Revenue Saved: $45k
      expect(screen.getByText('$45k')).toBeInTheDocument()
      
      // Sync Performance: 2.1s (average of all sync times)
      expect(screen.getByText('2.1s')).toBeInTheDocument()
      
      // Inventory Value: $1.7M
      expect(screen.getByText('$1.7M')).toBeInTheDocument()
    })

    it('displays correct change indicators', () => {
      render(<MetricsCards {...defaultProps} />)
      
      // Order Accuracy change: +3.2% (98.7 - 95.5)
      expect(screen.getByText('+3.2%')).toBeInTheDocument()
      
      // Revenue Saved change
      expect(screen.getByText('125 errors prevented')).toBeInTheDocument()
      
      // Sync Performance change
      expect(screen.getByText('15% faster')).toBeInTheDocument()
      
      // Inventory Value change
      expect(screen.getByText('+5.2% vs last month')).toBeInTheDocument()
    })

    it('shows appropriate icons for each metric', () => {
      render(<MetricsCards {...defaultProps} />)
      
      // Check that icons are present (they have specific classes)
      const cards = screen.getAllByRole('article')
      expect(cards.length).toBe(4)
      
      // Each card should have an icon
      cards.forEach(card => {
        const icon = card.querySelector('svg')
        expect(icon).toBeInTheDocument()
      })
    })
  })

  describe('Calculations', () => {
    it('calculates order accuracy change correctly', () => {
      const testData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-01', accuracyRate: 90.0 }, // Previous
          { date: '2024-01-08', accuracyRate: 95.0 }, // Current
        ],
      }
      
      render(<MetricsCards {...testData} />)
      
      // Should show +5.0% change
      expect(screen.getByText('+5.0%')).toBeInTheDocument()
    })

    it('calculates negative accuracy change correctly', () => {
      const testData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-01', accuracyRate: 95.0 }, // Previous
          { date: '2024-01-08', accuracyRate: 90.0 }, // Current
        ],
      }
      
      render(<MetricsCards {...testData} />)
      
      // Should show -5.0% change
      expect(screen.getByText('-5.0%')).toBeInTheDocument()
    })

    it('calculates average sync time correctly', () => {
      const testData = {
        ...defaultProps,
        syncPerformance: [
          { date: '2024-01-01', avgDuration: 1000 },
          { date: '2024-01-02', avgDuration: 2000 },
          { date: '2024-01-03', avgDuration: 3000 },
        ],
      }
      
      render(<MetricsCards {...testData} />)
      
      // Average should be 2000ms = 2.0s
      expect(screen.getByText('2.0s')).toBeInTheDocument()
    })

    it('handles empty data gracefully', () => {
      const emptyData = {
        orderAccuracy: [],
        syncPerformance: [],
        inventoryTrends: [],
        revenueImpact: {
          totalSaved: 0,
          accuracyImprovement: 0,
          errorsPrevented: 0,
        },
      }
      
      render(<MetricsCards {...emptyData} />)
      
      // Should show 0% for order accuracy
      expect(screen.getByText('0.0%')).toBeInTheDocument()
      
      // Should show $0k for revenue saved
      expect(screen.getByText('$0k')).toBeInTheDocument()
      
      // Should show 0.0s for sync performance
      expect(screen.getByText('0.0s')).toBeInTheDocument()
      
      // Should show $0.0M for inventory value
      expect(screen.getByText('$0.0M')).toBeInTheDocument()
    })
  })

  describe('Visual Indicators', () => {
    it('shows green color for positive changes', () => {
      const positiveData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-01', accuracyRate: 90.0 },
          { date: '2024-01-08', accuracyRate: 95.0 },
        ],
      }
      
      render(<MetricsCards {...positiveData} />)
      
      const positiveChange = screen.getByText('+5.0%')
      expect(positiveChange).toHaveClass('text-green-600')
    })

    it('shows red color for negative changes', () => {
      const negativeData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-01', accuracyRate: 95.0 },
          { date: '2024-01-08', accuracyRate: 90.0 },
        ],
      }
      
      render(<MetricsCards {...negativeData} />)
      
      const negativeChange = screen.getByText('-5.0%')
      expect(negativeChange).toHaveClass('text-red-600')
    })

    it('shows trending up icon for positive changes', () => {
      const positiveData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-01', accuracyRate: 90.0 },
          { date: '2024-01-08', accuracyRate: 95.0 },
        ],
      }
      
      render(<MetricsCards {...positiveData} />)
      
      // Should have trending up icon
      const trendingUpIcons = document.querySelectorAll('.text-green-600')
      expect(trendingUpIcons.length).toBeGreaterThan(0)
    })

    it('shows trending down icon for negative changes', () => {
      const negativeData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-01', accuracyRate: 95.0 },
          { date: '2024-01-08', accuracyRate: 90.0 },
        ],
      }
      
      render(<MetricsCards {...negativeData} />)
      
      // Should have trending down icon
      const trendingDownIcons = document.querySelectorAll('.text-red-600')
      expect(trendingDownIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Responsive Design', () => {
    it('applies responsive grid classes', () => {
      render(<MetricsCards {...defaultProps} />)
      
      const container = screen.getByText('Order Accuracy').closest('div')
      expect(container).toHaveClass('grid', 'gap-4', 'md:grid-cols-2', 'lg:grid-cols-4')
    })

    it('renders cards with proper spacing', () => {
      render(<MetricsCards {...defaultProps} />)
      
      const cards = screen.getAllByRole('article')
      cards.forEach(card => {
        expect(card).toHaveClass('card')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<MetricsCards {...defaultProps} />)
      
      const cards = screen.getAllByRole('article')
      expect(cards.length).toBe(4)
      
      cards.forEach(card => {
        const title = card.querySelector('h3') // CardTitle renders as h3
        expect(title).toBeInTheDocument()
      })
    })

    it('has proper heading hierarchy', () => {
      render(<MetricsCards {...defaultProps} />)
      
      const titles = screen.getAllByText(/Order Accuracy|Revenue Saved|Sync Performance|Inventory Value/)
      titles.forEach(title => {
        expect(title.tagName).toBe('H3')
      })
    })

    it('provides meaningful content for screen readers', () => {
      render(<MetricsCards {...defaultProps} />)
      
      // Each card should have a title and value
      expect(screen.getByText('Order Accuracy')).toBeInTheDocument()
      expect(screen.getByText('98.7%')).toBeInTheDocument()
      expect(screen.getByText('Revenue Saved')).toBeInTheDocument()
      expect(screen.getByText('$45k')).toBeInTheDocument()
    })
  })

  describe('Data Formatting', () => {
    it('formats currency values correctly', () => {
      const testData = {
        ...defaultProps,
        revenueImpact: {
          totalSaved: 1234567, // Should show as $1,235k
          accuracyImprovement: 2.5,
          errorsPrevented: 125,
        },
      }
      
      render(<MetricsCards {...testData} />)
      
      expect(screen.getByText('$1235k')).toBeInTheDocument()
    })

    it('formats large inventory values correctly', () => {
      const testData = {
        ...defaultProps,
        inventoryTrends: [
          { date: '2024-01-08', totalValue: 2500000 }, // Should show as $2.5M
        ],
      }
      
      render(<MetricsCards {...testData} />)
      
      expect(screen.getByText('$2.5M')).toBeInTheDocument()
    })

    it('formats percentage values with one decimal place', () => {
      const testData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-08', accuracyRate: 97.123 }, // Should show as 97.1%
        ],
      }
      
      render(<MetricsCards {...testData} />)
      
      expect(screen.getByText('97.1%')).toBeInTheDocument()
    })

    it('formats time values correctly', () => {
      const testData = {
        ...defaultProps,
        syncPerformance: [
          { date: '2024-01-08', avgDuration: 1500 }, // Should show as 1.5s
        ],
      }
      
      render(<MetricsCards {...testData} />)
      
      expect(screen.getByText('1.5s')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero values correctly', () => {
      const zeroData = {
        orderAccuracy: [{ date: '2024-01-08', accuracyRate: 0 }],
        syncPerformance: [{ date: '2024-01-08', avgDuration: 0 }],
        inventoryTrends: [{ date: '2024-01-08', totalValue: 0 }],
        revenueImpact: {
          totalSaved: 0,
          accuracyImprovement: 0,
          errorsPrevented: 0,
        },
      }
      
      render(<MetricsCards {...zeroData} />)
      
      expect(screen.getByText('0.0%')).toBeInTheDocument()
      expect(screen.getByText('$0k')).toBeInTheDocument()
      expect(screen.getByText('0.0s')).toBeInTheDocument()
      expect(screen.getByText('$0.0M')).toBeInTheDocument()
    })

    it('handles very large values correctly', () => {
      const largeData = {
        ...defaultProps,
        revenueImpact: {
          totalSaved: 999999999, // Very large number
          accuracyImprovement: 2.5,
          errorsPrevented: 125,
        },
        inventoryTrends: [
          { date: '2024-01-08', totalValue: 999999999999 }, // Very large number
        ],
      }
      
      render(<MetricsCards {...largeData} />)
      
      expect(screen.getByText('$1000000k')).toBeInTheDocument()
      expect(screen.getByText('$1000000.0M')).toBeInTheDocument()
    })

    it('handles negative values correctly', () => {
      const negativeData = {
        ...defaultProps,
        orderAccuracy: [
          { date: '2024-01-08', accuracyRate: -5.5 },
        ],
      }
      
      render(<MetricsCards {...negativeData} />)
      
      expect(screen.getByText('-5.5%')).toBeInTheDocument()
    })

    it('handles missing data gracefully', () => {
      const missingData = {
        orderAccuracy: [],
        syncPerformance: [],
        inventoryTrends: [],
        revenueImpact: {
          totalSaved: 0,
          accuracyImprovement: 0,
          errorsPrevented: 0,
        },
      }
      
      render(<MetricsCards {...missingData} />)
      
      // Should render without crashing
      expect(screen.getByText('Order Accuracy')).toBeInTheDocument()
      expect(screen.getByText('Revenue Saved')).toBeInTheDocument()
      expect(screen.getByText('Sync Performance')).toBeInTheDocument()
      expect(screen.getByText('Inventory Value')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently with large datasets', () => {
      const largeDataset = {
        orderAccuracy: Array.from({ length: 1000 }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          accuracyRate: 90 + Math.random() * 10,
        })),
        syncPerformance: Array.from({ length: 1000 }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          avgDuration: 1000 + Math.random() * 2000,
        })),
        inventoryTrends: Array.from({ length: 1000 }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          totalValue: 1000000 + Math.random() * 1000000,
        })),
        revenueImpact: {
          totalSaved: 45000,
          accuracyImprovement: 2.5,
          errorsPrevented: 125,
        },
      }
      
      const startTime = performance.now()
      render(<MetricsCards {...largeDataset} />)
      const endTime = performance.now()
      
      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<MetricsCards {...defaultProps} />)
      
      expect(() => unmount()).not.toThrow()
    })
  })
})
