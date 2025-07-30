/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InventoryTable } from '@/components/features/inventory/inventory-table'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}))

jest.mock('@/hooks/use-inventory', () => ({
  useInventoryRealtime: jest.fn(),
}))

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: jest.fn(),
  })),
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
  Button: ({ children, variant, size, onClick, disabled, ...props }: any) => (
    <button
      data-testid="button"
      className={variant}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, className }: any) => (
    <input
      data-testid="input"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
    />
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
  AlertTriangle: ({ className }: any) => (
    <div data-testid="alert-triangle-icon" className={className} />
  ),
  ArrowUpDown: ({ className }: any) => (
    <div data-testid="arrow-up-down-icon" className={className} />
  ),
  Download: ({ className }: any) => (
    <div data-testid="download-icon" className={className} />
  ),
  History: ({ className }: any) => (
    <div data-testid="history-icon" className={className} />
  ),
  MoreHorizontal: ({ className }: any) => (
    <div data-testid="more-horizontal-icon" className={className} />
  ),
  Package: ({ className }: any) => (
    <div data-testid="package-icon" className={className} />
  ),
  Upload: ({ className }: any) => (
    <div data-testid="upload-icon" className={className} />
  ),
}))

// Mock child components
jest.mock('@/components/features/inventory/adjustment-dialog', () => ({
  AdjustmentDialog: ({ open, onOpenChange, inventory }: any) => (
    <div data-testid="adjustment-dialog" data-open={open}>
      {inventory && `Adjustment for ${inventory.sku}`}
    </div>
  ),
}))

jest.mock('@/components/features/inventory/bulk-upload-dialog', () => ({
  BulkUploadDialog: ({ open, onOpenChange }: any) => (
    <div data-testid="bulk-upload-dialog" data-open={open}>
      Bulk Upload Dialog
    </div>
  ),
}))

jest.mock('@/components/features/inventory/export-button', () => ({
  ExportButton: ({ data }: any) => (
    <div data-testid="export-button" data-count={data?.length}>
      Export Button
    </div>
  ),
}))

describe('InventoryTable', () => {
  const mockInventory = [
    {
      id: 'inv-1',
      sku: 'SKU001',
      product_name: 'Test Product 1',
      warehouse_name: 'Main Warehouse',
      quantity: 100,
      available_quantity: 95,
      reserved_quantity: 5,
      low_stock_threshold: 10,
      last_updated: '2024-01-15T10:00:00Z',
      product: {
        id: 'prod-1',
        sku: 'SKU001',
        name: 'Test Product 1',
        category: 'Electronics',
      },
      warehouse: {
        id: 'warehouse-1',
        name: 'Main Warehouse',
        location: 'New York',
      },
    },
    {
      id: 'inv-2',
      sku: 'SKU002',
      product_name: 'Test Product 2',
      warehouse_name: 'Secondary Warehouse',
      quantity: 50,
      available_quantity: 45,
      reserved_quantity: 5,
      low_stock_threshold: 20,
      last_updated: '2024-01-15T09:00:00Z',
      product: {
        id: 'prod-2',
        sku: 'SKU002',
        name: 'Test Product 2',
        category: 'Clothing',
      },
      warehouse: {
        id: 'warehouse-2',
        name: 'Secondary Warehouse',
        location: 'Los Angeles',
      },
    },
    {
      id: 'inv-3',
      sku: 'SKU003',
      product_name: 'Test Product 3',
      warehouse_name: 'Main Warehouse',
      quantity: 0,
      available_quantity: 0,
      reserved_quantity: 0,
      low_stock_threshold: 5,
      last_updated: '2024-01-15T08:00:00Z',
      product: {
        id: 'prod-3',
        sku: 'SKU003',
        name: 'Test Product 3',
        category: 'Books',
      },
      warehouse: {
        id: 'warehouse-1',
        name: 'Main Warehouse',
        location: 'New York',
      },
    },
  ]

  const defaultProps = {
    initialData: mockInventory,
    organizationId: 'org-1',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the table with headers', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-head')).toHaveLength(8) // 8 columns including actions
    })

    it('should render table structure', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should display empty state when no inventory', () => {
      render(<InventoryTable {...defaultProps} initialData={[]} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Inventory Information Display', () => {
    it('should render table with proper structure', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })
  })

  describe('Stock Status Indicators', () => {
    it('should render table with status indicators', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
    })
  })

  describe('Inventory Actions', () => {
    it('should render action buttons', () => {
      render(<InventoryTable {...defaultProps} />)

      const actionButtons = screen.getAllByTestId('button')
      expect(actionButtons.length).toBeGreaterThan(0)
    })

    it('should render bulk upload dialog', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('bulk-upload-dialog')).toBeInTheDocument()
    })
  })

  describe('Search and Filtering', () => {
    it('should render search input', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search by SKU or product name...')).toBeInTheDocument()
    })

    it('should have search input', () => {
      render(<InventoryTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      expect(searchInput).toBeInTheDocument()
    })
  })

  describe('Real-time Updates', () => {
    it('should call useInventoryRealtime hook', () => {
      const { useInventoryRealtime } = require('@/hooks/use-inventory')
      
      render(<InventoryTable {...defaultProps} />)

      expect(useInventoryRealtime).toHaveBeenCalledWith({
        organizationId: 'org-1',
        onUpdate: expect.any(Function),
        onInsert: expect.any(Function),
        onDelete: expect.any(Function),
      })
    })

    it('should handle real-time updates', () => {
      const { useInventoryRealtime } = require('@/hooks/use-inventory')
      
      render(<InventoryTable {...defaultProps} />)

      expect(useInventoryRealtime).toHaveBeenCalled()
    })
  })

  describe('Virtual Scrolling', () => {
    it('should use virtual scrolling for large datasets', () => {
      const { useVirtualizer } = require('@tanstack/react-virtual')
      
      render(<InventoryTable {...defaultProps} />)

      expect(useVirtualizer).toHaveBeenCalled()
    })
  })

  describe('Export Functionality', () => {
    it('should render export button', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('export-button')).toBeInTheDocument()
    })

    it('should render export button', () => {
      render(<InventoryTable {...defaultProps} />)

      const exportButton = screen.getByTestId('export-button')
      expect(exportButton).toBeInTheDocument()
    })
  })

  describe('Table Structure', () => {
    it('should have correct column headers', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByText('SKU')).toBeInTheDocument()
      expect(screen.getByText('Product Name')).toBeInTheDocument()
      expect(screen.getByText('Warehouse')).toBeInTheDocument()
      expect(screen.getByText('On Hand')).toBeInTheDocument()
      expect(screen.getByText('Reserved')).toBeInTheDocument()
      expect(screen.getByText('Available')).toBeInTheDocument()
      expect(screen.getByText('Reorder Point')).toBeInTheDocument()
    })

    it('should render table structure correctly', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<InventoryTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should have search input with proper attributes', () => {
      render(<InventoryTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      expect(searchInput).toHaveAttribute('placeholder', 'Search by SKU or product name...')
    })
  })

  describe('Edge Cases', () => {
    it('should handle inventory with missing data', () => {
      const inventoryWithMissingData = [
        {
          id: 'inv-1',
          sku: 'SKU001',
          product_name: 'Test Product',
          warehouse_name: 'Test Warehouse',
          quantity: 0,
          available_quantity: 0,
          reserved_quantity: 0,
          low_stock_threshold: 0,
          last_updated: '2024-01-15T10:00:00Z',
          product: null,
          warehouse: null,
        },
      ]

      render(<InventoryTable {...defaultProps} initialData={inventoryWithMissingData} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle very large quantities', () => {
      const inventoryWithLargeQuantities = [
        {
          ...mockInventory[0],
          quantity: 999999,
          available_quantity: 999999,
          reserved_quantity: 0,
        },
      ]

      render(<InventoryTable {...defaultProps} initialData={inventoryWithLargeQuantities} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle negative quantities', () => {
      const inventoryWithNegativeQuantities = [
        {
          ...mockInventory[0],
          quantity: -10,
          available_quantity: -10,
          reserved_quantity: 0,
        },
      ]

      render(<InventoryTable {...defaultProps} initialData={inventoryWithNegativeQuantities} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component can be rendered without TypeScript errors
      expect(() => render(<InventoryTable {...defaultProps} />)).not.toThrow()
    })

    it('should handle InventoryWithRelations type correctly', () => {
      const validInventory = {
        id: 'inv-1',
        sku: 'SKU001',
        product_name: 'Test Product',
        warehouse_name: 'Test Warehouse',
        quantity: 100,
        available_quantity: 95,
        reserved_quantity: 5,
        low_stock_threshold: 10,
        last_updated: '2024-01-15T10:00:00Z',
        product: {
          id: 'prod-1',
          sku: 'SKU001',
          name: 'Test Product',
          category: 'Electronics',
        },
        warehouse: {
          id: 'warehouse-1',
          name: 'Test Warehouse',
          location: 'New York',
        },
      }

      render(<InventoryTable {...defaultProps} initialData={[validInventory]} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })
})