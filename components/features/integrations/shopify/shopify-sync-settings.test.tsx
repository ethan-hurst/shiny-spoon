/* eslint-env jest */
import React from 'react'
import { useRouter } from 'next/navigation'
import { render, screen } from '@testing-library/react'
import { useToast } from '@/components/ui/use-toast'
import { createBrowserClient } from '@/lib/supabase/client'
import type {
  ShopifyIntegrationConfig,
  ShopifySyncSettings as ShopifySyncSettingsType,
} from '@/types/shopify-integration.types'
import { ShopifySyncSettings } from './shopify-sync-settings'

// Mock dependencies - using Jest as the testing framework based on project structure
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/components/ui/use-toast', () => ({
  useToast: jest.fn(),
}))

jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: jest.fn(),
}))

// Mock UI components to focus on component logic
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}))

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, id, ...props }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      data-testid={`switch-${id}`}
      {...props}
    />
  ),
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div
      data-testid="select-container"
      data-value={value}
      data-disabled={disabled}
    >
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { onValueChange, value, disabled })
      )}
    </div>
  ),
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ value, children }: any) => (
    <option value={value} data-testid={`select-item-${value}`}>
      {children}
    </option>
  ),
  SelectTrigger: ({ children, id }: any) => (
    <button data-testid={`select-trigger-${id}`}>{children}</button>
  ),
  SelectValue: () => <span data-testid="select-value">Select Value</span>,
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

jest.mock('lucide-react', () => ({
  Loader2: ({ className }: any) => (
    <div data-testid="loader-icon" className={className} />
  ),
  RefreshCw: ({ className }: any) => (
    <div data-testid="refresh-icon" className={className} />
  ),
  Save: ({ className }: any) => (
    <div data-testid="save-icon" className={className} />
  ),
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('ShopifySyncSettings', () => {
  const mockRouter = {
    refresh: jest.fn(),
  }

  const mockToast = jest.fn()

  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  }

  const defaultConfig: ShopifyIntegrationConfig = {
    sync_products: true,
    sync_inventory: true,
    sync_orders: false,
    sync_customers: true,
    b2b_catalog_enabled: false,
  }

  const defaultSyncSettings: ShopifySyncSettingsType = {
    sync_frequency: 15,
    batch_size: 100,
  }

  const defaultProps = {
    integrationId: 'test-integration-id',
    config: defaultConfig,
    syncSettings: defaultSyncSettings,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Component Rendering', () => {
    it('renders all sync option switches with correct initial values', () => {
      render(<ShopifySyncSettings {...defaultProps} />)

      expect(screen.getByLabelText('Products')).toBeInTheDocument()
      expect(screen.getByLabelText('Inventory')).toBeInTheDocument()
      expect(screen.getByLabelText('Orders')).toBeInTheDocument()
      expect(screen.getByLabelText('Customers')).toBeInTheDocument()
      expect(screen.getByLabelText('B2B Catalogs')).toBeInTheDocument()

      // Check initial switch states based on config
      expect(screen.getByTestId('switch-sync-products')).toBeChecked()
      expect(screen.getByTestId('switch-sync-inventory')).toBeChecked()
      expect(screen.getByTestId('switch-sync-orders')).not.toBeChecked()
      expect(screen.getByTestId('switch-sync-customers')).toBeChecked()
      expect(screen.getByTestId('switch-b2b-catalogs')).not.toBeChecked()
    })

    it('renders descriptive text for each sync option', () => {
      render(<ShopifySyncSettings {...defaultProps} />)

      expect(
        screen.getByText('Sync product catalog including variants and metafields')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Real-time inventory level updates across locations')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Import orders for analytics and reporting')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Sync customer data and company information')
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Manage B2B catalogs and customer-specific pricing (Plus only)'
        )
      ).toBeInTheDocument()
    })

    it('renders sync frequency and batch size selects with labels', () => {
      render(<ShopifySyncSettings {...defaultProps} />)

      expect(screen.getByLabelText('Sync Frequency')).toBeInTheDocument()
      expect(screen.getByLabelText('Batch Size')).toBeInTheDocument()
      expect(
        screen.getByText('How often to check for updates')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Items processed per batch')
      ).toBeInTheDocument()
    })

    it('renders action buttons with correct labels', () => {
      render(<ShopifySyncSettings {...defaultProps} />)

      expect(
        screen.getByRole('button', { name: /sync all now/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /save settings/i })
      ).toBeInTheDocument()
    })

    it('renders individual sync buttons for each entity type', () => {
      render(<ShopifySyncSettings {...defaultProps} />)

      const refreshButtons = screen.getAllByTestId('refresh-icon')
      expect(refreshButtons).toHaveLength(4) // One for each sync entity type (products, inventory, orders, customers)
    })

    it('renders card structure for frequency and batch size settings', () => {
      render(<ShopifySyncSettings {...defaultProps} />)

      expect(screen.getByTestId('card')).toBeInTheDocument()
      expect(screen.getByTestId('card-content')).toBeInTheDocument()
    })
  })

  // ... (the rest of the tests remain unchanged)
})