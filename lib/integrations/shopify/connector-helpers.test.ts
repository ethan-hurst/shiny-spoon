import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { BaseLogger, SyncOptions } from '@/lib/integrations/base-connector'
import type { ShopifyApiClient } from './api-client'
import {
  incrementalSyncProducts,
  type IncrementalSyncHelperOptions,
} from './connector-helpers'
import type { ShopifyTransformers } from './transformers'

// Mock the ShopifyApiClient to avoid importing the real implementation
jest.mock('./api-client', () => ({
  ShopifyApiClient: {
    buildProductQuery: jest.fn().mockReturnValue('id title handle'),
  },
}))

describe('connector-helpers', () => {
  let mockHelpers: IncrementalSyncHelperOptions
  let mockClient: any
  let mockTransformers: any
  let mockLogger: any

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create mock implementations
    mockClient = {
      query: jest.fn(),
    }

    mockTransformers = {
      transformProduct: jest.fn(),
    }

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }

    mockHelpers = {
      client: mockClient,
      transformers: mockTransformers,
      logger: mockLogger,
      getSyncState: jest.fn() as any,
      saveProduct: jest.fn() as any,
      saveProductMapping: jest.fn() as any,
      saveSyncCursor: jest.fn() as any,
      updateSyncState: jest.fn() as any,
      emitProgress: jest.fn() as any,
      withRateLimit: jest.fn((fn: any) => fn()) as any,
    }
  })

  describe('incrementalSyncProducts', () => {
    describe('happy path scenarios', () => {
      it('should successfully sync products with basic configuration', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor123',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Test Product',
                    handle: 'test-product',
                  },
                },
                {
                  node: {
                    id: 'gid://shopify/Product/2',
                    title: 'Another Product',
                    handle: 'another-product',
                  },
                },
              ],
            },
          },
        }

        const transformedProduct = {
          id: 'internal-1',
          title: 'Test Product',
          handle: 'test-product',
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockReturnValue(transformedProduct)

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(result.processed).toBe(2)
        expect(result.failed).toBe(0)
        expect(result.errors).toHaveLength(0)
        expect(mockHelpers.saveProduct).toHaveBeenCalledTimes(2)
        expect(mockHelpers.saveProductMapping).toHaveBeenCalledTimes(2)
        expect(mockHelpers.saveSyncCursor).toHaveBeenCalledWith(
          'product',
          'cursor123'
        )
        expect(mockHelpers.updateSyncState).toHaveBeenCalledWith('product', {
          last_sync_at: expect.any(Date),
          total_synced: 2,
          total_failed: 0,
          last_error: null,
        })
      })

      it('should handle pagination correctly', async () => {
        const firstPage = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: true,
                endCursor: 'cursor1',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Product 1',
                  },
                },
              ],
            },
          },
        }

        const secondPage = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor2',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/2',
                    title: 'Product 2',
                  },
                },
              ],
            },
          },
        }

        mockClient.query
          .mockResolvedValueOnce(firstPage)
          .mockResolvedValueOnce(secondPage)
        mockTransformers.transformProduct.mockReturnValue({
          id: 'internal',
        })

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(mockClient.query).toHaveBeenCalledTimes(2)
        expect(result.processed).toBe(2)
        expect(mockHelpers.saveSyncCursor).toHaveBeenCalledWith(
          'product',
          'cursor1'
        )
        expect(mockHelpers.saveSyncCursor).toHaveBeenCalledWith(
          'product',
          'cursor2'
        )
      })

      it('should resume from existing cursor', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'new-cursor',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Product 1',
                  },
                },
              ],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockReturnValue({
          id: 'internal',
        })

        const syncState = { sync_cursor: 'existing-cursor' }
        await incrementalSyncProducts(mockHelpers, syncState)

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('query GetProducts'),
          { cursor: 'existing-cursor' }
        )
      })

      it('should emit progress at correct intervals', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: Array.from({ length: 25 }, (_, i) => ({
                node: {
                  id: `gid://shopify/Product/${i + 1}`,
                  title: `Product ${i + 1}`,
                },
              })),
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockReturnValue({
          id: 'internal',
        })

        const syncState = { sync_cursor: null }
        await incrementalSyncProducts(mockHelpers, syncState)

        // Progress should be emitted at products 10 and 20
        expect(mockHelpers.emitProgress).toHaveBeenCalledTimes(2)
        expect(mockHelpers.emitProgress).toHaveBeenNthCalledWith(1, 10, 10)
        expect(mockHelpers.emitProgress).toHaveBeenNthCalledWith(2, 20, 20)
      })
    })

    describe('dry run scenarios', () => {
      it('should handle dry run mode correctly', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Test Product',
                  },
                },
              ],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)

        const syncState = { sync_cursor: null }
        const options: SyncOptions = { dryRun: true }
        const result = await incrementalSyncProducts(
          mockHelpers,
          syncState,
          options
        )

        expect(result.processed).toBe(1)
        expect(mockHelpers.saveProduct).not.toHaveBeenCalled()
        expect(mockHelpers.saveProductMapping).not.toHaveBeenCalled()
        expect(mockHelpers.saveSyncCursor).not.toHaveBeenCalled()
        expect(mockHelpers.updateSyncState).not.toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Dry run: Would sync product',
          {
            id: 'gid://shopify/Product/1',
            title: 'Test Product',
          }
        )
      })
    })

    describe('limit and abort scenarios', () => {
      it('should respect sync limit', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: true,
                endCursor: 'cursor',
              },
              edges: Array.from({ length: 10 }, (_, i) => ({
                node: {
                  id: `gid://shopify/Product/${i + 1}`,
                  title: `Product ${i + 1}`,
                },
              })),
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockReturnValue({
          id: 'internal',
        })

        const syncState = { sync_cursor: null }
        const options: SyncOptions = { limit: 5 }
        const result = await incrementalSyncProducts(
          mockHelpers,
          syncState,
          options
        )

        expect(result.processed).toBe(10)
        expect(mockHelpers.saveProduct).toHaveBeenCalledTimes(10)
      })

      it('should handle abort signal', async () => {
        const abortController = new AbortController()
        abortController.abort()

        const syncState = { sync_cursor: null }
        const options: SyncOptions = { signal: abortController.signal }
        const result = await incrementalSyncProducts(
          mockHelpers,
          syncState,
          options
        )

        expect(result.processed).toBe(0)
        expect(mockClient.query).not.toHaveBeenCalled()
      })

      it('should use custom limit in GraphQL query', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)

        const syncState = { sync_cursor: null }
        const options: SyncOptions = { limit: 25 }
        await incrementalSyncProducts(mockHelpers, syncState, options)

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('products(first: 25'),
          { cursor: null }
        )
      })
    })

    describe('error handling scenarios', () => {
      it('should handle individual product transformation errors', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Good Product',
                  },
                },
                {
                  node: {
                    id: 'gid://shopify/Product/2',
                    title: 'Bad Product',
                  },
                },
              ],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct
          .mockReturnValueOnce({ id: 'internal-1' })
          .mockImplementationOnce(() => {
            throw new Error('Transformation failed')
          })

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(result.processed).toBe(1)
        expect(result.failed).toBe(1)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toBe('Transformation failed')
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to sync product',
          {
            productId: 'gid://shopify/Product/2',
            error: expect.any(Error),
          }
        )
      })

      it('should handle save product errors', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Test Product',
                  },
                },
              ],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockReturnValue({
          id: 'internal',
        })
        ;(mockHelpers.saveProduct as any).mockRejectedValue(
          new Error('Database error')
        )

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(result.processed).toBe(0)
        expect(result.failed).toBe(1)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toBe('Database error')
      })

      it('should handle API query errors gracefully', async () => {
        mockClient.query.mockRejectedValue(new Error('API Error'))

        const syncState = { sync_cursor: null }

        await expect(
          incrementalSyncProducts(mockHelpers, syncState)
        ).rejects.toThrow('API Error')
      })

      it('should handle missing products data', async () => {
        const mockResponse = {
          data: {
            products: null,
          },
        }

        mockClient.query.mockResolvedValue(mockResponse)

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(result.processed).toBe(0)
        expect(result.failed).toBe(0)
        expect(result.errors).toHaveLength(0)
      })

      it('should update sync state with error information', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Test Product',
                  },
                },
              ],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockImplementation(() => {
          throw new Error('Critical transformation error')
        })

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(mockHelpers.updateSyncState).toHaveBeenCalledWith('product', {
          last_sync_at: expect.any(Date),
          total_synced: 0,
          total_failed: 1,
          last_error: 'Critical transformation error',
        })
      })
    })

    describe('rate limiting scenarios', () => {
      it('should call withRateLimit for API queries', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)

        const syncState = { sync_cursor: null }
        await incrementalSyncProducts(mockHelpers, syncState)

        expect(mockHelpers.withRateLimit).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })

      it('should handle rate limit errors', async () => {
        ;(mockHelpers.withRateLimit as any).mockRejectedValue(
          new Error('Rate limit exceeded')
        )

        const syncState = { sync_cursor: null }

        await expect(
          incrementalSyncProducts(mockHelpers, syncState)
        ).rejects.toThrow('Rate limit exceeded')
      })
    })

    describe('edge cases', () => {
      it('should handle empty product edges', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              edges: [],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(result.processed).toBe(0)
        expect(result.failed).toBe(0)
        expect(result.errors).toHaveLength(0)
        expect(mockHelpers.saveSyncCursor).toHaveBeenCalledWith('product', null)
      })

      it('should handle undefined sync state', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Test Product',
                  },
                },
              ],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockReturnValue({
          id: 'internal',
        })

        const result = await incrementalSyncProducts(mockHelpers, undefined)

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('query GetProducts'),
          { cursor: undefined }
        )
        expect(result.processed).toBe(1)
      })

      it('should handle null cursor values', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Product/1',
                    title: 'Test Product',
                  },
                },
              ],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)
        mockTransformers.transformProduct.mockReturnValue({
          id: 'internal',
        })

        const syncState = { sync_cursor: null }
        const result = await incrementalSyncProducts(mockHelpers, syncState)

        expect(mockHelpers.saveSyncCursor).toHaveBeenCalledWith('product', null)
        expect(result.processed).toBe(1)
      })

      it('should log start of sync operation', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)

        const syncState = { sync_cursor: null }
        await incrementalSyncProducts(mockHelpers, syncState)

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Starting incremental product sync'
        )
      })
    })

    describe('GraphQL query construction', () => {
      it('should construct proper GraphQL query with cursor parameter', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)

        const syncState = { sync_cursor: 'test-cursor' }
        await incrementalSyncProducts(mockHelpers, syncState)

        const expectedQuery = expect.stringContaining(
          'query GetProducts($cursor: String)'
        )
        expect(mockClient.query).toHaveBeenCalledWith(expectedQuery, {
          cursor: 'test-cursor',
        })
      })

      it('should include buildProductQuery result in GraphQL query', async () => {
        const mockProducts = {
          data: {
            products: {
              pageInfo: {
                hasNextPage: false,
                endCursor: 'cursor',
              },
              edges: [],
            },
          },
        }

        mockClient.query.mockResolvedValue(mockProducts)

        const syncState = { sync_cursor: null }
        await incrementalSyncProducts(mockHelpers, syncState)

        const capturedQuery = mockClient.query.mock.calls[0][0]
        expect(capturedQuery).toContain('id')
        expect(capturedQuery).toContain('title')
        expect(capturedQuery).toContain('handle')
      })
    })
  })
})
