/**
 * Integration tests for Product domain
 * Tests the full stack: Repository -> Service -> API/Actions
 */

import { ProductRepository, ProductService } from '@/lib/repositories/product.repository'
import { createMockSupabaseClient } from '../../utils/supabase-mocks'

describe('Product Domain Integration', () => {
  let repository: ProductRepository
  let service: ProductService
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new ProductRepository(mockSupabase, {
      userId: 'user-123',
      organizationId: 'org-123'
    })
    service = new ProductService(repository)
  })

  describe('Complete Product Lifecycle', () => {
    it('should handle create -> read -> update -> delete lifecycle', async () => {
      const createInput = {
        sku: 'LIFECYCLE-TEST',
        name: 'Lifecycle Test Product',
        description: 'A product for testing the complete lifecycle',
        active: true,
        base_price: 29.99,
        cost: 15.00
      }

      const mockProduct = {
        id: 'product-lifecycle',
        organization_id: 'org-123',
        ...createInput,
        category: null,
        weight: null,
        dimensions: {},
        image_url: null,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Mock repository responses
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // findBySku returns null
        .mockResolvedValueOnce({ data: mockProduct, error: null }) // findById returns product
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // findBySku for update returns null

      mockSupabase.from().insert().select().single
        .mockResolvedValue({ data: mockProduct, error: null })

      mockSupabase.from().select().eq().is().single
        .mockResolvedValue({ data: mockProduct, error: null })

      const updatedProduct = { ...mockProduct, name: 'Updated Product Name' }
      mockSupabase.from().update().eq().select().single
        .mockResolvedValue({ data: updatedProduct, error: null })

      // 1. Create product
      const created = await service.createProduct(createInput)
      expect(created).toEqual(mockProduct)

      // 2. Read product
      const read = await service.getProduct('product-lifecycle')
      expect(read).toEqual(mockProduct)

      // 3. Update product
      const updated = await service.updateProduct('product-lifecycle', {
        name: 'Updated Product Name'
      })
      expect(updated.name).toBe('Updated Product Name')

      // 4. Delete product (soft delete)
      await expect(service.deleteProduct('product-lifecycle')).resolves.not.toThrow()
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle transient database errors with retry', async () => {
      const createInput = {
        sku: 'RETRY-TEST',
        name: 'Retry Test Product',
        active: true,
        base_price: 10.00,
        cost: 5.00
      }

      const mockProduct = {
        id: 'product-retry',
        organization_id: 'org-123',
        ...createInput,
        description: null,
        category: null,
        weight: null,
        dimensions: {},
        image_url: null,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Mock transient failure then success
      mockSupabase.from().select().eq().single
        .mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      mockSupabase.from().insert().select().single
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({ data: mockProduct, error: null })

      const result = await service.createProduct(createInput)

      expect(result).toEqual(mockProduct)
      expect(mockSupabase.from().insert().select().single).toHaveBeenCalledTimes(2)
    })

    it('should validate business rules', async () => {
      // Test duplicate SKU validation
      const existingProduct = {
        id: 'existing-product',
        organization_id: 'org-123',
        sku: 'DUPLICATE-SKU',
        name: 'Existing Product',
        description: null,
        category: null,
        base_price: 10.00,
        cost: 5.00,
        weight: null,
        dimensions: {},
        image_url: null,
        active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from().select().eq().single
        .mockResolvedValue({ data: existingProduct, error: null })

      await expect(
        service.createProduct({
          sku: 'DUPLICATE-SKU',
          name: 'Duplicate Test',
          active: true,
          base_price: 15.00,
          cost: 8.00
        })
      ).rejects.toThrow('Product with SKU DUPLICATE-SKU already exists')
    })
  })

  describe('Organization Isolation', () => {
    it('should enforce organization boundaries', async () => {
      // Repository should always include organization_id filter
      await service.getAllProducts()

      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      const mockQuery = mockSupabase.from().select()
      expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'org-123')
    })

    it('should set audit fields on create', async () => {
      const createInput = {
        sku: 'AUDIT-TEST',
        name: 'Audit Test Product',
        active: true,
        base_price: 10.00,
        cost: 5.00
      }

      const mockProduct = {
        id: 'product-audit',
        organization_id: 'org-123',
        ...createInput,
        description: null,
        category: null,
        weight: null,
        dimensions: {},
        image_url: null,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from().select().eq().single
        .mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      mockSupabase.from().insert().select().single
        .mockResolvedValue({ data: mockProduct, error: null })

      await service.createProduct(createInput)

      // Verify audit fields are set
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-123'
        })
      )
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle bulk operations efficiently', async () => {
      const updates = Array.from({ length: 50 }, (_, i) => ({
        id: `product-${i}`,
        name: `Updated Product ${i}`
      }))

      // Mock successful updates
      const mockUpdatedProduct = {
        id: 'product-0',
        organization_id: 'org-123',
        sku: 'TEST-0',
        name: 'Updated Product 0',
        description: null,
        category: null,
        base_price: 10.00,
        cost: 5.00,
        weight: null,
        dimensions: {},
        image_url: null,
        active: true,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockSupabase.from().update().eq().select().single
        .mockResolvedValue({ data: mockUpdatedProduct, error: null })

      const results = await service.bulkUpdateProducts(updates)

      expect(results).toHaveLength(50)
      // Should process in batches (default batch size is 100, so all in one batch)
      expect(mockSupabase.from().update().eq().select().single).toHaveBeenCalledTimes(50)
    })

    it('should handle search operations', async () => {
      const mockSearchResults = [
        {
          id: 'search-1',
          organization_id: 'org-123',
          sku: 'SEARCH-1',
          name: 'Searchable Product 1',
          description: null,
          category: null,
          base_price: 10.00,
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
      mockQuery.order.mockResolvedValue({ data: mockSearchResults, error: null })

      const results = await service.searchProducts('search', 10)

      expect(results).toEqual(mockSearchResults)
      expect(mockQuery.or).toHaveBeenCalledWith('name.ilike.%search%,sku.ilike.%search%')
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
    })
  })

  describe('Health and Monitoring', () => {
    it('should report service health', async () => {
      mockSupabase.from().select
        .mockReturnValue({
          eq: () => ({
            is: () => Promise.resolve({ count: 100, error: null })
          })
        })

      const health = await service.getHealth()

      expect(health.service).toBe('ProductService')
      expect(health.status).toBe('healthy')
      expect(health.checks.basic).toBe(true)
    })

    it('should handle health check failures', async () => {
      mockSupabase.from().select
        .mockReturnValue({
          eq: () => ({
            is: () => Promise.reject(new Error('Database connection failed'))
          })
        })

      const health = await service.getHealth()

      expect(health.service).toBe('ProductService')
      expect(health.status).toBe('unhealthy')
      expect(health.checks.basic).toBe(false)
    })
  })
})