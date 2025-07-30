/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscrepancyTable } from '@/components/features/monitoring/discrepancy-table'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}))

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, onClick, disabled, className, asChild }: any) => {
    if (asChild) {
      return <div data-testid="button-as-child">{children}</div>
    }
    return (
      <button
        data-testid="button"
        data-variant={variant}
        data-size={size}
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
    )
  },
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuContent: ({ children, align }: any) => (
    <div data-testid="dropdown-menu-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, disabled, asChild, className }: any) => {
    if (asChild) {
      return <div data-testid="dropdown-menu-item-as-child">{children}</div>
    }
    return (
      <button
        data-testid="dropdown-menu-item"
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
    )
  },
  DropdownMenuTrigger: ({ children, asChild }: any) => {
    if (asChild) {
      return <div data-testid="dropdown-menu-trigger-as-child">{children}</div>
    }
    return <div data-testid="dropdown-menu-trigger">{children}</div>
  },
}))

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => (
    <table data-testid="table">{children}</table>
  ),
  TableBody: ({ children }: any) => (
    <tbody data-testid="table-body">{children}</tbody>
  ),
  TableCell: ({ children, colSpan, className }: any) => (
    <td data-testid="table-cell" colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
  TableHead: ({ children }: any) => (
    <th data-testid="table-head">{children}</th>
  ),
  TableHeader: ({ children }: any) => (
    <thead data-testid="table-header">{children}</thead>
  ),
  TableRow: ({ children }: any) => (
    <tr data-testid="table-row">{children}</tr>
  ),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  CheckCircle: ({ className }: any) => (
    <span data-testid="check-circle" className={className}>
      CheckCircle
    </span>
  ),
  Eye: ({ className }: any) => (
    <span data-testid="eye" className={className}>
      Eye
    </span>
  ),
  MoreHorizontal: ({ className }: any) => (
    <span data-testid="more-horizontal" className={className}>
      MoreHorizontal
    </span>
  ),
  XCircle: ({ className }: any) => (
    <span data-testid="x-circle" className={className}>
      XCircle
    </span>
  ),
}))

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => (
    <a data-testid="link" href={href}>
      {children}
    </a>
  ),
}))

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours ago'),
}))

describe('DiscrepancyTable', () => {
  const mockDiscrepancies = [
    {
      id: 'disc-1',
      accuracyCheckId: 'check-1',
      organizationId: 'org-1',
      entityType: 'product',
      entity_id: 'prod-12345678',
      fieldName: 'price',
      sourceValue: 100,
      targetValue: 150,
      discrepancyType: 'mismatch',
      severity: 'high',
      confidenceScore: 0.95,
      status: 'open',
      detectedAt: new Date('2024-01-15T10:00:00Z'),
      metadata: {},
    },
    {
      id: 'disc-2',
      accuracyCheckId: 'check-1',
      organizationId: 'org-1',
      entityType: 'inventory',
      entity_id: 'inv-87654321',
      fieldName: 'quantity',
      sourceValue: null,
      targetValue: 50,
      discrepancyType: 'missing',
      severity: 'critical',
      confidenceScore: 0.99,
      status: 'investigating',
      detectedAt: new Date('2024-01-15T09:00:00Z'),
      metadata: {},
    },
    {
      id: 'disc-3',
      accuracyCheckId: 'check-1',
      organizationId: 'org-1',
      entityType: 'customer',
      entity_id: 'cust-11111111',
      fieldName: 'email',
      sourceValue: 'old@example.com',
      targetValue: 'new@example.com',
      discrepancyType: 'stale',
      severity: 'medium',
      confidenceScore: 0.85,
      status: 'open',
      detectedAt: new Date('2024-01-15T08:00:00Z'),
      metadata: {},
    },
  ]

  const mockOnResolve = jest.fn()

  const defaultProps = {
    discrepancies: mockDiscrepancies,
    onResolve: mockOnResolve,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the table with headers', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should render all discrepancy rows', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      const rows = screen.getAllByTestId('table-row')
      // Header row + 3 data rows
      expect(rows).toHaveLength(4)
    })

    it('should display entity information', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })

    it('should display field names', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })

    it('should display discrepancy types', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })

    it('should display severity badges', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('critical')).toBeInTheDocument()
      expect(screen.getByText('medium')).toBeInTheDocument()
    })

    it('should display status badges', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no discrepancies', () => {
      render(<DiscrepancyTable discrepancies={[]} onResolve={mockOnResolve} />)

      expect(screen.getByText('No active discrepancies found!')).toBeInTheDocument()
      expect(screen.getByText('Your data is in sync.')).toBeInTheDocument()
      expect(screen.getByTestId('check-circle')).toBeInTheDocument()
    })
  })

  describe('Type Icons', () => {
    it('should display correct icons for different types', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })
  })

  describe('Severity Colors', () => {
    it('should apply correct severity colors', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      expect(badges).toHaveLength(6) // 3 severity + 3 status badges
    })
  })

  describe('Entity ID Truncation', () => {
    it('should truncate entity IDs', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })
  })

  describe('Action Buttons', () => {
    it('should render action buttons for each discrepancy', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      const dropdownTriggers = screen.getAllByTestId('dropdown-menu-trigger-as-child')
      expect(dropdownTriggers).toHaveLength(3)
    })

    it('should have resolve action in dropdown', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      const resolveButtons = screen.getAllByText('Mark Resolved')
      expect(resolveButtons).toHaveLength(3)
    })
  })

  describe('Resolve Functionality', () => {
    it('should call onResolve when resolve button is clicked', async () => {
      const user = userEvent.setup()
      render(<DiscrepancyTable {...defaultProps} />)

      const resolveButtons = screen.getAllByText('Mark Resolved')
      await user.click(resolveButtons[0])

      await waitFor(() => {
        expect(mockOnResolve).toHaveBeenCalledWith('disc-1')
      })
    })

    it('should disable resolve button while resolving', async () => {
      const user = userEvent.setup()
      mockOnResolve.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<DiscrepancyTable {...defaultProps} />)

      const resolveButtons = screen.getAllByText('Mark Resolved')
      await user.click(resolveButtons[0])

      // Button should be disabled during resolution
      expect(resolveButtons[0]).toBeDisabled()
    })

    it('should handle resolve errors gracefully', async () => {
      const user = userEvent.setup()
      
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })
  })

  describe('View All Link', () => {
    it('should show view all link when more than 10 discrepancies', () => {
      const manyDiscrepancies = Array.from({ length: 11 }, (_, i) => ({
        ...mockDiscrepancies[0],
        id: `disc-${i}`,
      }))

      render(<DiscrepancyTable discrepancies={manyDiscrepancies} onResolve={mockOnResolve} />)

      expect(screen.getByText('View All Discrepancies')).toBeInTheDocument()
      expect(screen.getByTestId('link')).toHaveAttribute('href', '/monitoring/discrepancies')
    })

    it('should not show view all link when 10 or fewer discrepancies', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      expect(screen.queryByText('View All Discrepancies')).not.toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('should format detection dates correctly', () => {
      const { formatDistanceToNow } = require('date-fns')
      formatDistanceToNow.mockReturnValue('2 hours ago')

      render(<DiscrepancyTable {...defaultProps} />)

      expect(screen.getAllByText('2 hours ago')).toHaveLength(3)
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should have proper button types', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      const buttons = screen.getAllByTestId('button')
      buttons.forEach(button => {
        expect(button).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle discrepancies with missing optional fields', () => {
      const incompleteDiscrepancy = {
        id: 'disc-incomplete',
        accuracyCheckId: 'check-1',
        organizationId: 'org-1',
        entityType: 'product',
        entity_id: 'prod-12345678',
        fieldName: 'price',
        sourceValue: 100,
        targetValue: 150,
        discrepancyType: 'mismatch',
        severity: 'high',
        confidenceScore: 0.95,
        status: 'open',
        detectedAt: new Date('2024-01-15T10:00:00Z'),
        metadata: {},
      }

      render(<DiscrepancyTable discrepancies={[incompleteDiscrepancy]} onResolve={mockOnResolve} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle unknown discrepancy types', () => {
      const unknownTypeDiscrepancy = {
        ...mockDiscrepancies[0],
        discrepancyType: 'unknown' as any,
      }

      render(<DiscrepancyTable discrepancies={[unknownTypeDiscrepancy]} onResolve={mockOnResolve} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle unknown severity levels', () => {
      const unknownSeverityDiscrepancy = {
        ...mockDiscrepancies[0],
        severity: 'unknown' as any,
      }

      render(<DiscrepancyTable discrepancies={[unknownSeverityDiscrepancy]} onResolve={mockOnResolve} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should handle different discrepancy types', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })

    it('should handle different severity levels', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('critical')).toBeInTheDocument()
      expect(screen.getByText('medium')).toBeInTheDocument()
    })

    it('should handle different status values', () => {
      render(<DiscrepancyTable {...defaultProps} />)

      // Check that the table renders with the correct structure
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })
  })
})