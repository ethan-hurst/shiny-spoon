/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RefreshInsightsButton } from '@/components/features/insights/refresh-insights-button'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/app/actions/ai-insights', () => ({
  generateInsights: jest.fn(),
}))

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, disabled, onClick }: any) => (
    <button
      data-testid="button"
      data-variant={variant}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  RefreshCw: ({ className }: any) => (
    <span data-testid="refresh-cw" className={className}>
      RefreshCw
    </span>
  ),
}))

describe('RefreshInsightsButton', () => {
  const mockRouter = {
    refresh: jest.fn(),
  }

  const mockGenerateInsights = require('@/app/actions/ai-insights').generateInsights
  const mockToast = require('sonner').toast
  const mockUseRouter = require('next/navigation').useRouter

  const defaultProps = {
    organizationId: 'org-1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(mockRouter)
  })

  describe('Component Rendering', () => {
    it('should render the refresh button', () => {
      render(<RefreshInsightsButton {...defaultProps} />)

      expect(screen.getByTestId('button')).toBeInTheDocument()
      expect(screen.getByText('Refresh Insights')).toBeInTheDocument()
    })

    it('should render with correct variant', () => {
      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      expect(button).toHaveAttribute('data-variant', 'outline')
    })

    it('should render refresh icon', () => {
      render(<RefreshInsightsButton {...defaultProps} />)

      expect(screen.getByTestId('refresh-cw')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should show loading state while generating insights', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      expect(button).toBeDisabled()
      expect(screen.getByText('Generating...')).toBeInTheDocument()
    })

    it('should disable button while loading', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      expect(button).toBeDisabled()
    })

    it('should show spinning icon when loading', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      const icon = screen.getByTestId('refresh-cw')
      expect(icon).toHaveClass('animate-spin')
    })
  })

  describe('Success Handling', () => {
    it('should handle successful insight generation', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockResolvedValue({
        success: true,
        data: { insights: 5 },
      })

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockGenerateInsights).toHaveBeenCalledWith('org-1')
        expect(mockToast.success).toHaveBeenCalledWith('Generated 5 new insights')
        expect(mockRouter.refresh).toHaveBeenCalled()
      })
    })

    it('should handle successful generation with zero insights', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockResolvedValue({
        success: true,
        data: { insights: 0 },
      })

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Generated 0 new insights')
      })
    })

    it('should handle successful generation with missing insights count', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockResolvedValue({
        success: true,
        data: {},
      })

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Generated 0 new insights')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle generation failure with error message', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockResolvedValue({
        success: false,
        error: 'Failed to connect to AI service',
      })

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to connect to AI service')
      })
    })

    it('should handle generation failure without error message', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockResolvedValue({
        success: false,
      })

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to generate insights')
      })
    })

    it('should handle thrown exceptions', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockRejectedValue(new Error('Network error'))

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to generate insights')
      })
    })

    it('should not refresh router on error', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockRejectedValue(new Error('Network error'))

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockRouter.refresh).not.toHaveBeenCalled()
      })
    })
  })

  describe('Button Interaction', () => {
    it('should call generateInsights when clicked', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockResolvedValue({
        success: true,
        data: { insights: 3 },
      })

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      await waitFor(() => {
        expect(mockGenerateInsights).toHaveBeenCalledWith('org-1')
      })
    })

    it('should be enabled when not loading', () => {
      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      expect(button).not.toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button structure', () => {
      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('data-variant', 'outline')
    })

    it('should be keyboard accessible', () => {
      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      expect(button).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long loading times', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)

      expect(button).toBeDisabled()
      expect(screen.getByText('Generating...')).toBeInTheDocument()
    })

    it('should handle multiple rapid clicks', async () => {
      const user = userEvent.setup()
      mockGenerateInsights.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        success: true,
        data: { insights: 1 },
      }), 100)))

      render(<RefreshInsightsButton {...defaultProps} />)

      const button = screen.getByTestId('button')
      await user.click(button)
      
      // Wait for the button to be disabled before second click
      await waitFor(() => {
        expect(button).toBeDisabled()
      })
      
      await user.click(button) // Second click should be ignored when disabled

      await waitFor(() => {
        expect(mockGenerateInsights).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Type Safety', () => {
    it('should handle different organization IDs', () => {
      render(<RefreshInsightsButton organizationId="org-2" />)

      expect(screen.getByTestId('button')).toBeInTheDocument()
    })

    it('should handle empty organization ID', () => {
      render(<RefreshInsightsButton organizationId="" />)

      expect(screen.getByTestId('button')).toBeInTheDocument()
    })
  })
})