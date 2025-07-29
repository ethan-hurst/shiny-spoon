// PRP-014: Shopify Connector Implementation
import { createClient } from '@/lib/supabase/server'
import { BaseConnector } from '../base-connector'
import { ShopifyAuth } from './auth'
import { ShopifyApiClient } from './api-client'
import { ShopifyTransformers } from './transformers'

// Types
import type { ConnectorConfig, SyncOptions, SyncResult } from '../base-connector'
import { IntegrationError, type IntegrationPlatformType } from '@/types/integration.types'
import type { ShopifyIntegrationSettings } from '@/types/shopify.types'

export class ShopifyConnector extends BaseConnector {
  private auth: ShopifyAuth
  private client: ShopifyApiClient
  private transformers: ShopifyTransformers
  private supabase = createClient()
  private shopifyConfig: ShopifyIntegrationSettings

  get platform(): IntegrationPlatformType {
    return 'shopify'
  }

  constructor(config: ConnectorConfig) {
    super(config)
    
    // Parse Shopify-specific config
    this.shopifyConfig = config.settings as ShopifyIntegrationSettings
    
    // Initialize components
    this.auth = new ShopifyAuth(
      config.integrationId,
      config.organizationId,
      {
        shop_domain: this.shopifyConfig.shop_domain,
        access_token: this.shopifyConfig.access_token,
        api_version: this.shopifyConfig.api_version || '2024-01',
      }
    )
    
    this.client = new ShopifyApiClient(
      this.auth,
      {
        shop_domain: this.shopifyConfig.shop_domain,
        access_token: this.shopifyConfig.access_token,
        api_version: this.shopifyConfig.api_version || '2024-01',
      },
      this.rateLimiter
    )
    
    this.transformers = new ShopifyTransformers({
      field_mappings: this.shopifyConfig.field_mappings,
      location_mappings: this.shopifyConfig.location_mappings,
      default_currency: 'USD',
      weight_unit_conversion: 'grams',
    })
  }

  async authenticate(): Promise<void> {
    try {
      this.logger.info('Authenticating with Shopify')
      
      // Initialize auth with stored credentials
      await this.auth.initialize()
      
      // Test authentication by getting shop info
      await this.auth.getShopInfo()
      
      this.emit('authenticated', { integrationId: this.config.integrationId })
      this.logger.info('Shopify authentication successful')
    } catch (error) {
      this.handleError(error, 'Authentication failed')
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      this.logger.debug('Testing Shopify connection')
      
      // Get shop info to test connectivity
      const shopInfo = await this.auth.getShopInfo()
      
      this.logger.info('Shopify connection test successful', { shopName: shopInfo.name })
      return !!shopInfo.id
    } catch (error) {
      this.logger.error('Shopify connection test failed', { error })
      return false
    }
  }

  async syncProducts(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting Shopify product sync', options)
        
        // Get sync state
        const syncState = await this.getSyncState('product')
        const lastSyncDate = syncState?.last_sync_date || new Date(0)
        
        // Build query options
        const queryOptions: any = {
          limit: options?.limit || 250,
          status: 'active',
        }

        // Add date filter for incremental sync
        if (options?.filters?.updated_at_min || lastSyncDate > new Date(0)) {
          queryOptions.updated_at_min = options?.filters?.updated_at_min || 
            lastSyncDate.toISOString()
        }

        let hasMore = true
        let nextPageInfo: string | undefined = options?.cursor

        while (hasMore) {
          try {
            // Get products from Shopify
            const result = await this.client.getProducts({
              ...queryOptions,
              since_id: nextPageInfo ? undefined : options?.filters?.since_id,
            })

            // Process each product
            for (const shopifyProduct of result.products) {
              try {
                // Transform to internal format
                const transformedProduct = this.transformers.transformProduct(shopifyProduct)
                
                // Save to database
                await this.saveProduct(transformedProduct)
                
                totalProcessed++
                this.emitProgress(totalProcessed, totalProcessed + result.products.length)
              } catch (error) {
                totalFailed++
                errors.push({
                  item_id: shopifyProduct.id?.toString(),
                  error: error instanceof Error ? error.message : 'Unknown error',
                  details: error,
                })
                this.logger.error('Failed to process product', {
                  productId: shopifyProduct.id,
                  error,
                })
              }
            }

            hasMore = result.hasNextPage
            nextPageInfo = result.nextPageInfo

            // Update sync state
            await this.updateSyncState('product', {
              last_sync_date: new Date().toISOString(),
              next_cursor: nextPageInfo,
              items_processed: totalProcessed,
              items_failed: totalFailed,
            })

          } catch (error) {
            this.logger.error('Failed to fetch products batch', { error })
            throw error
          }
        }

        const duration = Date.now() - startTime
        this.logger.info('Shopify product sync completed', {
          totalProcessed,
          totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
          next_cursor: nextPageInfo,
          summary: {
            duration,
            last_sync_date: new Date().toISOString(),
          },
        }
      } catch (error) {
        this.handleError(error, 'Product sync failed')
        throw error
      }
    })
  }

  async syncInventory(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting Shopify inventory sync', options)
        
        // Get sync state
        const syncState = await this.getSyncState('inventory')
        const lastSyncDate = syncState?.last_sync_date || new Date(0)
        
        // Get locations first
        const locations = await this.auth.getLocations()
        const locationIds = locations.map(loc => loc.id)

        // Build query options
        const queryOptions: any = {
          limit: options?.limit || 250,
        }

        // Add date filter for incremental sync
        if (options?.filters?.updated_at_min || lastSyncDate > new Date(0)) {
          queryOptions.updated_at_min = options?.filters?.updated_at_min || 
            lastSyncDate.toISOString()
        }

        let hasMore = true
        let nextPageInfo: string | undefined = options?.cursor

        while (hasMore) {
          try {
            // Get inventory levels from Shopify
            const result = await this.client.getInventoryLevels({
              ...queryOptions,
              location_ids: locationIds,
            })

            // Process each inventory level
            for (const shopifyInventory of result.inventory_levels) {
              try {
                // Transform to internal format
                const transformedInventory = this.transformers.transformInventoryLevel(shopifyInventory)
                
                // Save to database
                await this.updateInventory(transformedInventory)
                
                totalProcessed++
                this.emitProgress(totalProcessed, totalProcessed + result.inventory_levels.length)
              } catch (error) {
                totalFailed++
                errors.push({
                  item_id: shopifyInventory.id?.toString(),
                  error: error instanceof Error ? error.message : 'Unknown error',
                  details: error,
                })
                this.logger.error('Failed to process inventory level', {
                  inventoryId: shopifyInventory.id,
                  error,
                })
              }
            }

            hasMore = result.hasNextPage
            nextPageInfo = result.nextPageInfo

            // Update sync state
            await this.updateSyncState('inventory', {
              last_sync_date: new Date().toISOString(),
              next_cursor: nextPageInfo,
              items_processed: totalProcessed,
              items_failed: totalFailed,
            })

          } catch (error) {
            this.logger.error('Failed to fetch inventory batch', { error })
            throw error
          }
        }

        const duration = Date.now() - startTime
        this.logger.info('Shopify inventory sync completed', {
          totalProcessed,
          totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
          next_cursor: nextPageInfo,
          summary: {
            duration,
            last_sync_date: new Date().toISOString(),
          },
        }
      } catch (error) {
        this.handleError(error, 'Inventory sync failed')
        throw error
      }
    })
  }

  async syncPricing(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting Shopify pricing sync', options)
        
        // Check if B2B features are available
        const hasB2B = await this.auth.hasB2BFeatures()
        if (!hasB2B) {
          this.logger.warn('Shopify B2B features not available, skipping pricing sync')
          return {
            success: true,
            items_processed: 0,
            items_failed: 0,
            items_skipped: 0,
            errors: [],
            summary: {
              b2b_not_available: true,
            },
          }
        }

        // Get price lists
        const priceListsResult = await this.client.getPriceLists()
        
        for (const priceList of priceListsResult.price_lists) {
          try {
            // Transform and save price list
            const transformedPriceList = {
              id: priceList.id?.toString(),
              external_id: priceList.id?.toString(),
              name: priceList.name,
              currency: priceList.currency,
              prices: priceList.prices || [],
              created_at: priceList.created_at,
              updated_at: priceList.updated_at,
            }
            
            await this.savePriceList(transformedPriceList)
            totalProcessed++
          } catch (error) {
            totalFailed++
            errors.push({
              item_id: priceList.id?.toString(),
              error: error instanceof Error ? error.message : 'Unknown error',
              details: error,
            })
          }
        }

        const duration = Date.now() - startTime
        this.logger.info('Shopify pricing sync completed', {
          totalProcessed,
          totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
          summary: {
            duration,
            b2b_available: true,
          },
        }
      } catch (error) {
        this.handleError(error, 'Pricing sync failed')
        throw error
      }
    })
  }

  async syncCustomers(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting Shopify customer sync', options)
        
        // Get sync state
        const syncState = await this.getSyncState('customer')
        const lastSyncDate = syncState?.last_sync_date || new Date(0)
        
        // Build query options
        const queryOptions: any = {
          limit: options?.limit || 250,
        }

        // Add date filter for incremental sync
        if (options?.filters?.updated_at_min || lastSyncDate > new Date(0)) {
          queryOptions.updated_at_min = options?.filters?.updated_at_min || 
            lastSyncDate.toISOString()
        }

        let hasMore = true
        let nextPageInfo: string | undefined = options?.cursor

        while (hasMore) {
          try {
            // Get customers from Shopify
            const result = await this.client.getCustomers(queryOptions)

            // Process each customer
            for (const shopifyCustomer of result.customers) {
              try {
                // Transform to internal format
                const transformedCustomer = this.transformers.transformCustomer(shopifyCustomer)
                
                // Save to database
                await this.saveCustomer(transformedCustomer)
                
                totalProcessed++
                this.emitProgress(totalProcessed, totalProcessed + result.customers.length)
              } catch (error) {
                totalFailed++
                errors.push({
                  item_id: shopifyCustomer.id?.toString(),
                  error: error instanceof Error ? error.message : 'Unknown error',
                  details: error,
                })
                this.logger.error('Failed to process customer', {
                  customerId: shopifyCustomer.id,
                  error,
                })
              }
            }

            hasMore = result.hasNextPage
            nextPageInfo = result.nextPageInfo

            // Update sync state
            await this.updateSyncState('customer', {
              last_sync_date: new Date().toISOString(),
              next_cursor: nextPageInfo,
              items_processed: totalProcessed,
              items_failed: totalFailed,
            })

          } catch (error) {
            this.logger.error('Failed to fetch customers batch', { error })
            throw error
          }
        }

        const duration = Date.now() - startTime
        this.logger.info('Shopify customer sync completed', {
          totalProcessed,
          totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
          next_cursor: nextPageInfo,
          summary: {
            duration,
            last_sync_date: new Date().toISOString(),
          },
        }
      } catch (error) {
        this.handleError(error, 'Customer sync failed')
        throw error
      }
    })
  }

  async syncOrders(options?: SyncOptions): Promise<SyncResult> {
    return this.withRetry(async () => {
      const startTime = Date.now()
      let totalProcessed = 0
      let totalFailed = 0
      const errors: Array<{ item_id?: string; error: string; details?: any }> = []

      try {
        this.logger.info('Starting Shopify order sync', options)
        
        // Get sync state
        const syncState = await this.getSyncState('order')
        const lastSyncDate = syncState?.last_sync_date || new Date(0)
        
        // Build query options
        const queryOptions: any = {
          limit: options?.limit || 250,
          status: 'any',
        }

        // Add date filter for incremental sync
        if (options?.filters?.updated_at_min || lastSyncDate > new Date(0)) {
          queryOptions.updated_at_min = options?.filters?.updated_at_min || 
            lastSyncDate.toISOString()
        }

        let hasMore = true
        let nextPageInfo: string | undefined = options?.cursor

        while (hasMore) {
          try {
            // Get orders from Shopify
            const result = await this.client.getOrders(queryOptions)

            // Process each order
            for (const shopifyOrder of result.orders) {
              try {
                // Transform to internal format
                const transformedOrder = this.transformers.transformOrder(shopifyOrder)
                
                // Save to database
                await this.saveOrder(transformedOrder)
                
                totalProcessed++
                this.emitProgress(totalProcessed, totalProcessed + result.orders.length)
              } catch (error) {
                totalFailed++
                errors.push({
                  item_id: shopifyOrder.id?.toString(),
                  error: error instanceof Error ? error.message : 'Unknown error',
                  details: error,
                })
                this.logger.error('Failed to process order', {
                  orderId: shopifyOrder.id,
                  error,
                })
              }
            }

            hasMore = result.hasNextPage
            nextPageInfo = result.nextPageInfo

            // Update sync state
            await this.updateSyncState('order', {
              last_sync_date: new Date().toISOString(),
              next_cursor: nextPageInfo,
              items_processed: totalProcessed,
              items_failed: totalFailed,
            })

          } catch (error) {
            this.logger.error('Failed to fetch orders batch', { error })
            throw error
          }
        }

        const duration = Date.now() - startTime
        this.logger.info('Shopify order sync completed', {
          totalProcessed,
          totalFailed,
          duration,
        })

        return {
          success: totalFailed === 0,
          items_processed: totalProcessed,
          items_failed: totalFailed,
          items_skipped: 0,
          errors,
          next_cursor: nextPageInfo,
          summary: {
            duration,
            last_sync_date: new Date().toISOString(),
          },
        }
      } catch (error) {
        this.handleError(error, 'Order sync failed')
        throw error
      }
    })
  }

  // Private helper methods

  private async getSyncState(entityType: string) {
    const { data } = await this.supabase
      .from('sync_states')
      .select('*')
      .eq('integration_id', this.config.integrationId)
      .eq('entity_type', entityType)
      .single()

    return data
  }

  private async updateSyncState(entityType: string, updates: any) {
    const { error } = await this.supabase
      .from('sync_states')
      .upsert({
        integration_id: this.config.integrationId,
        entity_type: entityType,
        ...updates,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      this.logger.error('Failed to update sync state', { error, entityType })
    }
  }

  private async saveProduct(product: any) {
    const { error } = await this.supabase
      .from('products')
      .upsert({
        ...product,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      throw new Error(`Failed to save product: ${error.message}`)
    }
  }

  private async updateInventory(inventory: any) {
    const { error } = await this.supabase
      .from('inventory')
      .upsert({
        ...inventory,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      throw new Error(`Failed to update inventory: ${error.message}`)
    }
  }

  private async saveCustomer(customer: any) {
    const { error } = await this.supabase
      .from('customers')
      .upsert({
        ...customer,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      throw new Error(`Failed to save customer: ${error.message}`)
    }
  }

  private async saveOrder(order: any) {
    const { error } = await this.supabase
      .from('orders')
      .upsert({
        ...order,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      throw new Error(`Failed to save order: ${error.message}`)
    }
  }

  private async savePriceList(priceList: any) {
    const { error } = await this.supabase
      .from('price_lists')
      .upsert({
        ...priceList,
        organization_id: this.config.organizationId,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      throw new Error(`Failed to save price list: ${error.message}`)
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    try {
      this.logger.info('Processing Shopify webhook', { 
        topic: payload.topic,
        resourceId: payload.id 
      })

      switch (payload.topic) {
        case 'products/create':
        case 'products/update':
          await this.handleProductWebhook(payload)
          break
        case 'inventory_levels/update':
          await this.handleInventoryWebhook(payload)
          break
        case 'orders/create':
        case 'orders/updated':
          await this.handleOrderWebhook(payload)
          break
        case 'customers/create':
        case 'customers/update':
          await this.handleCustomerWebhook(payload)
          break
        default:
          this.logger.warn('Unhandled webhook topic', { topic: payload.topic })
      }
    } catch (error) {
      this.logger.error('Webhook processing failed', { error, payload })
      throw error
    }
  }

  private async handleProductWebhook(payload: any) {
    const product = await this.client.getProduct(payload.id.toString())
    const transformedProduct = this.transformers.transformProduct(product)
    await this.saveProduct(transformedProduct)
  }

  private async handleInventoryWebhook(payload: any) {
    const transformedInventory = this.transformers.transformInventoryLevel(payload)
    await this.updateInventory(transformedInventory)
  }

  private async handleOrderWebhook(payload: any) {
    const order = await this.client.getOrders({ since_id: payload.id })
    if (order.orders.length > 0) {
      const transformedOrder = this.transformers.transformOrder(order.orders[0])
      await this.saveOrder(transformedOrder)
    }
  }

  private async handleCustomerWebhook(payload: any) {
    const customer = await this.client.getCustomers({ since_id: payload.id })
    if (customer.customers.length > 0) {
      const transformedCustomer = this.transformers.transformCustomer(customer.customers[0])
      await this.saveCustomer(transformedCustomer)
    }
  }
}