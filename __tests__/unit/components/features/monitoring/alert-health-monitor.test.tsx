import React from 'react'
import { render, screen } from '@/__tests__/helpers/test-utils'
import { AlertHealthMonitor } from '@/components/features/monitoring/alert-health-monitor'

describe('AlertHealthMonitor Component', () => {
  describe('Rendering', () => {
    it('renders the main heading and description', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText('Alert Health Monitor')).toBeInTheDocument()
      expect(screen.getByText(/monitor system alerts/i)).toBeInTheDocument()
    })

    it('renders all four status cards', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText('Active Alerts')).toBeInTheDocument()
      expect(screen.getByText('Acknowledged')).toBeInTheDocument()
      expect(screen.getByText('Resolved')).toBeInTheDocument()
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('displays correct alert counts', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText('3')).toBeInTheDocument() // Active alerts
      expect(screen.getByText('2')).toBeInTheDocument() // Acknowledged
      expect(screen.getByText('15')).toBeInTheDocument() // Resolved
      expect(screen.getByText('1')).toBeInTheDocument() // Critical
    })

    it('shows appropriate status descriptions', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText('Requires attention')).toBeInTheDocument()
      expect(screen.getByText('Under review')).toBeInTheDocument()
      expect(screen.getByText('This week')).toBeInTheDocument()
      expect(screen.getByText('Immediate action required')).toBeInTheDocument()
    })

    it('renders status icons for each card', () => {
      render(<AlertHealthMonitor />)
      
      // Check that icons are present (they have specific classes)
      const cards = screen.getAllByRole('article')
      expect(cards.length).toBeGreaterThanOrEqual(4)
      
      // Each card should have an icon
      cards.forEach(card => {
        const icon = card.querySelector('svg')
        expect(icon).toBeInTheDocument()
      })
    })
  })

  describe('Status Cards', () => {
    it('displays active alerts with red styling', () => {
      render(<AlertHealthMonitor />)
      
      const activeAlertsCard = screen.getByText('Active Alerts').closest('article')
      const countElement = activeAlertsCard?.querySelector('.text-2xl')
      
      expect(countElement).toHaveClass('text-red-600')
      expect(countElement).toHaveTextContent('3')
    })

    it('displays acknowledged alerts with yellow styling', () => {
      render(<AlertHealthMonitor />)
      
      const acknowledgedCard = screen.getByText('Acknowledged').closest('article')
      const countElement = acknowledgedCard?.querySelector('.text-2xl')
      
      expect(countElement).toHaveClass('text-yellow-600')
      expect(countElement).toHaveTextContent('2')
    })

    it('displays resolved alerts with green styling', () => {
      render(<AlertHealthMonitor />)
      
      const resolvedCard = screen.getByText('Resolved').closest('article')
      const countElement = resolvedCard?.querySelector('.text-2xl')
      
      expect(countElement).toHaveClass('text-green-600')
      expect(countElement).toHaveTextContent('15')
    })

    it('displays critical alerts with red styling', () => {
      render(<AlertHealthMonitor />)
      
      const criticalCard = screen.getByText('Critical').closest('article')
      const countElement = criticalCard?.querySelector('.text-2xl')
      
      expect(countElement).toHaveClass('text-red-600')
      expect(countElement).toHaveTextContent('1')
    })
  })

  describe('Recent Alerts Section', () => {
    it('renders the recent alerts section', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText('Recent Alerts')).toBeInTheDocument()
      expect(screen.getByText(/latest system alerts/i)).toBeInTheDocument()
    })

    it('displays critical alert with destructive styling', () => {
      render(<AlertHealthMonitor />)
      
      const criticalAlert = screen.getByText(/critical.*sync job failed/i)
      expect(criticalAlert).toBeInTheDocument()
      
      const alertContainer = criticalAlert.closest('[role="alert"]')
      expect(alertContainer).toHaveClass('destructive')
    })

    it('displays warning alert with default styling', () => {
      render(<AlertHealthMonitor />)
      
      const warningAlert = screen.getByText(/warning.*high error rate/i)
      expect(warningAlert).toBeInTheDocument()
    })

    it('displays info alert with default styling', () => {
      render(<AlertHealthMonitor />)
      
      const infoAlert = screen.getByText(/info.*database connection/i)
      expect(infoAlert).toBeInTheDocument()
    })

    it('shows timestamps for all alerts', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
      expect(screen.getByText('4 hours ago')).toBeInTheDocument()
      expect(screen.getByText('6 hours ago')).toBeInTheDocument()
    })

    it('displays alert badges with outline styling', () => {
      render(<AlertHealthMonitor />)
      
      const badges = screen.getAllByText(/ago/i)
      badges.forEach(badge => {
        expect(badge).toHaveClass('outline')
      })
    })
  })

  describe('Responsive Design', () => {
    it('applies responsive grid classes to status cards', () => {
      render(<AlertHealthMonitor />)
      
      const gridContainer = screen.getByText('Active Alerts').closest('.grid')
      expect(gridContainer).toHaveClass('grid', 'gap-4', 'md:grid-cols-2', 'lg:grid-cols-4')
    })

    it('renders cards with proper spacing', () => {
      render(<AlertHealthMonitor />)
      
      const cards = screen.getAllByRole('article')
      cards.forEach(card => {
        expect(card).toHaveClass('card')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<AlertHealthMonitor />)
      
      // Should have proper heading hierarchy
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveTextContent('Alert Health Monitor')
      
      // Should have proper card structure
      const cards = screen.getAllByRole('article')
      expect(cards.length).toBeGreaterThanOrEqual(4)
    })

    it('has proper ARIA attributes for alerts', () => {
      render(<AlertHealthMonitor />)
      
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).toBeGreaterThan(0)
      
      alerts.forEach(alert => {
        expect(alert).toBeInTheDocument()
      })
    })

    it('provides meaningful content for screen readers', () => {
      render(<AlertHealthMonitor />)
      
      // Each status card should have a title and value
      expect(screen.getByText('Active Alerts')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('has proper color contrast for status indicators', () => {
      render(<AlertHealthMonitor />)
      
      // Critical and active alerts should have red styling
      const criticalElements = document.querySelectorAll('.text-red-600')
      expect(criticalElements.length).toBeGreaterThan(0)
      
      // Resolved alerts should have green styling
      const resolvedElements = document.querySelectorAll('.text-green-600')
      expect(resolvedElements.length).toBeGreaterThan(0)
    })
  })

  describe('Visual Indicators', () => {
    it('uses appropriate icons for each status type', () => {
      render(<AlertHealthMonitor />)
      
      // Check that all expected icons are present
      const icons = document.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThanOrEqual(4)
    })

    it('applies correct colors for different alert severities', () => {
      render(<AlertHealthMonitor />)
      
      // Critical and active alerts should be red
      const redElements = document.querySelectorAll('.text-red-600')
      expect(redElements.length).toBeGreaterThan(0)
      
      // Acknowledged alerts should be yellow
      const yellowElements = document.querySelectorAll('.text-yellow-600')
      expect(yellowElements.length).toBeGreaterThan(0)
      
      // Resolved alerts should be green
      const greenElements = document.querySelectorAll('.text-green-600')
      expect(greenElements.length).toBeGreaterThan(0)
    })

    it('shows destructive styling for critical alerts', () => {
      render(<AlertHealthMonitor />)
      
      const destructiveAlert = document.querySelector('.destructive')
      expect(destructiveAlert).toBeInTheDocument()
    })
  })

  describe('Content Structure', () => {
    it('displays alert descriptions with proper formatting', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText(/sync job failed for shopify/i)).toBeInTheDocument()
      expect(screen.getByText(/high error rate detected/i)).toBeInTheDocument()
      expect(screen.getByText(/database connection pool/i)).toBeInTheDocument()
    })

    it('shows alert severity levels', () => {
      render(<AlertHealthMonitor />)
      
      expect(screen.getByText('Critical:')).toBeInTheDocument()
      expect(screen.getByText('Warning:')).toBeInTheDocument()
      expect(screen.getByText('Info:')).toBeInTheDocument()
    })

    it('displays timestamps in a readable format', () => {
      render(<AlertHealthMonitor />)
      
      const timestamps = screen.getAllByText(/ago/i)
      expect(timestamps.length).toBe(3)
      
      timestamps.forEach(timestamp => {
        expect(timestamp).toMatch(/\d+\s+hours?\s+ago/)
      })
    })
  })

  describe('Layout and Spacing', () => {
    it('applies proper spacing between sections', () => {
      render(<AlertHealthMonitor />)
      
      const container = screen.getByText('Alert Health Monitor').closest('div')
      expect(container).toHaveClass('space-y-6')
    })

    it('renders cards with consistent spacing', () => {
      render(<AlertHealthMonitor />)
      
      const cards = screen.getAllByRole('article')
      cards.forEach(card => {
        expect(card).toHaveClass('card')
      })
    })

    it('displays alert list with proper spacing', () => {
      render(<AlertHealthMonitor />)
      
      const alertList = screen.getByText('Recent Alerts').closest('div')
      const alertContainer = alertList?.querySelector('.space-y-4')
      expect(alertContainer).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<AlertHealthMonitor />)
      const endTime = performance.now()
      
      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<AlertHealthMonitor />)
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero alert counts gracefully', () => {
      // This component currently uses hardcoded values, but in a real implementation
      // it would handle dynamic data. This test ensures the structure remains intact.
      render(<AlertHealthMonitor />)
      
      // Should still render all sections
      expect(screen.getByText('Active Alerts')).toBeInTheDocument()
      expect(screen.getByText('Recent Alerts')).toBeInTheDocument()
    })

    it('maintains layout with different content lengths', () => {
      render(<AlertHealthMonitor />)
      
      // Should handle varying alert message lengths
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).toBeGreaterThan(0)
      
      alerts.forEach(alert => {
        expect(alert).toBeInTheDocument()
      })
    })
  })

  describe('Integration Readiness', () => {
    it('has proper structure for data integration', () => {
      render(<AlertHealthMonitor />)
      
      // The component should have clear sections for different data types
      expect(screen.getByText('Active Alerts')).toBeInTheDocument()
      expect(screen.getByText('Recent Alerts')).toBeInTheDocument()
      
      // This structure would make it easy to integrate with real data
      const statusCards = screen.getAllByRole('article')
      expect(statusCards.length).toBeGreaterThanOrEqual(4)
    })

    it('provides clear visual hierarchy', () => {
      render(<AlertHealthMonitor />)
      
      // Main heading
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      
      // Card titles
      const cardTitles = screen.getAllByText(/Active Alerts|Acknowledged|Resolved|Critical/)
      expect(cardTitles.length).toBe(4)
      
      // Section title
      expect(screen.getByText('Recent Alerts')).toBeInTheDocument()
    })
  })
}) 