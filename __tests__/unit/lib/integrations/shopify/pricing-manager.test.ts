/* eslint-env jest */
// PRP-014: Shopify B2B Pricing Manager Unit Tests
// Testing library: Jest (v30.0.4) with @testing-library/jest-dom

import { ShopifyApiClient } from '@/lib/integrations/shopify/api-client'
import { PricingManager } from '@/lib/integrations/shopify/pricing-manager'
import { ShopifyTransformers } from '@/lib/integrations/shopify/transformers'
import { createClient } from '@/lib/supabase/server'
import type {
  ShopifyCatalog,
  ShopifyPriceList,
  ShopifyPrice,
  ShopifyCatalogGroup,
  SyncResult,
  SyncOptions
} from '@/types/shopify.types'

// Mock dependencies

jest.mock('@/lib/integrations/shopify/api-client')
jest.mock('@/lib/integrations/shopify/transformers')
jest.mock('@/lib/supabase/server')

const mockApiClient = {
  query: jest.fn(),
  mutation: jest.fn()
} as jest.Mocked<ShopifyApiClient>

const mockSupabaseClient = {
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  single: jest.fn(() => mockSupabaseClient),
  upsert: jest.fn(() => mockSupabaseClient),
  insert: jest.fn(() => mockSupabaseClient)
}

const mockTransformers = {
  transformPrice: jest.fn()
} as jest.Mocked<ShopifyTransformers>

;(createClient as jest.Mock).mockResolvedValue(mockSupabaseClient)
;(ShopifyTransformers as jest.Mock).mockImplementation(() => mockTransformers)

describe('PricingManager', () => {
  let pricingManager: PricingManager
  const integrationId = 'test-integration-id'
  const organizationId = 'test-org-id'

  beforeEach(() => {
    jest.clearAllMocks()
    pricingManager = new PricingManager(
      mockApiClient,
      integrationId,
      organizationId,
      { currency: 'USD' }
    )
  })

  describe('constructor', () => {
    it('should initialize with required parameters', () => {
      expect(pricingManager).toBeInstanceOf(PricingManager)
    })

    it('should initialize with default settings when none provided', () => {
      const manager = new PricingManager(mockApiClient, integrationId, organizationId)
      expect(manager).toBeInstanceOf(PricingManager)
    })

    it('should initialize transformers instance', () => {
      expect(ShopifyTransformers).toHaveBeenCalled()
    })

    it('should handle undefined settings gracefully', () => {
      const manager = new PricingManager(mockApiClient, integrationId, organizationId, undefined)
      expect(manager).toBeDefined()
    })
  })

  describe('syncCatalogs', () => {
    const mockCatalogs: ShopifyCatalog[] = [
      {
        id: 'catalog-1',
        title: 'Test Catalog 1',
        status: 'ACTIVE',
        priceList: {
          id: 'price-list-1',
          name: 'Test Price List',
          currency: 'USD'
        }
      },
      {
        id: 'catalog-2',
        title: 'Test Catalog 2',
        status: 'ACTIVE',
        priceList: null
      }
    ]

    const mockCatalogGroups: ShopifyCatalogGroup[] = [
      {
        id: 'group-1',
        name: 'Test Group'
      }
    ]

    beforeEach(() => {
      // Mock private methods
      jest.spyOn(pricingManager as any, 'fetchCatalogs').mockResolvedValue(mockCatalogs)
      jest.spyOn(pricingManager as any, 'fetchCatalogGroups').mockResolvedValue(mockCatalogGroups)
      jest.spyOn(pricingManager as any, 'saveCatalog').mockResolvedValue(undefined)
      jest.spyOn(pricingManager as any, 'saveCatalogGroup').mockResolvedValue(undefined)
      jest.spyOn(pricingManager as any, 'syncPriceList').mockResolvedValue(undefined)
    })

    it('should successfully sync catalogs and return success result', async () => {
      const result = await pricingManager.syncCatalogs()

      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(3) // 2 catalogs + 1 group
      expect(result.items_failed).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(typeof result.duration_ms).toBe('number')
      expect(result.duration_ms).toBeGreaterThan(0)
    })

    it('should handle dry run mode without executing mutations', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const saveCatalogSpy = jest.spyOn(pricingManager as any, 'saveCatalog')

      const result = await pricingManager.syncCatalogs({ dryRun: true })

      expect(consoleSpy).toHaveBeenCalledWith('Dry run: Would sync catalog', {
        id: 'catalog-1',
        title: 'Test Catalog 1'
      })
      expect(saveCatalogSpy).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(3)

      consoleSpy.mockRestore()
    })

    it('should handle catalog sync errors and continue processing', async () => {
      const error = new Error('Catalog sync failed')
      jest.spyOn(pricingManager as any, 'saveCatalog')
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await pricingManager.syncCatalogs()

      expect(result.success).toBe(false)
      expect(result.items_processed).toBe(2) // 1 successful catalog + 1 group
      expect(result.items_failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('Catalog sync failed')
      expect(result.errors[0].code).toBe('PRICING_SYNC_ERROR')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to sync catalog:', error)

      consoleErrorSpy.mockRestore()
    })

    it('should sync price lists for catalogs that have them', async () => {
      const syncPriceListSpy = jest.spyOn(pricingManager as any, 'syncPriceList')

      await pricingManager.syncCatalogs()

      expect(syncPriceListSpy).toHaveBeenCalledWith(mockCatalogs[0].priceList)
      expect(syncPriceListSpy).toHaveBeenCalledTimes(1)
    })

    it('should handle catalog group sync errors without stopping execution', async () => {
      const error = new Error('Group sync failed')
      jest.spyOn(pricingManager as any, 'saveCatalogGroup').mockRejectedValue(error)

      const result = await pricingManager.syncCatalogs()

      expect(result.success).toBe(false)
      expect(result.items_failed).toBe(1)
      expect(result.errors[0].message).toBe('Group sync failed')
    })

    it('should throw error if fetchCatalogs fails', async () => {
      const error = new Error('Fetch failed')
      jest.spyOn(pricingManager as any, 'fetchCatalogs').mockRejectedValue(error)

      await expect(pricingManager.syncCatalogs()).rejects.toThrow('Catalog sync failed: Error: Fetch failed')
    })

    it('should handle empty catalogs array', async () => {
      jest.spyOn(pricingManager as any, 'fetchCatalogs').mockResolvedValue([])
      jest.spyOn(pricingManager as any, 'fetchCatalogGroups').mockResolvedValue([])

      const result = await pricingManager.syncCatalogs()

      expect(result.success).toBe(true)
      expect(result.items_processed).toBe(0)
      expect(result.items_failed).toBe(0)
    })
  })

  describe('createCatalog', () => {
    const mockResponse = {
      data: {
        catalogCreate: {
          catalog: {
            id: 'new-catalog-id',
            title: 'New Catalog',
            status: 'ACTIVE',
            publication: { id: 'pub-id' }
          },
          userErrors: []
        }
      }
    }

    beforeEach(() => {
      mockApiClient.mutation.mockResolvedValue(mockResponse)
      jest.spyOn(pricingManager, 'assignCatalogToCustomers').mockResolvedValue(undefined)
    })

    it('should create a new catalog successfully', async () => {
      const result = await pricingManager.createCatalog('Test Catalog', ['customer-1'])

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation createCatalog'),
        {
          input: {
            title: 'Test Catalog',
            status: 'ACTIVE'
          }
        }
      )
      expect(result).toEqual(mockResponse.data.catalogCreate.catalog)
    })

    it('should assign catalog to customers when customer IDs provided', async () => {
      const customerIds = ['customer-1', 'customer-2']
      const assignSpy = jest.spyOn(pricingManager, 'assignCatalogToCustomers')

      await pricingManager.createCatalog('Test Catalog', customerIds)

      expect(assignSpy).toHaveBeenCalledWith('new-catalog-id', customerIds)
    })

    it('should not assign customers when empty array provided', async () => {
      const assignSpy = jest.spyOn(pricingManager, 'assignCatalogToCustomers')

      await pricingManager.createCatalog('Test Catalog', [])

      expect(assignSpy).not.toHaveBeenCalled()
    })

    it('should throw error when catalog creation fails with user errors', async () => {
      const errorResponse = {
        data: {
          catalogCreate: {
            catalog: null,
            userErrors: [{ field: 'title', message: 'Title is required' }]
          }
        }
      }
      mockApiClient.mutation.mockResolvedValue(errorResponse)

      await expect(pricingManager.createCatalog('', [])).rejects.toThrow('Failed to create catalog: Title is required')
    })

    it('should handle network errors during catalog creation', async () => {
      const networkError = new Error('Network timeout')
      mockApiClient.mutation.mockRejectedValue(networkError)

      await expect(pricingManager.createCatalog('Test', [])).rejects.toThrow('Network timeout')
    })
  })

  describe('upsertPriceList', () => {
    const mockPrices = [
      { variantId: 'variant-1', price: 10.99, compareAtPrice: 15.99 },
      { variantId: 'variant-2', price: 20.50 }
    ]

    const mockResponse = {
      data: {
        priceListFixedPricesAdd: {
          prices: [],
          userErrors: []
        }
      }
    }

    beforeEach(() => {
      mockApiClient.mutation.mockResolvedValue(mockResponse)
      jest.spyOn(pricingManager as any, 'getOrCreatePriceList').mockResolvedValue('price-list-id')
    })

    it('should update prices successfully with proper formatting', async () => {
      await pricingManager.upsertPriceList('catalog-id', mockPrices)

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation updatePrices'),
        {
          priceListId: 'price-list-id',
          prices: [
            {
              variantId: 'variant-1',
              price: { amount: '10.99', currencyCode: 'USD' },
              compareAtPrice: { amount: '15.99', currencyCode: 'USD' }
            },
            {
              variantId: 'variant-2',
              price: { amount: '20.5', currencyCode: 'USD' },
              compareAtPrice: null
            }
          ]
        }
      )
    })

    it('should use default currency when not specified in settings', async () => {
      const managerWithoutCurrency = new PricingManager(mockApiClient, integrationId, organizationId)
      jest.spyOn(managerWithoutCurrency as any, 'getOrCreatePriceList').mockResolvedValue('price-list-id')

      await managerWithoutCurrency.upsertPriceList('catalog-id', [mockPrices[0]])

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prices: expect.arrayContaining([
            expect.objectContaining({
              price: expect.objectContaining({ currencyCode: 'USD' })
            })
          ])
        })
      )
    })

    it('should handle zero prices correctly', async () => {
      const zeroPrices = [{ variantId: 'variant-free', price: 0 }]

      await pricingManager.upsertPriceList('catalog-id', zeroPrices)

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prices: expect.arrayContaining([
            expect.objectContaining({
              price: { amount: '0', currencyCode: 'USD' }
            })
          ])
        })
      )
    })

    it('should throw error when price update fails', async () => {
      const errorResponse = {
        data: {
          priceListFixedPricesAdd: {
            prices: [],
            userErrors: [{ field: 'price', message: 'Invalid price format' }]
          }
        }
      }
      mockApiClient.mutation.mockResolvedValue(errorResponse)

      await expect(pricingManager.upsertPriceList('catalog-id', mockPrices))
        .rejects.toThrow('Failed to update prices: Invalid price format')
    })

    it('should handle empty prices array', async () => {
      await pricingManager.upsertPriceList('catalog-id', [])

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prices: []
        })
      )
    })
  })

  describe('deletePrices', () => {
    const mockResponse = {
      data: {
        priceListFixedPricesDelete: {
          deletedFixedPriceVariantIds: ['variant-1', 'variant-2'],
          userErrors: []
        }
      }
    }

    beforeEach(() => {
      mockApiClient.mutation.mockResolvedValue(mockResponse)
    })

    it('should delete prices successfully', async () => {
      const variantIds = ['variant-1', 'variant-2']
      
      await pricingManager.deletePrices('price-list-id', variantIds)

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation deletePrices'),
        {
          priceListId: 'price-list-id',
          variantIds
        }
      )
    })

    it('should handle empty variant IDs array', async () => {
      await pricingManager.deletePrices('price-list-id', [])

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variantIds: []
        })
      )
    })

    it('should throw error when deletion fails', async () => {
      const errorResponse = {
        data: {
          priceListFixedPricesDelete: {
            deletedFixedPriceVariantIds: [],
            userErrors: [{ field: 'variantIds', message: 'Invalid variant IDs' }]
          }
        }
      }
      mockApiClient.mutation.mockResolvedValue(errorResponse)

      await expect(pricingManager.deletePrices('price-list-id', ['invalid-id']))
        .rejects.toThrow('Failed to delete prices: Invalid variant IDs')
    })
  })

  describe('assignCatalogToCustomers', () => {
    const mockResponse = {
      data: {
        catalogContextUpdate: {
          catalog: { id: 'catalog-id' },
          userErrors: []
        }
      }
    }

    beforeEach(() => {
      mockApiClient.mutation.mockResolvedValue(mockResponse)
    })

    it('should assign customers to catalog successfully', async () => {
      const customerIds = ['customer-1', 'customer-2']
      
      await pricingManager.assignCatalogToCustomers('catalog-id', customerIds)

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation assignCustomers'),
        {
          catalogId: 'catalog-id',
          customerIds
        }
      )
    })

    it('should handle single customer assignment', async () => {
      const customerIds = ['single-customer']
      
      await pricingManager.assignCatalogToCustomers('catalog-id', customerIds)

      expect(mockApiClient.mutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          customerIds: ['single-customer']
        })
      )
    })

    it('should throw error when assignment fails', async () => {
      const errorResponse = {
        data: {
          catalogContextUpdate: {
            catalog: null,
            userErrors: [{ field: 'customerIds', message: 'Invalid customer IDs' }]
          }
        }
      }
      mockApiClient.mutation.mockResolvedValue(errorResponse)

      await expect(pricingManager.assignCatalogToCustomers('catalog-id', ['invalid-id']))
        .rejects.toThrow('Failed to assign customers: Invalid customer IDs')
    })
  })

  describe('pushCustomerPricing', () => {
    const mockCustomerPrices = [
      {
        customer_id: 'customer-1',
        product_id: 'product-1',
        price: '10.99',
        original_price: '15.99',
        contract_id: 'contract-1',
        product: { external_id: 'shopify-product-1', sku: 'SKU001' }
      }
    ]

    beforeEach(() => {
      // Reset mock chain
      mockSupabaseClient.from.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.single.mockResolvedValue({ data: mockCustomerPrices, error: null })
      
      jest.spyOn(pricingManager as any, 'getOrCreateCustomerCatalog').mockResolvedValue('catalog-id')
      jest.spyOn(pricingManager as any, 'mapPricesToVariants').mockResolvedValue([
        { variantId: 'variant-1', price: 10.99, compareAtPrice: 15.99 }
      ])
      jest.spyOn(pricingManager, 'upsertPriceList').mockResolvedValue(undefined)
    })

    it('should push customer pricing successfully', async () => {
      await pricingManager.pushCustomerPricing('customer-1')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('customer_pricing')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('customer_id', 'customer-1')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true)
    })

    it('should handle no customer pricing found', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: null })
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await pricingManager.pushCustomerPricing('customer-1')

      expect(consoleSpy).toHaveBeenCalledWith('No customer-specific pricing found')
      consoleSpy.mockRestore()
    })

    it('should handle empty pricing array', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [] })
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await pricingManager.pushCustomerPricing('customer-1')

      expect(consoleSpy).toHaveBeenCalledWith('No customer-specific pricing found')
      consoleSpy.mockRestore()
    })

    it('should group prices by tier correctly', async () => {
      const multiTierPrices = [
        { ...mockCustomerPrices[0], contract_id: 'tier-1' },
        { ...mockCustomerPrices[0], contract_id: 'tier-2' },
        { ...mockCustomerPrices[0], contract_id: null } // default tier
      ]
      
      // Mock the chained query builder to return the data
      mockSupabaseClient.from.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.single.mockResolvedValue({ data: multiTierPrices, error: null })

      const getOrCreateSpy = jest.spyOn(pricingManager as any, 'getOrCreateCustomerCatalog')
      
      await pricingManager.pushCustomerPricing('customer-1')

      expect(getOrCreateSpy).toHaveBeenCalledWith('customer-1', 'tier-1')
      expect(getOrCreateSpy).toHaveBeenCalledWith('customer-1', 'tier-2')
      expect(getOrCreateSpy).toHaveBeenCalledWith('customer-1', 'default')
      expect(getOrCreateSpy).toHaveBeenCalledTimes(3)
    })

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      
      // Mock the chained query builder to throw an error
      mockSupabaseClient.from.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient)
      mockSupabaseClient.single.mockRejectedValue(dbError)

      await expect(pricingManager.pushCustomerPricing('customer-1')).rejects.toThrow('Database connection failed')
    })
  })

  // ... remaining private method tests unchanged ...
})