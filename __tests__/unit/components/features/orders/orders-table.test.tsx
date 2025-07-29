/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersTable } from '@/components/features/orders/orders-table'
import { cancelOrder } from '@/app/actions/orders'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    refresh: jest.fn(),
  })),
}))

jest.mock('@/app/actions/orders', () => ({
  cancelOrder: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock UI components
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

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, className, disabled, onClick, ...props }: any) => (
    <button
      data-testid="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" className={className} data-variant={variant}>
      {children}
    </span>
  ),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children, asChild }: any) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children, align }: any) => (
    <div data-testid="dropdown-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: any) => (
    <div data-testid="dropdown-label">{children}</div>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
  DropdownMenuItem: ({ children, onClick, className, asChild }: any) => (
    <div data-testid="dropdown-item" onClick={onClick} className={className}>
      {children}
    </div>
  ),
}))

jest.mock('@/components/ui/pagination', () => ({
  Pagination: ({ currentPage, totalPages, baseUrl }: any) => (
    <div data-testid="pagination" data-current={currentPage} data-total={totalPages} data-base={baseUrl}>
      Pagination Component
    </div>
  ),
}))

jest.mock('lucide-react', () => ({
  MoreHorizontal: ({ className }: any) => (
    <div data-testid="more-horizontal-icon" className={className} />
  ),
  Eye: ({ className }: any) => (
    <div data-testid="eye-icon" className={className} />
  ),
  Edit: ({ className }: any) => (
    <div data-testid="edit-icon" className={className} />
  ),
  X: ({ className }: any) => (
    <div data-testid="x-icon" className={className} />
  ),
}))

// Mock window.confirm
const mockConfirm = jest.fn()
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
})

describe('OrdersTable', () => {
  let mockRouter: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock router
    const { useRouter } = require('next/navigation')
    mockRouter = {
      refresh: jest.fn(),
    }
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)

    // Reset confirm mock
    mockConfirm.mockReturnValue(true)
  })

  const mockOrders = [
    {
      id: 'order-1',
      order_number: 'ORD-001',
      order_date: '2024-01-15T10:00:00Z',
      customer_id: 'customer-1',
      customer_name: 'John Doe',
      item_count: 3,
      total_amount: 299.99,
      status: 'pending',
    },
    {
      id: 'order-2',
      order_number: 'ORD-002',
      order_date: '2024-01-16T14:30:00Z',
      customer_id: 'customer-2',
      customer_name: 'Jane Smith',
      item_count: 1,
      total_amount: 99.99,
      status: 'delivered',
    },
    {
      id: 'order-3',
      order_number: 'ORD-003',
      order_date: '2024-01-17T09:15:00Z',
      customer_id: null,
      customer_name: null,
      item_count: 2,
      total_amount: 149.99,
      status: 'cancelled',
    },
  ]

  const defaultProps = {
    orders: mockOrders,
    total: 3,
    page: 1,
    limit: 10,
  }

  describe('Component Rendering', () => {
    it('should render the table with headers', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-head')).toHaveLength(7) // 7 columns
    })

    it('should render all orders', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByText('ORD-001')).toBeInTheDocument()
      expect(screen.getByText('ORD-002')).toBeInTheDocument()
      expect(screen.getByText('ORD-003')).toBeInTheDocument()
    })

    it('should display order details correctly', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Guest')).toBeInTheDocument()
      expect(screen.getByText('$299.99')).toBeInTheDocument()
      expect(screen.getByText('$99.99')).toBeInTheDocument()
      expect(screen.getByText('$149.99')).toBeInTheDocument()
    })

    it('should display empty state when no orders', () => {
      render(<OrdersTable orders={[]} total={0} page={1} limit={10} />)

      expect(screen.getByText('No orders found')).toBeInTheDocument()
    })
  })

  describe('Status Badges', () => {
    it('should render status badges with correct styling', () => {
      render(<OrdersTable {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      expect(badges).toHaveLength(3)

      // Check that badges have the correct text
      expect(badges[0]).toHaveTextContent('Pending')
      expect(badges[1]).toHaveTextContent('Delivered')
      expect(badges[2]).toHaveTextContent('Cancelled')
    })

    it('should handle different status types', () => {
      const ordersWithDifferentStatuses = [
        { ...mockOrders[0], status: 'confirmed' },
        { ...mockOrders[1], status: 'processing' },
        { ...mockOrders[2], status: 'shipped' },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithDifferentStatuses} />)

      const badges = screen.getAllByTestId('badge')
      expect(badges[0]).toHaveTextContent('Confirmed')
      expect(badges[1]).toHaveTextContent('Processing')
      expect(badges[2]).toHaveTextContent('Shipped')
    })

    it('should handle unknown status gracefully', () => {
      const ordersWithUnknownStatus = [
        { ...mockOrders[0], status: 'unknown_status' },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithUnknownStatus} />)

      const badge = screen.getByTestId('badge')
      expect(badge).toHaveTextContent('Unknown_status')
    })
  })

  describe('Order Actions', () => {
    it('should render dropdown menu for each order', () => {
      render(<OrdersTable {...defaultProps} />)

      const dropdownMenus = screen.getAllByTestId('dropdown-menu')
      expect(dropdownMenus).toHaveLength(3)
    })

    it('should render action buttons', () => {
      render(<OrdersTable {...defaultProps} />)

      const actionButtons = screen.getAllByTestId('button')
      expect(actionButtons.length).toBeGreaterThan(0)
    })

    it('should show view and edit actions for all orders', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getAllByText('View Details')).toHaveLength(3)
      expect(screen.getAllByText('Edit Order')).toHaveLength(3)
    })

    it('should show cancel action only for cancellable orders', () => {
      render(<OrdersTable {...defaultProps} />)

      // Only pending order should have cancel option
      const cancelButtons = screen.getAllByText('Cancel Order')
      expect(cancelButtons).toHaveLength(1) // Only the pending order
    })

    it('should not show cancel action for delivered orders', () => {
      const ordersWithDelivered = [
        { ...mockOrders[0], status: 'delivered' },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithDelivered} />)

      expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument()
    })

    it('should not show cancel action for cancelled orders', () => {
      const ordersWithCancelled = [
        { ...mockOrders[0], status: 'cancelled' },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithCancelled} />)

      expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument()
    })
  })

  describe('Order Cancellation', () => {
    beforeEach(() => {
      ;(cancelOrder as jest.Mock).mockResolvedValue({ success: true })
    })

    it('should call cancelOrder when cancel is confirmed', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(true)

      render(<OrdersTable {...defaultProps} />)

      const cancelButtons = screen.getAllByText('Cancel Order')
      await user.click(cancelButtons[0])

      await waitFor(() => {
        expect(cancelOrder).toHaveBeenCalledWith('order-1')
        expect(toast.success).toHaveBeenCalledWith('Order cancelled successfully')
        expect(mockRouter.refresh).toHaveBeenCalled()
      })
    })

    it('should not call cancelOrder when cancel is not confirmed', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(false)

      render(<OrdersTable {...defaultProps} />)

      const cancelButtons = screen.getAllByText('Cancel Order')
      await user.click(cancelButtons[0])

      expect(cancelOrder).not.toHaveBeenCalled()
    })

    it('should handle cancellation error', async () => {
      const user = userEvent.setup()
      ;(cancelOrder as jest.Mock).mockResolvedValue({ 
        success: false, 
        error: 'Order cannot be cancelled' 
      })

      render(<OrdersTable {...defaultProps} />)

      const cancelButtons = screen.getAllByText('Cancel Order')
      await user.click(cancelButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Order cannot be cancelled')
      })
    })

    it('should handle cancellation exception', async () => {
      const user = userEvent.setup()
      ;(cancelOrder as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(<OrdersTable {...defaultProps} />)

      const cancelButtons = screen.getAllByText('Cancel Order')
      await user.click(cancelButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('An error occurred while cancelling the order')
      })
    })

    it('should disable action button while cancelling', async () => {
      const user = userEvent.setup()
      ;(cancelOrder as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      render(<OrdersTable {...defaultProps} />)

      const cancelButtons = screen.getAllByText('Cancel Order')
      await user.click(cancelButtons[0])

      // The button should be disabled during cancellation
      const actionButtons = screen.getAllByTestId('button')
      const disabledButtons = actionButtons.filter(button => button.disabled)
      expect(disabledButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Pagination', () => {
    it('should render pagination when total pages > 1', () => {
      render(<OrdersTable {...defaultProps} total={25} page={1} limit={10} />)

      expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })

    it('should not render pagination when total pages = 1', () => {
      render(<OrdersTable {...defaultProps} total={3} page={1} limit={10} />)

      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
    })

    it('should pass correct props to pagination component', () => {
      render(<OrdersTable {...defaultProps} total={25} page={2} limit={10} />)

      const pagination = screen.getByTestId('pagination')
      expect(pagination).toHaveAttribute('data-current', '2')
      expect(pagination).toHaveAttribute('data-total', '3')
      expect(pagination).toHaveAttribute('data-base', '/dashboard/orders')
    })
  })

  describe('Currency Formatting', () => {
    it('should format currency correctly', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByText('$299.99')).toBeInTheDocument()
      expect(screen.getByText('$99.99')).toBeInTheDocument()
      expect(screen.getByText('$149.99')).toBeInTheDocument()
    })

    it('should handle zero amounts', () => {
      const ordersWithZeroAmount = [
        { ...mockOrders[0], total_amount: 0 },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithZeroAmount} />)

      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('should handle large amounts', () => {
      const ordersWithLargeAmount = [
        { ...mockOrders[0], total_amount: 999999.99 },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithLargeAmount} />)

      expect(screen.getByText('$999,999.99')).toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument()
      expect(screen.getByText('Jan 16, 2024')).toBeInTheDocument()
      expect(screen.getByText('Jan 17, 2024')).toBeInTheDocument()
    })
  })

  describe('Customer Links', () => {
    it('should render customer links for orders with customers', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('should show "Guest" for orders without customers', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByText('Guest')).toBeInTheDocument()
    })
  })

  describe('Order Links', () => {
    it('should render order number as links', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByText('ORD-001')).toBeInTheDocument()
      expect(screen.getByText('ORD-002')).toBeInTheDocument()
      expect(screen.getByText('ORD-003')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<OrdersTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should have proper ARIA labels', () => {
      render(<OrdersTable {...defaultProps} />)

      // Check for screen reader text (there should be one for each order)
      expect(screen.getAllByText('Open menu')).toHaveLength(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty orders array', () => {
      render(<OrdersTable orders={[]} total={0} page={1} limit={10} />)

      expect(screen.getByText('No orders found')).toBeInTheDocument()
    })

    it('should handle orders with missing data', () => {
      const ordersWithMissingData = [
        {
          id: 'order-1',
          order_number: 'ORD-001',
          order_date: '2024-01-15T10:00:00Z',
          customer_id: null,
          customer_name: null,
          item_count: 0,
          total_amount: 0,
          status: 'pending',
        },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithMissingData} />)

      expect(screen.getByText('Guest')).toBeInTheDocument()
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('should handle very large order numbers', () => {
      const ordersWithLargeNumbers = [
        { ...mockOrders[0], order_number: 'ORD-999999999999' },
      ]

      render(<OrdersTable {...defaultProps} orders={ordersWithLargeNumbers} />)

      expect(screen.getByText('ORD-999999999999')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component can be rendered without TypeScript errors
      expect(() => render(<OrdersTable {...defaultProps} />)).not.toThrow()
    })

    it('should handle OrderSummary type correctly', () => {
      const validOrder = {
        id: 'order-1',
        order_number: 'ORD-001',
        order_date: '2024-01-15T10:00:00Z',
        customer_id: 'customer-1',
        customer_name: 'John Doe',
        item_count: 3,
        total_amount: 299.99,
        status: 'pending',
      }

      render(<OrdersTable {...defaultProps} orders={[validOrder]} />)

      expect(screen.getByText('ORD-001')).toBeInTheDocument()
    })
  })
})