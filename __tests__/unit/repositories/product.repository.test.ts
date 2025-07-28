/**
 * Unit tests for ProductRepository
 * Tests the concrete implementation extending BaseRepository
 */

import { ProductRepository, type Product, type CreateProductInput } from '@/lib/repositories/product.repository'
import { createMockSupabaseClient } from '../../utils/supabase-mocks'

describe('ProductRepository', () => {
  let repository: ProductRepository
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new ProductRepository(mockSupabase, {
      userId: 'user-123',
      organizationId: 'org-123'
    })
  })

  describe('Organization Isolation', () => {
    it('should include organization filter in queries', async () => {
      const mockQuery = mockSupabase.from().select()
      mockQuery.eq.mockReturnThis()
      mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      await repository.findById('product-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'org-123')
    })

    it('should filter out soft-deleted records', async () => {
      const mockQuery = mockSupabase.from().select()
      mockQuery.eq.mockReturnThis()
      mockQuery.is.mockReturnThis()
      mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      await repository.findById('product-123')

      expect(mockQuery.is).toHaveBeenCalledWith('deleted_at', null)
    })
  })

  describe('findBySku', () => {
    it('should find product by SKU', async () => {
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

      const mockQuery = mockSupabase.from().select()
      mockQuery.eq.mockReturnThis()
      mockQuery.is.mockReturnThis()
      mockQuery.single.mockResolvedValue({ data: mockProduct, error: null })

      const result = await repository.findBySku('TEST-SKU')

      expect(result).toEqual(mockProduct)
      expect(mockQuery.eq).toHaveBeenCalledWith('sku', 'TEST-SKU')
    })

    it('should return null when product not found', async () => {
      const mockQuery = mockSupabase.from().select()
      mockQuery.eq.mockReturnThis()
      mockQuery.is.mockReturnThis()
      mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      const result = await repository.findBySku('NONEXISTENT-SKU')

      expect(result).toBeNull()
    })
  })

  describe('search', () => {
    it('should search products by name or SKU', async () => {
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

      const mockQuery = mockSupabase.from().select()
      mockQuery.eq.mockReturnThis()
      mockQuery.is.mockReturnThis()
      mockQuery.or.mockReturnThis()
      mockQuery.limit.mockReturnThis()
      mockQuery.order.mockResolvedValue({ data: mockProducts, error: null })

      const result = await repository.search('Search', 10)

      expect(result).toEqual(mockProducts)
      expect(mockQuery.or).toHaveBeenCalledWith('name.ilike.%Search%,sku.ilike.%Search%')
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
      expect(mockQuery.order).toHaveBeenCalledWith('name')
    })
  })

  describe('create', () => {
    it('should create product with audit fields', async () => {
      const input: CreateProductInput = {
        sku: 'NEW-SKU',
        name: 'New Product',
        description: 'A new product',
        active: true,
        base_price: 15.99,
        cost: 8.00
      }

      const mockProduct: Product = {
        id: 'product-new',
        organization_id: 'org-123',
        ...input,
        category: null,
        weight: null,
        dimensions: {},
        image_url: null,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockProduct,
        error: null
      })

      const result = await repository.create(input)

      expect(result).toEqual(mockProduct)
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...input,
          organization_id: 'org-123'
        })
      )
    })
  })

  describe('Context Management', () => {
    it('should set context correctly', () => {
      repository.setContext('new-user-123', 'new-org-123')

      // Context should be reflected in organization isolation
      expect(repository['organizationId']).toBe('new-org-123')
      expect(repository['userId']).toBe('new-user-123')
    })
  })
})