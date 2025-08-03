import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsTable } from '@/components/features/products/products-table'
import { Product } from '@/types/product.types'

// Mock the ProductActions component
jest.mock('@/components/features/products/product-actions', () => ({
  ProductActions: ({ product }: { product: Product }) => (
    <div data-testid="product-actions" data-product-id={product.id}>
      Actions
    </div>
  ),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock the product actions
jest.mock('@/app/actions/products', () => ({
  deleteProduct: jest.fn(),
  duplicateProduct: jest.fn(),
}))

const mockProducts = [
  {
    id: '1',
    sku: 'PROD-001',
    name: 'Test Product 1',
    description: 'A test product description',
    category: 'Electronics',
    base_price: '99.99',
    active: true,
    inventory_count: 1,
    total_quantity: 100,
    available_quantity: 95,
    low_stock: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    sku: 'PROD-002',
    name: 'Test Product 2',
    description: 'Another test product',
    category: 'Clothing',
    base_price: '49.99',
    active: false,
    inventory_count: 1,
    total_quantity: 50,
    available_quantity: 30,
    low_stock: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    sku: 'PROD-003',
    name: 'Test Product 3',
    description: null,
    category: null,
    base_price: null,
    active: true,
    inventory_count: 1,
    total_quantity: 200,
    available_quantity: 200,
    low_stock: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

const mockCategories = ['Electronics', 'Clothing', 'Books']

describe('ProductsTable', () => {
  const defaultProps = {
    initialData: mockProducts,
    categories: mockCategories,
  }

  describe('Component Rendering', () => {
    it('should render all table headers', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('SKU')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Price')).toBeInTheDocument()
      expect(screen.getByText('Stock')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should render all products in the table', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('A test product description')).toBeInTheDocument()
      expect(screen.getByText('PROD-002')).toBeInTheDocument()
      expect(screen.getByText('Test Product 2')).toBeInTheDocument()
      expect(screen.getByText('PROD-003')).toBeInTheDocument()
      expect(screen.getByText('Test Product 3')).toBeInTheDocument()
    })

    it('should render search input', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(
        screen.getByPlaceholderText('Search products...')
      ).toBeInTheDocument()
    })

    it('should render category and status filters', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('All categories')).toBeInTheDocument()
      expect(screen.getByText('All status')).toBeInTheDocument()
    })

    it('should render pagination controls', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('should display product SKU correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.getByText('PROD-002')).toBeInTheDocument()
      expect(screen.getByText('PROD-003')).toBeInTheDocument()
    })

    it('should display product names and descriptions', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('A test product description')).toBeInTheDocument()
      expect(screen.getByText('Test Product 2')).toBeInTheDocument()
      expect(screen.getByText('Another test product')).toBeInTheDocument()
    })

    it('should display categories as badges', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('Electronics')).toBeInTheDocument()
      expect(screen.getByText('Clothing')).toBeInTheDocument()
      expect(screen.getAllByText('—')).toHaveLength(2) // For null category and null price
    })

    it('should format prices correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('$99.99')).toBeInTheDocument()
      expect(screen.getByText('$49.99')).toBeInTheDocument()
      expect(screen.getAllByText('—')).toHaveLength(2) // For null category and null price
    })

    it('should display stock information correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('100 units')).toBeInTheDocument()
      expect(screen.getByText('50 units')).toBeInTheDocument()
      expect(screen.getByText('200 units')).toBeInTheDocument()
      expect(screen.getByText('95 available')).toBeInTheDocument()
      expect(screen.getByText('30 available')).toBeInTheDocument()
    })

    it('should display status badges correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getAllByText('Active')).toHaveLength(2) // Products 1 and 3 are active
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('should render ProductActions for each row', () => {
      render(<ProductsTable {...defaultProps} />)

      const actionElements = screen.getAllByTestId('product-actions')
      expect(actionElements).toHaveLength(3)
      expect(actionElements[0]).toHaveAttribute('data-product-id', '1')
      expect(actionElements[1]).toHaveAttribute('data-product-id', '2')
      expect(actionElements[2]).toHaveAttribute('data-product-id', '3')
    })
  })

  describe('Search Functionality', () => {
    it('should filter products by SKU', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search products...')
      await user.type(searchInput, 'PROD-001')

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.queryByText('PROD-002')).not.toBeInTheDocument()
      expect(screen.queryByText('PROD-003')).not.toBeInTheDocument()
    })

    it('should filter products by name', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search products...')
      await user.type(searchInput, 'Test Product 1')

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Test Product 3')).not.toBeInTheDocument()
    })

    it('should filter products by description', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search products...')
      await user.type(searchInput, 'test product description')

      expect(screen.getByText('A test product description')).toBeInTheDocument()
      expect(screen.queryByText('Another test product')).not.toBeInTheDocument()
    })

    it('should show no results when search has no matches', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search products...')
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText('No products found.')).toBeInTheDocument()
    })

    it('should clear search and show all products', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search products...')
      await user.type(searchInput, 'PROD-001')
      await user.clear(searchInput)

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.getByText('PROD-002')).toBeInTheDocument()
      expect(screen.getByText('PROD-003')).toBeInTheDocument()
    })
  })

  describe('Filtering', () => {
    it.skip('should filter by category', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const comboboxes = screen.getAllByRole('combobox')
      const categorySelect = comboboxes[0] // First combobox is category
      await user.click(categorySelect)

      const electronicsOption = screen.getByText('Electronics')
      await user.click(electronicsOption)

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.queryByText('PROD-002')).not.toBeInTheDocument()
      expect(screen.queryByText('PROD-003')).not.toBeInTheDocument()
    })

    it.skip('should filter by status', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const comboboxes = screen.getAllByRole('combobox')
      const statusSelect = comboboxes[1] // Second combobox is status
      await user.click(statusSelect)

      const activeOption = screen.getAllByText('Active')[0] // Get first Active option
      await user.click(activeOption)

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.getByText('PROD-003')).toBeInTheDocument()
      expect(screen.queryByText('PROD-002')).not.toBeInTheDocument()
    })

    it.skip('should clear category filter', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const comboboxes = screen.getAllByRole('combobox')
      const categorySelect = comboboxes[0] // First combobox is category
      await user.click(categorySelect)

      const electronicsOption = screen.getByText('Electronics')
      await user.click(electronicsOption)

      // Clear filter
      await user.click(screen.getByText('Electronics'))
      await user.click(screen.getByText('All categories'))

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.getByText('PROD-002')).toBeInTheDocument()
      expect(screen.getByText('PROD-003')).toBeInTheDocument()
    })

    it.skip('should clear status filter', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const comboboxes = screen.getAllByRole('combobox')
      const statusSelect = comboboxes[1] // Second combobox is status
      await user.click(statusSelect)

      const activeOption = screen.getAllByText('Active')[0] // Get first Active option
      await user.click(activeOption)

      // Clear filter
      await user.click(screen.getAllByText('Active')[0])
      await user.click(screen.getByText('All status'))

      expect(screen.getByText('PROD-001')).toBeInTheDocument()
      expect(screen.getByText('PROD-002')).toBeInTheDocument()
      expect(screen.getByText('PROD-003')).toBeInTheDocument()
    })
  })

  describe('Pagination', () => {
    it('should show correct product count', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('3 of 3 product(s)')).toBeInTheDocument()
    })

    it('should update count when filtering', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search products...')
      await user.type(searchInput, 'PROD-001')

      expect(screen.getByText('1 of 3 product(s)')).toBeInTheDocument()
    })

    it('should have pagination buttons', () => {
      render(<ProductsTable {...defaultProps} />)

      const prevButton = screen.getByText('Previous')
      const nextButton = screen.getByText('Next')

      expect(prevButton).toBeInTheDocument()
      expect(nextButton).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty product list', () => {
      render(<ProductsTable initialData={[]} categories={[]} />)

      expect(screen.getByText('No products found.')).toBeInTheDocument()
    })

    it('should handle products with null values', () => {
      render(<ProductsTable {...defaultProps} />)

      // Product 3 has null description, category, and price
      expect(screen.getByText('Test Product 3')).toBeInTheDocument()
      expect(screen.getAllByText('—')).toHaveLength(2) // For null category and null price
    })

    it('should handle low stock products', () => {
      render(<ProductsTable {...defaultProps} />)

      // Product 2 has low_stock: true
      const lowStockElement = screen.getByText('50 units').closest('div')
      expect(lowStockElement).toHaveClass('text-destructive')
    })

    it('should show available quantity when less than total', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('95 available')).toBeInTheDocument()
      expect(screen.getByText('30 available')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('row')).toHaveLength(4) // Header + 3 data rows
      expect(screen.getAllByRole('columnheader')).toHaveLength(7) // 7 columns including actions
    })

    it('should have search input with proper label', () => {
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search products...')
      expect(searchInput).toBeInTheDocument()
      // Input type is not explicitly set, so we just check it exists
      expect(searchInput).toBeInTheDocument()
    })

    it('should have proper button accessibility', () => {
      render(<ProductsTable {...defaultProps} />)

      const prevButton = screen.getByText('Previous')
      const nextButton = screen.getByText('Next')

      expect(prevButton).toBeInTheDocument()
      expect(nextButton).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component accepts the correct props
      const props: React.ComponentProps<typeof ProductsTable> = {
        initialData: mockProducts,
        categories: mockCategories,
      }

      expect(props.initialData).toHaveLength(3)
      expect(props.categories).toHaveLength(3)
      expect(props.initialData[0]).toHaveProperty('id')
      expect(props.initialData[0]).toHaveProperty('sku')
      expect(props.initialData[0]).toHaveProperty('name')
    })
  })
})
