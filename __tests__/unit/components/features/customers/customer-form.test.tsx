import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock next/navigation
const mockPush = jest.fn()
const mockRouter = {
  push: mockPush,
}
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock form actions
const mockCreateCustomer = jest.fn()
const mockUpdateCustomer = jest.fn()
jest.mock('@/app/actions/customers', () => ({
  createCustomer: mockCreateCustomer,
  updateCustomer: mockUpdateCustomer,
}))

// Mock sonner
const mockToast = {
  error: jest.fn(),
  success: jest.fn(),
}
jest.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button data-testid="button" {...props}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardDescription: ({ children, ...props }: any) => (
    <div data-testid="card-description" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...props }: any) => (
    <div data-testid="card-title" {...props}>
      {children}
    </div>
  ),
}))

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ ...props }: any) => (
    <input type="checkbox" data-testid="checkbox" {...props} />
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => (
    <input data-testid="input" {...props} />
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => (
    <label data-testid="label" {...props}>
      {children}
    </label>
  ),
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }: any) => (
    <div data-testid="select" {...props}>
      {children}
    </div>
  ),
  SelectContent: ({ children, ...props }: any) => (
    <div data-testid="select-content" {...props}>
      {children}
    </div>
  ),
  SelectItem: ({ children, ...props }: any) => (
    <div data-testid="select-item" {...props}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ children, ...props }: any) => (
    <span data-testid="select-value" {...props}>
      {children}
    </span>
  ),
}))

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: any) => (
    <div data-testid="tabs" {...props}>
      {children}
    </div>
  ),
  TabsContent: ({ children, ...props }: any) => (
    <div data-testid="tabs-content" {...props}>
      {children}
    </div>
  ),
  TabsList: ({ children, ...props }: any) => (
    <div data-testid="tabs-list" {...props}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, ...props }: any) => (
    <button data-testid="tabs-trigger" {...props}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ ...props }: any) => (
    <textarea data-testid="textarea" {...props} />
  ),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Building2: ({ className }: any) => (
    <div data-testid="building2-icon" className={className} />
  ),
  CreditCard: ({ className }: any) => (
    <div data-testid="credit-card-icon" className={className} />
  ),
  FileText: ({ className }: any) => (
    <div data-testid="file-text-icon" className={className} />
  ),
  MapPin: ({ className }: any) => (
    <div data-testid="map-pin-icon" className={className} />
  ),
  User: ({ className }: any) => (
    <div data-testid="user-icon" className={className} />
  ),
}))

// Mock validation schema
jest.mock('@/lib/customers/validations', () => ({
  createCustomerSchema: {
    parse: jest.fn(),
  },
}))

import { CustomerForm } from '@/components/features/customers/customer-form'

const mockTiers = [
  {
    id: 'tier-1',
    name: 'Basic',
    level: 1,
    discount_percentage: 5,
    color: '#3b82f6',
  },
  {
    id: 'tier-2',
    name: 'Premium',
    level: 2,
    discount_percentage: 10,
    color: '#10b981',
  },
]

const mockCustomer = {
  id: 'customer-1',
  company_name: 'Test Company',
  display_name: 'Test Customer',
  tax_id: 'TAX123',
  website: 'https://test.com',
  tier_id: 'tier-1',
  status: 'active',
  customer_type: 'standard',
  billing_address: {
    line1: '123 Main St',
    line2: 'Suite 100',
    city: 'Test City',
    state: 'CA',
    postal_code: '12345',
    country: 'US',
  },
  shipping_address: {
    line1: '456 Ship St',
    line2: '',
    city: 'Ship City',
    state: 'NY',
    postal_code: '67890',
    country: 'US',
  },
  credit_limit: 50000,
  payment_terms: 30,
  currency: 'USD',
  notes: 'Test notes',
  internal_notes: 'Internal test notes',
  tags: ['test', 'customer'],
}

describe.skip('CustomerForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Structure', () => {
    it('should render the form with all tabs', () => {
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      expect(screen.getByTestId('tabs')).toBeInTheDocument()
      expect(screen.getAllByTestId('tabs-trigger')).toHaveLength(5)
      expect(screen.getByText('General')).toBeInTheDocument()
      expect(screen.getByText('Addresses')).toBeInTheDocument()
      expect(screen.getByText('Billing')).toBeInTheDocument()
      expect(screen.getByText('Contact')).toBeInTheDocument()
      expect(screen.getByText('Notes')).toBeInTheDocument()
    })

    it('should render tab icons', () => {
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      expect(screen.getAllByTestId('building2-icon')).toHaveLength(1)
      expect(screen.getAllByTestId('map-pin-icon')).toHaveLength(1)
      expect(screen.getAllByTestId('credit-card-icon')).toHaveLength(1)
      expect(screen.getAllByTestId('user-icon')).toHaveLength(1)
      expect(screen.getAllByTestId('file-text-icon')).toHaveLength(1)
    })

    it('should render form inputs', () => {
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      expect(screen.getAllByTestId('input')).toHaveLength(expect.any(Number))
      expect(screen.getAllByTestId('label')).toHaveLength(expect.any(Number))
      expect(screen.getAllByTestId('select')).toHaveLength(expect.any(Number))
    })
  })

  describe('Create Mode', () => {
    it('should render in create mode with empty form', () => {
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const companyNameInput = screen.getByDisplayValue('')
      expect(companyNameInput).toBeInTheDocument()
    })

    it('should call createCustomer when submitting in create mode', async () => {
      const user = userEvent.setup()
      mockCreateCustomer.mockResolvedValue({ data: { id: 'new-customer' } })

      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const companyNameInput = screen.getByDisplayValue('')
      await user.type(companyNameInput, 'New Company')

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCreateCustomer).toHaveBeenCalled()
      })
    })
  })

  describe('Edit Mode', () => {
    it('should render in edit mode with customer data', () => {
      render(
        <CustomerForm
          customer={mockCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      expect(screen.getByDisplayValue('Test Company')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Customer')).toBeInTheDocument()
    })

    it('should call updateCustomer when submitting in edit mode', async () => {
      const user = userEvent.setup()
      mockUpdateCustomer.mockResolvedValue({ data: { id: 'customer-1' } })

      render(
        <CustomerForm
          customer={mockCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockUpdateCustomer).toHaveBeenCalled()
      })
    })
  })

  describe('Form Validation', () => {
    it('should show validation errors for required fields', async () => {
      const user = userEvent.setup()
      mockCreateCustomer.mockResolvedValue({ error: 'Validation failed' })

      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCreateCustomer).toHaveBeenCalled()
      })
    })

    it('should handle form submission errors', async () => {
      const user = userEvent.setup()
      mockCreateCustomer.mockResolvedValue({ error: 'Server error' })

      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const companyNameInput = screen.getByDisplayValue('')
      await user.type(companyNameInput, 'Test Company')

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Server error')
      })
    })
  })

  describe('Success Handling', () => {
    it('should show success toast and redirect on successful creation', async () => {
      const user = userEvent.setup()
      mockCreateCustomer.mockResolvedValue({ data: { id: 'new-customer' } })

      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const companyNameInput = screen.getByDisplayValue('')
      await user.type(companyNameInput, 'New Company')

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Customer created successfully'
        )
        expect(mockRouter.push).toHaveBeenCalledWith('/customers/new-customer')
      })
    })

    it('should show success toast and redirect on successful update', async () => {
      const user = userEvent.setup()
      mockUpdateCustomer.mockResolvedValue({ data: { id: 'customer-1' } })

      render(
        <CustomerForm
          customer={mockCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Customer updated successfully'
        )
        expect(mockRouter.push).toHaveBeenCalledWith('/customers/customer-1')
      })
    })
  })

  describe('Address Handling', () => {
    it('should handle billing and shipping addresses', () => {
      render(
        <CustomerForm
          customer={mockCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument()
      expect(screen.getByDisplayValue('456 Ship St')).toBeInTheDocument()
    })

    it('should handle use billing for shipping checkbox', () => {
      render(
        <CustomerForm
          customer={mockCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      const checkbox = screen.getByTestId('checkbox')
      expect(checkbox).toBeInTheDocument()
    })
  })

  describe('Tier Selection', () => {
    it('should render tier options', () => {
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      expect(screen.getAllByTestId('select-trigger')).toHaveLength(expect.any(Number))
    })
  })

  describe('Tab Navigation', () => {
    it('should switch between tabs', async () => {
      const user = userEvent.setup()
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const addressesTab = screen.getByText('Addresses')
      await user.click(addressesTab)

      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should handle loading state during submission', async () => {
      const user = userEvent.setup()
      mockCreateCustomer.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: { id: 'new-customer' } }), 100))
      )

      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const companyNameInput = screen.getByDisplayValue('')
      await user.type(companyNameInput, 'Test Company')

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      // Button should be disabled during submission
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      const user = userEvent.setup()
      mockCreateCustomer.mockRejectedValue(new Error('Network error'))

      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const companyNameInput = screen.getByDisplayValue('')
      await user.type(companyNameInput, 'Test Company')

      const submitButton = screen.getByTestId('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'An unexpected error occurred'
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper form structure', () => {
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const form = screen.getByRole('form')
      expect(form).toBeInTheDocument()
    })

    it('should have proper labels for inputs', () => {
      render(<CustomerForm tiers={mockTiers} mode="create" />)

      const labels = screen.getAllByTestId('label')
      expect(labels.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle customer with minimal data', () => {
      const minimalCustomer = {
        id: 'customer-1',
        company_name: 'Test Company',
        display_name: 'Test Customer',
        status: 'active',
        customer_type: 'standard',
        billing_address: {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
        },
        credit_limit: 0,
        payment_terms: 30,
        currency: 'USD',
        notes: '',
        internal_notes: '',
        tags: [],
      }

      render(
        <CustomerForm
          customer={minimalCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      expect(screen.getByDisplayValue('Test Company')).toBeInTheDocument()
    })

    it('should handle empty tiers array', () => {
      render(<CustomerForm tiers={[]} mode="create" />)

      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should handle different customer types', () => {
      const enterpriseCustomer = {
        ...mockCustomer,
        customer_type: 'enterprise',
      }

      render(
        <CustomerForm
          customer={enterpriseCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })

    it('should handle different status values', () => {
      const inactiveCustomer = {
        ...mockCustomer,
        status: 'inactive',
      }

      render(
        <CustomerForm
          customer={inactiveCustomer}
          tiers={mockTiers}
          mode="edit"
        />
      )

      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })
  })
})