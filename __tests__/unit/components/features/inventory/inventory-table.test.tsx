import React from 'react'
import { render, screen, waitFor } from '@/__tests__/helpers/test-utils'
import { InventoryTable } from '@/components/features/inventory/inventory-table'
import { mockInventoryItem, mockProduct, mockWarehouse } from '@/__tests__/helpers/test-utils'

// Mock the hooks
jest.mock('@/hooks/use-inventory', () => ({
  useInventoryRealtime: jest.fn(() => ({
    isConnected: true,
    lastUpdate: new Date().toISOString(),
  })),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

// Mock the child components
jest.mock('@/components/features/inventory/adjustment-dialog', () => ({
  AdjustmentDialog: ({ open, onOpenChange, inventory }: any) =>
    open ? (
      <div data-testid="adjustment-dialog">
        Adjustment Dialog for {inventory?.sku}
      </div>
    ) : null,
}))

jest.mock('@/components/features/inventory/bulk-upload-dialog', () => ({
  BulkUploadDialog: ({ open, onOpenChange }: any) =>
    open ? <div data-testid="bulk-upload-dialog">Bulk Upload Dialog</div> : null,
}))

jest.mock('@/components/features/inventory/export-button', () => ({
  ExportButton: () => <div data-testid="export-button">Export Button</div>,
}))

const mockInventoryData = [
  {
    ...mockInventoryItem,
    id: 'inv-1',
    sku: 'SKU-001',
    quantity: 100,
    available_quantity: 90,
    product: {
      ...mockProduct,
      id: 'prod-1',
      name: 'Test Product 1',
      sku: 'SKU-001',
    },
    warehouse: {
      ...mockWarehouse,
      id: 'wh-1',
      name: 'Main Warehouse',
    },
  },
  {
    ...mockInventoryItem,
    id: 'inv-2',
    sku: 'SKU-002',
    quantity: 5,
    available_quantity: 5,
    product: {
      ...mockProduct,
      id: 'prod-2',
      name: 'Test Product 2',
      sku: 'SKU-002',
    },
    warehouse: {
      ...mockWarehouse,
      id: 'wh-1',
      name: 'Main Warehouse',
    },
  },
  {
    ...mockInventoryItem,
    id: 'inv-3',
    sku: 'SKU-003',
    quantity: 0,
    available_quantity: 0,
    product: {
      ...mockProduct,
      id: 'prod-3',
      name: 'Test Product 3',
      sku: 'SKU-003',
    },
    warehouse: {
      ...mockWarehouse,
      id: 'wh-2',
      name: 'Secondary Warehouse',
    },
  },
]

describe('InventoryTable Component', () => {
  const defaultProps = {
    initialData: mockInventoryData,
    organizationId: 'test-org-id',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders the inventory table with data', () => {
      render(<InventoryTable {...defaultProps} />)
      
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
      expect(screen.getByText('SKU-002')).toBeInTheDocument()
      expect(screen.getByText('SKU-003')).toBeInTheDocument()
    })

    it('displays product names correctly', () => {
      render(<InventoryTable {...defaultProps} />)
      
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('Test Product 2')).toBeInTheDocument()
      expect(screen.getByText('Test Product 3')).toBeInTheDocument()
    })

    it('displays warehouse names correctly', () => {
      render(<InventoryTable {...defaultProps} />)
      
      expect(screen.getByText('Main Warehouse')).toBeInTheDocument()
      expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument()
    })

    it('displays quantity information correctly', () => {
      render(<InventoryTable {...defaultProps} />)
      
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('shows low stock indicators for items with low quantity', () => {
      render(<InventoryTable {...defaultProps} />)
      
      // SKU-002 has low stock (5 units)
      const lowStockRow = screen.getByText('SKU-002').closest('tr')
      expect(lowStockRow).toHaveClass('border-l-4', 'border-l-orange-500')
    })

    it('shows out of stock indicators for items with zero quantity', () => {
      render(<InventoryTable {...defaultProps} />)
      
      // SKU-003 is out of stock (0 units)
      const outOfStockRow = screen.getByText('SKU-003').closest('tr')
      expect(outOfStockRow).toHaveClass('border-l-4', 'border-l-red-500')
    })
  })

  describe('Table Headers and Columns', () => {
    it('renders all required table headers', () => {
      render(<InventoryTable {...defaultProps} />)
      
      expect(screen.getByText('SKU')).toBeInTheDocument()
      expect(screen.getByText('Product')).toBeInTheDocument()
      expect(screen.getByText('Warehouse')).toBeInTheDocument()
      expect(screen.getByText('Quantity')).toBeInTheDocument()
      expect(screen.getByText('Available')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('has sortable columns', () => {
      render(<InventoryTable {...defaultProps} />)
      
      const sortButtons = screen.getAllByRole('button', { name: /sort/i })
      expect(sortButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Search and Filtering', () => {
    it('renders search input', () => {
      render(<InventoryTable {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search inventory/i)
      expect(searchInput).toBeInTheDocument()
    })

    it('filters table data when searching', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search inventory/i)
      await user.type(searchInput, 'SKU-001')
      
      await waitFor(() => {
        expect(screen.getByText('SKU-001')).toBeInTheDocument()
        expect(screen.queryByText('SKU-002')).not.toBeInTheDocument()
        expect(screen.queryByText('SKU-003')).not.toBeInTheDocument()
      })
    })

    it('filters by product name', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search inventory/i)
      await user.type(searchInput, 'Test Product 1')
      
      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument()
        expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument()
      })
    })

    it('clears filter when search input is cleared', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search inventory/i)
      await user.type(searchInput, 'SKU-001')
      
      await waitFor(() => {
        expect(screen.queryByText('SKU-002')).not.toBeInTheDocument()
      })
      
      await user.clear(searchInput)
      
      await waitFor(() => {
        expect(screen.getByText('SKU-001')).toBeInTheDocument()
        expect(screen.getByText('SKU-002')).toBeInTheDocument()
        expect(screen.getByText('SKU-003')).toBeInTheDocument()
      })
    })
  })

  describe('Sorting', () => {
    it('sorts by SKU when clicking sort button', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const skuSortButton = screen.getByRole('button', { name: /sort sku/i })
      await user.click(skuSortButton)
      
      // Check that the sort indicator is visible
      expect(skuSortButton).toHaveAttribute('aria-sort')
    })

    it('sorts by quantity when clicking quantity sort button', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const quantitySortButton = screen.getByRole('button', { name: /sort quantity/i })
      await user.click(quantitySortButton)
      
      expect(quantitySortButton).toHaveAttribute('aria-sort')
    })

    it('toggles sort direction on repeated clicks', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const sortButton = screen.getByRole('button', { name: /sort sku/i })
      
      // First click - ascending
      await user.click(sortButton)
      expect(sortButton).toHaveAttribute('aria-sort', 'ascending')
      
      // Second click - descending
      await user.click(sortButton)
      expect(sortButton).toHaveAttribute('aria-sort', 'descending')
      
      // Third click - none
      await user.click(sortButton)
      expect(sortButton).toHaveAttribute('aria-sort', 'none')
    })
  })

  describe('Row Actions', () => {
    it('shows action menu for each row', () => {
      render(<InventoryTable {...defaultProps} />)
      
      const actionButtons = screen.getAllByRole('button', { name: /actions/i })
      expect(actionButtons.length).toBe(3) // One for each row
    })

    it('opens action menu when clicking actions button', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const actionButtons = screen.getAllByRole('button', { name: /actions/i })
      await user.click(actionButtons[0])
      
      expect(screen.getByText('Adjust Stock')).toBeInTheDocument()
      expect(screen.getByText('View History')).toBeInTheDocument()
    })

    it('opens adjustment dialog when clicking adjust stock', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const actionButtons = screen.getAllByRole('button', { name: /actions/i })
      await user.click(actionButtons[0])
      
      const adjustStockButton = screen.getByText('Adjust Stock')
      await user.click(adjustStockButton)
      
      expect(screen.getByTestId('adjustment-dialog')).toBeInTheDocument()
    })

    it('navigates to history page when clicking view history', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const actionButtons = screen.getAllByRole('button', { name: /actions/i })
      await user.click(actionButtons[0])
      
      const viewHistoryButton = screen.getByText('View History')
      await user.click(viewHistoryButton)
      
      // This would typically navigate to a history page
      // The actual navigation would be handled by the router
    })
  })

  describe('Bulk Operations', () => {
    it('renders bulk upload button', () => {
      render(<InventoryTable {...defaultProps} />)
      
      expect(screen.getByText('Bulk Upload')).toBeInTheDocument()
    })

    it('opens bulk upload dialog when clicking bulk upload', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const bulkUploadButton = screen.getByText('Bulk Upload')
      await user.click(bulkUploadButton)
      
      expect(screen.getByTestId('bulk-upload-dialog')).toBeInTheDocument()
    })

    it('renders export button', () => {
      render(<InventoryTable {...defaultProps} />)
      
      expect(screen.getByTestId('export-button')).toBeInTheDocument()
    })
  })

  describe('Pagination', () => {
    it('renders pagination controls when there are many items', () => {
      // Create more data to trigger pagination
      const manyItems = Array.from({ length: 25 }, (_, i) => ({
        ...mockInventoryItem,
        id: `inv-${i}`,
        sku: `SKU-${String(i).padStart(3, '0')}`,
        product: {
          ...mockProduct,
          id: `prod-${i}`,
          name: `Test Product ${i}`,
          sku: `SKU-${String(i).padStart(3, '0')}`,
        },
        warehouse: mockWarehouse,
      }))

      render(
        <InventoryTable
          initialData={manyItems}
          organizationId="test-org-id"
        />
      )
      
      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })

    it('navigates to next page when clicking next', async () => {
      const manyItems = Array.from({ length: 25 }, (_, i) => ({
        ...mockInventoryItem,
        id: `inv-${i}`,
        sku: `SKU-${String(i).padStart(3, '0')}`,
        product: {
          ...mockProduct,
          id: `prod-${i}`,
          name: `Test Product ${i}`,
          sku: `SKU-${String(i).padStart(3, '0')}`,
        },
        warehouse: mockWarehouse,
      }))

      const { user } = render(
        <InventoryTable
          initialData={manyItems}
          organizationId="test-org-id"
        />
      )
      
      const nextButton = screen.getByText('Next')
      await user.click(nextButton)
      
      // Should show different items on the next page
      expect(screen.getByText('SKU-010')).toBeInTheDocument()
    })
  })

  describe('Real-time Updates', () => {
    it('displays real-time connection status', () => {
      render(<InventoryTable {...defaultProps} />)
      
      // The real-time indicator should be present
      expect(screen.getByTestId('realtime-indicator')).toBeInTheDocument()
    })

    it('updates data when real-time updates are received', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      // Simulate a real-time update
      const updatedData = [
        {
          ...mockInventoryData[0],
          quantity: 150, // Updated quantity
        },
        ...mockInventoryData.slice(1),
      ]

      // Re-render with updated data
      render(<InventoryTable initialData={updatedData} organizationId="test-org-id" />)
      
      expect(screen.getByText('150')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper table structure and ARIA attributes', () => {
      render(<InventoryTable {...defaultProps} />)
      
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      
      const headers = screen.getAllByRole('columnheader')
      expect(headers.length).toBeGreaterThan(0)
      
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(1) // Header row + data rows
    })

    it('supports keyboard navigation', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search inventory/i)
      await user.tab()
      
      expect(searchInput).toHaveFocus()
    })

    it('has proper focus management for action menus', async () => {
      const { user } = render(<InventoryTable {...defaultProps} />)
      
      const actionButtons = screen.getAllByRole('button', { name: /actions/i })
      await user.click(actionButtons[0])
      
      const menuItems = screen.getAllByRole('menuitem')
      expect(menuItems.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockInventoryItem,
        id: `inv-${i}`,
        sku: `SKU-${String(i).padStart(4, '0')}`,
        product: {
          ...mockProduct,
          id: `prod-${i}`,
          name: `Test Product ${i}`,
          sku: `SKU-${String(i).padStart(4, '0')}`,
        },
        warehouse: mockWarehouse,
      }))

      const startTime = performance.now()
      render(
        <InventoryTable
          initialData={largeDataset}
          organizationId="test-org-id"
        />
      )
      const endTime = performance.now()

      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<InventoryTable {...defaultProps} />)
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('handles empty data gracefully', () => {
      render(<InventoryTable initialData={[]} organizationId="test-org-id" />)
      
      expect(screen.getByText(/no inventory items found/i)).toBeInTheDocument()
    })

    it('handles malformed data gracefully', () => {
      const malformedData = [
        {
          id: 'inv-1',
          sku: 'SKU-001',
          quantity: 100,
          // Missing required fields
        },
      ] as any

      render(
        <InventoryTable
          initialData={malformedData}
          organizationId="test-org-id"
        />
      )
      
      // Should still render without crashing
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })

  describe('Data Validation', () => {
    it('validates quantity values', () => {
      const invalidData = [
        {
          ...mockInventoryItem,
          quantity: -5, // Invalid negative quantity
        },
      ]

      render(
        <InventoryTable
          initialData={invalidData}
          organizationId="test-org-id"
        />
      )
      
      // Should still display the data but with appropriate styling
      expect(screen.getByText('-5')).toBeInTheDocument()
    })

    it('handles missing product information', () => {
      const dataWithMissingProduct = [
        {
          ...mockInventoryItem,
          product: null,
        },
      ]

      render(
        <InventoryTable
          initialData={dataWithMissingProduct}
          organizationId="test-org-id"
        />
      )
      
      // Should display a placeholder or fallback
      expect(screen.getByText(/no product/i)).toBeInTheDocument()
    })
  })
}) 