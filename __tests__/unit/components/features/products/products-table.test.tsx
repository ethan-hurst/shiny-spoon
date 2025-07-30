/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsTable } from '@/components/features/products/products-table'

// Mock dependencies
jest.mock('@/components/features/products/product-actions', () => ({
  ProductActions: ({ product }: any) => (
    <div data-testid="product-actions" data-product-id={product.id}>
      Actions for {product.name}
    </div>
  ),
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

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: any) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  ),
  SelectValue: ({ placeholder }: any) => (
    <div data-testid="select-value" data-placeholder={placeholder} />
  ),
}))

jest.mock('lucide-react', () => ({
  Filter: ({ className }: any) => (
    <div data-testid="filter-icon" className={className} />
  ),
  Search: ({ className }: any) => (
    <div data-testid="search-icon" className={className} />
  ),
}))

describe('ProductsTable', () => {
  const mockProducts = [
    {
      id: 'product-1',
      sku: 'SKU001',
      name: 'Test Product 1',
      description: 'A test product description',
      category: 'Electronics',
      base_price: 99.99,
      total_quantity: 100,
      available_quantity: 95,
      low_stock: false,
      active: true,
      inventory_count: 1,
    },
    {
      id: 'product-2',
      sku: 'SKU002',
      name: 'Test Product 2',
      description: 'Another test product',
      category: 'Clothing',
      base_price: 49.99,
      total_quantity: 50,
      available_quantity: 45,
      low_stock: true,
      active: false,
      inventory_count: 1,
    },
    {
      id: 'product-3',
      sku: 'SKU003',
      name: 'Test Product 3',
      description: null,
      category: null,
      base_price: null,
      total_quantity: 0,
      available_quantity: 0,
      low_stock: false,
      active: true,
      inventory_count: 0,
    },
  ]

  const mockCategories = ['Electronics', 'Clothing', 'Books']

  const defaultProps = {
    initialData: mockProducts,
    categories: mockCategories,
  }

  describe('Component Rendering', () => {
    it('should render the table with headers', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-head')).toHaveLength(7) // 7 columns including actions
    })

    it('should render all products', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('Test Product 2')).toBeInTheDocument()
      expect(screen.getByText('Test Product 3')).toBeInTheDocument()
    })

    it('should display product details correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('SKU001')).toBeInTheDocument()
      expect(screen.getByText('SKU002')).toBeInTheDocument()
      expect(screen.getByText('SKU003')).toBeInTheDocument()
      expect(screen.getByText('$99.99')).toBeInTheDocument()
      expect(screen.getByText('$49.99')).toBeInTheDocument()
    })

    it('should display empty state when no products', () => {
      render(<ProductsTable {...defaultProps} initialData={[]} />)

      expect(screen.getByText('No products found.')).toBeInTheDocument()
    })
  })

  describe('Product Information Display', () => {
    it('should display SKU correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('SKU001')).toBeInTheDocument()
      expect(screen.getByText('SKU002')).toBeInTheDocument()
      expect(screen.getByText('SKU003')).toBeInTheDocument()
    })

    it('should display product name and description', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('A test product description')).toBeInTheDocument()
      expect(screen.getByText('Test Product 2')).toBeInTheDocument()
      expect(screen.getByText('Another test product')).toBeInTheDocument()
    })

    it('should handle products without description', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('Test Product 3')).toBeInTheDocument()
      // Should not display description for product 3
      expect(screen.queryByText('null')).not.toBeInTheDocument()
    })

    it('should display category badges', () => {
      render(<ProductsTable {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      const categoryBadges = badges.filter(badge => 
        badge.textContent === 'Electronics' || badge.textContent === 'Clothing'
      )
      expect(categoryBadges.length).toBeGreaterThan(0)
    })

    it('should handle products without category', () => {
      render(<ProductsTable {...defaultProps} />)

      // Should display "—" for products without category
      expect(screen.getAllByText('—')).toHaveLength(2) // null category and null price
    })

    it('should format price correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('$99.99')).toBeInTheDocument()
      expect(screen.getByText('$49.99')).toBeInTheDocument()
    })

    it('should handle products without price', () => {
      render(<ProductsTable {...defaultProps} />)

      // Should display "—" for products without price
      expect(screen.getAllByText('—')).toHaveLength(2) // null category and null price
    })

    it('should display stock information', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('100 units')).toBeInTheDocument()
      expect(screen.getByText('50 units')).toBeInTheDocument()
      expect(screen.getByText('0 units')).toBeInTheDocument()
    })

    it('should display available quantity when different from total', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('95 available')).toBeInTheDocument()
      expect(screen.getByText('45 available')).toBeInTheDocument()
    })

    it('should highlight low stock items', () => {
      render(<ProductsTable {...defaultProps} />)

      // The low stock item should have destructive styling
      const lowStockElement = screen.getByText('50 units')
      expect(lowStockElement).toHaveClass('text-destructive')
    })

    it('should display status badges', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getAllByText('Active')).toHaveLength(3) // 2 in table + 1 in filter
      expect(screen.getAllByText('Inactive')).toHaveLength(2) // 1 in table + 1 in filter
    })
  })

  describe('Product Actions', () => {
    it('should render product actions for each product', () => {
      render(<ProductsTable {...defaultProps} />)

      const actionElements = screen.getAllByTestId('product-actions')
      expect(actionElements).toHaveLength(3)
    })

    it('should pass correct product data to actions', () => {
      render(<ProductsTable {...defaultProps} />)

      const actionElements = screen.getAllByTestId('product-actions')
      expect(actionElements[0]).toHaveAttribute('data-product-id', 'product-1')
      expect(actionElements[1]).toHaveAttribute('data-product-id', 'product-2')
      expect(actionElements[2]).toHaveAttribute('data-product-id', 'product-3')
    })
  })

  describe('Search Functionality', () => {
    it('should render search input', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByTestId('input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument()
    })

    it('should render search icon', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByTestId('search-icon')).toBeInTheDocument()
    })

    it('should filter products by SKU', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      await user.type(searchInput, 'SKU001')

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Test Product 3')).not.toBeInTheDocument()
    })

    it('should filter products by name', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      await user.type(searchInput, 'Product 1')

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument()
    })

    it('should filter products by description', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      await user.type(searchInput, 'test product description')

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument()
    })

    it('should be case insensitive', async () => {
      const user = userEvent.setup()
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      await user.type(searchInput, 'sku001')

      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })
  })

  describe('Category Filter', () => {
    it('should render category filter', () => {
      render(<ProductsTable {...defaultProps} />)

      const categorySelects = screen.getAllByTestId('select')
      expect(categorySelects.length).toBeGreaterThan(0)
    })

    it('should display all categories as options', () => {
      render(<ProductsTable {...defaultProps} />)

      const selectItems = screen.getAllByTestId('select-item')
      const categoryItems = selectItems.filter(item => 
        item.textContent === 'Electronics' || 
        item.textContent === 'Clothing' || 
        item.textContent === 'Books'
      )
      expect(categoryItems.length).toBeGreaterThan(0)
    })

    it('should have "All categories" option', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('All categories')).toBeInTheDocument()
    })
  })

  describe('Status Filter', () => {
    it('should render status filter', () => {
      render(<ProductsTable {...defaultProps} />)

      const statusSelects = screen.getAllByTestId('select')
      expect(statusSelects.length).toBeGreaterThan(0)
    })

    it('should display status options', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('All status')).toBeInTheDocument()
      expect(screen.getAllByText('Active')).toHaveLength(3) // 2 in table + 1 in filter
      expect(screen.getAllByText('Inactive')).toHaveLength(2) // 1 in table + 1 in filter
    })
  })

  describe('Pagination', () => {
    it('should render pagination controls', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })

    it('should display product count', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('3 of 3 product(s)')).toBeInTheDocument()
    })

    it('should disable previous button on first page', () => {
      render(<ProductsTable {...defaultProps} />)

      const buttons = screen.getAllByTestId('button')
      const previousButton = buttons.find(button => button.textContent === 'Previous')
      expect(previousButton).toBeDisabled()
    })

    it('should enable next button when there are more pages', () => {
      // Create more products to trigger pagination
      const manyProducts = Array.from({ length: 15 }, (_, i) => ({
        ...mockProducts[0],
        id: `product-${i + 1}`,
        sku: `SKU${String(i + 1).padStart(3, '0')}`,
        name: `Product ${i + 1}`,
      }))

      render(<ProductsTable {...defaultProps} initialData={manyProducts} />)

      const buttons = screen.getAllByTestId('button')
      const nextButton = buttons.find(button => button.textContent === 'Next')
      expect(nextButton).not.toBeDisabled()
    })
  })

  describe('Table Structure', () => {
    it('should have correct column headers', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('SKU')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Price')).toBeInTheDocument()
      expect(screen.getByText('Stock')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should render table rows correctly', () => {
      render(<ProductsTable {...defaultProps} />)

      const rows = screen.getAllByTestId('table-row')
      // Header row + 3 data rows
      expect(rows.length).toBeGreaterThan(3)
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should have search input with proper attributes', () => {
      render(<ProductsTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      expect(searchInput).toHaveAttribute('placeholder', 'Search products...')
    })
  })

  describe('Edge Cases', () => {
    it('should handle products with null values', () => {
      render(<ProductsTable {...defaultProps} />)

      // Product 3 has null values
      expect(screen.getByText('Test Product 3')).toBeInTheDocument()
      expect(screen.getAllByText('—')).toHaveLength(2) // null category and null price
    })

    it('should handle products with zero stock', () => {
      render(<ProductsTable {...defaultProps} />)

      expect(screen.getByText('0 units')).toBeInTheDocument()
    })

    it('should handle products with missing data', () => {
      const productsWithMissingData = [
        {
          id: 'product-1',
          sku: 'SKU001',
          name: 'Test Product',
          description: null,
          category: null,
          base_price: null,
          total_quantity: 0,
          available_quantity: 0,
          low_stock: false,
          active: true,
          inventory_count: 0,
        },
      ]

      render(<ProductsTable {...defaultProps} initialData={productsWithMissingData} />)

      expect(screen.getByText('Test Product')).toBeInTheDocument()
      expect(screen.getByText('SKU001')).toBeInTheDocument()
      expect(screen.getAllByText('—')).toHaveLength(2) // null category and null price
    })

    it('should handle empty categories array', () => {
      render(<ProductsTable {...defaultProps} categories={[]} />)

      // Should still render the table
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByText('All categories')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component can be rendered without TypeScript errors
      expect(() => render(<ProductsTable {...defaultProps} />)).not.toThrow()
    })

    it('should handle ProductWithStats type correctly', () => {
      const validProduct = {
        id: 'product-1',
        sku: 'SKU001',
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        base_price: 99.99,
        total_quantity: 100,
        available_quantity: 95,
        low_stock: false,
        active: true,
        inventory_count: 1,
      }

      render(<ProductsTable {...defaultProps} initialData={[validProduct]} />)

      expect(screen.getByText('Test Product')).toBeInTheDocument()
    })
  })
})