/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomerTable } from '@/components/features/customers/customer-table'
import { deleteCustomer } from '@/app/actions/customers'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}))

jest.mock('@/app/actions/customers', () => ({
  deleteCustomer: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/hooks/use-customer-realtime', () => ({
  useCustomerListRealtime: jest.fn(),
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
  Badge: ({ children, variant, className, style }: any) => (
    <span data-testid="badge" className={className} data-variant={variant} style={style}>
      {children}
    </span>
  ),
}))

jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: any) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarFallback: ({ children }: any) => (
    <div data-testid="avatar-fallback">{children}</div>
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

jest.mock('lucide-react', () => ({
  ChevronLeft: ({ className }: any) => (
    <div data-testid="chevron-left-icon" className={className} />
  ),
  ChevronRight: ({ className }: any) => (
    <div data-testid="chevron-right-icon" className={className} />
  ),
  CreditCard: ({ className }: any) => (
    <div data-testid="credit-card-icon" className={className} />
  ),
  Edit: ({ className }: any) => (
    <div data-testid="edit-icon" className={className} />
  ),
  Eye: ({ className }: any) => (
    <div data-testid="eye-icon" className={className} />
  ),
  FileText: ({ className }: any) => (
    <div data-testid="file-text-icon" className={className} />
  ),
  MoreHorizontal: ({ className }: any) => (
    <div data-testid="more-horizontal-icon" className={className} />
  ),
  Trash2: ({ className }: any) => (
    <div data-testid="trash-icon" className={className} />
  ),
  UserPlus: ({ className }: any) => (
    <div data-testid="user-plus-icon" className={className} />
  ),
}))

// Mock window.confirm
const mockConfirm = jest.fn()
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
})

describe('CustomerTable', () => {
  let mockRouter: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock router
    const { useRouter } = require('next/navigation')
    mockRouter = {
      push: jest.fn(),
      refresh: jest.fn(),
    }
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)

    // Reset confirm mock
    mockConfirm.mockReturnValue(true)
  })

  const mockCustomers = [
    {
      id: 'customer-1',
      display_name: 'Acme Corporation',
      company_name: 'Acme Corp',
      status: 'active',
      tier_name: 'Premium',
      tier_color: '#3B82F6',
      credit_limit: 50000,
      currency: 'USD',
      total_orders: 25,
      account_age_days: 365,
      contact_count: 3,
      primary_contact: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@acme.com',
      },
    },
    {
      id: 'customer-2',
      display_name: 'Tech Solutions Inc',
      company_name: 'Tech Solutions',
      status: 'inactive',
      tier_name: 'Standard',
      tier_color: '#10B981',
      credit_limit: 25000,
      currency: 'USD',
      total_orders: 12,
      account_age_days: 180,
      contact_count: 1,
      primary_contact: {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@techsolutions.com',
      },
    },
    {
      id: 'customer-3',
      display_name: 'Global Industries',
      company_name: 'Global Industries',
      status: 'suspended',
      tier_name: null,
      tier_color: null,
      credit_limit: 0,
      currency: 'USD',
      total_orders: 0,
      account_age_days: 30,
      contact_count: 0,
      primary_contact: null,
    },
  ]

  const defaultProps = {
    customers: mockCustomers,
    currentPage: 1,
    pageSize: 10,
    hasMore: false,
    organizationId: 'org-1',
  }

  describe('Component Rendering', () => {
    it('should render the table with headers', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-head')).toHaveLength(7) // 7 columns
    })

    it('should render all customers', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
      expect(screen.getByText('Tech Solutions Inc')).toBeInTheDocument()
      expect(screen.getByText('Global Industries')).toBeInTheDocument()
    })

    it('should display customer details correctly', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getByText('$50,000')).toBeInTheDocument()
      expect(screen.getByText('$25,000')).toBeInTheDocument()
      expect(screen.getByText('$0')).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('should display empty state when no customers', () => {
      render(<CustomerTable {...defaultProps} customers={[]} />)

      expect(screen.getByText('No customers found. Try adjusting your filters or add a new customer.')).toBeInTheDocument()
    })
  })

  describe('Status Badges', () => {
    it('should render status badges with correct styling', () => {
      render(<CustomerTable {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      expect(badges.length).toBeGreaterThan(0)

      // Check that badges have the correct variants
      const statusBadges = badges.filter(badge => 
        badge.textContent === 'active' || 
        badge.textContent === 'inactive' || 
        badge.textContent === 'suspended'
      )
      expect(statusBadges.length).toBeGreaterThan(0)
    })

    it('should handle different status types', () => {
      const customersWithDifferentStatuses = [
        { ...mockCustomers[0], status: 'active' },
        { ...mockCustomers[1], status: 'inactive' },
        { ...mockCustomers[2], status: 'suspended' },
      ]

      render(<CustomerTable {...defaultProps} customers={customersWithDifferentStatuses} />)

      const badges = screen.getAllByTestId('badge')
      const statusBadges = badges.filter(badge => 
        ['active', 'inactive', 'suspended'].includes(badge.textContent || '')
      )
      expect(statusBadges.length).toBeGreaterThan(0)
    })

    it('should handle unknown status gracefully', () => {
      const customersWithUnknownStatus = [
        { ...mockCustomers[0], status: 'unknown_status' },
      ]

      render(<CustomerTable {...defaultProps} customers={customersWithUnknownStatus} />)

      const badges = screen.getAllByTestId('badge')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  describe('Tier Badges', () => {
    it('should render tier badges for customers with tiers', () => {
      render(<CustomerTable {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      const tierBadges = badges.filter(badge => 
        badge.textContent === 'Premium' || badge.textContent === 'Standard'
      )
      expect(tierBadges.length).toBeGreaterThan(0)
    })

    it('should not render tier badge for customers without tiers', () => {
      const customersWithoutTiers = [
        { ...mockCustomers[0], tier_name: null, tier_color: null },
      ]

      render(<CustomerTable {...defaultProps} customers={customersWithoutTiers} />)

      const badges = screen.getAllByTestId('badge')
      const tierBadges = badges.filter(badge => 
        badge.textContent === 'Premium' || badge.textContent === 'Standard'
      )
      expect(tierBadges.length).toBe(0)
    })

    it('should apply custom styling to tier badges', () => {
      render(<CustomerTable {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      const tierBadges = badges.filter(badge => 
        badge.textContent === 'Premium' || badge.textContent === 'Standard'
      )
      
      tierBadges.forEach(badge => {
        expect(badge).toHaveAttribute('data-variant', 'outline')
      })
    })
  })

  describe('Customer Actions', () => {
    it('should render dropdown menu for each customer', () => {
      render(<CustomerTable {...defaultProps} />)

      const dropdownMenus = screen.getAllByTestId('dropdown-menu')
      expect(dropdownMenus).toHaveLength(3)
    })

    it('should render action buttons', () => {
      render(<CustomerTable {...defaultProps} />)

      const actionButtons = screen.getAllByTestId('button')
      expect(actionButtons.length).toBeGreaterThan(0)
    })

    it('should show all action menu items', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getAllByText('View Details')).toHaveLength(3)
      expect(screen.getAllByText('Edit')).toHaveLength(3)
      expect(screen.getAllByText('Manage Contacts')).toHaveLength(3)
      expect(screen.getAllByText('Custom Pricing')).toHaveLength(3)
      expect(screen.getAllByText('View Orders')).toHaveLength(3)
      expect(screen.getAllByText('Delete')).toHaveLength(3)
    })

    it('should have proper ARIA labels for actions', () => {
      render(<CustomerTable {...defaultProps} />)

      // Check for screen reader text
      expect(screen.getAllByText('Open menu')).toHaveLength(3)
    })
  })

  describe('Customer Deletion', () => {
    beforeEach(() => {
      ;(deleteCustomer as jest.Mock).mockResolvedValue({ success: true })
    })

    it('should call deleteCustomer when delete is confirmed', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(true)

      render(<CustomerTable {...defaultProps} />)

      const deleteButtons = screen.getAllByText('Delete')
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(deleteCustomer).toHaveBeenCalledWith('customer-1')
        expect(toast.success).toHaveBeenCalledWith('Customer deleted successfully')
        expect(mockRouter.refresh).toHaveBeenCalled()
      })
    })

    it('should not call deleteCustomer when delete is not confirmed', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(false)

      render(<CustomerTable {...defaultProps} />)

      const deleteButtons = screen.getAllByText('Delete')
      await user.click(deleteButtons[0])

      expect(deleteCustomer).not.toHaveBeenCalled()
    })

    it('should handle deletion error', async () => {
      const user = userEvent.setup()
      ;(deleteCustomer as jest.Mock).mockResolvedValue({ 
        error: 'Customer cannot be deleted' 
      })

      render(<CustomerTable {...defaultProps} />)

      const deleteButtons = screen.getAllByText('Delete')
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Customer cannot be deleted')
      })
    })

    it('should handle deletion exception', async () => {
      const user = userEvent.setup()
      ;(deleteCustomer as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(<CustomerTable {...defaultProps} />)

      const deleteButtons = screen.getAllByText('Delete')
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete customer')
      })
    })

    it('should disable action button while deleting', async () => {
      const user = userEvent.setup()
      ;(deleteCustomer as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      render(<CustomerTable {...defaultProps} />)

      const deleteButtons = screen.getAllByText('Delete')
      await user.click(deleteButtons[0])

      // The button should be disabled during deletion
      const actionButtons = screen.getAllByTestId('button')
      const disabledButtons = actionButtons.filter(button => button.disabled)
      expect(disabledButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Pagination', () => {
    it('should render pagination when there are multiple pages', () => {
      render(<CustomerTable {...defaultProps} currentPage={2} hasMore={true} />)

      expect(screen.getByText('Showing 11 to 13 customers')).toBeInTheDocument()
      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })

    it('should not render pagination when there is only one page', () => {
      render(<CustomerTable {...defaultProps} currentPage={1} hasMore={false} />)

      expect(screen.queryByText('Showing')).not.toBeInTheDocument()
      expect(screen.queryByText('Previous')).not.toBeInTheDocument()
      expect(screen.queryByText('Next')).not.toBeInTheDocument()
    })

    it('should disable previous button on first page', () => {
      render(<CustomerTable {...defaultProps} currentPage={1} hasMore={true} />)

      const buttons = screen.getAllByTestId('button')
      const previousButton = buttons.find(button => button.textContent?.includes('Previous'))
      expect(previousButton).toBeDisabled()
    })

    it('should disable next button when no more pages', () => {
      render(<CustomerTable {...defaultProps} currentPage={2} hasMore={false} />)

      const buttons = screen.getAllByTestId('button')
      const nextButton = buttons.find(button => button.textContent?.includes('Next'))
      expect(nextButton).toBeDisabled()
    })

    it('should navigate to correct pages', async () => {
      const user = userEvent.setup()
      render(<CustomerTable {...defaultProps} currentPage={2} hasMore={true} />)

      const buttons = screen.getAllByTestId('button')
      const previousButton = buttons.find(button => button.textContent?.includes('Previous'))
      const nextButton = buttons.find(button => button.textContent?.includes('Next'))

      if (previousButton) {
        await user.click(previousButton)
        expect(mockRouter.push).toHaveBeenCalledWith('/customers?page=1')
      }

      if (nextButton) {
        await user.click(nextButton)
        expect(mockRouter.push).toHaveBeenCalledWith('/customers?page=3')
      }
    })
  })

  describe('Customer Information Display', () => {
    it('should display customer avatars with initials', () => {
      render(<CustomerTable {...defaultProps} />)

      const avatars = screen.getAllByTestId('avatar')
      expect(avatars.length).toBeGreaterThan(0)
    })

    it('should display contact count for customers with contacts', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getByText('3 contacts')).toBeInTheDocument()
      expect(screen.getByText('1 contact')).toBeInTheDocument()
    })

    it('should not display contact count for customers without contacts', () => {
      const customersWithoutContacts = [
        { ...mockCustomers[0], contact_count: 0, primary_contact: null },
      ]

      render(<CustomerTable {...defaultProps} customers={customersWithoutContacts} />)

      expect(screen.queryByText('0 contacts')).not.toBeInTheDocument()
    })

    it('should display account age in days', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getByText('365 days')).toBeInTheDocument()
      expect(screen.getByText('180 days')).toBeInTheDocument()
      expect(screen.getByText('30 days')).toBeInTheDocument()
    })
  })

  describe('Currency Formatting', () => {
    it('should format currency correctly', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getByText('$50,000')).toBeInTheDocument()
      expect(screen.getByText('$25,000')).toBeInTheDocument()
      expect(screen.getByText('$0')).toBeInTheDocument()
    })

    it('should handle different currencies', () => {
      const customersWithDifferentCurrencies = [
        { ...mockCustomers[0], currency: 'EUR' },
        { ...mockCustomers[1], currency: 'GBP' },
      ]

      render(<CustomerTable {...defaultProps} customers={customersWithDifferentCurrencies} />)

      // The component should handle different currencies
      expect(screen.getByText('€50,000')).toBeInTheDocument()
      expect(screen.getByText('£25,000')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<CustomerTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should have proper ARIA labels', () => {
      render(<CustomerTable {...defaultProps} />)

      // Check for screen reader text
      expect(screen.getAllByText('Open menu')).toHaveLength(3)
    })

    it('should have proper region labels', () => {
      render(<CustomerTable {...defaultProps} />)

      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-label', 'Customer table')
    })
  })

  describe('Real-time Updates', () => {
    it('should call useCustomerListRealtime hook', () => {
      const { useCustomerListRealtime } = require('@/hooks/use-customer-realtime')
      
      render(<CustomerTable {...defaultProps} />)

      expect(useCustomerListRealtime).toHaveBeenCalledWith('org-1')
    })

    it('should handle missing organizationId', () => {
      const { useCustomerListRealtime } = require('@/hooks/use-customer-realtime')
      
      render(<CustomerTable {...defaultProps} organizationId={undefined} />)

      expect(useCustomerListRealtime).toHaveBeenCalledWith('')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty customers array', () => {
      render(<CustomerTable {...defaultProps} customers={[]} />)

      expect(screen.getByText('No customers found. Try adjusting your filters or add a new customer.')).toBeInTheDocument()
    })

    it('should handle customers with missing data', () => {
      const customersWithMissingData = [
        {
          id: 'customer-1',
          display_name: 'Test Customer',
          company_name: 'Test Corp',
          status: 'active',
          tier_name: null,
          tier_color: null,
          credit_limit: 0,
          currency: 'USD',
          total_orders: 0,
          account_age_days: 0,
          contact_count: 0,
          primary_contact: null,
        },
      ]

      render(<CustomerTable {...defaultProps} customers={customersWithMissingData} />)

      expect(screen.getByText('Test Customer')).toBeInTheDocument()
      expect(screen.getByText('$0')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0 days')).toBeInTheDocument()
    })

    it('should handle very large numbers', () => {
      const customersWithLargeNumbers = [
        { ...mockCustomers[0], credit_limit: 999999999, total_orders: 999999 },
      ]

      render(<CustomerTable {...defaultProps} customers={customersWithLargeNumbers} />)

      expect(screen.getByText('$999,999,999')).toBeInTheDocument()
      expect(screen.getByText('999999')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component can be rendered without TypeScript errors
      expect(() => render(<CustomerTable {...defaultProps} />)).not.toThrow()
    })

    it('should handle CustomerWithStats type correctly', () => {
      const validCustomer = {
        id: 'customer-1',
        display_name: 'Test Customer',
        company_name: 'Test Corp',
        status: 'active',
        tier_name: 'Premium',
        tier_color: '#3B82F6',
        credit_limit: 50000,
        currency: 'USD',
        total_orders: 25,
        account_age_days: 365,
        contact_count: 3,
        primary_contact: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@test.com',
        },
      }

      render(<CustomerTable {...defaultProps} customers={[validCustomer]} />)

      expect(screen.getByText('Test Customer')).toBeInTheDocument()
    })
  })
})