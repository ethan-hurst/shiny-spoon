/**
 * Unit tests for ProductService
 * Tests the concrete implementation extending BaseService
 */

import { ProductService } from '@/lib/services/product.service'
import { ProductRepository, type Product, type CreateProductInput } from '@/lib/repositories/product.repository'

// Mock the repository
const mockRepository = {
  findBySku: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  search: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  bulkUpdate: jest.fn(),
  findLowStock: jest.fn(),
} as unknown as jest.Mocked<ProductRepository>

describe('ProductService', () => {
  let service: ProductService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ProductService(mockRepository)
  })

  describe('createProduct', () => {
    const validInput: CreateProductInput = {
      sku: 'TEST-SKU',
      name: 'Test Product',
      description: 'A test product',
      active: true,
      base_price: 10.99,
      cost: 5.00
    }

    const mockProduct: Product = {
      id: 'product-123',
      organization_id: 'org-123',
      ...validInput,
      category: null,
      weight: null,
      dimensions: {},
      image_url: null,
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should create a product successfully', async () => {
      mockRepository.findBySku.mockResolvedValue(null)
      mockRepository.create.mockResolvedValue(mockProduct)

      const result = await service.createProduct(validInput)

      expect(result).toEqual(mockProduct)
      expect(mockRepository.findBySku).toHaveBeenCalledWith('TEST-SKU')
      expect(mockRepository.create).toHaveBeenCalledWith(validInput)
    })

    it('should throw error for duplicate SKU', async () => {
      mockRepository.findBySku.mockResolvedValue(mockProduct)

      await expect(service.createProduct(validInput)).rejects.toThrow(
        'Product with SKU TEST-SKU already exists'
      )

      expect(mockRepository.create).not.toHaveBeenCalled()
    })

    it('should validate input data', async () => {
      const invalidInput = {
        sku: '', // Invalid empty SKU
        name: 'Test Product'
      }

      await expect(service.createProduct(invalidInput as any)).rejects.toThrow()
    })
  })

  describe('updateProduct', () => {
    const existingProduct: Product = {
      id: 'product-123',
      organization_id: 'org-123',
      sku: 'EXISTING-SKU',
      name: 'Existing Product',
      description: null,
      category: null,
      base_price: 10.99,
      cost: 5.00,
      weight: null,
      dimensions: {},
      image_url: null,
      active: true,
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should update a product successfully', async () => {
      const updateInput = {
        name: 'Updated Product Name',
        base_price: 15.99
      }

      const updatedProduct = { ...existingProduct, ...updateInput }

      mockRepository.findById.mockResolvedValue(existingProduct)
      mockRepository.update.mockResolvedValue(updatedProduct)

      const result = await service.updateProduct('product-123', updateInput)

      expect(result).toEqual(updatedProduct)
      expect(mockRepository.findById).toHaveBeenCalledWith('product-123')
      expect(mockRepository.update).toHaveBeenCalledWith('product-123', updateInput)
    })

    it('should throw error for non-existent product', async () => {
      mockRepository.findById.mockResolvedValue(null)

      await expect(service.updateProduct('nonexistent', { name: 'New Name' })).rejects.toThrow(
        'Product nonexistent not found'
      )

      expect(mockRepository.update).not.toHaveBeenCalled()
    })

    it('should check for duplicate SKU when updating SKU', async () => {
      const duplicateProduct = { ...existingProduct, id: 'other-product' }
      
      mockRepository.findById.mockResolvedValue(existingProduct)
      mockRepository.findBySku.mockResolvedValue(duplicateProduct)

      await expect(
        service.updateProduct('product-123', { sku: 'DUPLICATE-SKU' })
      ).rejects.toThrow('Product with SKU DUPLICATE-SKU already exists')

      expect(mockRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('getProduct', () => {
    it('should return a product by ID', async () => {
      const mockProduct: Product = {
        id: 'product-123',
        organization_id: 'org-123',
        sku: 'TEST-SKU',
        name: 'Test Product',
        description: null,
        category: null,
        base_price: 10.99,
        cost: 5.00,
        weight: null,
        dimensions: {},
        image_url: null,
        active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockRepository.findById.mockResolvedValue(mockProduct)

      const result = await service.getProduct('product-123')

      expect(result).toEqual(mockProduct)
      expect(mockRepository.findById).toHaveBeenCalledWith('product-123')
    })

    it('should return null for non-existent product', async () => {
      mockRepository.findById.mockResolvedValue(null)

      const result = await service.getProduct('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('searchProducts', () => {
    it('should search products by term', async () => {
      const mockProducts: Product[] = [
        {
          id: 'product-1',
          organization_id: 'org-123',
          sku: 'SEARCH-1',
          name: 'Searchable Product 1',
          description: null,
          category: null,
          base_price: 10.99,
          cost: 5.00,
          weight: null,
          dimensions: {},
          image_url: null,
          active: true,
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockRepository.search.mockResolvedValue(mockProducts)

      const result = await service.searchProducts('search', 10)

      expect(result).toEqual(mockProducts)
      expect(mockRepository.search).toHaveBeenCalledWith('search', 10)
    })
  })

  describe('Retry Logic', () => {
    it('should retry on transient errors', async () => {
      const validInput: CreateProductInput = {
        sku: 'RETRY-SKU',
        name: 'Retry Product',
        active: true,
        base_price: 10.99,
        cost: 5.00
      }

      const mockProduct: Product = {
        id: 'product-retry',
        organization_id: 'org-123',
        ...validInput,
        description: null,
        category: null,
        weight: null,
        dimensions: {},
        image_url: null,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Mock transient error on first call, success on second
      mockRepository.findBySku.mockResolvedValue(null)
      mockRepository.create
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce(mockProduct)

      const result = await service.createProduct(validInput)

      expect(result).toEqual(mockProduct)
      expect(mockRepository.create).toHaveBeenCalledTimes(2)
    })

    it('should not retry on validation errors', async () => {
      const invalidInput = {
        sku: '', // Invalid
        name: 'Test Product'
      }

      await expect(service.createProduct(invalidInput as any)).rejects.toThrow()

      // Should not call repository at all due to validation failure
      expect(mockRepository.findBySku).not.toHaveBeenCalled()
      expect(mockRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('Health Check', () => {
    it('should return healthy status when repository is accessible', async () => {
      mockRepository.count.mockResolvedValue(100)

      const health = await service.getHealth()

      expect(health.status).toBe('healthy')
      expect(health.checks.basic).toBe(true)
    })

    it('should return unhealthy status when repository fails', async () => {
      mockRepository.count.mockRejectedValue(new Error('Database error'))

      const health = await service.getHealth()

      expect(health.status).toBe('unhealthy')
      expect(health.checks.basic).toBe(false)
    })
  })
})