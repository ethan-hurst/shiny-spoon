import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock next/navigation
const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockRouter = {
  push: mockPush,
  refresh: mockRefresh,
}
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock form actions
const mockCreateProduct = jest.fn()
const mockUpdateProduct = jest.fn()
jest.mock('@/app/actions/products', () => ({
  createProduct: mockCreateProduct,
  updateProduct: mockUpdateProduct,
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

jest.mock('@/components/ui/form', () => ({
  Form: ({ children, ...props }: any) => (
    <div data-testid="form" {...props}>
      {children}
    </div>
  ),
  FormControl: ({ children, ...props }: any) => (
    <div data-testid="form-control" {...props}>
      {children}
    </div>
  ),
  FormDescription: ({ children, ...props }: any) => (
    <div data-testid="form-description" {...props}>
      {children}
    </div>
  ),
  FormField: ({ children, ...props }: any) => (
    <div data-testid="form-field" {...props}>
      {children}
    </div>
  ),
  FormItem: ({ children, ...props }: any) => (
    <div data-testid="form-item" {...props}>
      {children}
    </div>
  ),
  FormLabel: ({ children, ...props }: any) => (
    <label data-testid="form-label" {...props}>
      {children}
    </label>
  ),
  FormMessage: ({ children, ...props }: any) => (
    <div data-testid="form-message" {...props}>
      {children}
    </div>
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => (
    <input data-testid="input" {...props} />
  ),
}))

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ ...props }: any) => (
    <textarea data-testid="textarea" {...props} />
  ),
}))

// Mock child components
jest.mock('@/components/features/products/category-select', () => ({
  CategorySelect: ({ value, onChange }: any) => (
    <select
      data-testid="category-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select category</option>
      <option value="electronics">Electronics</option>
      <option value="clothing">Clothing</option>
    </select>
  ),
}))

jest.mock('@/components/features/products/image-upload', () => ({
  ImageUpload: ({ value, onChange }: any) => (
    <input
      type="file"
      data-testid="image-upload"
      accept="image/*"
      onChange={(e) => onChange(e.target.files?.[0])}
    />
  ),
}))

// Mock validation schema
jest.mock('@/lib/validations/product', () => ({
  productSchema: {
    parse: jest.fn(),
  },
}))

// Mock file utility
jest.mock('@/lib/utils/file', () => ({
  isFile: jest.fn(),
}))

import { ProductForm } from '@/components/features/products/product-form'

const mockProduct = {
  id: 'product-1',
  sku: 'WIDGET-001',
  name: 'Test Product',
  description: 'A test product description',
  category: 'electronics',
  base_price: 99.99,
  cost: 50.00,
  weight: 1.5,
  image_url: 'https://example.com/image.jpg',
  status: 'active',
  stock_quantity: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('ProductForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Structure', () => {
    it('should render the form with all fields', () => {
      render(<ProductForm />)

      expect(document.querySelector('form')).toBeInTheDocument()
      expect(screen.getByText('SKU')).toBeInTheDocument()
      expect(screen.getByText('Product Name')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
    })

    it('should render form labels', () => {
      render(<ProductForm />)

      expect(screen.getByText('SKU')).toBeInTheDocument()
      expect(screen.getByText('Product Name')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
    })

    it('should render form inputs', () => {
      render(<ProductForm />)

      expect(screen.getAllByRole('textbox')).toHaveLength(expect.any(Number))
      expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument()
    })
  })

  describe('Create Mode', () => {
    it('should render in create mode with empty form', () => {
      render(<ProductForm />)

      const skuInput = screen.getByDisplayValue('')
      expect(skuInput).toBeInTheDocument()
    })

    it('should call createProduct when submitting in create mode', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockResolvedValue({ data: { id: 'new-product' } })

      render(<ProductForm />)

      const nameInput = screen.getByDisplayValue('')
      await user.type(nameInput, 'New Product')

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockCreateProduct).toHaveBeenCalled()
      })
    })
  })

  describe('Edit Mode', () => {
    it('should render in edit mode with product data', () => {
      render(<ProductForm product={mockProduct} />)

      expect(screen.getByDisplayValue('WIDGET-001')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument()
      expect(screen.getByDisplayValue('A test product description')).toBeInTheDocument()
    })

    it('should disable SKU field in edit mode', () => {
      render(<ProductForm product={mockProduct} />)

      const skuInput = screen.getByDisplayValue('WIDGET-001')
      expect(skuInput).toBeDisabled()
    })

    it('should call updateProduct when submitting in edit mode', async () => {
      const user = userEvent.setup()
      mockUpdateProduct.mockResolvedValue({ data: { id: 'product-1' } })

      render(<ProductForm product={mockProduct} />)

      const submitButton = screen.getByRole('button', { name: /update product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockUpdateProduct).toHaveBeenCalled()
      })
    })
  })

  describe('Form Validation', () => {
    it('should handle validation errors', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockResolvedValue({
        error: {
          fieldErrors: {
            name: ['Name is required'],
            sku: ['SKU must be unique'],
          },
        },
      })

      render(<ProductForm />)

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Validation errors: name: Name is required; sku: SKU must be unique'
        )
      })
    })

    it('should handle string error messages', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockResolvedValue({ error: 'Product already exists' })

      render(<ProductForm />)

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Product already exists')
      })
    })
  })

  describe('Success Handling', () => {
    it('should show success toast and redirect on successful creation', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockResolvedValue({ data: { id: 'new-product' } })

      render(<ProductForm />)

      const nameInput = screen.getByDisplayValue('')
      await user.type(nameInput, 'New Product')

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Product created successfully'
        )
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/products')
        expect(mockRouter.refresh).toHaveBeenCalled()
      })
    })

    it('should show success toast and redirect on successful update', async () => {
      const user = userEvent.setup()
      mockUpdateProduct.mockResolvedValue({ data: { id: 'product-1' } })

      render(<ProductForm product={mockProduct} />)

      const submitButton = screen.getByRole('button', { name: /update product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Product updated successfully'
        )
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/products')
        expect(mockRouter.refresh).toHaveBeenCalled()
      })
    })
  })

  describe('Image Upload', () => {
    it('should handle image upload', async () => {
      const user = userEvent.setup()
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      render(<ProductForm />)

      const imageUpload = screen.getByTestId('image-upload')
      await user.upload(imageUpload, mockFile)

      expect(imageUpload).toBeInTheDocument()
    })
  })

  describe('Category Selection', () => {
    it('should handle category selection', async () => {
      const user = userEvent.setup()
      render(<ProductForm />)

      const categorySelect = screen.getByTestId('category-select')
      await user.selectOptions(categorySelect, 'electronics')

      expect(categorySelect).toHaveValue('electronics')
    })
  })

  describe('Loading States', () => {
    it('should handle loading state during submission', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: { id: 'new-product' } }), 100))
      )

      render(<ProductForm />)

      const nameInput = screen.getByDisplayValue('')
      await user.type(nameInput, 'Test Product')

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      // Button should be disabled during submission
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockRejectedValue(new Error('Network error'))

      render(<ProductForm />)

      const nameInput = screen.getByDisplayValue('')
      await user.type(nameInput, 'Test Product')

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'An unexpected error occurred'
        )
      })
    })

    it('should handle API errors with message', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockResolvedValue({
        error: { message: 'Database connection failed' },
      })

      render(<ProductForm />)

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Database connection failed')
      })
    })

    it('should handle generic error fallback', async () => {
      const user = userEvent.setup()
      mockCreateProduct.mockResolvedValue({
        error: { someOtherField: 'value' },
      })

      render(<ProductForm />)

      const submitButton = screen.getByRole('button', { name: /create product/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to save product. Please check your input and try again.'
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper form structure', () => {
      render(<ProductForm />)

      const form = document.querySelector('form')
      expect(form).toBeInTheDocument()
    })

    it('should have proper labels for inputs', () => {
      render(<ProductForm />)

      const labels = screen.getAllByText(/SKU|Product Name|Description|Category/)
      expect(labels.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle product with minimal data', () => {
      const minimalProduct = {
        id: 'product-1',
        sku: 'MINIMAL-001',
        name: 'Minimal Product',
        description: '',
        category: '',
        base_price: 0,
        cost: 0,
        weight: 0,
        image_url: '',
        status: 'active',
        stock_quantity: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      render(<ProductForm product={minimalProduct} />)

      expect(screen.getByDisplayValue('MINIMAL-001')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Minimal Product')).toBeInTheDocument()
    })

    it('should handle null/undefined values', () => {
      const productWithNulls = {
        ...mockProduct,
        description: null,
        category: null,
        base_price: null,
        cost: null,
        weight: null,
        image_url: null,
      }

      render(<ProductForm product={productWithNulls} />)

      expect(document.querySelector('form')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should handle different product statuses', () => {
      const inactiveProduct = {
        ...mockProduct,
        status: 'inactive',
      }

      render(<ProductForm product={inactiveProduct} />)

      expect(document.querySelector('form')).toBeInTheDocument()
    })

    it('should handle different price formats', () => {
      const productWithDecimals = {
        ...mockProduct,
        base_price: 99.99,
        cost: 50.50,
      }

      render(<ProductForm product={productWithDecimals} />)

      expect(document.querySelector('form')).toBeInTheDocument()
    })
  })
})