// PRP-014: Shopify B2B Pricing Manager
import { ShopifyApiClient } from './api-client'
import { ShopifyTransformers } from './transformers'
import type { 
  ShopifyCatalog,
  ShopifyPriceList,
  ShopifyPrice,
  ShopifyCatalogGroup,
  SyncResult,
  SyncOptions
} from '@/types/shopify.types'
import { createClient } from '@/lib/supabase/server'

export class PricingManager {
  private transformers: ShopifyTransformers
  private settings: { currency?: string }

  constructor(
    private client: ShopifyApiClient,
    private integrationId: string,
    private organizationId: string,
    settings?: { currency?: string }
  ) {
    this.transformers = new ShopifyTransformers()
    this.settings = settings || {}
  }

  /**
   * Sync B2B catalogs and price lists
   */
  async syncCatalogs(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now()
    let totalProcessed = 0
    let totalFailed = 0
    const errors: Error[] = []

    try {
      // Fetch catalogs
      const catalogs = await this.fetchCatalogs()
      
      // Process each catalog
      for (const catalog of catalogs) {
        try {
          if (options?.dryRun) {
            console.log('Dry run: Would sync catalog', {
              id: catalog.id,
              title: catalog.title
            })
          } else {
            await this.saveCatalog(catalog)
            
            // Sync associated price list if exists
            if (catalog.priceList) {
              await this.syncPriceList(catalog.priceList)
            }
          }
          totalProcessed++
        } catch (error) {
          totalFailed++
          errors.push(error as Error)
          console.error('Failed to sync catalog:', error)
        }
      }

      // Sync catalog groups
      const groups = await this.fetchCatalogGroups()
      for (const group of groups) {
        try {
          if (!options?.dryRun) {
            await this.saveCatalogGroup(group)
          }
          totalProcessed++
        } catch (error) {
          totalFailed++
          errors.push(error as Error)
        }
      }

      const duration = Date.now() - startTime
      return {
        success: totalFailed === 0,
        items_processed: totalProcessed,
        items_failed: totalFailed,
        duration_ms: duration,
        errors: errors.map(e => ({ message: e.message, code: 'PRICING_SYNC_ERROR' }))
      }
    } catch (error) {
      throw new Error(`Catalog sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create a new B2B catalog
   */
  async createCatalog(
    name: string,
    customerTierIds: string[]
  ): Promise<ShopifyCatalog> {
    const mutation = `
      mutation createCatalog($input: CatalogCreateInput!) {
        catalogCreate(catalog: $input) {
          catalog {
            id
            title
            status
            publication {
              id
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await this.client.mutation(mutation, {
      input: {
        title: name,
        status: 'ACTIVE'
      }
    })

    if (response.data?.catalogCreate.userErrors.length > 0) {
      throw new Error(`Failed to create catalog: ${response.data.catalogCreate.userErrors[0].message}`)
    }

    const catalog = response.data?.catalogCreate?.catalog
    
    if (!catalog) {
      throw new Error('Failed to create catalog: No catalog returned in response')
    }
    
    // Associate with customer groups
    if (customerTierIds.length > 0) {
      await this.assignCatalogToCustomers(catalog.id, customerTierIds)
    }

    return catalog
  }

  /**
   * Create or update a price list
   */
  async upsertPriceList(
    catalogId: string,
    prices: Array<{
      variantId: string
      price: number
      compareAtPrice?: number
    }>
  ): Promise<void> {
    const mutation = `
      mutation updatePrices($priceListId: ID!, $prices: [PriceListPriceInput!]!) {
        priceListFixedPricesAdd(
          priceListId: $priceListId
          prices: $prices
        ) {
          prices {
            variant {
              id
            }
            price {
              amount
              currencyCode
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    // Get or create price list for catalog
    const priceListId = await this.getOrCreatePriceList(catalogId)

    // Transform prices to Shopify format
    const shopifyPrices = prices.map(p => ({
      variantId: p.variantId,
      price: {
        amount: p.price.toString(),
        currencyCode: this.settings.currency || 'USD'
      },
      compareAtPrice: p.compareAtPrice ? {
        amount: p.compareAtPrice.toString(),
        currencyCode: this.settings.currency || 'USD'
      } : null
    }))

    const response = await this.client.mutation(mutation, {
      priceListId,
      prices: shopifyPrices
    })

    if (response.data?.priceListFixedPricesAdd.userErrors.length > 0) {
      throw new Error(`Failed to update prices: ${response.data.priceListFixedPricesAdd.userErrors[0].message}`)
    }
  }

  /**
   * Delete prices from a price list
   */
  async deletePrices(
    priceListId: string,
    variantIds: string[]
  ): Promise<void> {
    const mutation = `
      mutation deletePrices($priceListId: ID!, $variantIds: [ID!]!) {
        priceListFixedPricesDelete(
          priceListId: $priceListId
          variantIds: $variantIds
        ) {
          deletedFixedPriceVariantIds
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await this.client.mutation(mutation, {
      priceListId,
      variantIds
    })

    if (response.data?.priceListFixedPricesDelete.userErrors.length > 0) {
      throw new Error(`Failed to delete prices: ${response.data.priceListFixedPricesDelete.userErrors[0].message}`)
    }
  }

  /**
   * Assign catalog to customer groups
   */
  async assignCatalogToCustomers(
    catalogId: string,
    customerIds: string[]
  ): Promise<void> {
    const mutation = `
      mutation assignCustomers($catalogId: ID!, $customerIds: [ID!]!) {
        catalogContextUpdate(
          catalogId: $catalogId
          contextsToAdd: {
            companyLocationIds: $customerIds
          }
        ) {
          catalog {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await this.client.mutation(mutation, {
      catalogId,
      customerIds
    })

    if (response.data?.catalogContextUpdate.userErrors.length > 0) {
      throw new Error(`Failed to assign customers: ${response.data.catalogContextUpdate.userErrors[0].message}`)
    }
  }

  /**
   * Sync customer-specific pricing from TruthSource to Shopify
   */
  async pushCustomerPricing(customerId: string): Promise<void> {
    const supabase = await createClient()
    
    // Get customer pricing from TruthSource
    const { data: customerPrices } = await supabase
      .from('customer_pricing')
      .select(`
        *,
        product:products(
          external_id,
          sku
        )
      `)
      .eq('customer_id', customerId)
      .eq('organization_id', this.organizationId)
      .eq('is_active', true)

    if (!customerPrices || customerPrices.length === 0) {
      console.log('No customer-specific pricing found')
      return
    }

    // Group prices by catalog/tier
    const pricesByTier = new Map<string, typeof customerPrices>()
    
    for (const price of customerPrices) {
      const tierKey = price.contract_id || 'default'
      if (!pricesByTier.has(tierKey)) {
        pricesByTier.set(tierKey, [])
      }
      pricesByTier.get(tierKey)!.push(price)
    }

    // Update each price list
    for (const [tierKey, prices] of pricesByTier) {
      // Get or create catalog for this customer tier
      const catalogId = await this.getOrCreateCustomerCatalog(customerId, tierKey)
      
      // Map prices to Shopify variant IDs
      const shopifyPrices = await this.mapPricesToVariants(prices)
      
      // Update price list
      await this.upsertPriceList(catalogId, shopifyPrices)
    }
  }

  /**
   * Private helper methods
   */

  private async fetchCatalogs(): Promise<ShopifyCatalog[]> {
    const query = `
      query getCatalogs($cursor: String) {
        catalogs(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              status
              priceList {
                id
                name
                currency
              }
              publication {
                id
              }
            }
          }
        }
      }
    `

    const catalogs: ShopifyCatalog[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const response = await this.client.query(query, { cursor })
      const data = response.data?.catalogs

      if (!data || !data.edges) break

      catalogs.push(...data.edges.map((e: any) => e.node))
      hasNextPage = data.pageInfo?.hasNextPage || false
      cursor = data.pageInfo?.endCursor || null
    }

    return catalogs
  }

  private async fetchCatalogGroups(): Promise<ShopifyCatalogGroup[]> {
    // Fetch B2B companies and their locations as catalog groups (fix-45)
    const query = `
      query getCompanies($cursor: String) {
        companies(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              name
              externalId
              locations(first: 10) {
                edges {
                  node {
                    id
                    name
                    externalId
                    catalogs(first: 10) {
                      edges {
                        node {
                          id
                          title
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const groups: ShopifyCatalogGroup[] = []
    let cursor: string | null = null
    let hasNextPage = true

    try {
      while (hasNextPage) {
        const response = await this.client.query(query, { cursor })
        const data = response.data?.companies

        if (!data || !data.edges) break

        // Transform companies and their locations into catalog groups
        for (const edge of data.edges) {
          const company = edge?.node
          if (!company) continue
          
          // Add company as a group
          groups.push({
            id: company.id,
            name: company.name,
            external_id: company.externalId,
            type: 'company',
            catalog_ids: []
          })

          // Add company locations as groups
          if (company.locations?.edges) {
            for (const locEdge of company.locations.edges) {
              const location = locEdge.node
              const catalogIds = location.catalogs?.edges.map((e: any) => e.node.id) || []
              
              groups.push({
                id: location.id,
                name: `${company.name} - ${location.name}`,
                external_id: location.externalId,
                type: 'company_location',
                parent_id: company.id,
                catalog_ids: catalogIds
              })
            }
          }
        }

        hasNextPage = data.pageInfo?.hasNextPage || false
        cursor = data.pageInfo?.endCursor || null
      }
    } catch (error) {
      console.error('Failed to fetch catalog groups:', error)
      // Return partial results on error
    }
    
    return groups
  }

  private async syncPriceList(priceList: ShopifyPriceList): Promise<void> {
    const supabase = await createClient()
    
    // Fetch all prices in the price list
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const query = `
        query getPrices($priceListId: ID!, $cursor: String) {
          priceList(id: $priceListId) {
            prices(first: 250, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  variant {
                    id
                    sku
                  }
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      `

      const response = await this.client.query(query, {
        priceListId: priceList.id,
        cursor
      })

      const prices = response.data?.priceList?.prices
      if (!prices) break

      // Process prices
      for (const edge of prices.edges) {
        const priceData = this.transformers.transformPrice(edge.node)
        // Store price data as needed
      }

      hasNextPage = prices.pageInfo.hasNextPage
      cursor = prices.pageInfo.endCursor
    }
  }

  private async saveCatalog(catalog: ShopifyCatalog): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('shopify_b2b_catalogs')
      .upsert({
        integration_id: this.integrationId,
        organization_id: this.organizationId,
        shopify_catalog_id: catalog.id,
        name: catalog.title,
        status: catalog.status.toLowerCase(),
        price_list_id: catalog.priceList?.id,
        updated_at: new Date().toISOString()
      })
  }

  private async saveCatalogGroup(group: ShopifyCatalogGroup): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('shopify_catalog_groups')
      .upsert({
        integration_id: this.integrationId,
        organization_id: this.organizationId,
        shopify_group_id: group.id,
        catalog_id: group.catalogId,
        name: group.name,
        updated_at: new Date().toISOString()
      })
  }

  private async getOrCreatePriceList(catalogId: string): Promise<string> {
    // Check if catalog has a price list
    const query = `
      query getCatalog($id: ID!) {
        catalog(id: $id) {
          priceList {
            id
          }
        }
      }
    `

    const response = await this.client.query(query, { id: catalogId })
    
    if (response.data?.catalog?.priceList?.id) {
      return response.data.catalog.priceList.id
    }

    // Create new price list
    const mutation = `
      mutation createPriceList($input: PriceListCreateInput!) {
        priceListCreate(priceList: $input) {
          priceList {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const createResponse = await this.client.mutation(mutation, {
      input: {
        name: `Price List for Catalog ${catalogId}`,
        currency: this.settings.currency || 'USD',
        parent: {
          adjustment: {
            type: 'PERCENTAGE_DECREASE',
            value: 0
          }
        }
      }
    })

    if (createResponse.data?.priceListCreate.userErrors.length > 0) {
      throw new Error(`Failed to create price list: ${createResponse.data.priceListCreate.userErrors[0].message}`)
    }

    return createResponse.data.priceListCreate.priceList.id
  }

  private async getOrCreateCustomerCatalog(
    customerId: string, 
    tierKey: string
  ): Promise<string> {
    const supabase = await createClient()
    
    // Check if catalog exists for this customer/tier (fix-57: correct JSON path syntax)
    const { data: existing } = await supabase
      .from('shopify_b2b_catalogs')
      .select('shopify_catalog_id')
      .eq('integration_id', this.integrationId)
      .eq('organization_id', this.organizationId)
      .filter('metadata->customer_id', 'eq', customerId)
      .filter('metadata->tier_key', 'eq', tierKey)
      .single()

    if (existing?.shopify_catalog_id) {
      return existing.shopify_catalog_id
    }

    // Create new catalog
    const catalog = await this.createCatalog(
      `Customer ${customerId} - ${tierKey}`,
      [] // Customer assignment handled separately
    )

    // Save mapping
    await supabase
      .from('shopify_b2b_catalogs')
      .insert({
        integration_id: this.integrationId,
        organization_id: this.organizationId,
        shopify_catalog_id: catalog.id,
        name: catalog.title,
        status: catalog.status.toLowerCase(),
        metadata: {
          customer_id: customerId,
          tier_key: tierKey
        }
      })

    return catalog.id
  }

  private async mapPricesToVariants(
    prices: any[]
  ): Promise<Array<{ variantId: string; price: number; compareAtPrice?: number }>> {
    const supabase = await createClient()
    const mapped = []

    // Get all product IDs that need mapping
    const productIds = prices
      .filter(price => price.product?.external_id)
      .map(price => price.product_id)

    if (productIds.length === 0) return mapped

    // Fetch all mappings in a single query
    const { data: mappings } = await supabase
      .from('shopify_product_mapping')
      .select('shopify_variant_id, internal_product_id')
      .eq('integration_id', this.integrationId)
      .eq('organization_id', this.organizationId)
      .in('internal_product_id', productIds)

    // Create a map for quick lookup
    const mappingMap = new Map(
      (mappings || []).map(m => [m.internal_product_id, m.shopify_variant_id])
    )

    // Map prices using the lookup map
    for (const price of prices) {
      if (!price.product?.external_id) continue

      const variantId = mappingMap.get(price.product_id)
      if (variantId) {
        mapped.push({
          variantId,
          price: parseFloat(price.price),
          compareAtPrice: price.original_price ? parseFloat(price.original_price) : undefined
        })
      }
    }

    return mapped
  }
}